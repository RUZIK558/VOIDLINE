@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or 24 LTS from https://nodejs.org first.
  pause
  exit /b 1
)
if not exist node_modules\electron\dist\electron.exe (
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm start
if errorlevel 1 pause
