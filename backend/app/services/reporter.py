"""Generate CSV and Excel output files from analysis results."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import List, Union

from openpyxl import Workbook

from .excel_parser import BitFieldInfo

PathLike = Union[str, Path]


def write_csv(bitfields: List[BitFieldInfo], rows: List[dict], dest_path: PathLike) -> None:
    columns = ["TestCase"] + [bf.name for bf in bitfields]
    with open(dest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        for row in rows:
            writer.writerow([row["testCase"]] + list(row["values"]))


def write_xlsx(bitfields: List[BitFieldInfo], rows: List[dict], dest_path: PathLike) -> None:
    columns = ["TestCase"] + [bf.name for bf in bitfields]
    wb = Workbook()
    ws = wb.active
    ws.title = "Results"
    ws.append(columns)
    for row in rows:
        ws.append([row["testCase"]] + list(row["values"]))
    for col_cells in ws.columns:
        max_len = max(
            len(str(cell.value)) if cell.value is not None else 0
            for cell in col_cells
        )
        ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 2, 30)
    wb.save(dest_path)
