#!/bin/bash
# 灵伴(LingPal) 一键部署脚本
# 用法: bash deploy/deploy.sh [staging|production]
set -euo pipefail

ENV="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BRANCH="master"

echo "============================================"
echo "  灵伴(LingPal) 部署脚本 — ${ENV}"
echo "============================================"
echo ""

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
fail() { echo -e "${RED}[✗] $1${NC}"; exit 1; }

# 1. 检查依赖
step "检查环境..."
command -v go >/dev/null 2>&1 || fail "需要安装 Go 1.23+"
command -v docker >/dev/null 2>&1 || fail "需要安装 Docker"
command -v docker-compose >/dev/null 2>&1 || command -v docker >/dev/null 2>&1 || fail "需要安装 Docker Compose"

# 2. 拉取最新代码
step "拉取最新代码..."
cd "$PROJECT_ROOT"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# 3. 配置环境
step "配置环境变量..."
if [ ! -f .env ]; then
  if [ "$ENV" = "production" ]; then
    warn "生产环境需要手动创建 .env 文件"
    warn "参考 .env.example"
    fail "请先创建 .env 文件后重试"
  else
    cp .env.example .env
    echo "DEEPSEEK_API_KEY=sk-your-key-here" >> .env
    warn "测试环境 .env 已创建，请编辑填入真实的 DEEPSEEK_API_KEY"
  fi
fi

# 4. 编译后端
step "编译后端..."
cd "$PROJECT_ROOT/server"
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o ../bin/lingpal-server ./cmd/server
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o ../bin/lingpal-migrate ./cmd/migrate
cd "$PROJECT_ROOT"

# 5. Docker 构建
step "构建 Docker 镜像..."
docker build -t lingpal-server:"${ENV}" -f server/Dockerfile server/

# 6. 启动基础服务
step "启动基础设施..."
docker compose -f docker-compose.yml up -d postgres redis minio

# 7. 等待数据库就绪
step "等待数据库就绪..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U lingpal >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "数据库启动超时"
  fi
  sleep 2
done

# 8. 数据库迁移
step "执行数据库迁移..."
docker compose run --rm migrate ./lingpal-migrate up || warn "迁移可能已执行过"
docker compose run --rm migrate ./lingpal-migrate seed || warn "种子数据可能已存在"

# 9. 启动应用
step "启动应用服务..."
if [ "$ENV" = "production" ]; then
  docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d server
else
  docker compose up -d server
fi

# 10. 健康检查
step "健康检查..."
sleep 3
HEALTH_URL="http://localhost:8080/health"
if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
  echo ""
  echo -e "${GREEN}==========================================="
  echo "  🚀 部署成功！"
  echo "  API: http://localhost:8080"
  echo "  Health: http://localhost:8080/health"
  echo "  WebSocket: ws://localhost:8080/ws"
  echo "============================================${NC}"
else
  warn "服务可能还在启动中，请手动检查: $HEALTH_URL"
fi

echo ""
echo "下一步："
echo "  1. curl http://localhost:8080/health          # 健康检查"
echo "  2. curl -X POST :8080/api/v1/auth/wechat/login -d '{\"code\":\"dev\"}'  # 登录"
echo "  3. curl -N :8080/api/v1/chat/send -H 'Authorization: Bearer <token>' -d '{\"content\":\"你好\"}'  # AI对话"
