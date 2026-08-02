# check_bundle_size.ps1 — CI 包体大小门
# 用法: powershell -File tools/check_bundle_size.ps1 -BuildDir "build/wechatgame"
param(
    [string]$BuildDir = "build/wechatgame",
    [int]$MaxMainKB = 4096,       # 主包上限 4MB（保守值，微信约 20MB 含分包）
    [int]$MaxTotalKB = 20480      # 总代码包上限 20MB
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BuildDir)) {
    Write-Error "Build directory not found: $BuildDir"
    exit 1
}

# 计算主包大小（排除远程资源目录）
$mainFiles = Get-ChildItem -Path $BuildDir -Recurse -File |
    Where-Object { $_.FullName -notmatch "remote|cdn|assets_remote" }
$mainSizeKB = [math]::Round(($mainFiles | Measure-Object -Property Length -Sum).Sum / 1024)

# 计算总大小
$allFiles = Get-ChildItem -Path $BuildDir -Recurse -File
$totalSizeKB = [math]::Round(($allFiles | Measure-Object -Property Length -Sum).Sum / 1024)

Write-Host "=== Bundle Size Report ==="
Write-Host "Main package: ${mainSizeKB} KB (limit: ${MaxMainKB} KB)"
Write-Host "Total package: ${totalSizeKB} KB (limit: ${MaxTotalKB} KB)"

$failed = $false
if ($mainSizeKB -gt $MaxMainKB) {
    Write-Host "[FAIL] Main package exceeds limit!" -ForegroundColor Red
    $failed = $true
} else {
    Write-Host "[PASS] Main package within limit" -ForegroundColor Green
}

if ($totalSizeKB -gt $MaxTotalKB) {
    Write-Host "[FAIL] Total package exceeds limit!" -ForegroundColor Red
    $failed = $true
} else {
    Write-Host "[PASS] Total package within limit" -ForegroundColor Green
}

if ($failed) { exit 1 }
Write-Host "=== All checks passed ===" -ForegroundColor Green