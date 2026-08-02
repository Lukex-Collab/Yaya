# 灵伴（LingPal）— AI陪伴 × 3D世界 × 语音通话 × 声音克隆

> **"牙牙在，就不孤单"** — 不只是AI聊天，是一个有体温的陪伴

[![Go](https://img.shields.io/badge/Go-42服务-blue)](server/)
[![Routes](https://img.shields.io/badge/API-190+端点-green)](server/cmd/server/main.go)
[![Tests](https://img.shields.io/badge/测试-41/41包通过-brightgreen)](server/)
[![CI](https://img.shields.io/badge/CI-自动适配-orange)](.github/workflows/ci-backend.yml)

---

## 产品定位

**一个微信小程序，两种陪伴模式，一个3D世界。**

| 模式 | 定位 | 谁在用 |
|------|------|--------|
| 🧸 **牙牙（yaya）** | AI 守护玩偶 · 聊天/记忆/日记/健康/安全/依恋/梦境/来信 | 18-28岁城市独居女性 |
| 🌍 **灵伴世界** | Cocos Creator 3D 宠物探索 · 7大区域/7物种/开放世界 | 潮玩年轻群体 |
| 🎮 **小游戏** | 跳一跳/接浆果/快跑/记忆配对/画画猜词 | 消磨时间+赚宝石 |

---

## 核心差异化

| 能力 | 普通AI聊天 | 牙牙 |
|------|-----------|------|
| AI对话 | ✅ | ✅ + **性格种子**(每只唯一) + **四层记忆** |
| 记住你 | ❌ | ✅ pgvector语义记忆 · 越久越懂你 |
| 主动找你 | ❌ | ✅ **每日话题**·**依恋签到**·**牙牙来电** |
| 想你了 | ❌ | ✅ **离别重逢**("3天没见...牙牙以为你不回来了😢") |
| 双向关系 | ❌ | ✅ **喂食/抚摸/哄睡** — 牙牙也需要你 |
| 声音 | ❌ | ✅ **5种专属音色** + **声音克隆**(用你自己的声音) |
| 打电话 | ❌ | ✅ **LiveKit WebRTC** 实时语音通话 |
| 写日记 | ❌ | ✅ AI自动从对话生成手账日记 |
| 做梦境 | ❌ | ✅ **睡前专属梦境**(冒险/治愈/魔法/反省/舒适) |
| 来信 | ❌ | ✅ **每周手写信** — 牙牙第一人称 |
| 3D世界 | ❌ | ✅ **Cocos Creator 3D** + 微信小游戏原生WebGL |
| 小游戏 | ❌ | ✅ 5款内置游戏·得分换宝石·排行榜 |
| 实体玩具 | ❌ | ✅ **NFC NTAG215** 唯一ID绑定 · ESP32硬件 |

---

## 3D 世界：7 大区域

```
灵屿村(中心) ─┬─ 云杉林(Z-N)   针叶林·云杉·蘑菇巨石
              ├─ 花语原(Z-E)   花海草原·风车·彩色花田
              ├─ 暮光谷(Z-W)   峡谷岩壁·发光水晶洞
              ├─ 萤火沼(Z-SE)  湿地·芦苇·月光石
              ├─ 月影丘(Z-S)   山丘·巨石·帐篷
              └─ 星砂滩(Z-NW)  海岸·椰子树·灯塔
```

7种宠物GLB模型：灵狐·熊猫·牙牙·猫头鹰·章鱼·貔貅·鲸鱼

---

## 双后端架构

| 后端 | 语言 | 规模 | 启动 | 适用 |
|------|------|------|------|------|
| 🚀 **Go/Gin** | `server/` | 42服务·190+路由·41测试 | `go run` → :8080 | 生产 |
| ⚡ **Express/Node** | `server.js` | 130行·DeepSeek直连 | `node server.js` → :3000 | 快速原型 |

---

## 快速体验

```bash
# Go 后端 (全功能)
cd server && go run cmd/server/main.go
open public/index.html

# 微信小游戏 3D世界 (wechatgame/)
# 微信开发者工具 → 导入 wechatgame/ 目录

# Cocos Creator 3D工程 (cocos-project/)
# Cocos Creator 3.8.5 打开即可

# Node.js 原型
cp .env.example .env && node server.js
```

---

## 项目结构

```
server/            Go后端 159文件·42服务·41/41测试
cocos-project/     Cocos Creator 3.8.5 3D世界工程 (TypeScript)
wechatgame/        微信小游戏可玩原型 (原生WebGL)
miniapp-yaya/      微信小程序 12页面
public/            Web Demo + 5款小游戏
├── index.html     4Tab完整UI
├── app.js         JWT+SSE客户端
└── games/         跳一跳·接浆果·快跑·记忆·画画
```

---

## 开发

```bash
git clone https://github.com/Lukex-Collab/Yaya.git && cd Yaya
docker compose up -d
cd server && go run cmd/migrate/main.go up && go run cmd/migrate/main.go seed
go run cmd/server/main.go
```

*Made with ❤️ for every girl who deserves a warm companion.*
