# Safe dependency installation script for Windows
# This script safely handles pnpm installations by stopping dev processes first

Write-Host "🧹 BlinkBazaar - Safe Clean Install" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop any running dev servers
Write-Host "Step 1: Checking for running dev servers..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*BlinkBazaar*" }
if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) node processes in BlinkBazaar directory" -ForegroundColor Yellow
    $response = Read-Host "Stop these processes? (y/n)"
    if ($response -eq 'y') {
        $nodeProcesses | Stop-Process -Force
        Write-Host "✓ Stopped dev processes" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "✓ No running dev servers found" -ForegroundColor Green
}

# Step 2: Clean pnpm store if needed
Write-Host ""
Write-Host "Step 2: Checking pnpm store..." -ForegroundColor Yellow
$storeStatus = pnpm store status 2>&1
if ($storeStatus -match "mutated" -or $storeStatus -match "modified") {
    Write-Host "⚠ Corrupted packages detected in store" -ForegroundColor Red
    $response = Read-Host "Prune pnpm store? (y/n)"
    if ($response -eq 'y') {
        pnpm store prune
        Write-Host "✓ Store cleaned" -ForegroundColor Green
    }
} else {
    Write-Host "✓ Store is healthy" -ForegroundColor Green
}

# Step 3: Install dependencies
Write-Host ""
Write-Host "Step 3: Installing dependencies..." -ForegroundColor Yellow
pnpm install

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Installation complete!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Installation failed. Try closing VS Code and other editors, then run again." -ForegroundColor Red
    Write-Host "If issues persist, restart your computer and run this script again." -ForegroundColor Yellow
}
