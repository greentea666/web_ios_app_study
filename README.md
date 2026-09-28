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

Web 管理台已包含儀表板、預約、客戶、服務、報表與工作區品牌／功能模組設定。API 提供帳號註冊／登入、簽章 bearer token、密碼雜湊、使用者 workspace scope 和基本唯讀角色限制；本機預設使用 JSON repository，設定 `DATABASE_URL` 後則使用 Prisma/PostgreSQL 儲存帳號、工作區與商業資料。`prisma/schema.prisma` 和 `prisma/migrations/` 管理資料模型及資料庫版本。

> **上線範圍：** 已提供可用 PostgreSQL 的 API adapter、migration 與 Render Blueprint，可部署成**公開測試版**。這仍不是正式商用 SaaS：登入 rate limit 目前存於單一程序記憶體、尚無團隊邀請／密碼重設、完整資安審查、備份還原演練、稽核與個資流程；付款訂閱、郵件和推播也未串接。請用測試資料，不要放真實客戶個資。Render 免費服務可能休眠，喚醒會有延遲；部署前確認各平台當期免費方案與限制。

## 目前商業化進度

目前階段：**可部署的 MVP／公開測試準備中；本 repository 尚未替你建立第三方帳號或公開網址。**

- 已完成：Web 管理介面、帳號註冊／登入、workspace 隔離、預約／客戶／服務／報表 CRUD、Prisma/PostgreSQL repository、初始 migration、Render 部署設定與本機 API 測試。
- 尚未完成：第三方平台實際部署、公開網址、付款訂閱、郵件通知、正式資安與個資流程。
- 搜尋狀態：目前沒有公開網址、sitemap 或搜尋引擎驗證，因此 Google／Bing 現在搜尋不到這個本機專案。Web 入口是登入／註冊工作台，不是公開產品介紹頁；即使部署並收錄，搜尋引擎也看不到登入後的儀表板資料。

**部署前準備：** 需由你登入 GitHub、Neon、Render 和 Cloudflare 完成連結及輸入各平台產生的資料庫連線字串；不要把 secrets 提供給聊天或提交到 Git。API production 會要求 `DATABASE_URL`、至少 32 個隨機字元的 `AUTH_SECRET` 及明確的 `CORS_ORIGIN`。Web 的 `VITE_API_URL` 必須設為公開 API 的 `/api` 根網址。

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

本機商業資料儲存在 `.data/bookwise.json`、帳號雜湊資料儲存在 `.data/accounts.json`；可在 `.env` 設定 `BOOKWISE_DATA_FILE`、`BOOKWISE_AUTH_FILE` 改變位置。API 可從 workspace 根目錄或 `apps/api` 載入 `.env`。本機若已安裝 Docker，可啟動 PostgreSQL 並套用 migration：

```bash
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
```

設定 `.env` 的 `DATABASE_URL` 與 `DIRECT_URL`（本機可用相同 URL）後再啟動 API，便會使用 PostgreSQL repository；不設定則使用本機 JSON repository。

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

1. **目前：本機 MVP。** 完成核心管理流程，但無公開部署，不能承載正式資料。
2. 將帳號與商業資料 repository 換成 PostgreSQL/Prisma，補 migration、transaction、備份與還原測試；再部署 API 並設定 production secrets、CORS、監控。
3. 部署 Web，設定正式 API URL；建立公開產品介紹頁、隱私權政策與服務條款，再開始邀請測試使用者。
4. 加入團隊邀請、完整 workspace membership/RBAC、密碼重設／session 管理、跨程序 rate limit、稽核與個資刪除／匯出。
5. 加入訂閱金流、方案限制、email／推播提醒和 webhook idempotency；完成 E2E、CI/CD、備份演練與正式營運檢查。

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

## 免費公開部署與搜尋引擎

免費方案適合展示與早期測試，平台配額、休眠政策及條款可能調整；正式商用前請重新確認各平台價格和限制。Cloudflare Worker 提供免費 `*.workers.dev` 網址，不必購買自訂網域。

### 建議註冊的平台

