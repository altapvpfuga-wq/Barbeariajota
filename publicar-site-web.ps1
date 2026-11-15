# Copia a web ATUAL dos dois apps para docs/ (GitHub Pages - iPhone e navegador).
# Rodar SEMPRE que compilar uma versao nova: powershell -ExecutionPolicy Bypass -File .\publicar-site-web.ps1
$ErrorActionPreference = 'Stop'

# ---------- app do cliente (usa o www que ja esta sincronizado) ----------
New-Item -ItemType Directory -Path "docs\app" -Force | Out-Null
Remove-Item "docs\app\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "site-barbearia\www\*" "docs\app\" -Recurse -Force
Write-Output "  docs\app    <- site-barbearia\www"

# ---------- painel web (mesmos arquivos do APK) ----------
New-Item -ItemType Directory -Path "docs\painel" -Force | Out-Null
Remove-Item "docs\painel\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "..\apk-painel\index.html","..\apk-painel\painel.js","..\apk-painel\styles.css","..\apk-painel\logo.svg" "docs\painel\" -Force
Copy-Item "site-barbearia\icone-iphone.png" "docs\painel\icone-iphone.png" -Force
Write-Output "  docs\painel <- ..\apk-painel (web)"

Write-Output "PRONTO: docs/ atualizado - faca commit e push para publicar no GitHub Pages"
