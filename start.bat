@echo off
chcp 65001 >nul
title FPGA Register Analyzer - Launcher

set "ROOT=%~dp0"

echo ============================================================
echo  FPGA Register Analyzer - Launcher
echo ============================================================
echo.

REM -- Check Python --
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found.
    echo         Please install Python 3.10 or above:
    echo         https://www.python.org/downloads/
    echo         (Remember to check "Add Python to PATH" during install)
    echo.
    pause
    exit /b 1
)

REM -- Check frontend build exists; auto-build if npm is available --
if not exist "%ROOT%frontend\dist\index.html" (
    echo [Setup] Frontend not built. Checking for npm...
    where npm >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Frontend dist\ not found and npm is not installed.
        echo         Please include the built frontend\dist\ folder,
        echo         or install Node.js from https://nodejs.org/ and run start.bat again.
        echo.
        pause
        exit /b 1
    )
    echo [Setup] Building frontend (first run, may take 1-2 minutes)...
    cd /d "%ROOT%frontend"
    call npm install --silent
    call npm run build
    cd /d "%ROOT%"
    if not exist "%ROOT%frontend\dist\index.html" (
        echo [ERROR] Frontend build failed. Check npm output above.
        pause
        exit /b 1
    )
    echo [Setup] Frontend built successfully.
    echo.
)

REM -- First run: create Python virtual environment --
if not exist "%ROOT%backend\venv\Scripts\activate.bat" (
    echo [Setup] Creating Python environment (first run, may take a minute)...
    cd /d "%ROOT%backend"
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    call deactivate
    echo [Setup] Done.
    echo.
)

REM -- Start backend --
echo Starting FPGA Register Analyzer...
start "FPGA Analyzer" /d "%ROOT%backend" cmd /k "call ..\start_backend.bat"

REM -- Open browser after delay --
timeout /t 4 /nobreak >nul
start "" "http://localhost:8000"

echo.
echo ============================================================
echo  FPGA Register Analyzer is running!
echo  Open your browser: http://localhost:8000
echo ============================================================
echo.
echo  To stop: close the server window (FPGA Analyzer).
echo  This launcher window can be closed.
echo.
timeout /t 5 /nobreak >nul
