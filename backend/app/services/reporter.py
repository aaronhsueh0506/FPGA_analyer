"""Generate CSV and Excel output files from analysis results."""
from __future__ import annotations

from pathlib import Path
from typing import List, Union

import pandas as pd

from .excel_parser import BitFieldInfo

PathLike = Union[str, Path]


def build_dataframe(
    bitfields: List[BitFieldInfo],
    rows: List[dict],
) -> pd.DataFrame:
    columns = ["TestCase"] + [bf.name for bf in bitfields]
    records = []
    for row in rows:
        record = [row["testCase"]] + list(row["values"])
        records.append(record)
    return pd.DataFrame(records, columns=columns)


def write_csv(df: pd.DataFrame, dest_path: PathLike) -> None:
    df.to_csv(dest_path, index=False)


def write_xlsx(df: pd.DataFrame, dest_path: PathLike) -> None:
    with pd.ExcelWriter(dest_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Results")
        ws = writer.sheets["Results"]
        for col_cells in ws.columns:
            max_len = max(
                len(str(cell.value)) if cell.value is not None else 0
                for cell in col_cells
            )
            ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 2, 30)
