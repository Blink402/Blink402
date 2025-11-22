# PowerShell script to test Wallet Health Checker API

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Wallet Health Checker - API Test Suite" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$API_URL = "https://blink402-production.up.railway.app"

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/health" -Method Get
    Write-Host "  Status: $($response.status)" -ForegroundColor Green
    Write-Host "  Uptime: $($response.uptime)s" -ForegroundColor Green
    Write-Host "  ✓ PASS`n" -ForegroundColor Green
} catch {
    Write-Host "  ✗ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Wallet Analysis (Clean wallet - no tokens)
Write-Host "Test 2: Wallet Analysis (Clean Wallet)" -ForegroundColor Yellow
Write-Host "  Wallet: DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK" -ForegroundColor Gray

$body = @{
    wallet = "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/wallet-analysis" -Method Post -Body $body -ContentType "application/json"

    Write-Host "  Success: $($response.success)" -ForegroundColor Green
    Write-Host "  Duration: $($response.duration_ms)ms" -ForegroundColor Green
    Write-Host "  Cached: $($response.cached)" -ForegroundColor Green
    Write-Host "`n  Wallet Stats:" -ForegroundColor Cyan
    Write-Host "    SOL Balance: $($response.data.solBalance) SOL" -ForegroundColor White
    Write-Host "    SOL USD Value: `$$([math]::Round($response.data.solUsdValue, 2))" -ForegroundColor White
    Write-Host "    Tokens: $($response.data.tokens.Count)" -ForegroundColor White
    Write-Host "    NFTs: $($response.data.nftCount)" -ForegroundColor White
    Write-Host "    Transactions: $($response.data.transactionSummary.totalTransactions)" -ForegroundColor White

    Write-Host "`n  B402 Tier:" -ForegroundColor Cyan
    Write-Host "    Tier: $($response.data.b402.tier)" -ForegroundColor White
    Write-Host "    Balance: $($response.data.b402.balance) B402" -ForegroundColor White
    Write-Host "    Spam Detection: $($response.data.b402.features.spamDetection)" -ForegroundColor White

    # Validate critical fields
    $passed = $true

    if ($null -eq $response.data.nftCount) {
        Write-Host "`n  ✗ nftCount is NULL (FAIL)" -ForegroundColor Red
        $passed = $false
    } else {
        Write-Host "`n  ✓ nftCount present: $($response.data.nftCount)" -ForegroundColor Green
    }

    if ($response.data.b402.tier -ne "NONE") {
        Write-Host "  ✗ Expected tier NONE, got $($response.data.b402.tier) (FAIL)" -ForegroundColor Red
        $passed = $false
    } else {
        Write-Host "  ✓ Tier is NONE (expected for wallet with no B402)" -ForegroundColor Green
    }

    if ($response.data.b402.features.spamDetection -eq $true) {
        Write-Host "  ✗ Spam detection should be false for NONE tier (FAIL)" -ForegroundColor Red
        $passed = $false
    } else {
        Write-Host "  ✓ Spam detection disabled for FREE tier" -ForegroundColor Green
    }

    if ($passed) {
        Write-Host "`n  ✓ ALL CHECKS PASSED`n" -ForegroundColor Green
    } else {
        Write-Host "`n  ✗ SOME CHECKS FAILED`n" -ForegroundColor Red
    }

} catch {
    Write-Host "  ✗ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Invalid Wallet Address
Write-Host "Test 3: Invalid Wallet Address" -ForegroundColor Yellow

$invalidBody = @{
    wallet = "invalid-address"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/wallet-analysis" -Method Post -Body $invalidBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "  ✗ FAIL: Should have returned 400 error" -ForegroundColor Red
    Write-Host ""
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  ✓ PASS: 400 error returned for invalid address" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "  ✗ FAIL: Expected 400, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host ""
    }
}

# Test 4: Missing Wallet Parameter
Write-Host "Test 4: Missing Wallet Parameter" -ForegroundColor Yellow

$emptyBody = @{} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/wallet-analysis" -Method Post -Body $emptyBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "  ✗ FAIL: Should have returned 400 error" -ForegroundColor Red
    Write-Host ""
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  ✓ PASS: 400 error returned for missing wallet" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "  ✗ FAIL: Expected 400, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host ""
    }
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Test Suite Completed!" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. All tests passed? Great! The API is working correctly." -ForegroundColor Gray
Write-Host "2. Test via blink: https://blink402.dev/blink/wallet-analyzer" -ForegroundColor Gray
Write-Host "3. Monitor Railway logs for spam detection hits" -ForegroundColor Gray
Write-Host "4. Find a B402 holder wallet to test BRONZE+ tier`n" -ForegroundColor Gray
