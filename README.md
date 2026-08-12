# React Native Full Stack Development Roadmap

使用 Windows 開發 iOS App、Android App、Web 與 Backend 的完整規劃。

---

# 專案目標

使用單一技術棧完成：

- iOS App
- Android App
- Web Site
- Backend API
- Database

主要技術：

```text
TypeScript
React
React Native
Node.js
PostgreSQL
```

---

# 系統架構

```text
┌─────────────────────┐
│      Next.js Web     │
└──────────┬──────────┘
           │
           │ REST API
           ▼
┌─────────────────────┐
│     NestJS API      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    PostgreSQL DB    │
└─────────────────────┘
           ▲
           │ REST API
           │
┌─────────────────────┐
│ React Native (Expo) │
│  iOS / Android App  │
└─────────────────────┘
```

---

# 開發環境

## 作業系統

```text
Windows 11
```

---

## IDE

```text
Visual Studio Code
```

推薦擴充套件：

- ESLint
- Prettier
- GitLens
- Expo Tools
- Tailwind CSS IntelliSense

---

## Node.js

安裝：

https://nodejs.org

確認版本：

```bash
node -v
npm -v
```

---

## Git

安裝：

https://git-scm.com

確認：

```bash
git --version
```

---

## Android Studio

安裝：

https://developer.android.com/studio

用途：

- Android Emulator
- Android SDK

---

# React Native App

## 建立專案

```bash
npx create-expo-app mobile-app
```

進入目錄：

```bash
cd mobile-app
```

啟動：

```bash
npx expo start
```

---

# iPhone 測試

## 安裝 Expo Go

iPhone App Store：

```text
Expo Go
```

---

## 執行 App

啟動：

```bash
npx expo start
```

使用 Expo Go 掃描 QR Code。

即可在實體 iPhone 上運行。

---

# Android 模擬器

啟動 Emulator 之後：

```bash
npx expo start
```

按下：

```text
a
```

即可在模擬器啟動。

---

# 第一個畫面

修改：

```text
app/index.tsx
```

```tsx
import { View, Text } from "react-native";

export default function Home() {
  return (
    <View>
      <Text>Hello World</Text>
    </View>
  );
}
```

---

# Debug

輸出 Log：

```tsx
console.log("Button clicked");
```

查看：

```text
VS Code Terminal
Expo Console
```

---

# GitHub

初始化：

```bash
git init
```

加入：

```bash
git add .
```

提交：

```bash
git commit -m "Initial commit"
```

連接 GitHub：

```bash
git remote add origin <repository-url>
```

推送：

```bash
git push -u origin main
```

---

# Backend

推薦：

```text
Node.js
NestJS
```

建立：

```bash
npm i -g @nestjs/cli

nest new backend
```

啟動：

```bash
npm run start:dev
```

---

# API 範例

## Login

```http
POST /api/auth/login
```

---

## User Profile

```http
GET /api/users/profile
```

---

## Products

```http
GET /api/products
```

---

## Orders

```http
POST /api/orders
```

---

# Database

推薦：

```text
PostgreSQL
```

安裝：

https://www.postgresql.org/download/

管理工具：

```text
pgAdmin
```

---

# Future Web Project

建立 Next.js：

```bash
npx create-next-app@latest web
```

技術：

```text
React
Next.js
TypeScript
```

---

# Development Flow

## Phase 1

建立 App UI

```text
Login
Home
Profile
Settings
```

---

## Phase 2

建立 Backend API

```text
Authentication
Users
Products
Orders
```

---

## Phase 3

串接 PostgreSQL

```text
Users
Roles
Products
Orders
```

---

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
