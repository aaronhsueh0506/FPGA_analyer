import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..db import get_db, DATA_DIR
from ..models import (
    BatchORM,
    RegisterDefinitionORM,
    BatchOut,
    BatchDetailOut,
    BitFieldDefSchema,
    BatchRowSchema,
)
from ..services.excel_parser import parse_excel
from ..services.dat_parser import parse_dat_bytes
from ..services.analyzer import analyze
from ..services.reporter import build_dataframe, write_csv, write_xlsx

router = APIRouter(prefix="/api/batches", tags=["batches"])


def _batch_to_out(batch: BatchORM) -> BatchOut:
    return BatchOut(
        id=batch.id,
        name=batch.name,
        register_name=batch.register.name if batch.register else "",
        dat_count=batch.dat_count,
        warning_count=batch.warning_count or 0,
        analyzed_at=batch.analyzed_at,
    )


@router.get("", response_model=list[BatchOut])
def list_batches(db: Session = Depends(get_db)):
    batches = db.query(BatchORM).order_by(BatchORM.analyzed_at.desc()).all()
    return [_batch_to_out(b) for b in batches]


@router.post("", response_model=BatchOut)
async def create_batch(
    register_id: int = Form(...),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    register = db.get(RegisterDefinitionORM, register_id)
    if register is None:
        raise HTTPException(status_code=404, detail="Register definition not found")

    # Parse Excel
    try:
        reg_dict, bitfields = parse_excel(register.file_path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot read register file: {exc}")

    # Read & parse each dat
    dat_inputs: list[tuple[str, dict[str, int]]] = []
    for upload in files:
        if not upload.filename:
            continue
        content = await upload.read()
        addr_val = parse_dat_bytes(content, upload.filename)
        dat_inputs.append((upload.filename, addr_val))

    if not dat_inputs:
        raise HTTPException(status_code=400, detail="No valid .dat files provided")

    # Analyse
    result = analyze(reg_dict, bitfields, dat_inputs)

    # Persist results
    batch_name = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")

    batch_record = BatchORM(
        name=batch_name,
        register_definition_id=register_id,
        dat_count=len(dat_inputs),
        warning_count=len(result.warnings),
        analyzed_at=datetime.utcnow(),
    )
    db.add(batch_record)
    db.commit()
    db.refresh(batch_record)

    batch_dir = DATA_DIR / "batches" / str(batch_record.id)
    batch_dir.mkdir(parents=True, exist_ok=True)

    df = build_dataframe(result.bitfields, result.rows)
    csv_path = batch_dir / "result.csv"
    xlsx_path = batch_dir / "result.xlsx"
    write_csv(df, csv_path)
    write_xlsx(df, xlsx_path)

    # Save warnings & bitfield meta as JSON for fast re-serving
    meta = {
        "warnings": result.warnings,
        "bitfields": [
            {
                "name": bf.name,
                "width": bf.width,
                "register_name": bf.register_name,
                "register_addr": bf.register_addr,
            }
            for bf in result.bitfields
        ],
    }
    (batch_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    batch_record.result_csv_path = str(csv_path)
    batch_record.result_xlsx_path = str(xlsx_path)
    db.commit()
    db.refresh(batch_record)

    return _batch_to_out(batch_record)


@router.get("/{batch_id}", response_model=BatchDetailOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(BatchORM, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch_dir = DATA_DIR / "batches" / str(batch_id)
    meta_path = batch_dir / "meta.json"
    csv_path = Path(batch.result_csv_path) if batch.result_csv_path else None

    if not meta_path.exists() or csv_path is None or not csv_path.exists():
        raise HTTPException(status_code=404, detail="Result files not found")

    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    import pandas as pd
    df = pd.read_csv(csv_path)

    bitfields = [BitFieldDefSchema(**bf) for bf in meta["bitfields"]]
    bf_names = [bf.name for bf in bitfields]

    rows: list[BatchRowSchema] = []
    for _, row in df.iterrows():
        values = [None if pd.isna(row[name]) else int(row[name]) for name in bf_names]
        rows.append(BatchRowSchema(testCase=str(row["TestCase"]), values=values))

    return BatchDetailOut(
        summary=_batch_to_out(batch),
        bitFields=bitfields,
        rows=rows,
        warnings=meta["warnings"],
    )


@router.get("/{batch_id}/download.csv")
def download_csv(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(BatchORM, batch_id)
    if batch is None or not batch.result_csv_path:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(
        path=batch.result_csv_path,
        filename=f"batch_{batch_id}.csv",
        media_type="text/csv",
    )


@router.get("/{batch_id}/download.xlsx")
def download_xlsx(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(BatchORM, batch_id)
    if batch is None or not batch.result_xlsx_path:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(
        path=batch.result_xlsx_path,
        filename=f"batch_{batch_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.delete("/{batch_id}", status_code=204)
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(BatchORM, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch_dir = DATA_DIR / "batches" / str(batch_id)
    db.delete(batch)
    db.commit()

    # Clean up files
    import shutil
    if batch_dir.exists():
        shutil.rmtree(batch_dir, ignore_errors=True)
