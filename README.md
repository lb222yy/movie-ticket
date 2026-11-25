# CineMax · 在线电影购票系统

> Web 程序设计课程期末小组项目（项目 13）
> 技术栈：HTML5 + CSS3 + 原生 JavaScript（DOM / BOM）+ Node.js / Express + SQLite

CineMax 是一个完整的在线电影购票系统：前台提供影片浏览、搜索、详情、选座、支付、电子票、退票改签、影评评分与收藏；后台提供数据看板、影片、影院影厅、场次、订单、评论与轮播广告管理。前后端分离为 RESTful API + 原生多页面应用，数据库使用 Node.js 24 内置的 `node:sqlite`，**零原生依赖、开箱即用**。

---

## 一、在线体验

| 项目 | 地址 / 账号 |
| --- | --- |
| 前台首页 | `http://localhost:3000/` |
| 影院管理后台 | `http://localhost:3000/admin.html` |
| 普通用户 | `demo` / `demo123`（也可用 `xiaoyu` / `123456`） |
| 影院管理员 | `admin` / `admin123` |

> 部署到公网后，将 `localhost:3000` 替换为实际域名即可。部署方式见「七、部署上线」。

---

## 二、技术栈与运行环境

| 层次 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | HTML5 语义化标签、CSS3（Flex/Grid、变量、动画、媒体查询）、原生 JavaScript | 无框架、无构建，直接由 Express 托管静态资源 |
| DOM | 动态节点创建、事件委托、表单校验、节点遍历 | 影片卡片、座位图、订单卡片、后台表格均动态渲染 |
| BOM | `localStorage` / `sessionStorage`、`location`、`history`、定时器、`Notification`、`window.print`、`scroll` | 登录态、搜索历史、开场倒计时与提醒、打印电子票 |
| 后端 | Node.js + Express 4 | RESTful API、JWT 鉴权、统一错误处理、CORS |
| 数据库 | SQLite（`node:sqlite`） | 14 张表 + 1 个视图，外键、唯一索引、事务 |
| 其它 | `qrcode`（服务端生成电子票二维码）、`dotenv`、`cors` | 均为纯 JS 依赖，无编译环节 |

**环境要求**：Node.js **≥ 22.5**（`node:sqlite` 自 22.5 起提供；推荐 Node 24 LTS）。

---

## 三、快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（可选，缺省即可本地运行）
cp .env.example .env

# 3. 初始化演示数据（重建表结构并写入 8 部影片 / 4 家影院 / 9 个影厅 / 近 500 场次 / 历史订单）
npm run init-db

# 4. 启动服务
npm start
```

启动后访问 `http://localhost:3000`。首次启动若检测到空数据库，也会自动写入演示数据。

开发模式（文件变更自动重启）：

```bash
npm run dev
```

> 若本机未安装 Node，可使用项目外层的便携版：
> `d:\trae项目\tools\node-v24.11.1-win-x64\node.exe server\index.js`
>
> 启动时出现 `ExperimentalWarning: SQLite is an experimental feature` 属正常提示，不影响运行。

---

## 四、真实影片数据（内置爬虫）

项目使用 `scripts/crawl-douban.js`（零第三方依赖）从豆瓣电影抓取真实影片资料，并已下载到本地：片名、原始片名、年份、类型、片长、语言、上映日期、简介、导演、主演、热门短评、海报、剧照（详情页背景）、预告片。

- 抓取入口：豆瓣「热门」榜单 +「即将上映」榜单；也可用 `--ids` 指定影片 ID
- 资源落地：`public/assets/posters/douban`、`public/assets/backdrops/douban`、`public/assets/trailers`
- 数据落库：按影片 id 原位替换，场次 / 订单 / 收藏等外键不受影响；`npm run init-db` 重建数据库时会自动导入 `scripts/output/douban-movies.json`
- 稳定性处理：请求间隔默认 1.2 秒、失败自动重试；海报 CDN 必须携带 `Referer`（否则返回 418）；预告片为带时效直链，已下载为本地 MP4

当前库内 8 部真实影片（豆瓣 ID / 片名 / 年份 / 豆瓣评分）：

