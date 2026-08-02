#!/bin/bash
# 灵伴(LingPal) — 一键启动脚本
# 用法: bash scripts/start.sh
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
echo -e "${GREEN}============================================"
echo "  灵伴(LingPal) — AI陪伴 × 3D世界"
echo "  一键启动脚本"
echo -e "============================================${NC}"

# 1. 检查 Docker
if command -v docker &>/dev/null; then
  echo -e "${GREEN}[1/4] 启动基础设施 (PostgreSQL+Redis+MinIO)...${NC}"
  docker compose up -d 2>/dev/null || echo -e "${YELLOW}Docker守护进程未启动，跳过${NC}"
else
  echo -e "${YELLOW}[1/4] Docker未安装，请手动启动数据库${NC}"
fi

# 2. 配置环境
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || true
  echo -e "${YELLOW}[!] 请编辑 .env 填入 DEEPSEEK_API_KEY${NC}"
  echo "   获取免费Key: https://platform.deepseek.com"
fi

# 3. 编译+启动Go后端
echo -e "${GREEN}[2/4] 编译Go后端...${NC}"
cd server && CGO_ENABLED=0 go build -o ../bin/lingpal-server ./cmd/server && cd ..
echo -e "${GREEN}[3/4] 启动API网关 (端口8080)...${NC}"
./bin/lingpal-server &
SERVER_PID=$!
sleep 2

# 4. 显示入口
echo ""
echo -e "${GREEN}============================================"
echo "  🚀 启动成功！"
echo ""
echo "  📡 API:      http://localhost:8080"
echo "  📖 文档:     http://localhost:8080/docs"
echo "  💚 健康:     http://localhost:8080/health"
echo "  🔌 WebSocket: ws://localhost:8080/ws"
echo ""
echo "  快速测试:"
echo "  curl http://localhost:8080/docs"
echo "  curl -X POST :8080/api/v1/auth/wechat/login -d '{\"code\":\"dev\"}'"
echo -e "============================================${NC}"

wait $SERVER_PID
