# 灵伴平台（LingPal Platform）— 技术设计文档

> 版本：v1.0  
> 日期：2026-08-02  
> 性质：完整技术设计（架构 + 微服务 + 数据模型 + 开发计划）  
> 分支：`main`

---

## 0. 产品概述

灵伴平台是统一的 AI 陪伴产品平台，包含两个入口：

| 产品 | 形态 | 定位 | 开发阶段 |
|------|------|------|----------|
| **牙牙（yaya）** | 微信小程序 | AI 守护玩偶，面向 18-28 岁城市女性 | Phase 1 先行 |
| **灵伴世界（LingPal World）** | 微信小游戏（Cocos Creator 3D） | AI 宠物 × 3D 探索世界 × 实体盲盒 | Phase 2 |

两个产品共享同一套后端基础设施和 AI 引擎。

---

## 1. 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                    灵伴平台（LingPal Platform）                │
│                                                              │
│  ┌─────────────────────┐   ┌─────────────────────┐           │
│  │   牙牙小程序          │   │   灵伴世界小游戏       │           │
│  │   (原生+TDesign)     │   │   (Cocos Creator 3D) │           │
│  │   v1 先行            │   │   v2 开发              │           │
│  └─────────┬───────────┘   └───────────┬───────────┘           │
│            └──────────┬───────────────┘                      │
│                       │ HTTPS / WSS                          │
│            ┌──────────▼──────────────┐                       │
│            │      API Gateway         │                       │
│            │   (Go / Gin)             │                       │
│            └──────────┬──────────────┘                       │
│                       │                                      │
│     ┌──────┬──────┬───┴───┬──────┬──────┬──────┐            │
│     │      │      │       │      │      │      │            │
│  ┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐       │
│  │用户  ││AI   ││记忆 ││通知  ││健康  ││安全  ││手账  │       │
│  │服务  ││对话  ││服务 ││服务  ││关怀  ││(预留)││日记  │       │
│  └─────┘└──┬──┘└──┬──┘└─────┘└─────┘└─────┘└─────┘       │
│            │      │                                          │
│            ▼      ▼                                          │
│     ┌──────┐  ┌──────┐                                       │
│     │Deep- │  │pg-   │                                       │
│     │Seek  │  │vector│                                       │
│     │API   │  │      │                                       │
│     └──────┘  └──────┘                                       │
│                                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │Post- │ │Redis │ │OSS/  │ │定时   │                        │
│  │greSQL│ │      │ │MinIO │ │任务   │                        │
│  └──────┘ └──────┘ └──────┘ └──────┘                        │
└──────────────────────────────────────────────────────────────┘
```

### 1.1 技术选型

| 模块 | 方案 | 理由 |
|------|------|------|
| 后端语言 | Go (Gin) | 高并发、单一二进制部署、微信生态社区成熟 |
| 数据库 | PostgreSQL 16 + pgvector | 关系数据 + 向量检索一体，零额外运维 |
| 缓存 | Redis 7 | 会话/在线状态/限流/事件发布 |
| AI 模型 | DeepSeek（统一） | 中文顶级，API 成本极低（¥1/百万token），支持 Chat + Embedding |
| 对象存储 | MinIO（本地）→ 阿里云 OSS（生产） | S3 兼容，切换无痛 |
| 小程序框架 | 原生微信 + TDesign | 微信生态最佳兼容，TDesign 组件成熟 |
| 小游戏引擎 | Cocos Creator 3D | 微信小游戏支持最好，Low-Poly 性能友好 |
| 部署 | Docker Compose → 阿里云 ECS | MVP 单机起步，后续可拆微服务 |
| API 文档 | OpenAPI 3.0 (swaggo) | 代码注释自动生成 |

---

## 2. 微服务模块设计

### 2.1 牙牙 MVP 功能矩阵（7 场景 → 微服务）

| 场景 | 微服务 | 核心能力 |
|------|--------|----------|
| 💬 AI 对话 | `ai-chat` | DeepSeek 对话、性格 Prompt 注入、上下文窗口管理、意图识别 |
| 📖 日常记录 | `journal` | 日记 CRUD、AI 自动摘要、情绪标签、时间线 |
| 🌅 早安/晚安 | `ritual` | 定时模板消息、问候语 AI 生成、天气查询、睡前故事 |
| 🩷 健康关怀 | `health` | 经期记录/提醒、身体状态追踪、关怀建议 |
| 🔒 独居安全 | `safety` | 接口预留（纯软件 MVP，模拟数据），后续对接真实 ESP32 |
| 🎉 成就系统 | `achievement` | 陪伴天数、对话量、日记数等里程碑检测与解锁 |
| 👤 用户体系 | `user` | 微信登录、用户画像、偏好设置、隐私 |

### 2.2 服务详细定义

#### user-service

```
职责：微信 OAuth 登录、用户 CRUD、偏好设置、隐私开关

