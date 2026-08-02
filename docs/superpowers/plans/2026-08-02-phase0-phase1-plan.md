# 灵伴平台 — 多人协作实施计划

> **最终方案：CloudBase MVP（3天）→ Go Monorepo 自建（6周，3-5人）→ 灵伴世界上线（后续）**

**Goal:** 多人 GitHub 协作开发完整平台。先 CloudBase 验证方向，再 Go Monorepo 自建全套后端，牙牙小程序 4-6 周可上线。

**Architecture:** Go Monorepo 单进程，`internal/<module>/` 模块隔离，Gin 路由聚合。PostgreSQL 16 + pgvector + Redis。openai-go SDK 对接 DeepSeek。微信小程序原生 + TDesign。

**团队配置:** 后端 2-3 人，前端小程序 1-2 人，全栈/DevOps 1 人。

**Tech Stack:** Go 1.23+, Gin, pgx v5, pgvector, Redis, openai-go SDK, goose (DB migration), TDesign, DeepSeek API

---

## 0. 可复用现成方案

### 0.1 必用开源库（省掉大量自写代码）

| 库 | 用途 | 省掉 | Stars |
|----|------|------|-------|
| **[openai-go](https://github.com/openai/openai-go)** | OpenAI 官方 Go SDK | DeepSeek 兼容，Chat + Streaming + Embedding 全内置 | 15k+ |
| **[goose](https://github.com/pressly/goose)** | 数据库迁移工具 | 不用自己写 migrate CLI | 7k+ |
| **[pgvector/pgvector](https://github.com/pgvector/pgvector)** | PG 向量扩展 | 不用单独部署向量数据库 | 14k+ |
| **[TDesign 小程序](https://github.com/Tencent/tdesign-miniprogram)** | 微信小程序 UI 组件库 | 全部 UI 组件（聊天卡片/日历/表单/导航） | 5k+ |
| **[go-jwt](https://github.com/golang-jwt/jwt)** | JWT 库 | 不用手写 token 逻辑 | 7k+ |
| **[gin](https://github.com/gin-gonic/gin)** | HTTP 框架 | 路由/中间件/JSON | 80k+ |
| **[go-redis](https://github.com/redis/go-redis)** | Redis 客户端 | 会话/缓存/事件 | 20k+ |

### 0.2 重要参考项目

| 项目 | 可复用什么 | 链接 |
|------|-----------|------|
| **AgentPet** | AI 桌面宠物，**四层记忆体系**（几乎和我们设计一模一样：L1 工作记忆 → L4 核心事实），Live2D+语音，全部本地 SQLite | [github.com/cqzaaa/AgentPet](https://github.com/cqzaaa/AgentPet) |
| **cloudbase-agent-ui** | 小程序 AI 对话组件，SSE 流式+打字机+会话管理，可独立使用不依赖 CloudBase 后端 | [github.com/TencentCloudBase/cloudbase-agent-ui](https://github.com/TencentCloudBase/cloudbase-agent-ui) |
| **cloudbase-ai-example** | 腾讯官方小程序 AI 示例项目，clone 就能跑，可参考其 SSE 和 Prompt 写法 | [github.com/TencentCloudBase/cloudbase-ai-example](https://github.com/TencentCloudBase/cloudbase-ai-example) |

### 0.3 openai-go 直接对接 DeepSeek

DeepSeek API 与 OpenAI 完全兼容，只需改 `BaseURL`：

```go
import "github.com/openai/openai-go"

client := openai.NewClient(
    option.WithAPIKey("sk-your-deepseek-key"),
    option.WithBaseURL("https://api.deepseek.com/v1"),
)

// Chat（同步）
completion, _ := client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
    Model: openai.F(openai.ChatModel("deepseek-chat")),
    Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
        openai.UserMessage("你好"),
    }),
})

// Chat（流式 SSE）
stream := client.Chat.Completions.NewStreaming(ctx, params)
for stream.Next() {
    chunk := stream.Current()
    fmt.Print(chunk.Choices[0].Delta.Content)
}
```

**这意味着我们的 `pkg/deepseek/` 整个目录可以删掉——全是现成的。**

---

## 1. 项目结构（Go Monorepo + 小程序）

```
lingpal-platform/                    # GitHub: your-org/lingpal-platform
│
├── .github/
│   └── workflows/
│       ├── ci-backend.yml           # Go lint + test + build
│       └── ci-miniapp.yml           # 小程序 typecheck (可选)
│
├── docker-compose.yml               # 本地开发：PG + Redis + MinIO
├── Makefile
├── .env.example
│
├── server/                          # 🐹 Go Monorepo
│   ├── go.mod                       # module github.com/lingpal/platform
│   ├── go.sum
│   │
│   ├── cmd/
│   │   ├── server/
│   │   │   └── main.go              # 唯一启动入口（路由聚合）
│   │   └── migrate/
│   │       └── main.go              # goose 迁移运行器
│   │
│   ├── internal/
│   │   ├── core/                    # 🏗️ 共享基础设施 [由阿毛搭建，全员依赖]
│   │   │   ├── config.go
│   │   │   ├── postgres.go
│   │   │   ├── redis.go
│   │   │   ├── middleware/
│   │   │   │   ├── auth.go
│   │   │   │   ├── logger.go
│   │   │   │   ├── cors.go
│   │   │   │   └── ratelimit.go
│   │   │   └── response/
│   │   │       └── response.go
│   │   │
│   │   ├── user/                    # 👤 用户模块 [阿毛]
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   └── repository.go
│   │   │
│   │   ├── chat/                    # 💬 AI 对话模块 [阿狗]
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   └── prompt.go            # 牙牙 System Prompt
│   │   │
│   │   ├── memory/                  # 🧠 记忆模块 [阿毛]
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   ├── repository.go
│   │   │   └── ingester.go          # 异步记忆写入 worker
│   │   │
│   │   ├── journal/                 # 📖 日记模块 [阿狗]
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   └── repository.go
│   │   │
│   │   ├── ritual/                  # 🌅 早安晚安 [阿强]
│   │   │   ├── handler.go
│   │   │   └── service.go
│   │   │
│   │   ├── health/                  # 🩷 健康 [阿强]
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   └── repository.go
│   │   │
│   │   ├── achievement/             # 🎉 成就 [阿强]
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   └── definitions.go
│   │   │
│   │   └── safety/                  # 🔒 安全（模拟）[阿强]
│   │       ├── handler.go
│   │       └── service.go
│   │
│   ├── migrations/                  # goose SQL 迁移脚本
│   │   ├── 00001_users.sql
│   │   ├── 00002_conversations.sql
│   │   ├── 00003_memories.sql
│   │   ├── 00004_journals.sql
│   │   ├── 00005_health.sql
│   │   ├── 00006_achievements.sql
│   │   └── 00007_safety.sql
│   │
│   └── tests/                        # 集成测试
│       └── integration/
│
├── miniapp-yaya/                     # 📱 牙牙小程序 [小王 + 小李]
│   ├── project.config.json
│   ├── package.json                  # TDesign 小程序组件
│   ├── app.json / app.ts / app.wxss
│   ├── config/
│   │   └── api.ts                    # API_BASE_URL 配置
│   ├── typings/
│   │   └── api.d.ts                  # 后端 API 类型定义
│   ├── services/                     # API 请求封装
│   │   ├── request.ts                # 通用 HTTP（自动 JWT）
│   │   ├── auth.ts
│   │   ├── chat.ts
│   │   ├── journal.ts
│   │   ├── ritual.ts
│   │   ├── health.ts
│   │   ├── achievement.ts
│   │   └── safety.ts
│   ├── utils/
│   │   ├── token.ts                  # JWT 存储/读取
│   │   ├── date.ts                   # 日期格式化
│   │   └── emotion.ts                # 情绪→emoji 映射
│   ├── pages/
│   │   ├── login/                    # 微信登录页
│   │   ├── home/                     # 首页（牙牙形象+快捷入口）
│   │   ├── chat/                     # 对话页（SSE 流式）
│   │   ├── journal/                  # 日记列表
│   │   ├── journal-detail/           # 日记详情/编辑
│   │   ├── profile/                  # 个人中心
│   │   ├── health/                   # 健康关怀
│   │   ├── safety/                   # 安全状态
│   │   └── achievement/              # 成就墙
│   └── components/
│       ├── yaya-avatar/              # 牙牙形象
│       ├── chat-bubble/              # 聊天气泡
│       ├── mood-gauge/               # 情绪环形图
│       ├── ritual-card/              # 早安晚安卡片
│       └── journal-card/             # 日记卡片
│
└── docs/
    ├── 2026-08-02-lingpal-platform-design.md   # 设计文档
    ├── api/
    │   └── openapi.yaml                        # OpenAPI 契约文件
    └── superpowers/
        └── plans/
            └── 2026-08-02-phase0-phase1-plan.md  # 本文档
```

---

## 2. GitHub 协作流程

### 2.1 仓库设置

```bash
# 组织账号
https://github.com/lingpal/lingpal-platform

# 分支保护规则
main:  require PR + 1 review + CI pass
       no direct push
       linear history (rebase merge)
```

### 2.2 分支命名

```
feat/<module>-<brief>       # 新功能: feat/chat-sse-stream
fix/<module>-<brief>        # 修 bug: fix/auth-token-expire
chore/<brief>               # 杂项:   chore/go-mod-tidy
```

### 2.3 PR 模板

```markdown
## 变更
- [ ] 新增/修改了 internal/<module>/
- [ ] 测试通过 `go test ./internal/<module>/... -v`
- [ ] 与 OpenAPI 契约一致

## 截图（前端 PR）
(如果有 UI 变动)
```

### 2.4 CI 流水线

```yaml
# .github/workflows/ci-backend.yml
name: CI Backend
on:
  pull_request:
    paths: ['server/**']

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.23' }
      - run: cd server && go vet ./internal/...
      - uses: golangci/golangci-lint-action@v6

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env: { POSTGRES_USER: test, POSTGRES_PASSWORD: test, POSTGRES_DB: test }
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.23' }
      - run: cd server && go test ./internal/... -v -cover

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd server && go build ./cmd/server
```

### 2.5 Commit 规范

```
feat(chat): add SSE streaming response
fix(auth): handle expired JWT token
chore(deps): update openai-go to v0.5.0
docs(api): add OpenAPI chat endpoint spec
```

---

## 3. 开发阶段划分

### Phase 0: CloudBase 验证（Day 1-3 — 1 人）

> **目标：** 微信里能跟牙牙聊天。**不做后端开发。**

| 天 | 做什么 | 产出 |
|----|--------|------|
| Day 1 | 注册 CloudBase、开通 AI+、创建小程序项目 | 项目跑起来 |
| Day 2 | 配 Agent System Prompt（牙牙性格）、接入 cloudbase-agent-ui 组件 | 对话页能聊天 |
| Day 3 | 加首页（牙牙形象）+ 微信登录 + 发给朋友测试 | **可演示 Demo** |

**这一步的价值：** 3 天验证"AI 宠物陪伴有没有人想用"，而不是 6 周后发现方向不对。

### Phase 1: Go Monorepo 自建（Week 1-6 — 3-5 人）

> **目标：** 自建完整后端 + 牙牙小程序全部 7 场景，可上线。

---

## 4. 分工方案

```
Week 1-2: 基础设施 Sprint
─────────────────────────────────────────
阿毛 (后端)  → core/ (config/DB/Redis/middleware/response)
               user/ (微信登录+JWT)
               cmd/server/main.go (路由聚合)
               cmd/migrate/main.go

阿狗 (后端)  → chat/ (openai-go SDK对接+SSE流式)
               chat/prompt.go (System Prompt模板)

阿强 (后端)  → migrations/ (写全部SQL)
               帮阿毛 review core/

小王 (前端)  → 小程序骨架 (app/TDesign配置)
               login页 + home页
               services/request.ts (JWT自动携带)

小李 (全栈)  → docker-compose.yml + .env
               CI pipeline (.github/workflows/)
               Makefile
               OpenAPI 契约 (docs/api/openapi.yaml)
─────────────────────────────────────────
里程碑: 登录→对话→记忆 链路跑通
```

```
Week 3-4: 核心功能 Sprint
─────────────────────────────────────────
阿毛 (后端)  → memory/ (pgvector检索+异步写入+四层记忆)

阿狗 (后端)  → journal/ (CRUD+AI情绪分析+自动标题)

阿强 (后端)  → ritual/ (早安晚安+定时推送)
               health/ (经期记录+身体笔记)

小王 (前端)  → chat页 (SSE流式+打字机+语音输入)
               chat-bubble组件
               journal+journal-detail页

小李 (全栈)  → 集成测试 + 本地联调
               帮前端写 yaya-avatar/mood-gauge 组件
─────────────────────────────────────────
里程碑: 对话+日记+早安晚安 可演示
```

```
Week 5-6: 完整功能 Sprint
─────────────────────────────────────────
阿毛 (后端)  → memory/ 四层记忆完善
               事件总线 (Redis Pub/Sub: chat.completed→memory.ingest)

阿狗 (后端)  → journal/ link_memories 关联
               DeepSeek 批量分析优化

阿强 (后端)  → achievement/ (12个成就+事件检测)
               safety/ (模拟数据)

小王 (前端)  → profile/ + health/ + safety/ + achievement/ 页
               ritual-card / journal-card 组件

小李 (全栈)  → 全链路测试 + 压力测试
               部署文档 + 生产 docker-compose
               小程序审核准备
─────────────────────────────────────────
里程碑: 全部 7 场景完整，提交微信审核 🚀
```

### Phase 2: 灵伴世界 + 硬件（牙牙上线后）

```
Cocos Creator 3D 小游戏
NFC 实体绑定
AI 宠物性格引擎（复用 Go backend）
```

---

## 5. 关键协作约定

### 5.1 模块接口契约——OpenAPI First

每个模块开发前，先在 `docs/api/openapi.yaml` 定好接口：

```yaml
# 阿毛先写这个，阿狗/阿强/小王照此开发
/api/v1/chat/send:
  post:
    summary: 发送消息（SSE流式）
    security: [bearerAuth: []]
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [content]
            properties:
              content: { type: string }
              conversation_id: { type: string }
    responses:
      '200':
        description: SSE流式文本
        content:
          text/event-stream: {}
```

这样阿狗写 `chat/handler.go`、小王写 `pages/chat/chat.ts` 都对着同一份契约，联调时不会鸡同鸭讲。

### 5.2 路由注册约定

每个模块只暴露一个公开函数，在 `main.go` 里聚合：

```go
// internal/chat/handler.go
func RegisterRoutes(rg *gin.RouterGroup, deps Dependencies) {
    h := newHandler(deps)
    rg.POST("/chat/send", h.SendMessage)
    rg.GET("/chat/history", h.GetHistory)
    rg.DELETE("/chat/history/:id", h.DeleteConversation)
}
```

```go
// cmd/server/main.go
func main() {
    // ...
    api := r.Group("/api/v1")

    // 无需认证
    user.RegisterRoutes(api, deps)

    // 需要认证
    auth := api.Group("")
    auth.Use(middleware.Auth(cfg.JWTSecret))
    chat.RegisterRoutes(auth, deps)
    memory.RegisterRoutes(auth, deps)
    journal.RegisterRoutes(auth, deps)
    ritual.RegisterRoutes(auth, deps)
    health.RegisterRoutes(auth, deps)
    achievement.RegisterRoutes(auth, deps)
    safety.RegisterRoutes(auth, deps)
}
```

**任何模块的 handler 改动，只改自己的文件 + 可能改一行 main.go 路由。零冲突。**

### 5.3 Dependencies 注入

```go
// internal/core/deps.go
type Dependencies struct {
    Pool       *pgxpool.Pool
    Redis      *redis.Client
    Config     *config.Config
    DeepSeek   *openai.Client
}
```

每个模块的 Service 通过 Dependencies 拿到自己需要的，不互相依赖。

---

## 6. 技术决策速查

| # | 决策 | 结论 | 原因 |
|---|------|------|------|
| 1 | LLM SDK | **openai-go** | OpenAI 官方 SDK，DeepSeek 兼容，SSE 内置 |
| 2 | 数据库迁移 | **goose** | 比手写 migrate CLI 省两天 |
| 3 | 向量存储 | **pgvector** | 和 PG 一体，不用部署新服务 |
| 4 | 进程模型 | **单进程，多模块** | 开发简单，拆微服务时成本低 |
| 5 | 前端组件库 | **TDesign** | 腾讯官方，微信小程序第一方支持 |
| 6 | 接口契约 | **OpenAPI 3.0 YAML** | 前后端并行开发的前提 |
| 7 | AI 记忆参考 | **AgentPet 四层体系** | 开源项目，架构几乎一致，可参考实现 |

---

## 7. 开发环境一键启动

```bash
# 任何人 clone 之后的操作
git clone https://github.com/lingpal/lingpal-platform.git
cd lingpal-platform

# 1. 启动基础设施
make dev-up          # docker compose up -d (PG+Redis+MinIO)

# 2. 数据库迁移
make migrate         # goose up

# 3. 复制环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 4. 启动后端（单进程）
make run             # go run cmd/server/main.go

# 5. 启动小程序
# 微信开发者工具打开 miniapp-yaya/
```

---

## 8. 测试策略

```
单元测试:  internal/<module>/*_test.go
          go test ./internal/... -v
          覆盖率要求: service 层 > 80%

集成测试:  tests/integration/
          go test ./tests/integration/... -tags=integration
          需要 docker compose 环境

API 测试:  curl 脚本 + Bruno/Postman collection
          docs/api/test-collection.json
```

---

*计划结束。可即刻开始分工开发。*
