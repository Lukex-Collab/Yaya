# 贡献指南 — 灵伴平台 (Yaya)

欢迎加入牙牙的开发！本文档规范了多人协作的完整流程。

## 🌿 分支策略

```
master ─────────────────────────────────────▶ 生产就绪
  │
  ├── feat/<name> ───────────────────────▶ 新功能开发
  ├── fix/<name> ────────────────────────▶ Bug 修复
  ├── refactor/<name> ───────────────────▶ 重构
  ├── docs/<name> ───────────────────────▶ 文档更新
  └── chore/<name> ──────────────────────▶ 杂项（CI/依赖/配置）
```

### 规则

| 规则 | 说明 |
|------|------|
| **`master` 是保护分支** | 不允许直接 push，只能通过 PR 合并 |
| **功能分支从 `master` 切出** | `git checkout -b feat/my-feature master` |
| **分支名全部小写** | 用 `-` 分隔，如 `feat/voice-message` |
| **一个分支一件事** | 不要在一个分支里混入不相关的改动 |
| **rebase 代替 merge** | 合并前先 `git rebase master`，保持历史线性 |

### 分支命名

```bash
# ✅ 正确
feat/voice-message
fix/chat-sse-timeout
refactor/memory-layer
docs/api-update
chore/update-deps

# ❌ 错误
Feat/VoiceMessage    # 大小写混用
my-branch            # 没有前缀
feat_everything      # 不明确
```

## 📝 Commit 规范

使用 **Conventional Commits** 格式：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Type（类型）

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(chat): 添加语音消息发送` |
| `fix` | Bug 修复 | `fix(journal): 修复日记保存失败` |
| `refactor` | 重构 | `refactor(memory): 简化记忆检索逻辑` |
| `docs` | 文档 | `docs: 更新 API 文档` |
| `style` | 格式调整 | `style: 统一代码缩进` |
| `test` | 测试 | `test(health): 添加经期预测单测` |
| `chore` | 杂项 | `chore: 升级 Go 1.24` |
| `perf` | 性能优化 | `perf(chat): 减少 SSE 延迟` |

### Scope（模块）

```
chat, journal, ritual, health, safety, achievement,
user, memory, auth, miniapp, server, ci, deps
```

### 示例

```bash
feat(chat): 添加 DeepSeek 流式对话 SSE 端点
fix(journal): 修复空内容日记保存时 panic
refactor(memory): 将记忆评分改为异步处理
feat(miniapp): 完成聊天页语音输入 UI
chore(deps): 升级 gin v1.10
```

## 🔄 PR 流程

```
 1. 切分支        2. 开发+测试       3. Push+开PR
    │                 │                 │
  feat/xxx        make test         gh pr create
  (从 master)       make lint         (填写模板)
    │                 │                 │
    └─────────────────┴─────────────────┘
                                         │
 6. 合并+清理 ◀── 5. 解决冲突 ◀── 4. CI 通过 + Review
    │                 │                 │
  Squash merge    git rebase        至少1人 Approve
  git branch -d   master              所有检查 ✅
```

### 详细步骤

#### 1. 开始工作

```bash
# 更新本地 master
git checkout master
git pull origin master

# 切功能分支
git checkout -b feat/my-feature
```

#### 2. 开发过程中

```bash
# 频繁提交，清晰描述
git add -p                    # 选择性暂存，避免大坨提交
git commit -m "feat(chat): 添加消息历史分页"

# 定期同步 master（避免最后冲突地狱）
git fetch origin master
git rebase origin/master
```

#### 3. 推送并开 PR

```bash
# 推送前先跑检查
make test && make lint

# 推送分支
git push origin feat/my-feature

# 创建 PR
gh pr create --base master --title "feat(chat): 添加语音消息" --body "..."
```

#### 4. Code Review

PR 创建后：
- 至少 **1 人 Approve** 才能合并
- CI 必须 **全部通过**
- Review 意见需在 **48 小时内** 响应
- 大的改动建议 **结对或提前沟通设计**

#### 5. 合并

```bash
# 合并方式：Squash & Merge（推荐）
# PR 的所有 commit 压缩为一条 Conventional Commit
# 合并信息格式：feat(chat): 添加语音消息 (#42)
```

#### 6. 清理

```bash
# 合并后删除远程分支
git push origin --delete feat/my-feature

# 删除本地分支
git checkout master
git pull origin master
git branch -d feat/my-feature
```

## 🧪 开发环境

```bash
# 1. 启动基础设施
docker compose up -d

# 2. 配置
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# 3. 数据库迁移
make migrate

# 4. 启动后端
make run

# 5. 运行测试
make test

# 6. 代码检查
make lint
```

## 📁 项目约定

### 目录职责

| 目录 | 职责 | 修改时需注意 |
|------|------|-------------|
| `server/internal/core/` | 基础设施（config/DB/Redis/JWT） | 影响全局，需谨慎 |
| `server/internal/chat/` | AI 对话（DeepSeek SSE） | 影响核心体验 |
| `server/internal/memory/` | 记忆系统（pgvector） | 涉及 DB schema |
| `server/internal/journal/` | 日记 + 情绪分析 | — |
| `server/internal/ritual/` | 早安晚安仪式 | 涉及定时任务 |
| `server/internal/health/` | 健康关怀 | 涉及敏感数据 |
| `server/internal/achievement/` | 成就系统 | — |
| `server/internal/safety/` | 安全检测（当前模拟） | — |
| `miniapp-yaya/pages/` | 小程序各页面 | 按页面独立开发 |
| `miniapp-yaya/cloudfunctions/` | 云函数 | 微信云开发环境 |

### 代码风格

**Go：**
- 遵循标准 Go 风格（`gofmt`）
- 错误处理：始终检查并返回上下文错误
- 日志：使用 `log/slog` 结构化 JSON
- 测试：service 层必须有单元测试

**小程序 (TypeScript)：**
- 页面逻辑放 `.ts`，不要全塞 `.js`
- API 调用统一通过 `config/api.ts`
- 组件复用放在 `components/` 下

### 冲突预防

**最容易冲突的文件（改之前先沟通！）：**

| 文件 | 原因 |
|------|------|
| `app.json` / `app.ts` | 小程序主配置，多人改动必冲突 |
| `docker-compose.yml` | 基础设施定义 |
| `server/internal/core/deps.go` | 依赖注入聚合点 |
| `server/cmd/server/main.go` | 路由注册 |
| `server/internal/core/config.go` | 全局配置 |

**避免冲突的策略：**
- 改上述文件时先在 Issue/群聊里说一下
- 不同人负责不同模块，减少文件重叠
- 频繁 rebase master（每天至少一次）
- 小的 PR 优先（< 500 行改动）
- 改同一文件的不同区域通常能自动合并

## 🚨 常见问题

### rebase 冲突怎么办？

```bash
# 1. 确保当前在功能分支
git checkout feat/my-feature

# 2. rebase master
git rebase master

# 3. 如果有冲突，逐个解决
#    编辑冲突文件 → git add → git rebase --continue
#    或放弃：git rebase --abort

# 4. rebase 后强制推送（仅在自己的分支上！）
git push --force-with-lease origin feat/my-feature
```

### PR 合并后我的本地分支怎么办？

```bash
git checkout master
git pull origin master
git branch -d feat/my-feature    # 删除本地分支
git remote prune origin           # 清理远程分支引用
```

### CI 失败了？

1. 在 PR 页面查看 CI 日志
2. 本地重现：`make test && make lint`
3. 修复后 commit + push（无需新 PR）

---

*有问题？在 Issue 区提问，或直接在 PR 里 @ 团队成员。*