API:
  POST   /api/v1/auth/wechat/login     # 微信 code → JWT token
  GET    /api/v1/user/profile           # 获取用户信息
  PUT    /api/v1/user/profile           # 更新昵称/头像/偏好
  GET    /api/v1/user/status            # 牙牙状态
```

#### ai-chat-service

```
职责：DeepSeek 对话编排、性格 Prompt 管理、上下文检索、流式输出、安全过滤

API:
  POST   /api/v1/chat/send              # 发送消息（SSE 流式返回）
  GET    /api/v1/chat/history           # 历史对话列表
  DELETE /api/v1/chat/history/:id       # 删除对话
  GET    /api/v1/chat/daily_limit       # 每日剩余免费额度

内部流程:
  用户消息 → 安全过滤 → 记忆检索(pgvector) → 
  组装 System Prompt(性格+记忆+上下文) → DeepSeek API → 
  流式返回 → 异步写入记忆

System Prompt 模板:
  "你是{pet_name}，一只{personality_traits}的{species}。
   你记得关于主人的这些事情：{retrieved_memories}。
   你的说话风格：{speech_style}。
   当前时间是{now}，主人所在城市天气{weather}。
   规则：温暖不油腻、共情不说教、自然不刻板。"
```

#### memory-service

```
职责：对话记忆存储、向量化、相似检索、重要性评分、遗忘衰减

API:
  POST   /api/v1/memory/ingest          # 写入记忆（异步）
  POST   /api/v1/memory/search          # 语义搜索
  GET    /api/v1/memory/facts           # 牙牙知道的"关于你的事实"
  DELETE /api/v1/memory/forget/:id      # 用户主动删除记忆

记忆分层:
  L1 工作记忆: 当前对话上下文（最近 20 轮），Redis 缓存
  L2 短期记忆: 近 7 天摘要，pgvector 检索加权 ×1.5
  L3 长期记忆: 重要事件/用户说过的重要事实，衰减慢
  L4 核心事实: 用户姓名、生日、喜好等，PostgreSQL JSONB

向量化: DeepSeek Embedding API → pgvector (1536维)
重要性: DeepSeek 对话后异步评分 1-10
衰减:   importance < 3 的记忆 30 天后检索权重 ×0.5
```

#### journal-service

```
职责：日记 CRUD、AI 自动摘要/情绪标签、时间线浏览

API:
  POST   /api/v1/journal/create         # 写日记
  GET    /api/v1/journal/list           # 日记列表（分页+按情绪筛选）
  GET    /api/v1/journal/:id            # 日记详情
  PUT    /api/v1/journal/:id            # 编辑
  DELETE /api/v1/journal/:id            # 删除
  GET    /api/v1/journal/timeline       # 时间线视图
  GET    /api/v1/journal/mood-stats     # 情绪统计（周/月）

AI 关联:
  日记创建 → DeepSeek 异步分析 →
  - emotion: happy/sad/anxious/calm/excited/tired
  - auto_title: AI 生成标题
  - linked_memories: 当日相关对话记忆 ID
```

#### ritual-service

```
职责：早安/晚安/定时问候、天气查询、睡前故事生成

API:
  POST   /api/v1/ritual/good-morning    # 早安问候（Cron 触发）
  POST   /api/v1/ritual/good-night      # 晚安仪式
  GET    /api/v1/ritual/bedtime-story   # 睡前故事（AI 生成）
  PUT    /api/v1/ritual/schedule        # 设置问候时间

早安流程:
  用户设定的时间 → Cron 触发 → 天气 API → 
  DeepSeek 生成个性化早安 → 微信订阅消息推送

晚安流程:
  用户触发 → 今日对话摘要（AI 生成）→ 
  可选：哄睡故事 / 今日感恩三件事
```

#### health-service

```
职责：经期记录/预测、身体状态追踪、健康提醒

API:
  POST   /api/v1/health/period/record   # 记录经期
  GET    /api/v1/health/period/calendar  # 经期日历
  GET    /api/v1/health/period/predict   # 预测下次
  POST   /api/v1/health/body-note        # 身体不适记录
  PUT    /api/v1/health/reminder         # 提醒设置
