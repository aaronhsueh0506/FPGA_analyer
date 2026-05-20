@echo off
chcp 65001 >nul
title FPGA Register Analyzer - Launcher

REM Resolve project root (two levels up from this script)
set "SCRIPTS_DIR=%~dp0"
pushd "%SCRIPTS_DIR%..\.."
set "ROOT=%CD%\"
popd

echo ============================================================
echo  FPGA Register Analyzer - Launcher
echo ============================================================
echo.
echo [Info] Root directory: %ROOT%
echo.

REM ============================================================
REM Step 1: Check frontend build
REM ============================================================
echo [Step 1] Checking frontend build...
if exist "%ROOT%frontend\dist\index.html" goto :frontend_ok

echo         frontend\dist\index.html not found. Checking for npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Please install Node.js from https://nodejs.org/
    echo         and run start.bat again, OR copy the built frontend\dist\ folder manually.
    echo.
    pause
    exit /b 1
)
echo [Setup] Building frontend (first run, may take 1-2 minutes)...
cd /d "%ROOT%frontend"
call npm install
if errorlevel 1 goto :npm_build_fail
call npm run build
if errorlevel 1 goto :npm_build_fail
cd /d "%ROOT%"
if not exist "%ROOT%frontend\dist\index.html" goto :npm_build_fail
echo [Setup] Frontend built successfully.
echo.
goto :frontend_ok

:npm_build_fail
echo [ERROR] Frontend build failed. Check npm output above.
pause
exit /b 1

:frontend_ok
echo         OK - frontend\dist\index.html found.
echo.

REM ============================================================
REM Step 2: Check Python venv
REM ============================================================
echo [Step 2] Checking Python venv...
if exist "%ROOT%backend\venv\Scripts\activate.bat" goto :venv_ok

echo         venv not found. Creating Python virtual environment...
echo         (first run, may take a minute)
cd /d "%ROOT%backend"
echo         Trying: py -m venv venv
py -m venv venv 2>nul
if exist "%ROOT%backend\venv\Scripts\activate.bat" goto :venv_install
echo         py failed, trying: python -m venv venv
python -m venv venv 2>nul
if not exist "%ROOT%backend\venv\Scripts\activate.bat" goto :venv_fail

:venv_install
echo         venv created. Installing requirements...
call "%ROOT%backend\venv\Scripts\activate.bat"
pip install -r "%ROOT%backend\requirements.txt"
if errorlevel 1 goto :pip_fail
call deactivate
echo [Setup] Python environment ready.
echo.
goto :venv_ok

:venv_fail
echo [ERROR] Failed to create Python venv.
echo         Please install Python 3.10+ from https://www.python.org/downloads/
echo         and check "Add Python to PATH" during install.
echo         (Run: py --version  or  python --version  to verify Python is found)
echo.
pause
exit /b 1

:pip_fail
echo [ERROR] pip install failed. Check output above.
pause
exit /b 1

:venv_ok
echo         OK - venv found.
echo.

REM ============================================================
REM Step 3: Check port 8000
REM ============================================================
echo [Step 3] Checking port 8000...
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo         Port 8000 occupied (PID: %%p). Stopping old process...
    taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo         Port check done.
echo.

REM ============================================================
REM Step 4: Start backend
REM ============================================================
echo [Step 4] Starting backend server...
start "FPGA Analyzer" /d "%ROOT%backend" cmd /k "%SCRIPTS_DIR%start_backend.bat"

REM ============================================================
REM Step 5: Open browser
REM ============================================================
echo [Step 5] Waiting 4 seconds for server to start, then opening browser...
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
