# Dọn các file/thư mục còn sót lại từ template Hero API.
# Chạy MỘT LẦN từ thư mục hero-api:
#     powershell -ExecutionPolicy Bypass -File scripts\cleanup-hero-template.ps1
# Script hỏi xác nhận trước khi xóa, và tự xóa chính nó khi xong.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$targets = @(
    "postman", ".postman", ".remember", "AGENTS.md",
    "alembic.ini", "migrations",
    "app.db", "openapi.json",
    "app\routers\heroes.py", "app\frontend",
    "test",                    # thư mục test cũ (test mới nằm ở tests\)
    ".pytest_cache"
)
$found = @($targets | Where-Object { Test-Path $_ })
$found += Get-ChildItem -Directory -Filter "pytest-cache-files-*" | ForEach-Object { $_.Name }
$found += Get-ChildItem -Recurse -Directory -Filter "__pycache__" |
    Where-Object { $_.FullName -notlike "*\.venv\*" } |
    ForEach-Object { Resolve-Path -Relative $_.FullName }

if ($found.Count -eq 0) {
    Write-Host "Không còn gì để dọn."
} else {
    Write-Host "Sẽ xóa trong $root :" -ForegroundColor Yellow
    $found | ForEach-Object { Write-Host "  - $_" }
    $answer = Read-Host "Xóa các mục trên? (y/N)"
    if ($answer -ne "y") { Write-Host "Đã hủy."; exit 0 }
    foreach ($item in $found) {
        if (Test-Path -LiteralPath $item) {
            Remove-Item -LiteralPath $item -Recurse -Force -ErrorAction Continue
        }
    }
    Write-Host "Đã dọn xong." -ForegroundColor Green
}

Write-Host @"

Bước tiếp theo:
  1. (Khuyến nghị) tạo lại môi trường cho sạch package của template:
       Remove-Item -Recurse -Force .venv
       python -m venv .venv; .venv\Scripts\activate; pip install -r requirements.txt
  2. pytest
  3. fastapi dev app/main.py
"@

Remove-Item -LiteralPath $PSCommandPath -Force
