using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Portfolio.Api.Data;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Amazon.Runtime;
using Amazon.Runtime.CredentialManagement;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

// Prevent claim type mapping (keep "sub" as "sub", not transform to ClaimTypes.NameIdentifier)
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

// Prefer explicit environment variable `ConnectionStrings__Postgres` when present (runtime secrets injection)
var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Postgres")
    ?? builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Connection string 'Postgres' is not configured.");

builder.Services.AddCors(options =>
{
    options.AddPolicy("AppCors", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            var uri = new Uri(origin);
            // Allow all subdomains of healthdots.net + localhost for dev
            return uri.Host.EndsWith("healthdots.net") || uri.Host == "localhost";
        })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
});

// Configure AWS Cognito JWT authentication
var cognitoAuthority = builder.Configuration["Aws:Cognito:Authority"];
var cognitoAudience = builder.Configuration.GetSection("Aws:Cognito:Audience").Get<string[]>();

// Enable JWT Bearer authentication in ALL environments.
// ECS tasks now run in public subnets with internet access, allowing direct validation
// of JWT tokens against Cognito's JWKS endpoint without requiring VPC endpoints or NAT gateway.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = cognitoAuthority;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = cognitoAuthority,
            ValidateAudience = true,
            ValidAudiences = cognitoAudience,
            ValidateLifetime = true
        };
    });

builder.Services.AddAuthorization(options =>
{
    // Require authenticated users unless a specific endpoint opts out via [AllowAnonymous] or a custom policy.
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Register AWS clients. Pick up region from configuration if provided so clients can be constructed
// with a RegionEndpoint to avoid runtime errors when no default region is present in the environment.
// Ensure the SDK will load profiles from shared config (supports SSO profiles)
Environment.SetEnvironmentVariable("AWS_SDK_LOAD_CONFIG", "1");

var awsRegionName = builder.Configuration["Aws:Region"];
var awsProfileName = builder.Configuration["Aws:Profile"] ?? Environment.GetEnvironmentVariable("AWS_PROFILE");
Amazon.RegionEndpoint? awsRegion = null;
if (!string.IsNullOrWhiteSpace(awsRegionName))
{
    awsRegion = Amazon.RegionEndpoint.GetBySystemName(awsRegionName);
}

AWSCredentials? awsCredentials = null;
if (!string.IsNullOrWhiteSpace(awsProfileName))
{
    try
    {
        var chain = new CredentialProfileStoreChain();
        if (chain.TryGetAWSCredentials(awsProfileName, out var resolved))
        {
            awsCredentials = resolved;
        }
    }
    catch
    {
        // If profile lookup fails, leave credentials null so the SDK falls back to other sources.
    }
}

var s3Client = awsCredentials is not null
    ? (awsRegion is not null ? new Amazon.S3.AmazonS3Client(awsCredentials, awsRegion) : new Amazon.S3.AmazonS3Client(awsCredentials))
    : (awsRegion is not null ? new Amazon.S3.AmazonS3Client(awsRegion) : new Amazon.S3.AmazonS3Client());

var ssmClient = awsCredentials is not null
    ? (awsRegion is not null ? new AmazonSimpleSystemsManagementClient(awsCredentials, awsRegion) : new AmazonSimpleSystemsManagementClient(awsCredentials))
    : (awsRegion is not null ? new AmazonSimpleSystemsManagementClient(awsRegion) : new AmazonSimpleSystemsManagementClient());

builder.Services.AddSingleton<Amazon.S3.IAmazonS3>(s3Client);
builder.Services.AddSingleton<IAmazonSimpleSystemsManagement>(ssmClient);
var dynamoClient = awsCredentials is not null
    ? (awsRegion is not null ? new Amazon.DynamoDBv2.AmazonDynamoDBClient(awsCredentials, awsRegion) : new Amazon.DynamoDBv2.AmazonDynamoDBClient(awsCredentials))
    : (awsRegion is not null ? new Amazon.DynamoDBv2.AmazonDynamoDBClient(awsRegion) : new Amazon.DynamoDBv2.AmazonDynamoDBClient());

builder.Services.AddSingleton<Amazon.DynamoDBv2.IAmazonDynamoDB>(dynamoClient);
// Register DynamoDB cache service
builder.Services.AddSingleton<Portfolio.Api.Services.IDynamoCacheService, Portfolio.Api.Services.DynamoCacheService>();
builder.Services.AddScoped<Portfolio.Api.Services.IS3Service, Portfolio.Api.Services.S3Service>();
// Memory cache and token provider for GitHub Models API token caching
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<Portfolio.Api.Services.IGitHubModelsTokenProvider, Portfolio.Api.Services.GitHubModelsTokenProvider>();

// Register ShortIdGenerator for Portfolio ID generation; prefer Parameter Store salt if configured
builder.Services.AddSingleton<Portfolio.Api.Services.IShortIdGenerator>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var logger = sp.GetRequiredService<ILogger<Portfolio.Api.Services.ShortIdGenerator>>();
    var salt = config["Hashids:Salt"] ?? "portfolio-app-default-salt";
    var parameterName = config["Hashids:ParameterName"];
    // Log the effective parameter name resolved from configuration for easier debugging
    logger.LogInformation("Resolved Hashids:ParameterName = {ParameterName}", parameterName ?? "(null)");

    if (!string.IsNullOrWhiteSpace(parameterName))
    {
        try
        {
            var ssm = sp.GetRequiredService<IAmazonSimpleSystemsManagement>();
            var response = ssm.GetParameterAsync(new GetParameterRequest
            {
                Name = parameterName,
                WithDecryption = true
            }).GetAwaiter().GetResult();

            if (!string.IsNullOrWhiteSpace(response.Parameter?.Value))
            {
                salt = response.Parameter.Value;
            }
            else
            {
                logger.LogWarning("Parameter {ParameterName} returned empty; using configured Hashids:Salt.", parameterName);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch Hashids salt from SSM parameter {ParameterName}; using configured Hashids:Salt.", parameterName);
        }
    }

    return new Portfolio.Api.Services.ShortIdGenerator(salt, logger);
});
builder.Services.AddScoped<Portfolio.Api.Services.ICurrentUserProvider, Portfolio.Api.Services.CurrentUserProvider>();
builder.Services.AddScoped<Portfolio.Api.Services.IVersionService, Portfolio.Api.Services.VersionService>();
builder.Services.AddScoped<Portfolio.Api.Services.ILocaleValidator, Portfolio.Api.Services.LocaleValidator>();

// GitHub Models service registration: prefer env var for API token (runtime secrets injection)
var gitHubModelsApiToken = Environment.GetEnvironmentVariable("GitHubModels__ApiToken")
    ?? builder.Configuration["GitHubModels:ApiToken"];

// Register a named HttpClient with a retry handler and scoped service that uses IHttpClientFactory.
builder.Services.AddTransient<Portfolio.Api.Services.GitHubModelsRetryHandler>();
// Named client "GitHubModels" centralizes default headers, base address and timeout.
builder.Services.AddHttpClient("GitHubModels", client =>
{
    var baseUrl = builder.Configuration["GitHubModels:BaseUrl"];
    if (!string.IsNullOrWhiteSpace(baseUrl))
    {
        try { client.BaseAddress = new Uri(baseUrl); } catch { }
    }
    // Default headers common to GitHub Models / inference hosts
    try { client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json"); } catch { }
    try { client.DefaultRequestHeaders.UserAgent.ParseAdd("Portfolio.Api/1.0"); } catch { }
    
    // Add Authorization header if token is present
    if (!string.IsNullOrWhiteSpace(gitHubModelsApiToken))
    {
        try { client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", gitHubModelsApiToken); } catch { }
    }
    
    // Increase default timeout for potentially long model generation calls
    client.Timeout = TimeSpan.FromSeconds(builder.Configuration.GetValue<int>("GitHubModels:TimeoutSeconds", 120));
})
.AddHttpMessageHandler<Portfolio.Api.Services.GitHubModelsRetryHandler>();

builder.Services.AddScoped<Portfolio.Api.Services.IGitHubModelsService, Portfolio.Api.Services.GitHubModelsService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Portfolio API",
        Version = "v1"
    });
    
    // Add JWT authentication to Swagger
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Log credential resolution for easier debugging in dev
try
{
    var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
    startupLogger.LogInformation("Aws:Region={Region}, Aws:Profile={Profile}, CredentialsResolved={Resolved}", awsRegionName ?? "(none)", awsProfileName ?? "(none)", awsCredentials is not null);
}
catch
{
    // swallow logging errors during startup diagnostic logging
}

if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Beta"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Configure forwarded headers for running behind a proxy (ALB/CloudFront)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
});