| 豆瓣 ID | 片名 | 年份 | 豆瓣评分 | 状态 |
| --- | --- | --- | --- | --- |
| 36847425 | 可能的爱 | 2026 | 8.6 | 热映 |
| 37215318 | 黑球 | 2026 | 8.7 | 热映 |
| 38586131 | 多萝西 | 2026 | 8.0 | 热映 |
| 38520799 | 忘年之约 | 2026 | 7.3 | 热映 |
| 37436785 | 非常治疗师 | 2026 | 6.2 | 热映 |
| 37317907 | 另一个妈妈 | 2026 | 5.8 | 热映 |
| 36011202 | 复仇者联盟5 | 2026 | - | 待映 |
| 36212391 | 流浪地球3(上) | 2027 | - | 待映 |

> 影片页展示的评分由站内用户评论实时求均值（体现评分功能），与豆瓣评分口径不同属正常现象。

```bash
npm run crawl                                          # 只抓取并下载资源，导出 JSON
npm run crawl:apply                                    # 抓取后写入数据库
node scripts/crawl-douban.js --no-download --apply     # 仅更新元数据，复用已下载资源
node scripts/crawl-douban.js --ids 36847425,37215318 --apply   # 指定影片 ID
```

> 资源体积：海报约 2.4 MB、剧照约 1.7 MB、预告片约 150 MB（4 部，单部 ≤45 MB）。
> 若仓库体积敏感，可删除 `public/assets/trailers` 并把对应影片的 `trailer_url` 指回示例视频。
>
> 数据来源：豆瓣电影（https://movie.douban.com）。仅用于课程演示，请勿商用或高频抓取，遵守目标站点服务条款。

---

## 五、功能清单（对应题目 15 项要求）

| # | 题目要求 | 实现说明 |
| --- | --- | --- |
| 1 | 用户 / 影院管理员登录 | 注册、登录、JWT（HMAC-SHA256）鉴权、角色权限（`user` / `admin`）、个人资料修改 |
| 2 | 电影信息管理（增删改查、海报、预告片） | 后台影片表单：海报/剧照快捷选择、演职人员动态增删行、预告片地址、上映状态；已产生订单的影片禁止删除 |
| 3 | 电影列表（正在热映 / 即将上映、搜索） | 首页热映网格、即将上映倒计时、关键词搜索、类型筛选、排序、分页 |
| 4 | 电影详情（评分、演职人员） | 详情页 Hero、演职人员卡片、剧情简介、评分汇总与 1–10 分分布、评论列表 |
| 5 | 影院 / 影厅 / 场次管理 | 影院 CRUD、影厅 CRUD（自动生成座位，含 VIP / 情侣座）、同厅同时段排片冲突校验 |
| 6 | 选座购票（座位图动态渲染、锁定） | 座位图按排/列动态渲染，过道间距、售出/他人锁定/我的锁定三态；最多 6 座；15 分钟锁座 |
| 7 | 订单管理与支付模拟 | 锁座 → 下单 → 支付宝/微信/银行卡模拟支付 → 电子票；未支付订单自动关闭 |
| 8 | 退票 / 改签 | 开场前 2 小时可退（5% 手续费）或改签（同影片换场次换座、多退少补差价），全程事务与操作日志 |
| 9 | 我的订单与电子票（二维码） | 我的票夹：状态分页签、开场倒计时、电子票二维码/取票码、`window.print` 打印 |
| 10 | 评论评分 | 1–10 分评分 + 3–500 字影评，重复评价自动更新，管理员可删除 |
| 11 | 轮播广告位 | 首页 Hero 轮播（自动播放/箭头/圆点/悬停暂停），后台可配置图片、文案、跳转与排序 |
| 12 | 倒计时开场提醒（BOM 定时器） | 订单卡片秒级倒计时，开场前 10 分钟红色高亮；`Notification` 桌面提醒（需授权） |
| 13 | 统计看板（票房趋势） | 后台 Canvas 手绘图表：近 14 天票房折线（渐变面积）、影院票房占比环形图、影片 TOP 6 横向柱状图，含入场动画 |
| 14 | 响应式选座界面 | 座位图横向滚动 + 缩放适配，移动端单列卡片、导航折叠 |
| 15 | 搜索历史与收藏 | `localStorage` 保存最近 8 条搜索历史，下拉快速复用；影片收藏（想看片单）前后端联动 |

