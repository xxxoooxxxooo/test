标题：基于 PHP + 宝塔面板的 AI 视频创作平台技术方案

1. 目标与范围
- 目标：在宝塔面板（BT 7.9+）环境下，基于 PHP 8.1+ 构建一套可生产可运维的 AI 视频创作平台，实现多模型并行生成、脚本到视频流水线、实时协作与对比评估、以及多分辨率输出与多格式导出。
- 适配约束：
  - 开发语言：PHP 8.1+
  - 部署环境：宝塔面板 7.9+
  - 必需扩展：Swoole（WebSocket/并发 IO）、Redis、GD、Fileinfo（上传/MIME 校验）。建议安装 ext-curl、intl、mbstring、openssl。
  - 数据库：MySQL 8.0（事务 + JSON 字段） + Redis（缓存与队列）
  - 队列：Supervisor 进程守护，驱动 Redis
  - 存储：本地磁盘（热存储）+ 云存储（冷/分发）：阿里云 OSS/七牛云/KODO/AWS S3 等
  - 外部依赖：各视频模型供应商 API（Veo 3、Runway、Kling、Wan 2.5、Nano Banana 等）

2. 总体架构
- 分层：
  - 前端层：静态站点/管理控制台（现有 index.html 可演进为管理 UI），通过 REST + WebSocket 与后端交互。
  - API 网关层（PHP-FPM）：统一的业务 API，认证鉴权、参数校验、作业登记与查询。
  - 任务调度层（队列 + Worker）：将生成请求拆解为子任务，投递 Redis 队列，Supervisor 管理工作进程。
  - 模型适配层（Provider Adapters）：对接 Veo 3、Runway、Kling、Wan 2.5、Nano Banana 等供应商，屏蔽差异，统一状态与输出。
  - 实时协作层（Swoole WebSocket）：多人在线编辑、任务状态推送、对比评审同步。
  - 媒体服务层：FFmpeg 工具链（安装在宿主机），用于拼接、转码、抽帧、缩略图与 GIF 生成等。
  - 存储层：本地磁盘（高速读写）+ 云存储（长期/分发），提供签名 URL、CDN 加速。
- 关键流转：
  - 前端提交“视频生成任务” -> API 写入 DB（jobs、experiments）并入队 -> Worker 并行调度调用各 Provider -> 轮询/回调推进状态 -> 持久化输出与中间产物 -> WebSocket 向页面推送进度 -> 前端比对、预览与导出。

3. 模块与职责
- 身份与权限
  - 用户、组织、项目三层；RBAC 权限模型（项目成员角色：Owner/Admin/Editor/Viewer）。
  - 令牌：JWT（短期）+ 刷新令牌；管理后台支持 API Key（服务器到服务器调用）。
- 项目与版本
  - Project 表示业务工程；Version 表示阶段快照；ChangeLog 记录改动。
- 提示词与实验
  - PromptTemplate 分类管理（视频类型：广告、短剧、游戏、教育等）。
  - Experiment + Variant（A/B/N）并行测试，不同提示词、不同供应商或不同参数组合。
  - 统计聚合：成功率、耗时、成本、主/客观评分。
- 生成作业
  - GenerationJob：顶层作业，包含多 Variant 子任务；
  - JobTask：面向具体 Provider 的原子任务；
  - JobEvent：状态流转/日志与错误；
  - 统一状态：queued/starting/processing/succeeded/failed/canceled；
  - 并发控制：按 Provider + 租户限流。
- 实时协作
  - Swoole WebSocket 服务：
    - 频道：project:{id}、job:{id}、experiment:{id}
    - 事件：presence 加入/离开、doc_update（JSON Patch）、job_progress、comment、review_vote
    - 权限：握手校验 JWT 与项目成员身份
  - 文档协同：结构化 JSON（脚本、分镜、提示词表），采用服务器权威顺序写入 + 增量更新（JSON Patch），Redis 记录最近 N 条操作实现回放。
- 媒体流水线
  - ScriptParser：脚本场景解析与分镜建议（规则 + NLP 提示词生成）
  - Batch Generator：批量分发到多个 Provider，并行生成片段
  - Assembler：FFmpeg 拼接序列、加片头/片尾、BGM/水印、调速；输出 MP4/MOV/GIF
  - Thumbnailer：抽帧生成封面与海报

4. 供应商适配（Provider Adapters）
- 统一接口（伪代码）
  - createJob(input: array): returns {id, status}
  - getJob(id): returns {status, output, error, raw}
  - cancelJob(id)
  - normalize(output): 统一为 {video_url(s), cover_url, meta}
- 已知厂商
  - Veo 3：走 Google/Vertex AI 生态，需服务账号与 Region 配置（建议后端代理，避免前端暴露）
  - Runway：Gen 模型 HTTP API；注意队列时延与额度限制
  - Kling：Kuaishou（快手）API；通常需企业资质与白名单
  - Wan 2.5：商汤/字节系相关能力（按实际 API 对接）
  - Nano Banana：假定为第三方视频生成平台，按其文档适配
