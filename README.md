# 灵伴平台（LingPal Platform）

AI 陪伴产品统一平台：**牙牙（yaya）** 微信小程序 + **灵伴世界（LingPal World）** 微信小游戏。

## 快速开始

### 环境要求

| 工具 | 说明 |
|------|------|
| Go 1.23+ | 后端语言 |
| Docker Desktop | PostgreSQL + Redis |
| DeepSeek API Key | AI 模型调用 |

### 1. 启动基础设施

```bash
docker compose up -d
```

启动 PostgreSQL 16 (pgvector) + Redis 7 + MinIO。

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
```

### 3. 数据库迁移

```bash
make migrate
```

### 4. 种子数据（可选）

```bash
make seed
```

### 5. 启动后端

```bash
make run
```

API Gateway 运行在 `http://localhost:8080`。

### 验证

```bash
curl http://localhost:8080/health
# {"code":0,"msg":"ok","data":{"status":"healthy","version":"0.1.0"}}

curl -X POST http://localhost:8080/api/v1/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code":"dev","nickname":"测试用户"}'
# 返回 JWT token
```

## 项目结构

```
├── server/                   # Go 后端
│   ├── cmd/server/main.go   # 唯一入口
│   ├── internal/
│   │   ├── core/            # 基础设施（config/DB/Redis/JWT）
│   │   ├── user/            # 用户服务（微信登录）
│   │   ├── chat/            # AI 对话（DeepSeek SSE 流式）
│   │   ├── memory/          # 记忆系统（pgvector 四层）
│   │   ├── journal/         # 日记服务（AI 情绪分析）
│   │   ├── ritual/          # 早安晚安仪式
│   │   ├── health/          # 健康关怀
│   │   ├── achievement/     # 成就系统
│   │   └── safety/          # 安全检测（模拟）
│   └── migrations/          # 数据库迁移脚本
├── miniapp-yaya/            # 牙牙微信小程序
└── deploy/                  # 生产部署配置
```

## API 概览

| 模块 | 路由 | 说明 |
|------|------|------|
| 认证 | `POST /api/v1/auth/wechat/login` | 微信登录（开发用 code=dev） |
| 用户 | `GET/PUT /api/v1/user/profile` | 用户信息 |
| 对话 | `POST /api/v1/chat/send` | SSE 流式对话 |
| 记忆 | `POST /api/v1/memory/search` | 语义记忆检索 |
| 日记 | `POST /api/v1/journal/create` | 创建日记（AI 自动分析） |
| 仪式 | `POST /api/v1/ritual/good-morning` | 早安问候 |
| 健康 | `POST /api/v1/health/period/record` | 经期记录 |
| 成就 | `GET /api/v1/achievement/list` | 成就列表 |
| 安全 | `GET /api/v1/safety/status` | 安全状态（模拟） |

## 开发命令

```bash
make dev-up      # 启动 Docker 服务
make dev-down    # 停止
make migrate     # 数据库迁移
make seed        # 种子数据
make run         # 启动后端
make test        # 运行测试
make build       # 编译二进制
make lint        # 代码检查
```

## 贡献指南

我们欢迎所有贡献！请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解：

- 分支策略 — feat/ fix/ refactor/ 从 main 切出
- Commit 规范 — Conventional Commits
- PR 流程 — 至少 1 人 Review + CI 全部通过
- 开发环境 — Docker + Go + 微信开发者工具

**TL;DR：** 不要直接 push main → 切分支开发 → rebase → 开 PR → squash merge