> 另含：404 页面、健康检查、统一响应格式、API 日志、接口级权限校验、并发防超卖（唯一索引）。

---

## 六、知识点覆盖对照

| 知识点 | 覆盖位置 |
| --- | --- |
| HTML | 语义化结构（`header/main/section/article/footer`）、表单（登录、资料、后台 CRUD）、表格、SVG 图形 |
| CSS | 设计系统 CSS 变量、Flex/Grid、媒体查询、`transition` / `@keyframes`、渐变与毛玻璃、打印样式 |
| JS 基础 | 模块化命名空间（`window.Auth/API/UI/Utils`）、数组对象操作、异步 `async/await + fetch`、异常处理 |
| DOM | 动态创建/替换节点、事件委托（列表操作）、表单校验、`dataset` 传参、节点遍历 |
| BOM | `localStorage`（token、搜索历史、提醒标记）、`history.replaceState`、`setInterval/setTimeout`、`Notification`、`window.print`、`scroll` 监听 |
| 数据库 | 14 张关联表 + 视图、外键、部分唯一索引 `ux_ticket_seat_active`、事务、分页与聚合查询 |
| 前后端 | RESTful API、Bearer Token、统一 `{ success, message, data }`、错误码、CORS |
| 动态效果 | 轮播、骨架屏、Toast、弹窗动画、座位选中反馈、Canvas 图表动画、倒计时 |
| 工程化 | 目录分层、`.env` 配置、`.gitignore`、测试脚本、Docker / 部署配置、提交规范 |

---

## 七、项目结构

```
movie-ticket-system/
├─ database/
│  ├─ schema.sql              # 建表脚本（14 表 + 1 视图）
│  └─ cinema.db               # 运行时生成（已加入 .gitignore）
├─ server/
│  ├─ index.js                # 服务入口：中间件、路由挂载、404、错误处理
│  ├─ db.js                   # SQLite 连接、事务封装
│  ├─ auth.js                 # 密码哈希、JWT 签发校验、时间与订单号工具
│  ├─ respond.js              # 统一响应与 snake_case → camelCase
│  ├─ seed.js                 # 演示数据脚本（npm run init-db）
│  ├─ douban-import.js        # 豆瓣真实影片数据入库（爬虫与 seed 共用）
│  └─ routes/
│     ├─ auth.js              # 注册 / 登录 / 我的信息
│     ├─ movies.js            # 影片列表、搜索、热映榜、详情、CRUD
│     ├─ cinemas.js           # 影院、影厅、座位
│     ├─ showtimes.js         # 场次、座位图
│     ├─ orders.js            # 锁座、下单、支付、取消、退票、改签、电子票
│     ├─ comments.js          # 影评评分
│     ├─ misc.js              # 收藏、轮播
│     └─ admin.js             # 统计看板、订单/用户/评论管理
├─ public/
│  ├─ index.html              # 首页
│  ├─ movie.html              # 影片详情
│  ├─ seat.html               # 选座 + 支付
│  ├─ orders.html             # 我的票夹
│  ├─ admin.html              # 管理后台
│  ├─ 404.html
│  ├─ css/  base.css · home.css · movie.css · seat.css · orders.css · admin.css
│  ├─ js/   api.js · ui.js · home.js · movie.js · seat.js · orders.js · admin.js
│  └─ assets/ posters · backdrops · banners · trailers · favicon（演示用 SVG + 豆瓣真实海报/剧照/预告片）
├─ scripts/
│  ├─ gen-assets.js           # 原创 SVG 视觉素材生成脚本
│  ├─ crawl-douban.js         # 豆瓣电影爬虫（npm run crawl / crawl:apply）
│  └─ output/douban-movies.json  # 爬取结果（seed 自动导入）
├─ tests/api.test.js          # 33 项接口全链路测试
├─ docs/                      # PPT、分工说明、录屏脚本
├─ Dockerfile / render.yaml   # 部署配置
├─ .env.example
└─ package.json
```

---

## 八、数据库设计

数据库共 14 张表 + 1 个视图，核心关系：