- 实现策略
  - 初期：以 Replicate 作为统一桥接（已有 demo），当官方直连可用再替换为直连适配器
  - 错误与配额：标准化异常码（rate_limited/auth_failed/bad_request/timeout/provider_error）
  - 重试：指数退避 + 幂等键（外部 idempotency key）

5. 数据库设计（核心表建议）
- users(id, email, password_hash, name, role, created_at)
- organizations(id, name, owner_id, created_at)
- projects(id, org_id, name, description, created_at, updated_at)
- project_members(id, project_id, user_id, role)
- versions(id, project_id, name, note, created_at)
- prompts(id, project_id, title, type, content_json, created_at, updated_at)
- prompt_templates(id, category, title, content_json, created_at)
- experiments(id, project_id, name, objective, created_at)
- experiment_variants(id, experiment_id, provider, params_json, prompt_id, weight, created_at)
- generation_jobs(id, project_id, experiment_id, status, resolution, aspect_ratio, format, cost_cents, created_at, updated_at)
- job_tasks(id, job_id, variant_id, provider, provider_job_id, status, input_json, output_json, error_json, created_at, updated_at)
- job_events(id, job_id, task_id, level, message, data_json, created_at)
- assets(id, project_id, type, path, url, meta_json, storage, size_bytes, checksum, created_at)
- storage_files(id, disk, path, size_bytes, mime, ext, checksum, created_at)
- provider_accounts(id, org_id, provider, api_key_encrypted, quota_json, created_at)
- reviews(id, job_id, user_id, score, comment, created_at)
- collab_ops(id, project_id, doc_type, doc_id, user_id, op_json, created_at)
- indices：常用 where 条件建立 BTree；job_tasks(provider,status)、assets(project_id,created_at) 等

6. API 设计（REST）
- Auth：POST /api/v1/auth/login、POST /api/v1/auth/refresh
- Providers：GET /api/v1/providers（可用性、配额）
- Templates：GET /api/v1/templates?category=ad、POST /api/v1/templates
- Projects：CRUD
- Prompts：CRUD
- Experiments：POST /api/v1/experiments；POST /api/v1/experiments/{id}/variants
- Jobs：
  - POST /api/v1/jobs（body：project、experiment/variants、分辨率/比例/格式、脚本或提示词）
  - GET /api/v1/jobs/{id}（汇总）
  - GET /api/v1/jobs/{id}/tasks（明细）
  - GET /api/v1/jobs/{id}/events
  - POST /api/v1/jobs/{id}/cancel
- Assets：GET /api/v1/assets/{id}（签名 URL）
- WebSocket：/ws ；事件见“实时协作”部分

7. 多模型并行与调度
- 队列分组：queue:runway、queue:veo、queue:kling、queue:wan、queue:nano；每组 worker 并发 N
- 优先级：优先处理短时长/低分辨率任务；长任务降权或分时段执行
- 限流：Redis Token Bucket；按 provider/per org/per user 配置
- 去重：同一 Variant 的同参短时间内只跑一次（缓存命中）
- 进度监控：定时轮询 + Provider 回调（如支持 webhook），写入 job_events 并广播 WebSocket

8. 提示词助手与 A/B 测试
- 模板库：按照视频类型、体裁、风格与镜头语言组织；使用变量与片段（如 {scene_place}、{emotion}）
- A/B/N 框架：一次生成多个 Variant；统计成功率、耗时、评分；页面对比播放与投票
- 优化建议：
  - 基于历史数据的回归/树模型，对提示词特征与结果指标做关联分析
  - 规则提示：过长/过短、缺少镜头指令、风格冲突

9. 脚本到视频流水线
- 脚本解析：按场景与镜头切分，识别人物/场景/动作关键要素
- 提示词自动生成：根据镜头结构与风格词库合成提示词
- 批量任务：每个镜头一个子任务，落到不同 Provider 并行生成
- 序列组装：FFmpeg 拼接，插入转场、BGM、字幕（如使用 Whisper + SRT 同步）
- 产物：
  - 中间件：每个镜头的视频、封面、日志
  - 成品：MP4/MOV；可选生成 GIF 预览与 HLS 分片

10. 多分辨率输出
- 支持 720p、1080p、2K、4K；比例 9:16、16:9、1:1、21:9
- 转码策略：
  - Provider 原始分辨率 -> 统一到目标分辨率与码率
  - FFmpeg 预设：不同清晰度标准码率与编码参数（x264/x265/aac）
- 导出格式：MP4、MOV、GIF；打包下载（ZIP）或生成签名 URL

