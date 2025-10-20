#!/usr/bin/env bash
set -euo pipefail

APP_NAME="of-video"
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

print_header "一键安装 Of video 静态站点（PHP，无 Docker）"

USE_DOCKER_FLAG=${USE_DOCKER:-}
ARG1=${1:-}

if [[ "$USE_DOCKER_FLAG" == "1" || "$ARG1" == "docker" ]]; then
  echo "已指定使用 Docker 部署。"
  COMPOSE_CMD=""
  if command_exists docker; then
    if COMPOSE_CMD=$(choose_compose); then
      echo "使用 $COMPOSE_CMD 进行容器化部署。"
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
      docker build -t ${APP_NAME}:latest .
      if docker ps --format '{{.Names}}' | grep -q "^${APP_NAME}$"; then
        docker rm -f ${APP_NAME} >/dev/null 2>&1 || true
      fi
      docker run -d --name ${APP_NAME} \
        -e ENABLED_VIDEO_PROVIDERS=${ENABLED_VIDEO_PROVIDERS:-mock} \
        -e REPLICATE_API_TOKEN=${REPLICATE_API_TOKEN:-} \
        -p ${DEFAULT_PORT}:80 \
        -v ${APP_NAME}-data:/var/www/html/data \
        ${APP_NAME}:latest
      echo "\n部署完成！访问 http://localhost:${DEFAULT_PORT}"
      exit 0
    fi
  else
    echo "未检测到 Docker，请改用 PHP 部署。"
  fi
fi

# 默认：使用 PHP 内置服务器（无 Docker）
if command_exists php; then
  echo "使用 PHP 内置服务器运行（无 Docker）。"
  export ENABLED_VIDEO_PROVIDERS=${ENABLED_VIDEO_PROVIDERS:-mock}
  export REPLICATE_API_TOKEN=${REPLICATE_API_TOKEN:-}
  echo "前台启动：php -S 0.0.0.0:3000 router.php"
  echo "提示：可 Ctrl+C 退出；如需守护，请使用 systemd/supervisor 或自行配置 Nginx/Apache。"
  php -S 0.0.0.0:3000 router.php
  exit 0
fi

echo "未检测到 PHP。请先安装 PHP (>=8.0)：https://www.php.net/downloads.php"
exit 1
