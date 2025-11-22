# Stop all development servers for BlinkBazaar
# Run this before installing dependencies or switching branches

Write-Host "🛑 Stopping BlinkBazaar dev servers..." -ForegroundColor Cyan

# Find all node processes related to this project
$projectPath = "BlinkBazaar"
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*$projectPath*" }

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) node processes:" -ForegroundColor Yellow
    $nodeProcesses | ForEach-Object {
        Write-Host "  - PID $($_.Id): $($_.ProcessName)" -ForegroundColor Gray
    }

    Write-Host ""
    $nodeProcesses | Stop-Process -Force
    Write-Host "✅ All dev processes stopped" -ForegroundColor Green

    # Wait a moment for file handles to release
    Start-Sleep -Seconds 2
} else {
    Write-Host "✓ No running dev servers found" -ForegroundColor Green
}

Write-Host ""
Write-Host "You can now safely run 'pnpm install' or other package operations" -ForegroundColor Cyan
