# MD-Beautify · MVP v0.4

> AI Agent 内容展示与分享平台 — **MySQL 存储** · 前后端分离 · 用户系统 · 个人空间

## v0.4 核心变更

| 模块 | 改动 |
|------|------|
| **存储层** | 文件系统 → **MySQL 8.0**（users / contents / api_keys 三表） |
| **db 抽象** | `db/index.js` 暴露 Users/Contents/ApiKeys 三个模块，server.js 业务逻辑零改动 |
| **本地开发** | 无 MySQL 环境可设 `DB_DRIVER=sqlite` 走 SQLite 适配器（同接口） |
| **Docker** | `docker-compose.yml` 自动起 `mysql 8.0` 服务 + 自动建表 |
| **依赖** | 新增 `mysql2`, `dotenv`；新增 `better-sqlite3`（dev only） |

## 架构总览

```
md-beautify/
├── backend/                # Node.js + Express + MySQL
│   ├── server.js           # v0.4：MySQL 驱动
│   ├── db/
│   │   ├── index.js        # MySQL 抽象（Users/Contents/ApiKeys）
│   │   ├── schema.sql      # MySQL DDL
│   │   ├── init.js         # 一键建库建表
│   │   └── sqlite-adapter.js  # 本地开发 SQLite 替代（同接口）
│   ├── Dockerfile          # 启动时自动跑 init.js 建表
│   ├── package.json
│   └── test-api.sh
├── md-beautify-skill/      # AI Agent Skill
├── web/                    # React + Vite 前端
├── docker-compose.yml      # mysql + backend + web 三件套
├── .env.example
├── DOCKER.md
└── README.md
```

## 数据库 Schema

```sql
-- 3 张表 + 2 个外键
users (id PK, email UNIQUE, nickname, avatar, password_hash, created_at, updated_at)
contents (slug PK, user_id FK→users, title, excerpt, markdown, tags_json, view_count, source, status, created_at, updated_at)
api_keys (id, user_id FK→users, name, prefix, key_hash, last_used_at, created_at, PRIMARY KEY (user_id, id))
```

详见 `backend/db/schema.sql`。

## 快速开始

### 方式 1：Docker Compose（推荐 · 一键三件套）

```bash
# 1. 准备 .env
cp .env.example .env
# 编辑 JWT_SECRET 等

# 2. 一键启动 mysql + backend + web
docker compose up -d --build

# 3. 验证
curl http://localhost:3000/health         # 后端
curl http://localhost:8080/               # 前端
mysql -h 127.0.0.1 -P 3306 -u mdbeautify -pmdbeautify_pwd md_beautify -e "SHOW TABLES;"
```

> backend 容器启动时会**自动**跑 `node db/init.js` 建库建表，零手工操作。

### 方式 2：本地开发（无 MySQL 也能跑）

```bash
cd backend
npm install
cp .env.example ../.env

# 关键：用 SQLite 适配器启动
DB_DRIVER=sqlite JWT_SECRET=dev npm start
# → 自动在 backend/data-dev.sqlite 创建表
# → 监听 :3000
```

cd ../web && npm install && npm run dev  # 前端

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `DB_DRIVER` | `mysql` | `mysql` / `sqlite`（本地无 MySQL 时切换） |
| `DB_HOST` | `localhost` | MySQL 主机 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `root` | MySQL 用户名 |
| `DB_PASSWORD` | (空) | MySQL 密码 |
| `DB_NAME` | `md_beautify` | 数据库名 |
| `DB_CONNECTION_LIMIT` | `10` | 连接池大小 |
| `JWT_SECRET` | (必填) | JWT 签名密钥，**生产必改** |
| `PORT` | `3000` | 后端监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |

## API 端点（不变 · 与 v0.3 完全兼容）

### 公开
| Method | Path | 说明 |
|--------|------|------|
| GET    | `/health`                       | 健康检查 |
| POST   | `/api/auth/register`            | 注册 |
| POST   | `/api/auth/login`               | 登录 → JWT |
| GET    | `/api/contents?all=1`           | 公开内容 |
| GET    | `/api/contents/:slug`           | 内容详情 |

### 需认证 (Bearer Token 或 X-API-Key)
| Method | Path | 说明 |
|--------|------|------|
| GET    | `/api/auth/me`                  | 当前用户 |
| PATCH  | `/api/auth/me`                  | 更新资料 |
| POST   | `/api/auth/change-password`     | 改密码 |
| GET    | `/api/contents`                 | 自己的内容 |
| POST   | `/api/publish`                  | 发布 Markdown |
| DELETE | `/api/contents/:slug`           | 删除（仅本人） |
| GET    | `/api/keys`                     | 列出 API Key |
| POST   | `/api/keys`                     | 生成新 Key（明文只返一次） |
| DELETE | `/api/keys/:id`                 | 删除 Key |

## db 抽象层 API

业务代码不需要关心 MySQL / SQLite 区别：

```js
const db = require('./db');

// Users
await db.Users.create({ id, email, nickname, passwordHash });
await db.Users.findById(id);
await db.Users.findByEmail(email);
await db.Users.update(id, { nickname, avatar });
await db.Users.updatePassword(id, newHash);

// Contents
await db.Contents.create({ slug, userId, title, excerpt, markdown, tags, source });
await db.Contents.findBySlug(slug);
await db.Contents.list({ userId, publicOnly, since, limit, offset });
await db.Contents.count({ userId });
await db.Contents.incrementView(slug);
await db.Contents.delete(slug);

// API Keys
await db.ApiKeys.create({ id, userId, name, prefix, keyHash });
await db.ApiKeys.findById(userId, id);
await db.ApiKeys.findByPlainKey(plain);  // 慢路径（bcrypt 逐条比对）
await db.ApiKeys.listByUser(userId);
await db.ApiKeys.touchLastUsed(userId, id);
await db.ApiKeys.delete(userId, id);
```

## 端到端测试覆盖（v0.4 验证通过）

✅ 注册 → 登录 → JWT 校验
✅ API Key 生成 → 列表（脱敏）→ 删除 → 失效
✅ 用 API Key 发布 → 内容自动绑定 userId
✅ 已登录用户看自己内容；未登录看公开
✅ 删除内容时权限校验
✅ 改密码 → 旧密码失效
✅ 重复注册 409、错误密码 401
✅ 浏览数自动 +1

## 性能与扩展性

- **连接池**：`mysql2` 内置 pool，10 个连接并发
- **索引**：email / user_id / created_at / key_hash 前缀
- **JSON 列**：tags 用 MySQL 5.7+ 原生 JSON
- **API Key 查找**：当前为 O(N) bcrypt 逐条比对；大规模时建议加 prefix 唯一索引 + 短 hash

## 路线图

- [x] v0.1 MVP - 基础发布 / 渲染
- [x] v0.2 前后端分离
- [x] v0.3 用户系统 + 个人空间
- [x] v0.4 MySQL 存储层重构
- [ ] v0.5 知识库分组 / 标签筛选
- [ ] v0.6 微信小程序通知
- [ ] v0.7 团队空间 / 协作

---

基于 PRD v0.2 实现 · 2026-06-15 · v0.4 MySQL 存储版
