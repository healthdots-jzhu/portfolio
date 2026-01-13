using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Portfolio.Api.Data;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
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

// Register AWS clients (region from config)
var awsRegion = builder.Configuration["Aws:Region"] ?? "us-east-1";
builder.Services.AddSingleton<Amazon.S3.IAmazonS3>(new Amazon.S3.AmazonS3Client(Amazon.RegionEndpoint.GetBySystemName(awsRegion)));
builder.Services.AddSingleton<IAmazonSimpleSystemsManagement>(new AmazonSimpleSystemsManagementClient(Amazon.RegionEndpoint.GetBySystemName(awsRegion)));
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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AppCors");

app.UseAuthentication();

// Ensure authenticated users exist in DB (JIT provisioning)
app.UseMiddleware<Portfolio.Api.Middleware.EnsureUserExistsMiddleware>();

app.UseAuthorization();

app.MapControllers();

app.Run();