11. 运维与部署（宝塔面板）
- 站点与运行时
  - 新建站点（Nginx + PHP-8.1）；设置根目录为项目 public 或仓库根（结合路由）
  - 安装 PHP 扩展：Swoole、Redis、GD、Fileinfo、curl、pdo_mysql
  - composer install；生成 .env；php artisan migrate （如采用 Laravel）
- Nginx 配置要点
  - /api 与静态分流；上传大小 client_max_body_size 512m；
  - WebSocket 反向代理：location /ws 升级连接；
  - 反向代理回源 FFmpeg 生成的媒体（或直接走静态目录/CDN）
- Supervisor 进程
  - 队列：php artisan queue:work --queue=runway,veo,kling,wan,nano --sleep=1 --tries=1 --memory=512
  - WebSocket：php artisan swoole:server 或 php bin/ws-server.php
  - 定时任务：清理过期中间产物、刷新云存储回源缓存
- FFmpeg 安装
  - 通过宝塔软件商店或 apt 安装 ffmpeg；确保可执行路径
- Redis 与 MySQL
  - 在宝塔中安装 Redis 与 MySQL 8，设置持久化、慢查询、备份策略
- 云存储
  - 选择 OSS/S3；配置 AccessKey；使用 SDK 上传；生成私有读签名 URL；CDN 加速绑定

12. 安全与合规
- API Key 管理：Provider 密钥加密存储（OpenSSL + KMS），仅后端使用；前端不暴露
- 鉴权与授权：JWT + RBAC；操作日志审计
- CORS 与 CSRF：API 只允许特定来源；表单 CSRF Token
- 上传与媒体安全：Fileinfo 校验、扩展白名单、杀毒/隔离策略（若开放用户上传）
- 速率限制：IP/用户级别限流；异常触发拉黑

13. 监控与可观测
- 日志：结构化 JSON 日志（job_id、provider、latency、status）
- 指标：任务 QPS、成功率、P95/P99 时延、失败原因分布；Prometheus 导出或接入阿里云/腾讯云监控
- 告警：队列堆积、失败率上升、Provider 限速/配额耗尽，短信/邮件/企微

14. 渐进式落地计划（里程碑）
- M1（1-2 周）：后端骨架 + 统一 Provider 接口 + Replicate 适配 + 作业/任务表 + 队列与轮询；前端基础面板 + 进度展示
- M2（2-3 周）：Runway 与 Wan/Kling/Nano 的直连适配；多分辨率转码与缩略图；对比评审 UI
- M3（2 周）：脚本解析 + 分镜 + 批量生成 + FFmpeg 序列组装；模板库与 A/B 测试
- M4（1-2 周）：Swoole WebSocket 实时协作；操作历史与版本管理
- M5（持续）：云存储 + CDN；监控告警 + 成本统计；安全加固与压测

15. 环境变量建议（示例）
- APP_ENV=production
- APP_KEY=xxx
- DB_HOST=127.0.0.1
- DB_DATABASE=ai_video
- DB_USERNAME=***
- DB_PASSWORD=***
- REDIS_HOST=127.0.0.1
- REDIS_PASSWORD=
- QUEUE_CONNECTION=redis
- STORAGE_DISK=local|oss|s3
- OSS_ACCESS_KEY_ID=xxx
- OSS_ACCESS_KEY_SECRET=xxx
- OSS_BUCKET=xxx
- OSS_ENDPOINT=oss-cn-xxx.aliyuncs.com
- PROVIDERS_ENABLED=runway,veo,kling,wan,nano
- PROVIDER_RUNWAY_TOKEN=***
- PROVIDER_VEO_CREDENTIALS=***
- PROVIDER_KLING_TOKEN=***
- PROVIDER_WAN_TOKEN=***
- PROVIDER_NANO_TOKEN=***

16. 与现有仓库的衔接
- 现有静态站点可作为对外营销页与最小演示；/api 已提供 mock + replicate 示例，可演进为上述 API 的 MVP。
- 逐步将 router.php 拆到框架化项目（如 Laravel）或保留为反向代理层，路由到新的业务服务。
- 前端 main.js 已支持统一视频 API 与直连备用（开发模式）；后续接入 WebSocket 推送与作业对比界面即可。

17. 关键风险与对策
- 供应商额度与限速不确定：实现快速降级与重试；必要时排队与告知预计完成时间
- 多供应商参数与输出不一致：规范化输出与必要的二次处理；建立参数映射文档
- 大文件 IO 与转码耗时：分布式存储 + 队列弹性；FFmpeg 任务拆分并行；适配 CDN
- 实时协作复杂度：先覆盖核心字段（脚本/分镜/提示词），逐步演进 CRDT；引入操作日志回放

说明
- 本方案兼顾宝塔面板常见运维路径与高并发任务处理需求，先用队列化 + Provider 适配器实现“多模型并行”，逐步迭代协作与流水线能力，最终达到企业级可用。
