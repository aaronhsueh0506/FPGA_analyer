from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db import get_db, DATA_DIR
from ..models import RegisterDefinitionORM, RegisterDefinitionOut
from ..services.excel_parser import parse_excel

router = APIRouter(prefix="/api/registers", tags=["registers"])


@router.get("", response_model=list[RegisterDefinitionOut])
def list_registers(db: Session = Depends(get_db)):
    records = db.query(RegisterDefinitionORM).order_by(RegisterDefinitionORM.uploaded_at.desc()).all()
    return records


@router.post("", response_model=RegisterDefinitionOut)
async def upload_register(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are accepted")

    content = await file.read()

    # Save file to disk
    reg_dir = DATA_DIR / "registers"
    # Use a timestamp-based unique name to avoid collisions
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    dest = reg_dir / f"{ts}_{file.filename}"
    dest.write_bytes(content)

    # Parse to get counts
    try:
        registers, bitfields = parse_excel(dest)
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Cannot parse Excel: {exc}")

    name = Path(file.filename).stem

    record = RegisterDefinitionORM(
        name=name,
        original_filename=file.filename,
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
