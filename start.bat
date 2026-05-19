@echo off
chcp 65001 >nul
title FPGA Register Analyzer - Launcher

set "ROOT=%~dp0"

echo ============================================================
echo  FPGA Register Analyzer - Launcher
echo ============================================================
echo.
echo [Info] Root directory: %ROOT%

REM -- Check frontend build exists; auto-build if npm is available --
echo [Step 1] Checking frontend build...
if exist "%ROOT%frontend\dist\index.html" (
    echo         OK - frontend\dist\index.html found, skipping build.
) else (
    echo         frontend\dist\index.html not found. Checking for npm...
    where npm >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] npm not found. Please install Node.js from https://nodejs.org/
        echo         and run start.bat again, OR copy the built frontend\dist\ folder manually.
        echo.
        pause
        exit /b 1
    )
    for /f "delims=" %%v in ('npm --version 2^>^&1') do echo         npm version: %%v
    echo [Setup] Building frontend (first run, may take 1-2 minutes)...
    cd /d "%ROOT%frontend"
    call npm install
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
echo [Step 2] Checking Python venv...
if exist "%ROOT%backend\venv\Scripts\activate.bat" (
    echo         OK - venv already exists, skipping creation.
) else (
    echo         venv not found. Creating Python virtual environment...
    echo         (first run, may take a minute)
    cd /d "%ROOT%backend"
    echo         Trying: py -m venv --system-site-packages venv
    py -m venv --system-site-packages venv
    if not exist "%ROOT%backend\venv\Scripts\activate.bat" (
        echo         py failed, trying: python -m venv --system-site-packages venv
        python -m venv --system-site-packages venv
    )
    if not exist "%ROOT%backend\venv\Scripts\activate.bat" (
        echo [ERROR] Failed to create Python venv.
        echo         Please install Python 3.10+ from https://www.python.org/downloads/
        echo         and check "Add Python to PATH" during install.
        echo         (Run: py --version  or  python --version  to verify Python is found)
        echo.
        pause
        exit /b 1
    )
    echo         venv created. Installing requirements...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] pip install failed. Check output above.
        pause
        exit /b 1
    )
    call deactivate
    echo [Setup] Python environment ready.
    echo.
)

REM -- Start backend --
echo [Step 3] Starting backend server...
echo         Working dir for backend: %ROOT%backend
echo         Command: call ..\start_backend.bat
start "FPGA Analyzer" /d "%ROOT%backend" cmd /k "call ..\start_backend.bat"

REM -- Open browser after delay --
echo [Step 4] Waiting 4 seconds for server to start, then opening browser...
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