| 平台 | 用途 | 何時需要 |
| --- | --- | --- |
| [GitHub](https://github.com/) | 存放程式碼，讓部署平台從 repository 自動建置 | 部署前；若程式碼已在 GitHub 可略過 |
| [Cloudflare](https://dash.cloudflare.com/) | Workers Builds 部署 Vite 靜態 assets，提供公開 `*.workers.dev` 網址 | 公開前端展示時 |
| [Neon](https://neon.tech/) | PostgreSQL 資料庫；Render API 透過 `DATABASE_URL` 連線 | API 部署前 |
| [Render](https://render.com/) | 依 repository 的 [render.yaml](render.yaml) 部署 Node.js API、執行 migration 並提供 `/health` | API 部署時 |
| [Google Search Console](https://search.google.com/search-console/) | 驗證網站、檢查 Google 抓取狀態、提交 sitemap | 網站已經有公開 HTTPS 網址後 |
| [Bing Webmaster Tools](https://www.bing.com/webmasters/) | 驗證網站並提交 Bing 索引；可選擇匯入 Search Console 網站 | 網站已經有公開 HTTPS 網址後 |

以上服務都有免費入門選項，但不代表永久免費或沒有用量限制。Cloudflare Worker 負責前端靜態檔；Render 免費 API 可能休眠。不要把 `AUTH_SECRET`、資料庫連線字串或其他 secrets 放進前端環境變數或 Git。

### 免費部署完整流程

1. 將程式推到 GitHub，確認最新變更已在預設分支。
2. 在 Neon 建立 PostgreSQL project，複製 pooled connection string 作為 `DATABASE_URL`、direct connection string 作為 `DIRECT_URL`。API runtime 使用 pooled URL，Render build 的 Prisma migration 使用 direct URL。把兩條 URL 都視為 secret。
3. 在 Render 選 **New > Blueprint**，連結 repository 並套用根目錄的 `render.yaml`。在服務環境變數填入 `DATABASE_URL`、`DIRECT_URL`，將 `CORS_ORIGIN` 暫時設為 `https://web-ios-app-study.<你的帳號>.workers.dev`（以 Cloudflare 實際網址為準）；`AUTH_SECRET` 由 Blueprint 產生。Render build 會執行 Prisma generate、migration deploy 與 typecheck，start command 啟動 Fastify。
4. 等 Render 部署完成，在服務 Settings 確認 health check path 是 `/health`，打開 `https://你的-api.onrender.com/health`，預期回傳 `{"status":"ok","service":"bookwise-api"}`。記下 API 網址。
5. 在 Cloudflare Workers Builds 連結同一個 GitHub repository，建立 Worker `web-ios-app-study`。Root directory 設 `/`；Build command 設 `pnpm run build`；Deploy command 設 `npx wrangler deploy --config apps/web/wrangler.jsonc`。設定 Build variable `VITE_API_URL=https://你的-api.onrender.com/api` 後重新部署。Wrangler 設定會發布 `apps/web/dist`，並將未知路徑 fallback 到 SPA `index.html`。
6. 回 Render 把 `CORS_ORIGIN` 更新為 Cloudflare 顯示的實際 `https://<worker>.<subdomain>.workers.dev` 網址並重新部署。確認 Web 與 API 均使用 HTTPS，API health check 正常。

如果平台無法辨識 Blueprint，可在 Render 手動建立 Web Service：Root Directory 留空、Build Command 使用 `pnpm install --frozen-lockfile --prod=false && pnpm --filter @bookwise/api db:generate && pnpm --filter @bookwise/api db:migrate && pnpm --filter @bookwise/api typecheck`、Start Command 使用 `pnpm --filter @bookwise/api start`，Health Check Path 設 `/health`，並照 Blueprint 設定 `NODE_ENV=production`、`AUTH_SECRET`、`DATABASE_URL`、`DIRECT_URL`、`CORS_ORIGIN`。第一次部署前必須先建立 Neon DB 並設定兩條 URL，migration 才能成功。

### 公開網站線上驗收

使用無痕視窗打開 Cloudflare `workers.dev` 網址：

1. 建立一個專用測試帳號（密碼至少 12 字元），登入後確認工作區名稱正確。
2. 在「服務項目」新增測試服務，例如「線上測試諮詢」，設定時長與價格。
3. 在「客戶資料」新增測試客戶；在「預約管理」新增未來日期的預約，選擇剛新增的服務與客戶。
4. 編輯預約狀態，確認儀表板與營運報表同步更新；再編輯品牌名稱／顏色，確認設定可以儲存。
5. 重新整理頁面、登出再登入，確認服務、客戶、預約和設定仍存在；以另一個新帳號登入，確認看不到第一個帳號的資料。
6. 用 Render API health endpoint 確認狀態。免費 API 休眠後第一次請求可能需要等待服務喚醒。

不要使用真實客戶個資或重要密碼測試。免費平台不等於備份服務；正式收集資料前先建立自動備份、還原演練、監控與隱私權政策。

### 搜尋引擎收錄

若目標是讓搜尋結果介紹產品，需先建立不需登入即可瀏覽的公開介紹頁、聯絡方式與隱私權政策；目前首頁是登入工作台，metadata 不能取代公開內容。部署後在 Google Search Console 與 Bing Webmaster Tools 新增公開網址並完成所有權驗證；建立並提交 sitemap、檢查 `robots.txt` 與頁面抓取狀態，再要求索引。搜尋引擎是否收錄及排名由平台自行決定，提交網址不保證立即出現在搜尋結果。

搜尋引擎是否收錄及排名由平台自行決定，提交網址不保證立即出現在搜尋結果。修改網站後需重新部署；README 的網址、功能與平台狀態也應一併更新。
