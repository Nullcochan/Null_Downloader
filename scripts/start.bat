@echo off
REM Null Downloader - Clean Startup Script
REM Stops existing Node.js processes and starts the server fresh

echo.
echo ================================================
echo   Null Downloader - Clean Server Startup
echo ================================================
echo.

echo [1/3] Stopping existing Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo    - Node.js processes stopped
) else (
    echo    - No existing Node.js processes found
)

echo.
echo [2/3] Waiting for processes to terminate...
timeout /t 2 /nobreak >nul
echo    - Ready to start

echo.
echo [3/3] Starting Null Downloader server...
cd /d E:\Nullco\Null_Downloader
npm start
