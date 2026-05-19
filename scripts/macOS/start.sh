#!/usr/bin/env bash
set -euo pipefail

# Resolve project root (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKEND="${ROOT}/backend"

echo "============================================================"
echo " FPGA Register Analyzer - Launcher (macOS)"
echo "============================================================"
echo ""
echo "[Info] Project root: ${ROOT}"
echo ""

# Step 1: Check Python 3
echo "[Step 1] Checking Python 3..."
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found."
    echo "        Install Python 3.10+ from https://www.python.org/downloads/"
    exit 1
fi
PYVER=$(python3 --version 2>&1)
echo "        OK - ${PYVER}"
echo ""

# Step 2: Create venv if not present
echo "[Step 2] Checking Python venv..."
if [ ! -f "${BACKEND}/venv/bin/activate" ]; then
    echo "        venv not found. Creating virtual environment..."
    cd "${BACKEND}"
    python3 -m venv venv
    echo "        Installing requirements (first run, may take a minute)..."
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
    echo "        Python environment ready."
else
    echo "        OK - venv already exists."
fi
echo ""

# Step 3: Start backend
echo "[Step 3] Starting backend at http://localhost:8000"
echo "         Press Ctrl+C to stop."
echo ""
echo "============================================================"
echo ""

cd "${BACKEND}"
source venv/bin/activate

# Open browser after a short delay (background)
(sleep 3 && open "http://localhost:8000") &

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
