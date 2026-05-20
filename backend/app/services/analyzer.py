"""Core bit-field extraction logic."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .excel_parser import BitFieldInfo, RegisterInfo


@dataclass
class AnalysisResult:
    rows: List[dict]
    warnings: List[str]
    bitfields: List[BitFieldInfo]


def analyze(
    registers: Dict[str, RegisterInfo],
    ordered_bitfields: List[BitFieldInfo],
    dat_files: List[Tuple[str, Dict[str, int]]],
) -> AnalysisResult:
    warnings: List[str] = []
    rows: List[dict] = []
    unknown_counts: Dict[str, int] = {}

    for filename, addr_val_map in dat_files:
        values: List[Optional[int]] = []

        for addr in addr_val_map:
            if addr not in registers:
                unknown_counts[addr] = unknown_counts.get(addr, 0) + 1

        for bf in ordered_bitfields:
            addr = bf.register_addr
            if addr not in addr_val_map:
                values.append(None)
                msg = f"Missing address 0x{addr} ({bf.register_name}) in {filename}"
                if msg not in warnings:
                    warnings.append(msg)
            else:
                raw = addr_val_map[addr]
                mask = (1 << bf.width) - 1
                extracted = (raw >> bf.low_bit) & mask
                values.append(extracted)

        rows.append({"testCase": filename, "values": values})

    for addr, count in sorted(unknown_counts.items()):
        warnings.append(f"Unknown address 0x{addr} ({count} test case{'s' if count != 1 else ''})")

    return AnalysisResult(rows=rows, warnings=warnings, bitfields=ordered_bitfields)
