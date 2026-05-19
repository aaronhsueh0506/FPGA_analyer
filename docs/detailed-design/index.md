# FPGA Register Analyzer — 系統詳細設計

> 版本：v0.4.0　|　日期：2026-05-14　|　開發者：Aaron Hsueh

本文件為 V-Model 中的「系統詳細設計 (SDD)」，按主題拆分為 5 份。請依序閱讀或按需查閱。
高階「系統架構」（what & why）請見 [../architecture.md](../architecture.md)。

## 文件清單

| # | 標題 | 主要內容 |
| --- | --- | --- |
| 01 | [概述與元件分解](01-overview-and-components.md) | V-Model 階層位置、前端 React 元件樹、後端服務分層 |
| 02 | [資料模型與元件介面](02-data-and-interfaces.md) | TypeScript / Pydantic / SQLite schema、Props 介面、REST API contract |
| 03 | [動態行為（序列圖 / 資料流 / 狀態圖）](03-dynamics.md) | 6 個序列圖 + 5 個資料流圖 + 4 個狀態圖 |
| 04 | [演算法詳述](04-algorithms.md) | Bit-field 解析、組合分析、Range 涵蓋率、Histogram 分箱（偽程式碼） |
| 05 | [品質屬性（錯誤處理 / 效能 / 安全）](05-quality.md) | 錯誤路徑、效能考量、安全考量、文件變更歷程 |

## 圖表類型統計

- 序列圖：6 個（§5）
- 資料流圖：5 個（§6）
- 狀態圖：4 個（§7）
- 結構圖（component tree / data model）：4 個（§1, §2）
- 共 19 個 Mermaid 圖

---

> 對應的高階文件：[../architecture.md](../architecture.md) / [../architecture.html](../architecture.html)
