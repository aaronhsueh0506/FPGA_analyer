"""Parse an .xlsx register-definition file.

Sheet name: Registers
Header row: 7 (1-indexed, i.e. row index 6 in openpyxl)
Columns: ADDR | Register | INI | Bits | Member
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import openpyxl


@dataclass
class BitFieldInfo:
    name: str
    low_bit: int
    width: int
    ini: str  # raw hex string from Excel, e.g. "0x0"
    register_name: str
    register_addr: str  # 4-char uppercase hex, e.g. "0010"


@dataclass
class RegisterInfo:
    addr: str  # 4-char uppercase hex
    name: str
    bitfields: list[BitFieldInfo] = field(default_factory=list)


def _parse_bits(bits_str: str) -> tuple[int, int]:
    """Return (low_bit, width) from a Bits cell value like '5_4' or '10'."""
    s = str(bits_str).strip()
    if "_" in s:
        parts = s.split("_")
        hi = int(parts[0])
        lo = int(parts[1])
        return lo, hi - lo + 1
    else:
        bit = int(s)
        return bit, 1


def parse_excel(file_path: Union[str, Path]) -> Tuple[Dict[str, RegisterInfo], List[BitFieldInfo]]:
    """Parse Excel and return (registers_by_addr, ordered_bitfields).

    registers_by_addr maps uppercase 4-char addr -> RegisterInfo.
    ordered_bitfields is a flat list in address/definition order (used as column order).
    """
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    # Find header row (contains "ADDR" anywhere in the row)
    header_row_idx = None
    for i, row in enumerate(rows):
        if row and any(c is not None and str(c).strip().upper() == "ADDR" for c in row):
            header_row_idx = i
            break

    if header_row_idx is None:
        # Fallback: assume row index 6 (7th row), capped to available rows
        header_row_idx = min(6, len(rows) - 1)

    if header_row_idx < 0 or header_row_idx >= len(rows):
        raise ValueError(f"Cannot find header row with ADDR column (sheet has {len(rows)} rows)")

    col_names = [str(c).strip().upper() if c is not None else "" for c in rows[header_row_idx]]

    def col(name: str) -> int:
        for i, c in enumerate(col_names):
            if c == name:
                return i
        return -1

    addr_col = col("ADDR")
    reg_col = col("REGISTER")
    ini_col = col("INI")
    bits_col = col("BITS")
    member_col = col("MEMBER")

    registers: dict[str, RegisterInfo] = {}
    ordered_bitfields: list[BitFieldInfo] = []
    current_addr: str | None = None

    for row in rows[header_row_idx + 1:]:
        addr_val = row[addr_col] if addr_col >= 0 else None
        reg_val = row[reg_col] if reg_col >= 0 else None
        ini_val = row[ini_col] if ini_col >= 0 else None
        bits_val = row[bits_col] if bits_col >= 0 else None
        member_val = row[member_col] if member_col >= 0 else None

        # New register block
        if addr_val is not None and str(addr_val).strip():
            raw_addr = str(addr_val).strip().upper()
            # Normalise to 4 hex chars, stripping any leading 0x
            raw_addr = raw_addr.lstrip("0X").lstrip("0X")  # handle "0x" prefix
            if raw_addr == "":
                raw_addr = "0"
            current_addr = raw_addr.zfill(4)

        if reg_val is not None and str(reg_val).strip() and current_addr is not None:
            if current_addr not in registers:
                registers[current_addr] = RegisterInfo(addr=current_addr, name=str(reg_val).strip())

        if member_val is not None and str(member_val).strip() and bits_val is not None and current_addr is not None:
            try:
                low_bit, width = _parse_bits(str(bits_val))
            except (ValueError, IndexError):
                continue  # skip malformed rows

            bf = BitFieldInfo(
                name=str(member_val).strip(),
                low_bit=low_bit,
                width=width,
                ini=str(ini_val).strip() if ini_val is not None else "0x0",
                register_name=registers[current_addr].name if current_addr in registers else "",
                register_addr=current_addr,
            )
            if current_addr in registers:
                registers[current_addr].bitfields.append(bf)
            ordered_bitfields.append(bf)

    wb.close()
    return registers, ordered_bitfields
