# Bookwise Platform

一個可逐步商業化的多租戶預約管理 SaaS 基底。範例產品是「顧問／教練／工作室」的預約、客戶與營運儀表板，Web 與 iOS/Android 共用 TypeScript API 契約。

## 技術架構

```text
apps/web      React + Vite：響應式管理後台
apps/mobile   Expo Router：iOS / Android / mobile web
apps/api      Fastify：版本化 REST API、CORS、Helmet、Zod 驗證
packages/shared  共用資料型別與輸入 schema
prisma/       PostgreSQL 多租戶資料模型
```

Web 管理台已包含儀表板、預約、客戶、服務、報表與工作區品牌／功能模組設定。API 已加入帳號註冊／登入、簽章 bearer token、密碼雜湊、使用者 workspace scope 和基本唯讀角色限制；本機將帳號與商業資料分別原子寫入 `.data/accounts.json` 和 `.data/bookwise.json`，API 重啟後仍可保留。`prisma/schema.prisma` 是後續 PostgreSQL 整合的資料模型草案。

> **部署限制：** 目前是單機 MVP／展示基底，不是可直接承載正式客戶資料的 SaaS。API 刻意拒絕在 production 使用 JSON repository；正式上線前仍須實作 PostgreSQL repository、migration/transaction/備份、團隊邀請與完整 membership/RBAC、登入限流的跨程序儲存、密碼重設／session 管理、稽核與個資政策；訂閱金流、郵件和推播也尚未串接。註冊使用者的 token 會綁定自己的 workspace；只有非 production 的範例登入可切換展示 workspace。不要將此版本直接公開部署或放入真實個資。

## 快速開始

需求：Node.js 20+、pnpm 9+。

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Web：`http://localhost:5173`  
API：`http://localhost:4000`  
API health：`http://localhost:4000/health`

本機商業資料儲存在 `.data/bookwise.json`、帳號雜湊資料儲存在 `.data/accounts.json`；可在 `.env` 設定 `BOOKWISE_DATA_FILE`、`BOOKWISE_AUTH_FILE` 改變位置。API 可從 workspace 根目錄或 `apps/api` 載入 `.env`。若要啟動既有 PostgreSQL 容器（目前 API 尚未連接該服務）：

```bash
docker compose up -d postgres
```

各端單獨啟動：

```bash
pnpm dev:web
pnpm dev:api
pnpm --filter @bookwise/mobile start
```

Expo 啟動後可用 Expo Go 掃描 QR Code，或使用 `a` 開啟 Android Emulator、使用 `i` 開啟 iOS Simulator。

## 驗證指令

```bash
pnpm typecheck
pnpm build
pnpm test
```

## API v1

| Method | Route | 用途 |
| --- | --- | --- |
| GET | `/health` | 服務健康檢查 |
| POST | `/api/v1/auth/register` | 註冊帳號並建立獨立工作區 |
| POST | `/api/v1/auth/login` | 驗證帳號密碼並取得 bearer token |
| POST | `/api/v1/auth/demo` | 本機展示登入（production 關閉） |
| POST | `/api/v1/auth/password` | 變更密碼並撤銷舊 token |
| GET | `/api/v1/dashboard` | 工作區儀表板 |
| GET / POST | `/api/v1/appointments` | 搜尋／新增預約，驗證資料並檢查時段衝突 |
| PATCH / DELETE | `/api/v1/appointments/:id` | 更新／刪除預約 |
| GET / POST | `/api/v1/customers` | 搜尋／新增客戶 |
| PATCH / DELETE | `/api/v1/customers/:id` | 更新／刪除客戶；有預約的客戶禁止刪除 |
| GET / POST | `/api/v1/services` | 查詢／新增服務 |
| PATCH / DELETE | `/api/v1/services/:id` | 編輯、啟停或刪除服務 |
| GET | `/api/v1/reports` | 預約與營收彙總，可用 `from`／`to` 篩選 |
| GET / PATCH | `/api/v1/workspace` | 工作區名稱、幣別、時區、品牌色與功能開關 |

登入後的商業 API 需要 `Authorization: Bearer <token>`；正式帳號的 workspace 由簽章 token 決定，忽略任意 workspace header。僅本機 demo token 可搭配 `x-workspace-id` 切換範例工作區，不能用來隔離真實租戶。

## 商業化演進順序

1. 把本機 JSON repository 換成 PostgreSQL/Prisma，加入 migration、seed、transaction、備份與 restore 測試。
2. 加入安全登入、邀請團隊、workspace membership、RBAC 與所有請求的 tenant 授權。
3. 加入 Stripe 訂閱、方案限制、email／推播提醒與 webhook idempotency。
4. 補上稽核記錄、rate limit、個資刪除/匯出、API integration tests、Web E2E、CI/CD 與監控。
5. 將檔案、通知與背景工作拆到 object storage、queue worker；保持既有 API contract。

## 目錄

```text
apps/api/src/server.ts       API 入口與示範 endpoints
apps/web/src/main.tsx        Web 工作台
apps/web/src/styles.css      響應式視覺樣式
apps/mobile/app/index.tsx    Expo 工作台
packages/shared/src/index.ts 共用 schema / types
prisma/schema.prisma         PostgreSQL 資料模型
docker-compose.yml            本機 PostgreSQL
```

## Phase 4

串接 React Native

```text
Login
JWT
API Integration
```

---

## Phase 5

建立 Web 平台

```text
Next.js
Admin Dashboard
Member Portal
```

---

# Learning Roadmap

```text
HTML
↓
CSS
↓
JavaScript
↓
TypeScript
↓
React
↓
Next.js
↓
Node.js
↓
NestJS
↓
PostgreSQL
↓
React Native (Expo)
```

---

# 最終技術棧

```text
Frontend Web:
Next.js + TypeScript

Frontend Mobile:
React Native + Expo

Backend:
NestJS

Database:
PostgreSQL

Source Control:
GitHub

IDE:
VS Code

OS:
Windows 11
```

---

# 最終目標

使用單一 TypeScript 技術棧開發：

✅ iOS App

✅ Android App

✅ Web Site

✅ Backend API

✅ PostgreSQL Database

並在 Windows 環境完成大部分開發工作。
