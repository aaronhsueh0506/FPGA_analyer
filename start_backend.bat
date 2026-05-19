@echo off
chcp 65001 >nul
title FPGA Analyzer (port 8000)
cd /d "%~dp0backend"
call venv\Scripts\activate.bat
echo.
echo  FPGA Register Analyzer running on http://localhost:8000
echo  Press Ctrl+C to stop.
echo.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
