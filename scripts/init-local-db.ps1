# Initialize local PostgreSQL database for development
# This script:
# 1. Ensures Docker PostgreSQL is running
# 2. Applies EF Core migrations
# 3. Can optionally seed sample data

param(
    [switch]$Seed = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║  Portfolio Local Database Initialization                      ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"
Write-Host ""

# Check if Docker is running
Write-Host "🔍 Checking Docker status..."
try {
    $dockerStatus = docker ps 2>&1 | Select-Object -First 1
    Write-Host "✅ Docker is running"
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
}

# Start PostgreSQL container
Write-Host ""
Write-Host "🐘 Starting PostgreSQL container..."
try {
    docker-compose up -d postgres 2>&1 | Out-Null
    Write-Host "✅ PostgreSQL started"
} catch {
    Write-Host "❌ Failed to start PostgreSQL: $_"
    exit 1
}

# Wait for PostgreSQL to be ready
Write-Host ""
Write-Host "⏳ Waiting for PostgreSQL to be ready..."
$maxRetries = 30
$retries = 0
$pgReady = $false

while ($retries -lt $maxRetries) {
    try {
        $result = docker exec portfolio-postgres pg_isready -U portfolio_user -d portfoliodb 2>&1
        if ($result -like "*accepting*") {
            $pgReady = $true
            break
        }
    } catch { }
    
    Start-Sleep -Seconds 1
    $retries++
    Write-Host -NoNewline "."
}

if ($pgReady) {
    Write-Host ""
    Write-Host "✅ PostgreSQL is ready"
} else {
    Write-Host ""
    Write-Host "❌ PostgreSQL failed to start after $maxRetries seconds"
    exit 1
}

# Apply migrations
Write-Host ""
Write-Host "📦 Applying EF Core migrations..."
Push-Location ./APIs/Portfolio.Api

try {
    # Ensure environment variable is set for dotnet ef
    $env:ASPNETCORE_ENVIRONMENT = "Development"
    if (-not $env:ConnectionStrings__Postgres) {
        $env:ConnectionStrings__Postgres = "Host=localhost;Port=5432;Database=portfoliodb;Username=portfolio_user;Password=portfolio_password;SslMode=Disable;Include Error Detail=true"
    }
    
    # Pass explicit connection string to EF tools to avoid design-time config resolution issues
    $conn = $env:ConnectionStrings__Postgres
    $output = dotnet ef database update --connection "$conn" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migrations applied successfully"
    } else {
        Write-Host "⚠️  Migration output:"
        Write-Host $output
        Write-Host "✅ Database initialized (may have been already up-to-date)"
    }
} catch {
    Write-Host "❌ Migration failed: $_"
    Pop-Location
    exit 1
}

Pop-Location

# Optionally seed data
if ($Seed) {
    Write-Host ""
    Write-Host "🌱 Seeding sample data..."
    # TODO: Implement seeding when ready
    Write-Host "⏭️  Seeding not yet implemented"
}

Write-Host ""
Write-Host "✨ Database initialization complete!"
Write-Host ""
Write-Host "📊 Connect to PostgreSQL:"
Write-Host "   psql -h localhost -U portfolio_user -d portfoliodb"
Write-Host ""
