import io
from pathlib import Path
from datetime import datetime

import xlrd
import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db import get_db, DATA_DIR
from ..models import RegisterDefinitionORM, RegisterDefinitionOut
from ..services.excel_parser import parse_excel

router = APIRouter(prefix="/api/registers", tags=["registers"])


def _xls_to_xlsx(xls_bytes: bytes) -> bytes:
    """Convert legacy .xls bytes to .xlsx bytes, preserving cell values."""
    wb_xls = xlrd.open_workbook(file_contents=xls_bytes)
    wb_xlsx = openpyxl.Workbook()
    for sheet_idx in range(wb_xls.nsheets):
        ws_xls = wb_xls.sheet_by_index(sheet_idx)
        ws_xlsx = wb_xlsx.active if sheet_idx == 0 else wb_xlsx.create_sheet()
        ws_xlsx.title = ws_xls.name
        for row in range(ws_xls.nrows):
            for col_idx in range(ws_xls.ncols):
                cell = ws_xls.cell(row, col_idx)
                if cell.ctype == xlrd.XL_CELL_NUMBER:
                    val = cell.value
                    val = int(val) if val == int(val) else val
                elif cell.ctype == xlrd.XL_CELL_EMPTY:
                    val = None
                else:
                    val = cell.value
                ws_xlsx.cell(row=row + 1, column=col_idx + 1, value=val)
    buf = io.BytesIO()
    wb_xlsx.save(buf)
    return buf.getvalue()


@router.get("", response_model=list[RegisterDefinitionOut])
def list_registers(db: Session = Depends(get_db)):
    records = db.query(RegisterDefinitionORM).order_by(RegisterDefinitionORM.uploaded_at.desc()).all()
    return records


@router.post("", response_model=RegisterDefinitionOut)
async def upload_register(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    fname = file.filename or ""
    if not fname.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are accepted")

    content = await file.read()

    # Auto-convert .xls -> .xlsx
    if fname.lower().endswith(".xls"):
        try:
            content = _xls_to_xlsx(content)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Cannot convert .xls: {exc}")
        fname = fname[:-4] + ".xlsx"

    # Save file to disk
    reg_dir = DATA_DIR / "registers"
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    dest = reg_dir / f"{ts}_{fname}"
    dest.write_bytes(content)

    # Parse to get counts (use in-memory bytes to avoid antivirus file lock)
    try:
        import io as _io
        registers, bitfields = parse_excel(_io.BytesIO(content))
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Cannot parse Excel: {exc}")

    name = Path(fname).stem

    record = RegisterDefinitionORM(
        name=name,
        original_filename=fname,
        file_path=str(dest),
        register_count=len(registers),
        bitfield_count=len(bitfields),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{register_id}", status_code=204)
def delete_register(register_id: int, db: Session = Depends(get_db)):
    record = db.get(RegisterDefinitionORM, register_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Register not found")

    if record.batches:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete: there are batches referencing this register definition",
        )

    file_path = Path(record.file_path)
    db.delete(record)
    db.commit()
    file_path.unlink(missing_ok=True)
