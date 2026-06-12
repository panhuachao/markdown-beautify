# MD-Beautify · MVP

> AI Agent 内容展示与分享平台 — 前后端分离架构

## 架构总览

```
md-beautify/
├── backend/                # Node.js + Express 纯 REST API
│   ├── server.js           # API 入口（不含 HTML 模板渲染）
│   ├── package.json
│   └── data/               # 内容存储（运行时自动创建）
│       ├── markdown/       # 原始 .md 文件
│       └── meta/           # .json 元数据
├── md-beautify-skill/      # AI Agent Skill
│   ├── skill.json          # Skill 清单（OpenClaw/WorkBuddy 读取）
│   ├── index.js            # Skill 入口（执行 publish 动作）
│   └── test.js             # 端到端测试脚本
├── web/                    # React + Vite 前端 SPA
│   ├── src/
│   │   ├── pages/          # HomePage / ContentPage / AboutPage
│   │   ├── components/     # Layout / ContentCard
│   │   ├── api/            # API 客户端
│   │   ├── styles/         # 全局样式
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/             # 静态资源（favicon 等）
│   ├── index.html
│   ├── package.json
│   └── vite.config.js      # 含 /api 代理到后端
├── prd.md
└── README.md
```

## 一句话定位

> **AI Agent（如 OpenClaw / WorkBuddy）调用 Skill 上传 Markdown → 后端存储+渲染 HTML → 前端 React 拉取 API 展示 Mobile-First 页面**

## 快速开始

### 1. 启动后端 API

```bash
cd backend
npm install
npm start
```

服务监听 `http://localhost:3000`，仅提供 REST API。

### 2. 启动前端 Web

```bash
cd web
npm install
npm run dev
```

Vite 开发服务器 `http://localhost:5173`，通过 `vite.config.js` 的 `proxy` 自动把 `/api/*` 转发到后端 3000 端口，避免跨域。

### 3. 生产构建

```bash
cd web
npm run build      # 输出到 web/dist/
npm run preview    # 本地预览构建产物
```

### 4. 测试 Skill

```bash
cd md-beautify-skill
node test.js
```

会调用 Skill 的 `publish` 动作向 `http://localhost:3000/api/publish` 发送 Markdown，返回分享链接。

## API 端点

| Method | Path | 用途 |
|--------|------|------|
| GET    | `/api/contents`        | 列出所有内容（按时间倒序） |
| GET    | `/api/contents/:slug`  | 内容详情（原始 MD + 渲染后 HTML） |
| POST   | `/api/publish`         | 发布 Markdown（AI Agent Skill 调用） |
| DELETE | `/api/contents/:slug`  | 删除内容 |
| GET    | `/health`              | 健康检查 |

### `POST /api/publish` 请求示例

```bash
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# 标题\nMarkdown 内容...",
    "title": "可选标题",
    "tags": ["tag1", "tag2"]
  }'
```

返回：
```json
{
  "success": true,
  "contentId": "a1b2c3d4",
  "slug": "a1b2c3d4",
  "title": "标题",
  "url": "http://localhost:3000/p/a1b2c3d4",
  "createdAt": "2026-06-12T..."
}
```

## 前端路由

| Path | 组件 | 说明 |
|------|------|------|
| `/`         | `HomePage`    | 内容列表（卡片式） |
| `/p/:slug`  | `ContentPage` | 内容详情（Markdown 渲染） |
| `/about`    | `AboutPage`   | 项目说明 |

## MVP 已实现能力

