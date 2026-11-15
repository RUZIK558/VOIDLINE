@echo off
cd /d "%~dp0"
set VOIDLINE_MODE=events
node server.mjs
pause
