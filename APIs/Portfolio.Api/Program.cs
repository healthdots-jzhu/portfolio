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

// Prevent claim type mapping (keep "sub" as "sub", not transform to ClaimTypes.NameIdentifier)
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Postgres")
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
builder.Services.AddScoped<Portfolio.Api.Services.IS3Service, Portfolio.Api.Services.S3Service>();

// Register ShortIdGenerator for Portfolio ID generation; prefer Parameter Store salt if configured
builder.Services.AddSingleton<Portfolio.Api.Services.IShortIdGenerator>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var logger = sp.GetRequiredService<ILogger<Portfolio.Api.Services.ShortIdGenerator>>();
    var salt = config["Hashids:Salt"] ?? "portfolio-app-default-salt";
    var parameterName = config["Hashids:ParameterName"];

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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Enable routing before applying CORS so the CORS middleware can run with endpoint routing
app.UseRouting();

app.UseCors("AppCors");

app.UseAuthentication();

// Ensure authenticated users exist in DB (JIT provisioning)
app.UseMiddleware<Portfolio.Api.Middleware.EnsureUserExistsMiddleware>();

app.UseAuthorization();

app.MapControllers();

app.Run();