```

#### achievement-service

```
职责：里程碑检测、成就解锁

API:
  GET    /api/v1/achievement/list        # 所有成就 + 解锁状态
  GET    /api/v1/achievement/new         # 新解锁成就

成就列表（首批 12 个）:
  - 初次见面：完成第一次对话
  - 七日之约：连续陪伴 7 天
  - 三十天老友：连续陪伴 30 天
  - 话匣子：累计对话 1000 条
  - 日记达人：写满 30 篇日记
  - 早安鸟儿：连续 7 天早安签到
  - 晚安宝贝：连续 7 天晚安打卡
  - 情绪稳定：连续 7 天情绪为 happy
  - 健康管理师：连续记录经期 3 个月
  - 收藏家：解锁所有成就
  - 夜猫子：深夜对话 10 次（不鼓励）
  - 百天同行：陪伴 100 天

检测: 事件驱动（对话完成/日记创建/Cron 每日检查）
```

#### safety-service（预留）

```
职责: 独居安全检测（当前模拟模式，后续对接真实硬件）

API:
  GET    /api/v1/safety/status           # 安全状态（模拟: always safe）
  GET    /api/v1/safety/door-check       # 门窗检测（模拟: always closed）
  POST   /api/v1/safety/alert            # 告警上报（硬件调用）
  GET    /api/v1/safety/history          # 安全日志

模拟模式: safety_mode = "simulated"，所有接口返回正常状态
```

### 2.3 服务间通信

```
同步: HTTP REST (内网)
  用户消息 → ai-chat → memory.search → ai-chat → 返回

异步: Redis Pub/Sub
  对话完成 → 发布 chat.completed →
  ├── memory.ingest (写入长期记忆)
  ├── achievement.check (成就检测)
  └── journal.suggest (日记建议)
```

---

## 3. 数据模型

### 3.1 核心表结构

```sql
-- ═══════════════════════════
-- 用户域
-- ═══════════════════════════

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wechat_openid   VARCHAR(128) UNIQUE NOT NULL,
    wechat_unionid  VARCHAR(128),
    nickname        VARCHAR(64) NOT NULL,
    avatar_url      VARCHAR(512),
    yaya_nickname   VARCHAR(32) DEFAULT '牙牙',
    yaya_personality_seed INT NOT NULL DEFAULT floor(random() * 100000),
    companion_days  INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_settings (
    user_id             UUID REFERENCES users(id) PRIMARY KEY,
    voice_enabled       BOOLEAN DEFAULT false,
    greeting_time       TIME DEFAULT '08:00',
    bedtime_time        TIME DEFAULT '22:30',
    health_reminder     BOOLEAN DEFAULT true,
    period_reminder     BOOLEAN DEFAULT false,
    privacy_level       SMALLINT DEFAULT 0,
    data_sharing        BOOLEAN DEFAULT false
);

-- ═══════════════════════════
-- 对话域
-- ═══════════════════════════

CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    title           VARCHAR(128),
    mood            VARCHAR(16),
    message_count   INT DEFAULT 0,
    started_at      TIMESTAMPTZ DEFAULT now(),
    ended_at        TIMESTAMPTZ
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) NOT NULL,
    role            VARCHAR(8) NOT NULL CHECK (role IN ('user','assistant')),
    content         TEXT NOT NULL,
    emotion         VARCHAR(16),
    tokens_in       INT,
    tokens_out      INT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

-- ═══════════════════════════
-- 记忆域
-- ═══════════════════════════

CREATE TABLE memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    content         TEXT NOT NULL,
    summary         VARCHAR(256),
    embedding       vector(1536),
    importance      SMALLINT DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    memory_type     VARCHAR(16) DEFAULT 'episodic'
                    CHECK (memory_type IN ('episodic','semantic','core_fact')),
    source_msg_id   UUID REFERENCES messages(id),
    decay_factor    REAL DEFAULT 1.0,
    access_count    INT DEFAULT 0,
    last_accessed   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memories_embedding ON memories
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memories_user ON memories(user_id, memory_type);

CREATE TABLE core_facts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    key             VARCHAR(64) NOT NULL,
    value           TEXT NOT NULL,
    confidence      REAL DEFAULT 1.0,
    source_msg_id   UUID REFERENCES messages(id),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, key)
);