// Global exception handler: catch unexpected exceptions, log them, and return
// a minimal 500 response. Placed early to capture errors from downstream middleware.
app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    try
    {
        await next();

        // If downstream set a 5xx status without throwing, log it for visibility
        if (context.Response.StatusCode >= 500)
        {
            logger.LogError("Request completed with server error status {StatusCode} for {Method} {Path}", context.Response.StatusCode, context.Request.Method, context.Request.Path);
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Unhandled exception processing request {Method} {Path}", context.Request.Method, context.Request.Path);

        if (!context.Response.HasStarted)
        {
            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            var payload = System.Text.Json.JsonSerializer.Serialize(new { error = "An unexpected error occurred." });
            await context.Response.WriteAsync(payload);
        }

        // Do not rethrow; we handled and logged the exception.
    }
});

// Add request logging middleware to diagnose slow or hanging requests
app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    var stopwatch = System.Diagnostics.Stopwatch.StartNew();
    logger.LogInformation("→ {Method} {Path}", context.Request.Method, context.Request.Path);
    
    try
    {
        await next.Invoke();
        stopwatch.Stop();
        logger.LogInformation("← {Method} {Path} - {StatusCode} ({ElapsedMs}ms)", 
            context.Request.Method, context.Request.Path, context.Response.StatusCode, stopwatch.ElapsedMilliseconds);
    }
    catch (Exception)
    {
        // Let the global exception handler capture and log the exception.
        stopwatch.Stop();
        throw;
    }
});

// Respect a path base injected by the ALB (e.g. "/portfolio-beta/content") so existing controllers
// with routes like "api/[controller]" continue to work without changes.
var pathBase = Environment.GetEnvironmentVariable("PATH_BASE") ?? app.Configuration["PathBase"];
if (!string.IsNullOrEmpty(pathBase))
{
    try
    {
        var logger = app.Services.GetRequiredService<ILogger<Program>>();
        logger.LogInformation("Setting PathBase to {PathBase}", pathBase);
    }
    catch { }

    app.UsePathBase(new Microsoft.AspNetCore.Http.PathString(pathBase));
}

// HTTPS redirect is handled at the ALB level (which terminates HTTPS and forwards HTTP to container).
// The app receives X-Forwarded-Proto: https header from the ALB for detection.
// Skip UseHttpsRedirection() to avoid "Failed to determine https port" errors when running behind ALB.
// app.UseHttpsRedirection();

// Enable routing before applying CORS so the CORS middleware can run with endpoint routing
app.UseRouting();

app.UseCors("AppCors");

app.UseAuthentication();

// Ensure authenticated users exist in DB (JIT provisioning)
app.UseMiddleware<Portfolio.Api.Middleware.EnsureUserExistsMiddleware>();

app.UseAuthorization();

app.MapControllers();

app.Run();