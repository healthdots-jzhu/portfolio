# Start Portfolio platform for local development
# Supports multiple modes:
# 1. Full Docker stack (all services containerized)
# 2. Local API with Docker services (PostgreSQL, MinIO, DynamoDB in Docker)
# 3. Full local (requires manual service startup)

param(
    [ValidateSet("docker", "hybrid", "local")]
    [string]$Mode = "docker",
    
    [switch]$SkipMigrations = $false,
    [switch]$SkipBuild = $false,
    [switch]$FrontendOnly = $false,
    [switch]$ApiOnly = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║  Portfolio Local Development Environment                      ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"
Write-Host ""

Write-Host "Configuration:"
Write-Host "  Mode: $Mode"
Write-Host "  Skip Migrations: $SkipMigrations"
Write-Host "  Skip Build: $SkipBuild"
Write-Host ""

# Check Docker
if ($Mode -eq "docker" -or $Mode -eq "hybrid") {
    Write-Host "🔍 Checking Docker..."
    try {
        docker ps 2>&1 | Select-Object -First 1 | Out-Null
        Write-Host "✅ Docker is running"
    } catch {
        Write-Host "❌ Docker is required for this mode but not running"
        exit 1
    }
}

# Start Docker services if needed
if ($Mode -eq "docker" -or $Mode -eq "hybrid") {
    Write-Host ""
    Write-Host "🐳 Starting Docker services..."
    
    if ($Mode -eq "docker") {
        Write-Host "Starting: PostgreSQL, MinIO, DynamoDB, API, Frontend"
        docker-compose up --build -d
    } else {
        Write-Host "Starting: PostgreSQL, MinIO, DynamoDB"
        docker-compose up -d postgres minio dynamodb-local minio-init
    }
    
    Write-Host "⏳ Waiting for services to be healthy..."
    Start-Sleep -Seconds 5
}

# Initialize database if not skipping
if (-not $SkipMigrations -and -not $FrontendOnly) {
    Write-Host ""
    Write-Host "📦 Initializing database..."
    & ./scripts/init-local-db.ps1
}

# Build frontend if not skipping
if (-not $SkipBuild -and -not $ApiOnly) {
    Write-Host ""
    Write-Host "🏗️  Building frontend..."
    Push-Location ./portfolio-frontend
    try {
        npm ci --silent
        Write-Host "✅ Frontend dependencies installed"
    } catch {
        Write-Host "⚠️  Failed to install frontend dependencies: $_"
    }
    Pop-Location
}

# Start services based on mode
Write-Host ""
Write-Host "🚀 Starting services..."
Write-Host ""

if ($Mode -eq "docker") {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "🎯 All services started in Docker!"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host ""
    Write-Host "📱 Frontend:       http://localhost:5173"
    Write-Host "🔌 API:            http://localhost:5000"
    Write-Host "💾 PostgreSQL:     localhost:5432"
    Write-Host "📦 MinIO Console:  http://localhost:9001 (admin/minioadmin123)"
    Write-Host "📊 DynamoDB Admin: http://localhost:8001"
    Write-Host ""
    Write-Host "View logs: docker-compose logs -f"
    Write-Host "Stop all: docker-compose down"
    Write-Host ""
    
    # Keep compose running
    docker-compose logs -f

} else {
    # Hybrid or Local mode - start API and Frontend locally
    
    if (-not $FrontendOnly) {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        Write-Host "Starting API (watch mode)..."
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        Write-Host ""
        
        Push-Location ./APIs/Portfolio.Api
        $apiProcess = Start-Process -NoNewWindow -PassThru -FilePath "dotnet" -ArgumentList @(
            "watch",
            "run",
            "--project", "Portfolio.Api.csproj"
        )
        Pop-Location
        
        Start-Sleep -Seconds 3
    }
    
    if (-not $ApiOnly) {
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        Write-Host "Starting Frontend..."
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        Write-Host ""
        
        Push-Location ./portfolio-frontend
        $frontendProcess = Start-Process -NoNewWindow -PassThru -FilePath "npm" -ArgumentList @(
            "run",
            "dev"
        )
        Pop-Location
    }
    
    Write-Host ""
    Write-Host "✨ Services started!"
    Write-Host ""
    Write-Host "📱 Frontend:       http://localhost:5173"
    Write-Host "🔌 API:            http://localhost:5000"
    if ($Mode -eq "hybrid") {
        Write-Host "💾 PostgreSQL:     localhost:5432 (Docker)"
        Write-Host "📦 MinIO:          http://localhost:9000 (Docker)"
        Write-Host "📊 DynamoDB:       http://localhost:8000 (Docker)"
    }
    Write-Host ""
    Write-Host "Press Ctrl+C to stop"
    Write-Host ""
    
    # Wait for processes
    if ($apiProcess) { $apiProcess | Wait-Process }
    if ($frontendProcess) { $frontendProcess | Wait-Process }
}
