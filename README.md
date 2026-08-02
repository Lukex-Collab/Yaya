# 灵伴（LingPal）— AI陪伴 × 3D世界

> "牙牙在，就不孤单"

**一个微信小程序，两种陪伴模式。**

| 模式 | 定位 | 目标用户 |
|------|------|----------|
| 🧸 **牙牙（yaya）** | AI 守护玩偶 — 聊天/记忆/日记/健康/安全 | 18-28岁城市独居女性 |
| 🌍 **灵伴世界** | 3D 宠物探索 — 5物种/探索/盲盒/NFC/社交 | 潮玩年轻群体 |

实体毛绒玩具 × AI 陪伴软件 × Bluetooth/NFC 硬件 — 三合一消费产品。

---

## 🏗️ 双后端架构

为不同场景提供两种后端方案：

| 后端 | 语言 | 用途 | 启动 |
|------|------|------|------|
| 🚀 **Go/Gin (生产级)** | `server/` | 31微服务 · 100+路由 · pgvector · Redis · 所有功能 | `make run` |
| ⚡ **Express/TS (快速原型)** | `server.ts` | Gemini AI 对话 · SSR · 内存存储 · 快速验证想法 | `npx tsx server.ts` |

```
用户 → public/index.html (Web Demo) 或 miniapp-yaya (小程序)
         │                    │
    ┌────┴────┐         ┌─────┴──────┐
    │ Express │         │  Go/Gin    │
    │ server.ts│        │  server/   │
    │(Gemini) │         │ (DeepSeek) │
    └─────────┘         └────────────┘
```

同一个前端可以对接任意后端。开发新功能时先在 Express 快速验证，确认后再移植到 Go。

---

## 🖥️ 双Demo

| Demo | 文件 | 怎么用 |
|------|------|--------|
| 📱 **Web Demo** | `public/index.html` | 浏览器直接打开 → 连 Express 或 Go 后端 |
| 📱 **小程序 Demo** | `miniapp-yaya/demo/index.html` | 浏览器打开 → 连 CloudBase 云函数 |

---

## 快速开始

### Go 后端 (生产)

```bash
git clone https://github.com/Lukex-Collab/Yaya.git && cd Yaya
docker compose up -d              # PG16+pgvector + Redis7 + MinIO
cd server && go run cmd/migrate/main.go up && go run cmd/migrate/main.go seed
go run cmd/server/main.go         # → http://localhost:8080
```

### Express 后端 (快速原型)

```bash
npm install && npx tsx server.ts  # → http://localhost:3000
```

---

## 架构全景

```
116 Go源文件 · 13446行 · 31微服务 · 26 SQL迁移 · 17包测试通过
Express 463行 · Web前端 1672行 · 小程序 4481行 · 总计约20000行
```

## 项目结构

```
server/                          # Go 后端 (生产级)
├── cmd/server/main.go           # API Gateway (Gin) 入口
├── cmd/migrate/main.go          # 迁移+种子工具
├── internal/
│   ├── user/chat/memory/journal/  # 核心服务
│   ├── ritual/health/achievement/ # 功能服务
│   ├── safety/payment/push/admin/ # 业务服务
│   ├── world/voice/emotion/       # 世界+情绪
│   ├── attachment/bidcare/        # 依恋+双向守护 ★
│   ├── capsule/dream/             # 时间胶囊+梦境 ★
│   ├── soulmate/tts/hardware/     # 配对+语音+硬件 ★
│   ├── nfc/pet/social/            # NFC+宠物+社交
│   ├── search/share/export/       # 搜索+分享+导出
│   └── core/                      # 基础设施
├── pkg/ (6工具包)                 # llm/realtime/safetyfilter/...
├── migrations/ (26SQL)            # 13组迁移
└── integration/                   # 集成测试

miniapp-yaya/                    # 微信小程序 (89文件)
├── pages/ (13页面)
├── cloudfunctions/ (5云函数)
├── demo/index.html              # 浏览器Demo
└── services/utils

public/index.html                # Web前端 SPA (1672行)
server.ts                        # Express 快速原型 (463行)
```

---

## API 清单

```
认证: POST login   用户: GET/PUT profile/settings
对话: POST send(SSE) GET history DELETE history/:id
记忆: POST ingest/search GET facts DELETE forget/:id
日记: POST create GET list/mood-stats GET/PUT/DELETE :id
仪式: POST good-morning/night GET bedtime-story GET/PUT schedule GET calendar/today/week
健康: POST period/record GET calendar/predict POST body-note
成就: GET list/new/progress
世界: GET pet/zones/pets-nearby POST explore/:zoneId POST pet/feed
安全: GET status/history/devices/door-check/scenario POST alert/test/scenario/:name
支付: GET plans/subscription POST order POST cancel
推送: GET messages/unread-count POST messages/:id/read
上传: POST upload/image POST upload/voice
语音: POST voice/upload GET messages POST tts/synthesize GET voices
管理: GET admin/stats GET users GET users/:id
情绪: GET emotion/trend/report/insights POST rescue
依恋: GET attachment/checkin/status/reunion/timeline/digest
双向: GET care/yaya-status/concerns/report POST tend/reassure
胶囊: GET capsule/moments/life-story GET/:id POST seal/unseal
梦境: GET dream/tonight/history/last-night POST feedback
社交: GET social/friends/visits/feed POST friends/visit/:id/message/:id DELETE friends/:id
配对: GET soulmate/mypair/conv/gallery POST pair/visit POST unpair
导出: POST export/data GET status POST delete-account
搜索: GET search GET search/suggest
分享: POST share/journal/:id/achievement/emotion-report GET cards
硬件: GET hardware/status POST touch/hold/release/volume
系统: GET /health/live/ready + WebSocket ws://
```

---

## 技术栈

| 层 | 方案 | 理由 |
|----|------|------|
| 后端 | Go 1.26 (Gin) / TypeScript (Express) | 双方案: 生产+快速原型 |
| 数据库 | PostgreSQL 16 + pgvector | 关系+向量一体 |
| 缓存 | Redis 7 | Pub/Sub + 限流 + 会话 |
| AI | DeepSeek / Gemini | 双引擎可选 |
| 对象存储 | MinIO → S3/OSS | S3兼容 |
| 实时通信 | WebSocket (gorilla/websocket) | 22k★ |
| CI/CD | GitHub Actions | lint+test+integration+docker |
| 部署 | Docker Compose → K8s | 一键部署 |

## 开发命令

```bash
make dev-up      # 启动 PG+Redis+MinIO
make migrate     # 数据库迁移
make seed        # 种子数据
make run         # 启动 Go 后端 :8080
make test        # 运行测试
make build       # 编译二进制
npx tsx server.ts # 启动 Express 后端 :3000
```

## 贡献

```bash
git checkout -b feat/my-feature
# 开发 → 测试 → commit
git push origin feat/my-feature
# 开 PR → CI 通过 → squash merge
```

*Made with ❤️ for every girl who deserves a warm companion.*
