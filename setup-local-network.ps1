# OpenAlert Local Network Setup Script
# This script configures OpenAlert for local network access

Write-Host "🔍 Finding your local IP address..." -ForegroundColor Cyan

# Get the active network adapter's IP
$ip = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -eq "Dhcp" } |
      Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ip) {
    # Fallback: try to get any non-loopback IP
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
           Where-Object { $_.IPAddress -notlike "127.*" } |
           Select-Object -First 1).IPAddress
}

if (-not $ip) {
    Write-Host "❌ Could not detect IP address automatically." -ForegroundColor Red
    $ip = Read-Host "Please enter your IP address manually (from ipconfig)"
}

Write-Host "✅ Found IP: $ip" -ForegroundColor Green
Write-Host ""

# Update frontend .env.local
Write-Host "📝 Updating frontend configuration..." -ForegroundColor Cyan
$frontendEnv = "# Local network configuration`nVITE_API_URL=http://${ip}:3001`n"
Set-Content -Path "apps\web\.env.local" -Value $frontendEnv
Write-Host "✅ Updated: apps\web\.env.local" -ForegroundColor Green

# Update backend .env
Write-Host "📝 Updating backend CORS configuration..." -ForegroundColor Cyan
$backendEnvContent = Get-Content -Path "apps\api\.env" -Raw
$backendEnvContent = $backendEnvContent -replace 'ALLOWED_ORIGINS=.*', "ALLOWED_ORIGINS=http://localhost:5175,http://localhost:3000,http://${ip}:5175"
Set-Content -Path "apps\api\.env" -Value $backendEnvContent
Write-Host "✅ Updated: apps\api\.env" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Access OpenAlert from any device on your network:" -ForegroundColor Yellow
Write-Host "   http://${ip}:5175" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Remember to restart both servers:" -ForegroundColor Yellow
Write-Host "   Terminal 1: cd apps\api && npm run start:dev" -ForegroundColor White
Write-Host "   Terminal 2: cd apps\web && npm run dev" -ForegroundColor White
Write-Host ""
