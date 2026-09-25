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

目前 API 預設使用記憶體資料，讓新環境可以立即展示；`prisma/schema.prisma` 已定義 Workspace、User、Appointment，下一步可將 repository 接到 PostgreSQL。重啟 API 會重置示範資料。

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

PostgreSQL 開發服務：

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
| GET | `/api/v1/dashboard` | 工作區儀表板 |
| GET | `/api/v1/appointments` | 預約列表 |
| POST | `/api/v1/appointments` | 建立預約，使用 Zod 驗證 |
| PATCH | `/api/v1/appointments/:id` | 切換預約狀態 |
| DELETE | `/api/v1/appointments/:id` | 刪除預約 |

所有商業資料應帶 `workspaceId`，正式環境再加入 JWT／session middleware、RBAC、rate limit、audit log 與 payment webhook。

## 商業化演進順序

1. 將 API 的記憶體陣列替換為 Prisma repository，加入 migration、seed 與 transaction。
2. 加入登入、邀請團隊、角色權限與每個 request 的 workspace scope。
3. 加入 Stripe 訂閱、方案限制、email／推播提醒與 webhook idempotency。
4. 補上 API integration tests、Web E2E、Mobile release channel、CI/CD 與錯誤監控。
5. 將檔案、通知與背景工作拆到 object storage、queue worker；保留現有 API contract。

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
