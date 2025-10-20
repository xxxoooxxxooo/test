#!/usr/bin/env bash
set -euo pipefail

APP_NAME="crevas-ai"
DEFAULT_PORT=8080

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

choose_compose() {
  if command_exists docker; then
    if docker compose version >/dev/null 2>&1; then
      echo "docker compose"
      return 0
    fi
  fi
  if command_exists docker-compose; then
    echo "docker-compose"
    return 0
  fi
  return 1
}

print_header() {
  echo "============================================================"
  echo " $1"
  echo "============================================================"
}

print_header "一键安装 Crevas AI 静态站点（含可选 API）"

COMPOSE_CMD=""
if command_exists docker; then
  echo "检测到 Docker 已安装。"
  if COMPOSE_CMD=$(choose_compose); then
    echo "使用 $COMPOSE_CMD 进行容器化部署。"

    # Build and start
    $COMPOSE_CMD up -d --build

    echo "\n部署完成！"
    echo "- 访问地址: http://localhost:${DEFAULT_PORT}"
    echo "- 若需启用 Replicate，请设置环境变量并重新启动："
    echo "    export REPLICATE_API_TOKEN=your_token"
    echo "    export ENABLED_VIDEO_PROVIDERS=mock,replicate"
    echo "    $COMPOSE_CMD up -d"
    exit 0
  else
    echo "未检测到 docker compose / docker-compose，尝试直接使用 Docker 运行。"
    # Fallback: docker build + docker run
    docker build -t ${APP_NAME}:latest .
    if docker ps --format '{{.Names}}' | grep -q "^${APP_NAME}$"; then
      docker rm -f ${APP_NAME} >/dev/null 2>&1 || true
    fi
    docker run -d --name ${APP_NAME} \
      -e NODE_ENV=production \
      -e PORT=3000 \
      -e HOST=0.0.0.0 \
      -p ${DEFAULT_PORT}:3000 \
      -v ${APP_NAME}-data:/app/data \
      ${APP_NAME}:latest
    echo "\n部署完成！访问 http://localhost:${DEFAULT_PORT}"
    exit 0
  fi
fi

# Docker 不可用时的本地运行方案（Node.js）
if command_exists node; then
  echo "未检测到 Docker，改为直接使用 Node.js 运行。"
  export NODE_ENV=production
  export PORT=3000
  export HOST=0.0.0.0
  if command_exists pm2; then
    echo "检测到 PM2，使用 PM2 守护进程启动。"
    pm2 start ecosystem.config.js --name ${APP_NAME} || pm2 restart ${APP_NAME}
    echo "\n已通过 PM2 启动。请在服务器上配置反向代理到 http://127.0.0.1:3000"
    echo "或直接在本机访问 http://localhost:3000"
    exit 0
  else
    echo "未检测到 PM2，将直接前台启动：node server.js"
    echo "提示：可 Ctrl+C 退出，或安装 PM2 保持常驻：npm i -g pm2"
    node server.js
    exit 0
  fi
fi

echo "未检测到 Docker 或 Node.js。请先安装其中之一："
echo "- Docker: https://docs.docker.com/get-docker/"
echo "- Node.js (>=16): https://nodejs.org/en"
exit 1
