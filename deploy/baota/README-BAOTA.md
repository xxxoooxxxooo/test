# 在宝塔面板（BT）部署本项目

本项目包含完整的前端与后端：
- 前端：index.html + assets 静态资源
- 后端：Node.js 原生 HTTP 服务（server.js），提供 /api/contact 表单接口与 /healthz 健康检查

推荐使用宝塔的 Node 项目/PM2 管理器运行后端，并用 Nginx 反向代理对外提供服务。

## 环境要求
- Node.js 16 或更高（宝塔“应用商店 -> Node.js 管理器”安装对应版本）
- Nginx（宝塔默认安装）

## 部署步骤（PM2 + Nginx）
1. 通过 SFTP 或 Git，把整个仓库上传到服务器，比如：/www/wwwroot/crevas-ai
2. 在宝塔面板：
   - 打开“应用商店 -> PM2 管理器（Node 项目） -> 添加项目”
   - 运行目录：/www/wwwroot/crevas-ai
   - 启动文件：server.js（或选择 ecosystem.config.js 由 PM2 管理）
   - 运行用户：www（或 root，建议 www）
   - 环境变量（可选）：
     - PORT=3000（或其他未占用端口）
     - HOST=0.0.0.0
   - 启动项目
3. 在宝塔面板新增网站（域名），并配置 Nginx 反向代理到 PM2 监听端口，例如 3000：
   - 站点 -> 设置 -> 反向代理 -> 目标 URL: http://127.0.0.1:3000
   - 或直接编辑 Nginx 配置，使用本仓库的 deploy/baota/nginx.conf.example 作为参考
4. 访问你的域名确认前端页面可打开；/healthz 返回 {"ok": true}；填写“联系我们”表单应返回成功，并在 data/contacts.json 写入记录。

> 注意：server.js 默认会把联系人数据写到项目目录下的 data/contacts.json，请确保运行用户对该目录有写入权限。

## 仅静态部署（无后端）
若不需要表单接口，可以只部署前端静态文件：
- 站点根目录设置为项目中的 /www/wwwroot/crevas-ai（保持 index.html 与 assets 直接位于站点根）
- Nginx 不做反向代理，直接当静态站点即可
- 这种方式下 /api/contact 接口将不可用

## Nginx 配置示例
见同级文件 nginx.conf.example，可复制到“站点 -> 配置文件”中按需修改端口与域名即可。

## 常见问题
- 502/连接不上：检查 PM2 是否启动成功，server.js 监听的端口是否与 Nginx 反代端口一致。
- 表单提交失败：
  - 确认访问的域名指向了带后端的 Nginx 反向代理
  - 检查 data/contacts.json 是否有写入权限
  - 查看 PM2 日志：logs/out.log 与 logs/err.log
- 跨域：若前后端不在同一域名下，server.js 的 /api/contact 响应已设置 `Access-Control-Allow-Origin: *`，通常无需额外配置；如需收敛到特定域名，请自行修改。
