Crevas AI 静态站点

概述
- 本仓库包含一个无需构建的静态网站，旨在呈现一个与 crevas.ai 风格相近的 AI 平台营销站点。所有内容均为原创占位文案与样式，方便后续替换为正式品牌与素材。
- 默认是前端静态文件；可选地，提供了一个极简 Node.js 服务（server.js）用于处理联系表单。

预览（纯静态）
- 直接在浏览器中打开 index.html 即可本地预览。
- 或使用任意静态服务器（如：python -m http.server 或 npx serve）在本地启动。
- 注意：使用纯静态方式时，联系表单的提交接口不可用。

本地运行（带联系表单 API）
- 需要 Node.js 16+。
- 启动：
  - node server.js
  - 或 npm start
- 访问 http://localhost:3000
- 填写“联系我们”表单后，数据会写入 data/contacts.json。

目录结构
- index.html: 站点首页
- assets/css/styles.css: 站点样式
- assets/js/main.js: 交互脚本（移动端菜单、手风琴、联系表单提交）
- server.js: 极简静态文件服务器 + /api/contact 表单接口
- package.json: 启动脚本
- data/contacts.json: 本地表单数据（启动后自动创建）

自定义
- 将文案、链接和图片替换为你自己的品牌素材。
- 如需接入第三方服务或企业后端，可在 main.js 中调用你的 API，或扩展 server.js。

部署
- 纯静态部署：将 index.html 与 assets 文件夹托管到 Vercel、Netlify、Cloudflare Pages、GitHub Pages 等平台。
- 含表单 API 的部署：将整个仓库部署到支持 Node.js 的平台（如 Render、Railway、Fly.io 或自有服务器）。

许可与声明
- 本模板仅用于演示与快速落地，页面文案、图形与图标均为占位内容，不代表任何第三方网站的实际素材或信息。
