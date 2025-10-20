Of video 静态站点

概述
- 本仓库包含一个无需构建的静态网站，旨在呈现一个与 crevas.ai 风格相近的 AI 平台营销站点。所有内容均为原创占位文案与样式，方便后续替换为正式品牌与素材。
- 默认是前端静态文件；可选地，提供了一个极简 PHP 服务（router.php）用于处理联系表单与 AI 视频 API。

预览（纯静态）
- 直接在浏览器中打开 index.html 即可本地预览。
- 或使用任意静态服务器（如：python -m http.server 或 npx serve）在本地启动。
- 注意：使用纯静态方式时，联系表单的提交接口不可用。

本地运行（带联系表单 API）
- 需要 PHP 8.0+。
- 启动（内置服务器）：
  - php -S 0.0.0.0:3000 router.php
- 访问 http://localhost:3000
- 填写“联系我们”表单后，数据会写入 data/contacts.json。

目录结构
- index.html: 站点首页
- index.php: PHP 入口（在仅支持 PHP 的环境下直接访问首页）
- assets/css/styles.css: 站点样式
- assets/js/main.js: 交互脚本（移动端菜单、手风琴、联系表单提交）
- router.php: 极简 API 路由（/api/contact、/api/video/*、/healthz）
- install.php: 简易安装/环境检测（可写入 config.php）
- config.php.sample: 配置示例（复制为 config.php 使用）
- .htaccess: Apache 重写到 router.php（仅 API 路径）
- Dockerfile & docker-compose.yml: 容器化部署
- install.sh: 一键安装脚本
- data/contacts.json: 本地表单数据（启动后自动创建）

AI 视频 API 接入
- 新增统一接口，支持对接多家 AI 视频模型供应商（默认内置一个 Mock 演示与可选的 Replicate 适配器）。
- 前端演示入口：页面“AI 视频 API 接入”区块，可选择供应商并提交生成任务。

后端环境变量
- ENABLED_VIDEO_PROVIDERS: 启用的供应商，逗号分隔。默认 mock。可选：mock, replicate
- REPLICATE_API_TOKEN 或 VIDEO_REPLICATE_API_TOKEN: Replicate 访问令牌（配置后启用 Replicate 提供的模型/部署）

接口说明（简化）
- GET /api/video/providers
  - 返回已启用的供应商列表及其能力/配置状态
- POST /api/video/generate
  - 通用参数：{"provider": "mock"|"replicate", ...}
  - 当 provider=mock：{"prompt": "...", "options": {...}}（演示用途，2-3 秒返回成功状态）
  - 当 provider=replicate：{"deployment": "owner/name" 可选, "version": "模型版本ID" 可选, "input": {"prompt": "...", 其他模型参数}}
    - deployment 与 version 二选一；推荐使用 deployment（Replicate 的部署名称）
- GET /api/video/jobs/:provider/:id
  - 轮询查询任务状态，直到 succeeded 或 failed

使用示例（curl）
- 查看供应商：
  curl http://localhost:3000/api/video/providers
- 使用 Mock 生成（演示）：
  curl -X POST http://localhost:3000/api/video/generate \
       -H 'Content-Type: application/json' \
       -d '{"provider":"mock","prompt":"a cat in space"}'
- 使用 Replicate（需配置 REPLICATE_API_TOKEN）：
  curl -X POST http://localhost:3000/api/video/generate \
       -H 'Content-Type: application/json' \
       -d '{"provider":"replicate","deployment":"your-org/your-deployment","input":{"prompt":"a cat in space"}}'

自定义
- 将文案、链接和图片替换为你自己的品牌素材。
- 如需接入第三方服务或企业后端，可在 main.js 中调用你的 API，或扩展 router.php。
- 如需接更多视频供应商，可参考 router.php 中的 Replicate 适配器实现，新增对应适配器与路由分支。

PHP 安装访问（无 Docker）
- 将项目放到支持 PHP 的站点根目录。
- 访问 /install.php 进行环境检测与可选配置（会生成 config.php）。
- 若使用 PHP 内置服务器开发/快速启动：php -S 0.0.0.0:3000 router.php
- 生产环境推荐 Nginx/Apache + PHP，将 /api/* 与 /healthz 转发到 router.php。

部署（一键安装推荐）
- 一键安装（Docker 优先）：
  - 执行：bash ./install.sh
  - 默认使用 Docker Compose 启动，访问 http://localhost:8080
  - 环境变量（可选）：在安装前导出即可被 docker-compose 读取
    - export ENABLED_VIDEO_PROVIDERS=mock,replicate
    - export REPLICATE_API_TOKEN=你的令牌
  - 常用命令：
    - docker compose logs -f
    - docker compose restart
    - docker compose down

- 无 Docker 时（自动降级）：
  - install.sh 会使用 PHP 内置服务器直接启动（前台运行）
  - 默认监听 http://localhost:3000

- 纯静态部署：将 index.html 与 assets 文件夹托管到 Vercel、Netlify、Cloudflare Pages、GitHub Pages 等平台（不支持 /api）。
- 含后端 API 的部署：
  - Docker：使用本仓库的 Dockerfile（Apache + PHP）
  - 传统环境：Nginx/Apache + PHP（推荐 PHP 8+），将项目放到站点根目录，确保 .htaccess 生效或将 /api/* 与 /healthz 转发到 router.php。
- 在宝塔面板（BT）部署：建议使用 Docker（更简单），或使用 Nginx + PHP-FPM 配置站点，将 /api/* /healthz 路由到 router.php；数据写入 data/ 目录。

许可与声明
- 本模板仅用于演示与快速落地，页面文案、图形与图标均为占位内容，不代表任何第三方网站的实际素材或信息。
