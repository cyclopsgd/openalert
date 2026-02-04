# OpenAlert - Open Firewall Ports for Network Access
# This script creates Windows Firewall rules to allow remote access to OpenAlert

Write-Host "🔥 OpenAlert Firewall Configuration" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green
Write-Host ""

# Check if rules already exist
$frontendRule = Get-NetFirewallRule -DisplayName "OpenAlert Frontend" -ErrorAction SilentlyContinue
$backendRule = Get-NetFirewallRule -DisplayName "OpenAlert Backend" -ErrorAction SilentlyContinue

if ($frontendRule -and $backendRule) {
    Write-Host "ℹ️  Firewall rules already exist!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Existing rules:" -ForegroundColor Cyan
    Write-Host "  - OpenAlert Frontend (Port 5175)" -ForegroundColor White
    Write-Host "  - OpenAlert Backend (Port 3001)" -ForegroundColor White
    Write-Host ""
    $response = Read-Host "Do you want to recreate them? (y/n)"

    if ($response -eq 'y') {
        Remove-NetFirewallRule -DisplayName "OpenAlert Frontend" -ErrorAction SilentlyContinue
        Remove-NetFirewallRule -DisplayName "OpenAlert Backend" -ErrorAction SilentlyContinue
        Write-Host "🗑️  Removed existing rules" -ForegroundColor Yellow
    } else {
        Write-Host "✅ No changes made" -ForegroundColor Green
        Read-Host "Press Enter to exit"
        exit 0
    }
}

Write-Host "📝 Creating firewall rules..." -ForegroundColor Cyan
Write-Host ""

# Create Frontend rule (Port 5175)
try {
    New-NetFirewallRule `
        -DisplayName "OpenAlert Frontend" `
        -Direction Inbound `
        -LocalPort 5175 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -Description "Allow access to OpenAlert frontend development server" | Out-Null
    Write-Host "✅ Created rule: OpenAlert Frontend (Port 5175)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create frontend rule: $_" -ForegroundColor Red
}

# Create Backend rule (Port 3001)
try {
    New-NetFirewallRule `
        -DisplayName "OpenAlert Backend" `
        -Direction Inbound `
        -LocalPort 3001 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -Description "Allow access to OpenAlert backend API server" | Out-Null
    Write-Host "✅ Created rule: OpenAlert Backend (Port 3001)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create backend rule: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Firewall configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 You can now access OpenAlert from other devices:" -ForegroundColor Yellow

# Get local IP
$ip = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -eq "Dhcp" } |
      Select-Object -First 1 -ExpandProperty IPAddress

if ($ip) {
    Write-Host "   http://$ip:5175" -ForegroundColor Cyan
} else {
    Write-Host "   http://YOUR_IP_ADDRESS:5175" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "ℹ️  To remove these rules later, run:" -ForegroundColor Gray
Write-Host "   Remove-NetFirewallRule -DisplayName 'OpenAlert Frontend'" -ForegroundColor DarkGray
Write-Host "   Remove-NetFirewallRule -DisplayName 'OpenAlert Backend'" -ForegroundColor DarkGray
Write-Host ""

Read-Host "Press Enter to exit"
