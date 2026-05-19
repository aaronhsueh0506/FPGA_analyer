"""Parse a single .dat test-case file.

Format: ASCII, each line is 12 hex characters
  first 4 chars = address (hex, no 0x prefix)
  last  8 chars = 32-bit value (hex, no 0x prefix)
"""
from __future__ import annotations

from pathlib import Path


def parse_dat(file_path: str | Path) -> dict[str, int]:
    """Return {addr_upper4: int_value} for all lines in the dat file."""
    result: dict[str, int] = {}
    path = Path(file_path)
    with path.open("r", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            # Support both "0010000c0802" (12 chars) and "0010 000c0802" (with space)
            parts = line.split()
            if len(parts) == 2:
                addr_raw, val_raw = parts[0], parts[1]
            elif len(parts) == 1 and len(parts[0]) >= 12:
                addr_raw = parts[0][:4]
                val_raw = parts[0][4:12]
            else:
                continue  # malformed line

            addr = addr_raw.strip().upper().zfill(4)
            try:
                value = int(val_raw.strip(), 16)
            except ValueError:
                continue
            result[addr] = value
    return result


def parse_dat_bytes(content: bytes, filename: str) -> dict[str, int]:
    """Same as parse_dat but accepts raw bytes (for in-memory uploaded file)."""
    result: dict[str, int] = {}
    for raw_line in content.splitlines():
        line = raw_line.decode("ascii", errors="replace").strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) == 2:
            addr_raw, val_raw = parts[0], parts[1]
        elif len(parts) == 1 and len(parts[0]) >= 12:
            addr_raw = parts[0][:4]
            val_raw = parts[0][4:12]
        else:
            continue

        addr = addr_raw.strip().upper().zfill(4)
        try:
            value = int(val_raw.strip(), 16)
        except ValueError:
            continue
        result[addr] = value
    return result
