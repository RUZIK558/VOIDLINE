@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or 24 LTS from https://nodejs.org first.
  pause
  exit /b 1
)
if not exist node_modules\ws (
  call npm install --omit=dev
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Share your LAN IPv4 address and port 3080 with friends.
echo Stop the server with Ctrl+C.
call npm run server
pause