```
users ─┬─< orders >─ showtimes >─ movies
       │      └─< tickets >─ seats >─ halls >─ cinemas
       ├─< comments >─ movies
       ├─< favorites >─ movies
       └─< seat_locks >─ showtimes

showtimes >─ movies / cinemas / halls
orders >─ order_logs（操作审计）
```

| 表 | 用途 | 关键字段 / 约束 |
| --- | --- | --- |
| `users` | 用户与管理员 | `username` 唯一、`password_hash`（scrypt 加盐）、`role` |
| `movies` | 影片 | 状态 `showing/upcoming/offline`、海报、预告片、评分冗余 |
| `movie_cast` | 演职人员 | 外键 `movie_id`，级联删除 |
| `cinemas` / `halls` | 影院 / 影厅 | 影厅排数、列数、银幕类型 |
| `seats` | 座位 | `(hall_id, row_no, col_no)` 唯一、类型 `normal/vip/couple` |
| `showtimes` | 场次 | 外键影片/影院/影厅、开场时间、基础票价、版本 |
| `seat_locks` | 锁座 | 15 分钟过期，`order_id` 关联订单 |
| `orders` | 订单 | 订单号唯一、状态机、取票码、支付方式、时间戳 |
| `tickets` | 影票 | 部分唯一索引：`(showtime_id, seat_id) WHERE status IN ('held','valid')` 防止重复售卖 |
| `comments` | 影评 | `(user_id, movie_id)` 唯一，评分 1–10 |
| `favorites` | 收藏 | `(user_id, movie_id)` 唯一 |
| `banners` | 轮播 | 图片、标题、跳转、排序、启用状态 |
| `order_logs` | 订单日志 | 记录下单、支付、退票、改签等动作与差额 |
| `v_paid_orders` | 视图 | 统一票房统计口径 |

完整建表语句见 [database/schema.sql](database/schema.sql)。

---

## 九、API 一览

统一前缀 `/api`，响应体：

```json
{ "success": true, "message": "ok", "data": {} }
```

需要登录的接口通过请求头 `Authorization: Bearer <token>` 传递身份。

| 模块 | 方法 & 路径 | 说明 |
| --- | --- | --- |
| 认证 | `POST /auth/register`、`POST /auth/login` | 注册 / 登录，返回 token 与用户信息 |
| | `GET /auth/me`、`PUT /auth/profile` | 当前用户 / 修改昵称手机号 |
| 影片 | `GET /movies` | 列表：`status / keyword / sort / page / pageSize` |
| | `GET /movies/ranking`、`GET /movies/:id` | 票房榜 / 详情（含演职人员） |
| | `POST /movies`、`PUT /movies/:id`、`DELETE /movies/:id` | 管理员 CRUD |
| 影院 | `GET /cinemas`、`GET /cinemas/:id/halls` | 影院与影厅 |
| | `GET /halls/:id/seats` | 影厅座位布局 |
| | `POST/PUT/DELETE /cinemas`、`/halls` | 管理员 CRUD |
| 场次 | `GET /showtimes?movieId=&cinemaId=&date=` | 未来场次（含余座） |
| | `GET /showtimes/:id/seats` | 座位图（available / sold / locked / mine + 价格） |
| | `POST/PUT/DELETE /showtimes` | 管理员排片 |
| 购票 | `POST /seat-locks`、`DELETE /seat-locks/:showtimeId` | 锁座 / 释放锁座 |
| | `POST /orders`、`GET /orders`、`GET /orders/:id` | 下单 / 我的订单 / 订单详情 |
| | `POST /orders/:id/pay` | 支付模拟，返回电子票二维码 |
| | `POST /orders/:id/cancel`、`/refund`、`/reschedule` | 取消 / 退票 / 改签 |
| | `GET /orders/:id/ticket` | 电子票（二维码 + 取票码） |
| 影评 | `GET /comments?movieId=`、`POST /comments`、`DELETE /comments/:id` | 评分分布、发布/更新、删除 |
| 互动 | `GET/POST/DELETE /favorites` | 收藏列表 / 收藏 / 取消 |
| | `GET /banners`、`GET/POST/PUT/DELETE /admin/banners` | 轮播读取与后台维护 |
| 后台 | `GET /admin/stats` | 票房趋势、TOP 影片、影院占比、最新订单 |
| | `GET /admin/orders`、`POST /admin/orders/:id/refund` | 订单查询 / 全额退款 |
| | `GET /admin/users`、`GET /admin/comments`、`GET /admin/showtimes` | 用户 / 评论 / 场次列表 |