-- ═══════════════════════════
-- 日记域
-- ═══════════════════════════

CREATE TABLE journals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    title           VARCHAR(256),
    content         TEXT NOT NULL,
    emotion         VARCHAR(16),
    emotion_score   REAL,
    weather         VARCHAR(16),
    linked_memories UUID[] DEFAULT '{}',
    is_private      BOOLEAN DEFAULT false,
    word_count      INT,
    created_at      DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_journals_user_date ON journals(user_id, created_at DESC);

-- ═══════════════════════════
-- 成就域
-- ═══════════════════════════

CREATE TABLE achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(32) UNIQUE NOT NULL,
    name            VARCHAR(64) NOT NULL,
    description     VARCHAR(256),
    icon_emoji      VARCHAR(8),
    category        VARCHAR(16) CHECK (category IN ('milestone','social','emotion','special')),
    tier            SMALLINT DEFAULT 1
);

CREATE TABLE user_achievements (
    user_id         UUID REFERENCES users(id) NOT NULL,
    achievement_id  UUID REFERENCES achievements(id) NOT NULL,
    progress        INT DEFAULT 0,
    target          INT NOT NULL,
    unlocked_at     TIMESTAMPTZ,
    is_notified     BOOLEAN DEFAULT false,
    PRIMARY KEY (user_id, achievement_id)
);

-- ═══════════════════════════
-- 健康域
-- ═══════════════════════════

CREATE TABLE period_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE,
    cycle_length    SMALLINT,
    symptoms        VARCHAR(64)[] DEFAULT '{}',
    mood_note       VARCHAR(256),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE body_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    note_type       VARCHAR(32) NOT NULL,
    detail          VARCHAR(512),
    severity        SMALLINT CHECK (severity BETWEEN 1 AND 5),
    created_at      DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ═══════════════════════════
-- 安全域（预留）
-- ═══════════════════════════

CREATE TABLE safety_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    event_type      VARCHAR(32) NOT NULL,
    device_id       VARCHAR(64),
    detail          JSONB,
    is_simulated    BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 关键设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| 主键 | UUID v4 | 分布式友好，无自增碰撞 |
| 向量检索 | pgvector ivfflat | 和 PG 一体，免运维，百万级够用 |
| 记忆分层 | 表内用 `memory_type` 区分 | 避免多表 JOIN，检索统一查询 |
| 对话历史 | conversations + messages 双表 | 支持会话管理和上下文恢复 |
| 情绪标签 | 预定义枚举 + AI 建议 | 保证统计一致性 |
| 安全数据 | 独立 safety_logs 表 | 模拟模式也走真实数据路径 |

---

## 4. 项目结构

```
E:\C++\lingpal-platform\
├── docker-compose.yml
├── Makefile
├── docs/
│   ├── 2026-08-02-lingpal-platform-design.md   # 本设计文档
│   └── api/
│
├── server/
│   ├── go.mod / go.sum
│   ├── cmd/
│   │   ├── gateway/main.go
│   │   ├── user/main.go
│   │   ├── ai-chat/main.go
│   │   ├── memory/main.go
│   │   ├── journal/main.go
│   │   ├── ritual/main.go
│   │   ├── health/main.go
│   │   ├── achievement/main.go
│   │   └── safety/main.go
│   ├── internal/
│   │   ├── shared/
│   │   │   ├── middleware/    # JWT / 日志 / 限流 / CORS
│   │   │   ├── db/            # PostgreSQL 连接池
│   │   │   ├── redis/         # Redis 客户端
│   │   │   └── errors/        # 统一错误响应
│   │   ├── models/            # 共享数据模型
│   │   └── events/            # 事件总线
│   ├── pkg/
│   │   ├── deepseek/          # DeepSeek API 客户端
│   │   ├── embedding/         # DeepSeek Embedding
│   │   ├── vectorstore/       # pgvector 封装
│   │   ├── wechat/            # 微信 SDK
│   │   └── safetyfilter/      # 内容安全过滤
│   └── migrations/
│
├── miniapp-yaya/              # 牙牙小程序
│   ├── project.config.json
│   ├── app.json / app.ts / app.wxss
│   ├── pages/
│   │   ├── home/              # 首页
│   │   ├── chat/              # 对话页
│   │   ├── journal/           # 手账日记
│   │   ├── journal-detail/    # 日记详情
│   │   ├── profile/           # 我的
│   │   ├── health/            # 健康
│   │   ├── safety/            # 安全状态
│   │   └── achievement/       # 成就墙
│   ├── components/
│   │   ├── yaya-avatar/       # 牙牙形象组件
│   │   ├── chat-bubble/       # 聊天气泡
│   │   ├── mood-gauge/        # 情绪展示
│   │   ├── ritual-card/       # 早安/晚安卡片
│   │   └── journal-card/      # 日记卡片
│   ├── services/              # API 请求封装
│   └── utils/                 # 工具函数
│
├── minigame-lingpal/          # 灵伴世界小游戏 (v2)
│
└── deploy/
    ├── docker-compose.prod.yml
    ├── nginx.conf
    └── scripts/
```

