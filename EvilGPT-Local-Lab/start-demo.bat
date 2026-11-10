@echo off
setlocal
cd /d "%~dp0"
set "NODE_BIN="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_BIN set "NODE_BIN=%%N"
if not defined NODE_BIN if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_BIN=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_BIN (
  echo Node.js was not found. Install Node.js or run this demo from the Codex desktop environment.
  pause
  exit /b 1
)
start "" /b "%NODE_BIN%" server.js
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3189/"
pause
