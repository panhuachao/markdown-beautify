# MD-Beautify · Docker 部署指南

## 架构

```
┌─────────────────────────────────────────────────────────┐
│   宿主机                                                  │
│   ┌─────────────┐       ┌───────────────────────┐       │
│   │ 浏览器/Agent│ ───>  │  nginx (web 容器 :80) │       │
│   └─────────────┘       │  - 托管 React SPA     │       │
│        :8080            │  - /api/* 反代        │       │
│                         └───────────┬───────────┘       │
│                                     │                   │
│                                     ▼                   │
│                         ┌───────────────────────┐       │
│                         │ backend 容器 :3000    │       │
│                         │ - Node.js + Express   │       │
│                         │ - REST API            │       │
│                         └───────────┬───────────┘       │
│                                     │                   │
│                                     ▼                   │
│                         ┌───────────────────────┐       │
│                         │ Docker Volume         │       │
│                         │ backend-data          │       │
│                         │ - /app/data/markdown/  │       │
│                         │ - /app/data/meta/     │       │
│                         └───────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

## 快速部署

### 前置要求

- Docker 20.10+
- Docker Compose v2 (内置于 Docker Desktop)

### 1. 启动

```bash
# 在项目根目录
docker compose up -d --build
```

首次启动会：
1. 构建后端镜像（基于 node:20-alpine，约 200MB）
2. 构建前端镜像（多阶段：node build → nginx:alpine，最终约 50MB）
3. 创建 `md-beautify-net` 网络
4. 创建 `md-beautify-backend-data` 数据卷
5. 启动两个容器，挂在同一网桥

### 2. 验证

```bash
# 查看容器状态
docker compose ps

# 实时日志
docker compose logs -f

# 健康检查
curl http://localhost:8080/                    # 前端首页
curl http://localhost:8080/health              # 通过 nginx 代理到后端
curl http://localhost:3000/health              # 直接访问后端
```

### 3. 访问

- **Web 前端**: http://localhost:8080
- **后端 API**: http://localhost:3000/api/*
- **API 文档**: http://localhost:3000 不可直接访问（纯 API，无首页），
  通过前端或 curl 调用 `/api/contents` 等

## 端口规划

| 服务 | 容器端口 | 宿主机端口 | 说明 |
|------|----------|------------|------|
| web (nginx) | 80 | 8080 | 用户访问入口 |
| backend | 3000 | 3000 | REST API（可仅内网访问） |

**生产建议**：在云服务器/防火墙层面**只暴露 8080**，3000 端口仅容器间通过 `md-beautify-net` 通信。

## 常用命令

```bash
# 启动
docker compose up -d --build

# 停止（保留数据卷）
docker compose down

# 停止并删除所有数据
docker compose down -v

# 查看日志
docker compose logs -f backend
docker compose logs -f web

# 进入容器调试
docker compose exec backend sh
docker compose exec web sh

# 重新构建单个服务
docker compose build backend
docker compose up -d backend

# 查看资源占用
docker stats
```

## 数据持久化

后端容器通过命名卷 `md-beautify-backend-data` 持久化用户内容：

```yaml
volumes:
  backend-data:/app/data
```

容器内 `/app/data/` 包含：
- `markdown/{slug}.md` - 原始 Markdown 文件
- `meta/{slug}.json` - 元数据（标题/标签/浏览数/时间）

数据卷在 `docker compose down` 后**仍保留**，在 `down -v` 后**被删除**。

### 备份

```bash
# 导出数据卷为 tar
docker run --rm \
  -v md-beautify-backend-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/md-beautify-backup-$(date +%Y%m%d).tar.gz /data

# 恢复
docker run --rm \
  -v md-beautify-backend-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/md-beautify-backup-20260612.tar.gz -C /
```

## 生产环境配置

### 启用 HTTPS

在 `web` 服务前加一个反代容器（如 `nginx-proxy` + `acme-companion`），自动签发 Let's Encrypt 证书。

或手动：在 `web/nginx.conf` 中加 `listen 443 ssl;` + 证书路径。

### 限制资源

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
  web:
    deploy:
      resources:
        limits:
          cpus: '0.2'
          memory: 128M
```

### 日志持久化

默认日志写入到 docker json driver，定期清理：

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 镜像大小优化

| 镜像 | 大小（估计） | 优化手段 |
|------|--------------|----------|
| `md-beautify-backend` | ~180MB | node:20-alpine + npm ci --omit=dev |
| `md-beautify-web` | ~50MB | 多阶段构建 + nginx:alpine |

## 与 docker-compose 配合的开发流程

```bash
# 1. 修改代码后重新构建并重启
docker compose up -d --build

# 2. 仅代码变更（无需重装依赖）
docker compose restart backend

# 3. 清理未使用的镜像
docker image prune -f
```

## 排错

### 容器启动失败
```bash
docker compose logs backend
docker compose logs web
```

### 跨域问题
容器间通信通过 `md-beautify-net`，nginx 已配好 `/api/` 反代。**不要**直接用 `localhost:3000` 访问后端（生产中会暴露端口）。

### 数据丢失
- 检查数据卷是否存在：`docker volume ls | grep md-beautify`
- 检查容器内挂载：`docker compose exec backend ls -la /app/data/`
