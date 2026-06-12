# MD-Beautify · MVP v0.3

> AI Agent 内容展示与分享平台 — 前后端分离 + 用户系统 + 个人空间

## v0.3 新增能力

| 模块 | 功能 |
|------|------|
| 用户系统 | 邮箱注册 / 登录 / JWT 认证 / 密码加密 (bcrypt) |
| API 密钥 | 用户在 Web 端生成 N 个 API Key，AI Agent 用 `X-API-Key` 认证 |
| 个人空间 | "我的"页面按时间维度（今日/所有）浏览自己的内容 |
| 落地页 | 首页改为产品介绍落地页（Hero + 痛点 + 流程 + 特性 + 接入步骤 + CTA） |
| Web 上传 | 已登录用户在"我的"页直接写 Markdown 上传（弹层） |
| 资料管理 | 改昵称 / 改密码 / 密钥管理 / 登出 |

## 前端页面结构

| 路径 | 页面 | 用途 |
|------|------|------|
| `/`           | **HomePage**     | 产品介绍落地页（Hero / 痛点 / 解决方案 / 特性 / 接入步骤 / CTA） |
| `/my`         | **MyPage**       | 个人空间（顶部用户条 + 今日/所有 tab + 内容卡片 + 悬浮删除） |
| `/p/:slug`    | **ContentPage**  | 内容详情（Markdown 渲染 + 复制链接/原文 + 查看原始） |
| `/settings`   | **SettingsPage** | 个人资料 + 修改密码 + API 密钥管理 |
| `/login`      | **LoginPage**    | 登录页 |
| `/register`   | **RegisterPage** | 注册页 |
| `/about`      | **AboutPage**    | 项目说明（保留） |

## 架构总览

```
md-beautify/
├── backend/                # Node.js + Express REST API
│   ├── server.js           # v0.3：用户系统 + JWT + API Key
│   ├── package.json
│   ├── test-api.sh
│   ├── Dockerfile
│   └── data/
│       ├── markdown/       # 原始 .md
│       ├── meta/           # 内容元数据（含 userId）
│       ├── users/          # 用户数据
│       └── keys/           # API 密钥（仅存 hash）
├── md-beautify-skill/      # AI Agent Skill
│   ├── skill.json          # v0.3：含 apiKey 配置
│   ├── index.js            # v0.3：支持 X-API-Key 认证
│   └── test.js
├── web/                    # React + Vite 前端
│   ├── src/
│   │   ├── context/AuthContext.jsx
│   │   ├── api/client.js   # 自动注入 JWT
│   │   ├── pages/
│   │   │   ├── HomePage.jsx       # v0.3 改造：产品落地页
│   │   │   ├── MyPage.jsx         # v0.3 新增：个人空间
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── ContentPage.jsx
│   │   │   └── AboutPage.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx         # v0.3：导航 含"我的"
│   │   │   ├── ContentCard.jsx
│   │   │   └── UploadModal.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── prd.md
├── DOCKER.md
└── README.md
```

## 快速开始

```bash
# 1. 启动后端
cd backend && npm install && npm start
# → http://localhost:3000

# 2. 启动前端
cd web && npm install && npm run dev
# → http://localhost:5173

# 3. 体验完整流程
#   - 访问 http://localhost:5173 → 查看落地页
#   - 点击"免费注册" → 注册并自动登录
#   - 点击导航"我的" → 进入个人空间
#   - 点击"发布新内容" → 上传 Markdown
#   - 点击"设置" → 生成 API Key

# 4. 测试 Skill
cd md-beautify-skill
MD_BEAUTIFY_API_KEY=<你的密钥> node test.js
```

## API 端点（v0.3）

### 公开
| Method | Path | 说明 |
|--------|------|------|
| GET    | `/health`                       | 健康检查 |
| POST   | `/api/auth/register`            | 注册 |
| POST   | `/api/auth/login`               | 登录 → JWT |
| GET    | `/api/contents?all=1`           | 公开内容（无 userId 的历史数据）|
| GET    | `/api/contents/:slug`           | 内容详情 |

### 需认证 (Bearer Token 或 X-API-Key)
| Method | Path | 说明 |
|--------|------|------|
| GET    | `/api/auth/me`                  | 当前用户 |
| PATCH  | `/api/auth/me`                  | 更新资料 |
| POST   | `/api/auth/change-password`     | 改密码 |
| GET    | `/api/contents`                 | 自己的内容（"我的"页） |
| POST   | `/api/publish`                  | 发布 Markdown |
| DELETE | `/api/contents/:slug`           | 删除（仅本人） |
| GET    | `/api/keys`                     | 列出 API Key |
| POST   | `/api/keys`                     | 生成新 Key（明文只返一次） |
| DELETE | `/api/keys/:id`                 | 删除 Key |

## 关键设计

### 1. 落地页 vs 空间页分离
- **`/`** = 营销页（让访客理解产品） → 引导注册
- **`/my`** = 个人工作台（已登录用户用） → 看到自己的内容
- 公开内容（无 userId 的历史数据）通过 `?all=1` 仍可访问，但前端不在落地页展示

### 2. API Key 的双重身份
- 已登录 Web 用户看到的"自己的内容"= 该 userId 下的所有内容（含 Agent 用 Key 发布的）
- AI Agent 用 API Key 发布的内容 → 归属到 Key 对应的用户下
- 流程：用户生成 Key → 把 Key 填入 Agent → Agent 一键发布 → 用户在"我的"页看到

### 3. Mobile-First 单一策略
全站统一断点 `<768px / ≥768px`：
- 首页 Hero 移动端单列、PC 端大标题
- "我的"页 Tab 在移动端贴顶、PC 端更宽间距
- 所有按钮均有 `:active` 状态反馈（小红书风）

## 端到端测试覆盖

✅ 注册 → 登录 → JWT 校验
✅ API Key 生成 → 列表（脱敏）→ 删除 → 失效
✅ 用 API Key 发布 → 内容自动绑定 userId
✅ 已登录用户看自己内容；未登录看公开
✅ 删除内容时权限校验（403 防越权）
✅ 改密码 → 旧密码失效
✅ Skill 通过 `X-API-Key` 头认证发布

## 路线图

- [x] v0.1 MVP - 基础发布 / 渲染
- [x] v0.2 前后端分离
- [x] v0.3 用户系统 + 个人空间 + 产品落地页
- [ ] v0.4 知识库分组 / 标签筛选
- [ ] v0.5 微信小程序通知
- [ ] v0.6 团队空间 / 协作

---

基于 PRD v0.2 实现 · 2026-06-12 · v0.3 用户系统版