---

## 5. 开发计划

### 5.1 总体路线图

```
Phase 0: 基础设施 (2 周)
    → 共享后端 + DB + DeepSeek + 项目骨架 + 小程序骨架

Phase 1: 牙牙核心 MVP (4 周)  
    → AI 对话 + 手账日记 + 早安晚安 + 健康关怀
    → 首个可演示版本，5-10 人内测

Phase 1.5: 牙牙完整版 (4 周)
    → 成就系统 + 安全(模拟) + 微信支付订阅 + 打磨
    → 可上线产品

Phase 2: 灵伴世界 (牙牙上线后)
    → Cocos 3D 小游戏 + 宠物 AI 性格引擎 + 灵屿家园
```

### 5.2 Phase 0 详细计划（第 1-2 周）

```
Week 1:
  Day 1-2: 项目初始化（仓库/docker-compose/Go module/目录骨架）
  Day 2-4: 数据库（PostgreSQL+pgvector/全量migration/Redis连接池）
  Day 4-6: API Gateway（Gin路由/JWT中间件/统一错误响应）
  Day 5-6: 用户服务（微信登录/用户CRUD）

Week 2:
  Day 6-7: DeepSeek 客户端（Chat Completions/Embedding/SSE流式）
  Day 7-9: AI 对话服务（System Prompt模板/上下文管理/安全过滤）
  Day 9-10: 记忆服务（异步写入/pgvector检索/核心事实提取）
  Day 10-12: 微信小程序骨架（TDesign/登录页/首页骨架/API封装）
  Day 12-14: 联调 + 日志监控 + 端到端测试
```

### 5.3 Phase 1 详细计划（第 3-6 周）

```
Week 3: 对话体验升级 + 小程序对话页
Week 4: 手账日记服务 + 小程序日记页
Week 5: 仪式服务(早安/晚安/睡前故事) + 健康服务 + 小程序对应页面
Week 6: 性能优化 + UI/UX打磨 + 5-10人内测
```

### 5.4 Phase 1.5 详细计划（第 7-10 周）

```
Week 7-8: 成就系统 + 安全服务(模拟) + 小程序对应页面
Week 9: 微信支付 + 订阅 + 小程序支付页
Week 10: 全链路测试 + Bug修复 + 微信审核提交
```

### 5.5 开发规范

| 规范 | 要求 |
|------|------|
| 分支策略 | `main` 保护分支，Feature 分支开发 |
| Commit | Conventional Commits |
| 测试 | 单元测试 (service) + 集成测试 (API) |
| 日志 | `log/slog` 结构化 JSON |
| 响应格式 | `{"code":0,"msg":"ok","data":{...}}` |
| API 文档 | OpenAPI 3.0 (swaggo 注释生成) |

---

## 6. 关键设计决策汇总

| # | 决策 | 结论 |
|---|------|------|
| 1 | 两个产品合并为一个平台 | ✅ 共享后端 + AI 引擎 |
| 2 | 技术栈 | Go/Gin + PostgreSQL/pgvector + Redis + DeepSeek |
| 3 | 前端入口 | 微信小程序（牙牙）+ 微信小游戏（灵伴） |
| 4 | AI 模型 | 纯 DeepSeek（不做多模型路由） |
| 5 | 纯软件 MVP | 跳过硬件，安全检测用模拟数据 |
| 6 | 微服务通信 | 同步 HTTP REST + 异步 Redis Pub/Sub |
| 7 | 记忆架构 | 四层记忆体系（L1 工作 → L4 核心事实） |
| 8 | 向量数据库 | pgvector（和 PG 一体，免额外运维） |
| 9 | 部署 | Docker Compose 单机 → 后续拆分 |
| 10 | MVP 范围 | 牙牙全部 7 场景完整版 → 再启动灵伴 |

---

*文档结束*