错误示例：`400 参数校验失败`、`401 未登录或登录已过期`、`403 无权限`、`404 资源不存在`、`409 座位已被占用`。

---

## 十、测试

```bash
# 需先启动服务
npm start

# 另开终端执行接口全链路测试（默认 http://localhost:3000）
npm run test:api

# 指定服务地址
BASE_URL=http://localhost:3100 npm run test:api
```

覆盖 33 项断言：健康检查、列表搜索、详情、登录鉴权、锁座、下单、支付、二维码、改签、退票、座位释放、评论、收藏、管理端权限与 CRUD、统计看板。

前端已实测链路：首页轮播与搜索 → 影片详情与场次 → 选座 → 支付 → 电子票（二维码/打印）→ 我的票夹 → 电子票查看 → 后台登录 → 数据看板 → 影片管理。

---

## 十一、部署上线

项目是「前端静态页 + Node 服务 + SQLite」，需要一台能运行 Node 的服务器；纯 GitHub Pages 只能托管静态页、无法提供接口。

### 方式 A：Docker（推荐）

```bash
docker build -t cinemax .
docker run -d -p 3000:3000 -v cinemax-data:/app/database --name cinemax cinemax
```

### 方式 B：Render / Railway

1. 将仓库连接到平台，选择 Node 环境；
2. Build：`npm install`，Start：`npm start`；
3. 配置环境变量 `JWT_SECRET`（必改）、`PORT`（平台自动注入）；
4. SQLite 数据文件位于 `database/`，需要挂载持久化磁盘（Persistent Disk / Volume），否则每次发布数据会重置。

### 方式 C：云服务器（阿里云 / 腾讯云）

```bash
sudo apt install -y nodejs npm
npm install --production
PORT=80 nohup npm start > app.log 2>&1 &
```

建议配合 Nginx 反向代理与 HTTPS 证书。

> 说明：课程提交要求中的「在线访问链接」需要真实服务器 / 平台账号才能产出，仓库内已提供 Dockerfile 与 Render 蓝图，按上述步骤即可在数分钟内上线。

---

## 十二、分支规范与提交约定

| 分支 | 用途 |
| --- | --- |
| `main` | 可运行、可部署的稳定版本 |
| `dev` | 集成分支 |
| `feature/<模块>` | 功能开发（如 `feature/seat-booking`） |
| `fix/<问题>` | 缺陷修复 |

提交信息采用约定式前缀：`feat:` 新功能、`fix:` 修复、`style:` 样式、`docs:` 文档、`test:` 测试、`refactor:` 重构。

示例：

```
feat: 座位图动态渲染与 15 分钟锁座
fix: 修正锁座过期时间的时区问题
docs: 补充接口文档与部署说明
```

---

## 十三、常见问题

| 问题 | 处理方式 |
| --- | --- |
| 启动报 `SQLite is an experimental feature` | Node 正常提示，可忽略；如需消除可加 `--no-warnings` |
| 端口被占用 | 修改 `.env` 中 `PORT`，或结束占用进程 |
| 想重置演示数据 | `npm run init-db`（会重建表并重新写入数据） |
| 登录后马上失效 | 检查系统时间是否正确（JWT 有效期 7 天） |
| 修改前端后仍是旧样式 | 静态资源带 `?v=` 版本参数，更新时同步修改版本号 |
| 支付是真实的吗 | 否，支付为课程演示模拟流程，不会产生真实扣款 |

---

## 十四、提交材料对照

| 提交清单 | 对应内容 |
| --- | --- |
| 代码仓库（README / SQL / .env.example） | 本 README、`database/schema.sql`、`.env.example`、`.gitignore` |
| 在线访问链接 | 按「十、部署上线」部署后填写 |
| PPT（PDF 版） | `docs/CineMax-答辩PPT.pdf`（可编辑源文件 `docs/CineMax-答辩PPT.pptx`） |
| 录屏（MP4，5–10 分钟） | 录制脚本见 `docs/录屏脚本.md` |
| 分工说明表 | `docs/分工说明.md` |
