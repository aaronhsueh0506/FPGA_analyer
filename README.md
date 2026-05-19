# FPGA Register Analyzer

A local web tool for analyzing FPGA test case results.

Given a register definition Excel file and a set of `.dat` files produced by each test run, the tool parses and decodes each bit field, aligns values across all test cases into a table, and provides statistical views including histograms, scatter plots, and combination frequency analysis. Results can be exported as CSV or Excel.

---

## Requirements

| Component | Minimum version |
|-----------|----------------|
| Python    | 3.10            |
| Node.js   | 18 (only needed if building the frontend locally) |

The frontend is pre-built and included in `frontend/dist/`. Node.js is only required if you need to rebuild it.

---

## Quick Start

### macOS

1. Open Terminal and navigate to the project folder:
   ```
   cd "/path/to/FPGA analyer"
   ```

2. Make the launch script executable (first time only):
   ```
   chmod +x scripts/macOS/start.sh
   ```

3. Start the application:
   ```
   ./scripts/macOS/start.sh
   ```

   The script will create a Python virtual environment, install dependencies, and start the server. A browser window will open automatically at `http://localhost:8000`.

4. To stop: press `Ctrl+C` in the Terminal window.

---

### Windows

1. Make sure Python 3.10 or later is installed.
   Download from https://www.python.org/downloads/
   During installation, check **"Add Python to PATH"**.

2. Double-click `scripts\Windows\start.bat`.

   On the first run, the script will create a Python virtual environment and install all dependencies automatically. Subsequent runs will skip this step.

3. A browser window will open automatically at `http://localhost:8000`.

4. To stop: close the server window titled **"FPGA Analyzer"**.

---

## Usage

1. **Upload register definition**
   Go to "Register Management" and upload the `.xlsx` file that defines the register addresses and bit fields.

2. **Analyze a test batch**
   Go to "Analyze", select the register definition, then upload one or more `.dat` files. Click "Start Analysis".

3. **View results**
   After analysis, the Results page shows:
   - **Table view** — all test cases and bit field values side by side
   - **Distribution Scatter** — 2D density plot for any two bit fields
   - **Statistics** — histograms and summary stats per bit field
   - **Overall** — type distribution, range coverage, and combination frequency analysis
   - **Warnings** — any unknown addresses encountered during parsing

4. **Export**
   Use the CSV or Excel download buttons at the top of the Results page.

---

## Packaging as a Windows Executable

If you want to distribute the tool as a standalone `.exe` so colleagues do not need to install Python, follow these steps on a Windows machine.

**Prerequisites (Windows)**

- Python 3.10+ installed with "Add Python to PATH" checked
- The repository cloned or copied to the Windows machine

**Steps**

1. Open Command Prompt and navigate to the project folder.

2. Set up the backend virtual environment:
   ```
   cd backend
   py -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   pip install pyinstaller
   ```

3. Before running PyInstaller, the FastAPI application needs to be configured to serve the frontend static files from `frontend/dist/`. Verify that `backend/app/main.py` includes the static file mount (contact the developer if unsure).

4. Run PyInstaller from the `backend` folder:
   ```
   pyinstaller --onedir --name fpga-analyzer app/main.py ^
     --add-data "app;app" ^
     --add-data "..\frontend\dist;frontend\dist" ^
     --hidden-import uvicorn.logging ^
     --hidden-import uvicorn.loops.auto ^
     --hidden-import uvicorn.protocols.http.auto
   ```

5. The output will be in `backend/dist/fpga-analyzer/`. Copy that folder together with an empty `data/` directory to the target machine.

6. On the target machine, double-click `fpga-analyzer.exe` to start the server, then open `http://localhost:8000` in a browser.

**Notes**

- PyInstaller must run on Windows to produce a Windows executable. Cross-compilation from macOS is not supported.
- The `--onedir` option is recommended over `--onefile` because it starts significantly faster.
- If `openpyxl` data files are not included automatically, add `--collect-data openpyxl` to the PyInstaller command.

---

## Directory Structure

```
FPGA analyer/
├── backend/              Python FastAPI backend
│   ├── app/
│   └── requirements.txt
├── frontend/
│   ├── src/              React source (for development)
│   └── dist/             Pre-built frontend (served by backend)
├── scripts/
│   ├── macOS/
│   │   └── start.sh
│   └── Windows/
│       ├── start.bat
│       └── start_backend.bat
├── data/                 Created at runtime (SQLite, uploads, results)
└── docs/                 Architecture and design documents
```

---

## Development (frontend)

If you need to modify and rebuild the frontend:

```
cd frontend
npm install
npm run dev       # development server with hot reload (http://localhost:5173)
npm run build     # production build to frontend/dist/
```

After building, commit `frontend/dist/` so Windows users can run without Node.js.
