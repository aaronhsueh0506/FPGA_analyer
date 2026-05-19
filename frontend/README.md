# FPGA Register Analyzer — Frontend (UI 原型)

這是 FPGA Register Analyzer 的前端骨架，使用 **React 18 + Vite + TypeScript**。
目前所有資料皆為 mock，**未串接後端**，純粹用於確認 UI 與互動流程是否符合預期。

---

## 啟動前置：先安裝 Node.js

您的系統目前沒有安裝 Node.js。請在 terminal 跑以下指令（擇一）：

### 方式 A：用 Homebrew（您已有 brew）

```bash
brew install node
```

### 方式 B：到官網下載

https://nodejs.org/ — 下載 LTS 版（建議 v20 以上），雙擊安裝。

安裝完成後請確認版本：

```bash
node --version    # 應顯示 v20.x.x 或更高
npm --version
```

---

## 啟動專案

```bash
cd "/Users/aaronhsueh/Desktop/FPGA analyer/frontend"
npm install        # 第一次需要，會裝大約 150MB
npm run dev        # 啟動開發伺服器，瀏覽器會自動開啟 http://localhost:5173
```

---

## 確認重點

啟動後請確認以下事項：

### Layout
- 左側 sidebar、白色背景、無 emoji
- Sidebar 底部置中有「版本資訊」按鈕，點擊跳 modal（版本號 / 日期 / Aaron Hsueh）
- 右上角有語言切換按鈕（繁體中文 ⇄ English），切換後所有文字立即更新

### 五個頁面
1. **首頁**（`/`）— 統計卡片、最近批次列表、快速開始指引
2. **Register 管理**（`/registers`）— 上傳 Excel 區域、已上傳列表
3. **分析**（`/analyze`）— 三步驟流程（選 Register → 上傳 dat → 開始分析）
4. **分析結果**（`/results/:batchId`）— 三個 Tab：表格、熱力圖、警告
5. **歷史紀錄**（`/history`）— Batch 列表，點「查看」進入結果頁

### 互動 mock 範圍
- 在 Analyze 頁選 Register、拖曳/選擇 dat 檔、按開始分析 → 1.2 秒後自動跳到結果頁
- 在 Register 管理頁拖曳/選擇 .xlsx 會新增一筆假紀錄
- 結果頁可切換表格 Hex/Decimal、搜尋 bit field、切換 Tab

---

## 目錄結構

```
frontend/
├── src/
│   ├── main.tsx                  # entrypoint
│   ├── App.tsx                   # 路由設定
│   ├── components/
│   │   ├── Layout.tsx            # sidebar + topbar + outlet
│   │   ├── Sidebar.tsx
│   │   ├── VersionModal.tsx
│   │   ├── LanguageToggle.tsx
│   │   └── Heatmap.tsx           # ECharts 包裝
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Registers.tsx
│   │   ├── Analyze.tsx
│   │   ├── Results.tsx
│   │   └── History.tsx
│   ├── i18n/
│   │   ├── index.ts              # react-i18next 設定
│   │   ├── zh-TW.json
│   │   └── en.json
│   ├── mock/
│   │   └── data.ts               # 假資料
│   └── styles/
│       └── global.css            # 白底 / 深藍強調色
├── index.html
├── package.json
└── vite.config.ts
```

---

## 後續

UI 確認沒問題後，下一階段會做：
- 後端 (FastAPI + openpyxl + SQLite)
- 把前端 mock 改成實際呼叫後端 API
- PyInstaller 打包成可分發的執行檔
