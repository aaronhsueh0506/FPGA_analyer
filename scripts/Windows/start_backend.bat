@echo off
chcp 65001 >nul
title FPGA Analyzer (port 8000)

echo ============================================================
echo  FPGA Register Analyzer - Backend
echo ============================================================
echo.

REM Derive root from this script's location (two levels up from scripts\Windows\)
pushd "%~dp0..\.."
set "ROOT=%CD%\"
popd
set "BACKEND=%ROOT%backend"

echo [Step 1] Looking for backend at: %BACKEND%
if not exist "%BACKEND%" (
    echo [ERROR] backend folder not found: %BACKEND%
    echo         Make sure the scripts folder is inside the FPGA analyer root folder.
    pause
    exit /b 1
)
cd /d "%BACKEND%"
echo         OK - current dir: %CD%
echo.

REM -- Check venv --
echo [Step 2] Looking for Python venv...
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] venv not found at: %CD%\venv
    echo         Please run scripts\Windows\start.bat once to set up the environment.
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate venv.
    pause
    exit /b 1
)
echo         OK - venv activated
echo.

REM -- Check uvicorn is installed --
echo [Step 3] Checking uvicorn...
python -m uvicorn --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] uvicorn not found in venv. Installing requirements...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] pip install failed.
        pause
        exit /b 1
    )
)
echo         OK
echo.

REM -- Start server --
echo [Step 4] Starting uvicorn on http://localhost:8000
echo          Press Ctrl+C to stop.
echo.
echo ============================================================
echo.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
echo.
if errorlevel 1 (
    echo [ERROR] uvicorn exited with an error.
    echo         Check the output above for details.
) else (
    echo [INFO] uvicorn stopped cleanly.
)
echo.
pause
