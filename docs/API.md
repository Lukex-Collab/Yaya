# 灵伴(LingPal) API 文档

> v1.0.0 | Base URL: `http://localhost:8080/api/v1`

## 认证

所有需要认证的接口需在 Header 中携带 JWT Token：
```
Authorization: Bearer <token>
```

Token 通过微信登录获取（开发模式使用 `code=dev`）。

---

## 用户 User

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| POST | `/auth/wechat/login` | 微信登录 | ❌ |
| GET | `/user/profile` | 获取个人信息 | ✅ |
| PUT | `/user/profile` | 更新昵称/头像 | ✅ |
| GET | `/user/settings` | 获取设置 | ✅ |
| PUT | `/user/settings` | 更新设置 | ✅ |

## AI对话 Chat

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| POST | `/chat/send` | 发送消息 (SSE流式返回) | ✅ |
| GET | `/chat/history` | 对话历史 | ✅ |
| DELETE | `/chat/history/:id` | 删除对话 | ✅ |

## 记忆 Memory

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| POST | `/memory/ingest` | 写入记忆 | ✅ |
| POST | `/memory/search` | 语义搜索记忆 | ✅ |
| GET | `/memory/facts` | 核心事实列表 | ✅ |
| DELETE | `/memory/forget/:id` | 删除记忆 | ✅ |

## 日记 Journal

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| POST | `/journal/create` | 创建日记 | ✅ |
| GET | `/journal/list` | 日记列表 (支持情绪筛选) | ✅ |
| GET | `/journal/:id` | 日记详情 | ✅ |
| PUT | `/journal/:id` | 编辑日记 | ✅ |
| DELETE | `/journal/:id` | 删除日记 | ✅ |
| GET | `/journal/mood-stats` | 情绪统计 | ✅ |

## 仪式 & 日历 Ritual

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| POST | `/ritual/good-morning` | 早安问候 | ✅ |
| POST | `/ritual/good-night` | 晚安仪式 | ✅ |
| GET | `/ritual/bedtime-story` | 睡前故事 | ✅ |
| GET | `/ritual/schedule` | 推送时间设置 | ✅ |
| PUT | `/ritual/schedule` | 更新推送设置 | ✅ |
| GET | `/ritual/calendar/today` | 今日女子日历 | ✅ |
| GET | `/ritual/calendar/week` | 本周女子日历 | ✅ |

## 健康 Health

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| POST | `/health/period/record` | 记录经期 | ✅ |
| GET | `/health/period/calendar` | 经期日历 | ✅ |
| GET | `/health/period/predict` | 预测下次经期 | ✅ |
| POST | `/health/body-note` | 身体状态记录 | ✅ |

## 成就 Achievement

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| GET | `/achievement/list` | 全部成就+解锁状态 | ✅ |
| GET | `/achievement/new` | 新解锁成就 | ✅ |
| GET | `/achievement/progress` | 进度总览 | ✅ |

## 灵伴世界 World

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| GET | `/world/pet` | 我的灵伴状态 | ✅ |
| GET | `/world/zones` | 5个探索区域 | ✅ |
| POST | `/world/explore/:zoneId` | 探索区域 | ✅ |
| POST | `/world/pet/feed` | 喂食灵伴 | ✅ |
| GET | `/world/pets/nearby` | 附近灵伴 | ✅ |

## 安全 Safety

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| GET | `/safety/status` | 安全状态 | ✅ |
| GET | `/safety/history` | 告警历史 | ✅ |
| GET | `/safety/door-check` | 门窗检测 | ✅ |
| POST | `/safety/alert/test` | 测试告警 | ✅ |

## 支付 Payment

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| GET | `/payment/plans` | 订阅方案 | ✅ |
| POST | `/payment/order` | 创建订单 | ✅ |
| GET | `/payment/subscription` | 我的订阅 | ✅ |
| POST | `/payment/subscription/cancel` | 取消续费 | ✅ |

## 推送 Push

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| GET | `/push/messages` | 推送消息列表 | ✅ |
| POST | `/push/messages/:id/read` | 标记已读 | ✅ |
| GET | `/push/unread-count` | 未读数 | ✅ |

## 文件上传 Upload

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| POST | `/upload/image` | 上传图片 (jpg/png/webp) | ✅ |
| POST | `/upload/voice` | 上传语音 (mp3/wav/aac) | ✅ |

## 语音 Voice

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| POST | `/voice/upload` | 上传语音消息 | ✅ |
| GET | `/voice/messages` | 语音消息列表 | ✅ |

## 管理后台 Admin

| Method | Path | 说明 | Auth |
|--------|------|------|------|
| GET | `/admin/stats` | 运营数据面板 | ✅ |
| GET | `/admin/users` | 用户列表 | ✅ |
| GET | `/admin/users/:id` | 用户详情 | ✅ |

## 系统 System

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health` | 健康检查 (含DB/Redis状态) |
| GET | `/health/live` | K8s Liveness Probe |
| GET | `/health/ready` | K8s Readiness Probe |
| GET | `/ws` | WebSocket连接 (实时推送) |

---

## 响应格式

```json
{
  "code": 0,
  "msg": "ok",
  "data": {}
}
```

| Code | 说明 |
|------|------|
| 0 | 成功 |
| 1 | 服务器错误 |
| 40000 | 参数错误 |
| 40100 | 未认证 |
| 42900 | 限流 |
| 50000 | 内部错误 |

## 开发者登录

```bash
curl -X POST http://localhost:8080/api/v1/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code":"dev","nickname":"测试用户"}'
```

返回: `{"code":0,"data":{"token":"eyJ...","user":{...},"is_new":true}}`