| 能力 | 状态 | 说明 |
|------|------|------|
| 后端 REST API | ✅ | 4 个端点完整可用 |
| 前端 SPA | ✅ | React 18 + Vite 5 + React Router 6 |
| AI Agent Skill | ✅ | `publish` action |
| 文件系统存储 | ✅ | `data/markdown/` + `data/meta/` |
| Markdown 实时渲染 | ✅ | marked + highlight.js（10+ 语言） |
| Mobile-First 适配 | ✅ | 单断点策略 (<768px / ≥768px) |
| CORS | ✅ | 允许 Vite dev 跨域 |
| Vite API 代理 | ✅ | 开发态零配置 |
| 浏览统计 | ✅ | 详情接口内 +1 |
| 删除内容 | ✅ | DELETE API |
| 代码高亮 | ✅ | GitHub 风格主题 |
| 分享链接复制 | ✅ | Web 端一键复制 URL |
| 标签展示 | ✅ | 列表+详情均展示 |
| 全文搜索 | ⏳ 下一迭代 | |
| 知识库分组 | ⏳ 下一迭代 | |
| 定时任务 Webhook | ⏳ 下一迭代 | |
| 微信小程序通知 | ⏳ 下一迭代 | |
| 数据库 | ⏳ 下一迭代 | |

## 关键设计决策

### 1. 前后端完全分离
- **后端**: 只暴露 JSON API（含 `markdown` 原文 + `html` 渲染后的 HTML），不渲染页面模板
- **前端**: React SPA 通过 fetch 调用 `/api/...`，自主渲染所有页面
- **开发态**: Vite proxy `/api → http://localhost:3000` 解决跨域
- **生产态**: 后端提供静态托管（待配置）或前端用 Nginx 反代

### 2. 渲染在哪一侧？
**后端**渲染 Markdown → HTML（marked + highlight.js），原因：
- ✅ AI Agent 拿到 URL 即可访问，移动端优先样式即开即用
- ✅ 前端拿到的是纯 HTML 字符串，`dangerouslySetInnerHTML` 直接渲染
- ✅ SEO 友好（即使后端不渲染整页，HTML 片段也可被搜索引擎抓取）
- ⚠️ 服务端有少量 CPU 开销（MVP 量级可接受）

### 3. 实时渲染 vs 预渲染
每次访问详情 API 时**实时**调用 `marked.parse()`：
- ✅ 实现简单，无中间状态同步问题
- ✅ 永远展示最新内容（如果用户修改源 MD）
- ⚠️ 每次访问有少量 CPU 开销

### 4. 文件系统 vs 数据库
MVP 用文件系统，**符合 PRD 中"先不用数据库方式"的要求**：
- `data/markdown/{slug}.md` 存原始 Markdown
- `data/meta/{slug}.json` 存元数据（标题/标签/浏览数等）
- ✅ 零依赖，`git` 可直接备份
- 下一迭代再迁到 SQLite/PostgreSQL

### 5. Mobile-First 单断点策略
CSS 默认从移动端写起（<768px），@media 升级到 PC 端多栏宽版：
- 字体 ≥16px、行高 ≥1.6
- 图片 `max-width: 100%`
- 代码块 `overflow-x: auto` 支持横向滑动
- 表格 `display: block; overflow-x: auto` 移动端可滚动

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 18 |
| 构建工具 | Vite 5 |
| 路由 | React Router 6 |
| 样式 | 原生 CSS（Mobile-First） |
| 代码高亮 | highlight.js (GitHub 主题) |
| Markdown 解析 | marked |
| 后端框架 | Express 4 |
| 跨域 | cors |
| ID 生成 | nanoid |

## 在 AI Agent 中接入

### OpenClaw / WorkBuddy
将 `md-beautify-skill/` 目录复制到 Agent 框架的 skills 目录中。框架读取 `skill.json` 中的 `triggers` 字段识别命令（如 "发布到 MD-Beautify"），调用 `index.js` 的 `execute('publish', {...})` 方法。

### 通用 HTTP 调用
任何能发起 HTTP 请求的工具都可以直接调用：
```bash
curl -X POST $API_BASE/api/publish -H "Content-Type: application/json" -d @content.json
```

## 路线图（按 PRD 规划）

- **Phase 1.5**: 全文搜索、标签筛选、今日视图、知识库分组、定时任务 Webhook
- **Phase 2**: 版本历史、自定义主题、嵌套分组、知识库整体分享
- **Phase 3**: 团队空间、自定义域名、第二个 Agent 框架对接

---

基于 PRD v0.2 实现 · 2026-06-12 · v0.2 前后端分离重构
