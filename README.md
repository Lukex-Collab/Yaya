# 灵伴（LingPal）— AI陪伴 × 3D世界 × 语音通话 × 声音克隆

> **"牙牙在，就不孤单"** — 不只是AI聊天，是一个有体温的陪伴

[![Go](https://img.shields.io/badge/Go-38服务-blue)](server/)
[![Routes](https://img.shields.io/badge/API-168端点-green)](server/cmd/server/main.go)
[![Tests](https://img.shields.io/badge/测试-41/41包通过-brightgreen)](server/)
[![CI](https://img.shields.io/badge/CI-自动适配-orange)](.github/workflows/ci-backend.yml)

---

## 产品定位

**一个微信小程序，两种陪伴模式，无数种情感连接。**

| 模式 | 定位 | 谁在用 |
|------|------|--------|
| 🧸 **牙牙（yaya）** | AI 守护玩偶 · 聊天/记忆/日记/健康/安全/依恋/梦境/来信 | 18-28岁城市独居女性 |
| 🌍 **灵伴世界** | 3D 宠物探索 · 5区域×5物种/NFC/社交/配对/进化 | 潮玩年轻群体 |

---

## 核心差异化

| 能力 | 普通AI聊天 | 牙牙 |
|------|-----------|------|
| AI对话 | ✅ | ✅ + **性格种子**(每只唯一) + **四层记忆** |
| 记住你 | ❌ | ✅ pgvector语义记忆 · 越久越懂你 |
| 主动找你 | ❌ | ✅ **每日话题**·**依恋签到**·**早安晚安** |
| 想你了 | ❌ | ✅ **离别重逢**("3天没见...牙牙以为你不回来了😢") |
| 双向关系 | ❌ | ✅ **喂食/抚摸/哄睡** — 牙牙也需要你 |
| 声音 | ❌ | ✅ **5种专属音色** + **声音克隆**(用你自己的声音) |
| 打电话 | ❌ | ✅ **LiveKit WebRTC** 实时语音通话 |
| 写日记 | ❌ | ✅ AI自动从对话生成手账日记 |
| 做梦境 | ❌ | ✅ **睡前专属梦境**(冒险/治愈/魔法/反省/舒适) |
| 来信 | ❌ | ✅ **每周手写信** — 牙牙第一人称 |
| 实体玩具 | ❌ | ✅ **NFC NTAG215** 唯一ID绑定 · ESP32硬件 |

---

## 双后端架构

| 后端 | 语言 | 规模 | 启动 | 适用 |
|------|------|------|------|------|
| 🚀 **Go/Gin** | `server/` | 38服务·168路由·41测试 | `go run` → :8080 | 生产 |
| ⚡ **Express/Node** | `server.js` | 130行·DeepSeek直连 | `node server.js` → :3000 | 快速原型 |

---

## 快速体验

### 浏览器 Demo（无需微信）

```bash
# 启动 Go 后端
cd server && go run cmd/server/main.go

# 浏览器打开 → 自动连Go后端 → SSE流式聊天
open public/index.html
```

### 微信小程序

```bash
# 微信开发者工具 → 导入 miniapp-yaya/ 目录
# 12个页面 · 5个云函数 · 完整API对接
```

### Node.js 原型

```bash
cp .env.example .env  # 填入 DEEPSEEK_API_KEY
node server.js        # → http://localhost:3000
```

---

## 产品功能全景

```
用户体系     👤 微信登录 · JWT · 游客模式
AI对话       💬 SSE流式 · 五维性格引擎 · 记忆注入
记忆系统     🧠 pgvector四层记忆 · 语义搜索 · 衰减
日记手账     📖 AI自动日记 · 情绪分析 · 我的记录
仪式&日历    🌅 早安晚安 · 睡前故事 · 女子历史日历
健康关怀     🩺 经期预测 · 身体打卡 · 感恩日记
成就系统     🏆 39个里程碑 · 事件驱动解锁
安全守护     🔒 BLE设备模拟器 · 4传感器 · 3场景
支付订阅     💳 微信支付 · 月付/年付方案
推送通知     📲 个性化推送 · 早安/晚安/关怀/成就
灵伴世界     🌍 5区域探索 · 宠物养成 · 社交
宠物进化     🐾 5级进化 · 20+物种 · 自主行为
NFC绑定      📱 NTAG215实体玩具 · 唯一ID配对
依恋系统     🫂 签到 · 离别重逢 · 连续陪伴激励
双向守护     🤝 照顾牙牙 · 牙牙担心你 · 互相关心
时间胶囊     💌 封存回忆 · 给未来的自己 · 生命故事
梦境编织     🌙 5种主题 · 每日专属 · 基于情绪生成
每日话题     💡 15种子×6类别 · 牙牙主动发起聊天
怀旧引擎     🕰️ "那年的今天" · 回忆推送
牙牙来信     ✉️ 每周AI手写信 · 情绪统计 · 可分享
声音克隆     🎤 Chatterbox TTS · 用你的声音说话
实时通话     📞 LiveKit WebRTC · 真正打电话给牙牙
语音合成     🎵 5种专属音色 · 火山引擎TTS
公共广场     🌐 日记分享 · 点赞 · 公众号内容源
闺蜜配对     👯 6位配对码 · 两只牙牙交朋友 · 裂变传播
情绪分析     📊 趋势图谱 · 月度报告 · 情绪急救
新手指引     🆕 10步渐进式 · 7天完成 · 奖励驱动
搜索&导出    🔍 全局搜索 · GDPR数据导出 · 账号删除
```

---

## 技术栈

| 层 | 方案 |
|----|------|
| 后端 | Go 1.25 (Gin) · Express/Node |
| 数据库 | PostgreSQL 16 + pgvector |
| 缓存 | Redis 7 (Pub/Sub · 限流 · 会话) |
| AI模型 | DeepSeek Chat + Embedding |
| 语音 | 火山引擎TTS · Chatterbox声音克隆 · LiveKit WebRTC |
| 通信 | WebSocket (gorilla) · SSE流式 |
| 存储 | MinIO → S3/OSS |
| 部署 | Docker · GitHub Actions · K8s探针 |
| 前端 | 微信小程序 · HTML5/CSS3/JS · p5.js动画 |

---

## 项目结构

```
server/            Go后端 154文件·15249行·38服务
├── cmd/           server + migrate 入口
├── internal/      38个微服务模块
├── pkg/           6个工具包
├── migrations/    16组SQL迁移
└── integration/   集成测试

miniapp-yaya/      微信小程序 12页面
├── pages/         登录·主页·聊天·手账·世界·我的·健康·安全·成就·记忆·情绪
├── services/      HTTP客户端(JWT+SSE)
└── cloudfunctions/ 5个云函数

public/            Web Demo
├── index.html     1672行 4Tab完整UI
└── app.js         JWT+SSE客户端

server.js          Express快速原型 130行
index.html         对方前端 Demo
```

---

## 开发

```bash
git clone https://github.com/Lukex-Collab/Yaya.git && cd Yaya
docker compose up -d              # PG+Redis+MinIO
cd server && go run cmd/migrate/main.go up && go run cmd/migrate/main.go seed
go run cmd/server/main.go         # → http://localhost:8080
# 浏览器打开 public/index.html
```

*Made with ❤️ for every girl who deserves a warm companion.*
