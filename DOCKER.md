# MD-Beautify · Docker 部署指南 (v0.4)

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
│                         │ - 自动建表            │       │
│                         └───────────┬───────────┘       │
│                                     │ mysql2            │
│                                     ▼                   │
│                         ┌───────────────────────┐       │
│                         │ mysql 容器 :3306      │       │
│                         │ - MySQL 8.0           │       │
│                         │ - utf8mb4             │       │
│                         └───────────┬───────────┘       │
│                                     │                   │
│                                     ▼                   │
│                         ┌───────────────────────┐       │
│                         │ Docker Volume         │       │
│                         │ mysql-data            │       │
│                         └───────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

## 快速部署

```bash
# 1. 准备环境变量
cp .env.example .env
# 修改 JWT_SECRET 为强随机字符串

# 2. 一键启动 mysql + backend + web
docker compose up -d --build

# 3. 验证
docker compose ps
curl http://localhost:8080/      # 前端首页
curl http://localhost:3000/health # 后端健康
docker compose exec mysql mysql -uroot -prootpwd -e "USE md_beautify; SHOW TABLES;"
```

## 端口规划

| 服务 | 容器端口 | 宿主机端口 | 说明 |
|------|----------|------------|------|
| web (nginx) | 80 | 8080 | 用户访问入口 |
| backend | 3000 | 3000 | REST API（生产建议仅内网） |
| mysql | 3306 | 3306 | 数据库（生产建议仅内网） |

## 自动建表

backend 容器 `CMD` 改为：
```dockerfile
CMD ["sh", "-c", "node db/init.js && node server.js"]
```

- `db/init.js` 读取 `backend/db/schema.sql`
- 自动 `CREATE DATABASE IF NOT EXISTS md_beautify`
- 自动 `CREATE TABLE IF NOT EXISTS ...`（三张表）
- 通过 `docker-compose depends_on: condition: service_healthy` 等 MySQL 完全就绪后再跑

## 数据持久化

```yaml
volumes:
  mysql-data:
    name: md-beautify-mysql-data
    driver: local
```

### 备份

```bash
# 导出整个数据库为 SQL
docker compose exec mysql sh -c 'mysqldump -uroot -prootpwd md_beautify' > backup-$(date +%Y%m%d).sql

# 恢复
cat backup-20260615.sql | docker compose exec -T mysql mysql -uroot -prootpwd md_beautify
```

## 进入容器调试

```bash
# 进入 backend
docker compose exec backend sh

# 进入 mysql 客户端
docker compose exec mysql mysql -uroot -prootpwd md_beautify

# 看 backend 日志
docker compose logs -f backend
```

## 本地无 Docker / 无 MySQL 开发

如果本地没有 Docker，可以用 SQLite 适配器：

```bash
cd backend
DB_DRIVER=sqlite JWT_SECRET=dev npm start
# → backend/data-dev.sqlite 自动建表
```

前端同样：
```bash
cd web
npm run dev
# → http://localhost:5173
```

## 资源限制建议

```yaml
services:
  mysql:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
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

## 排错

### mysql 容器启动失败
```bash
docker compose logs mysql
# 常见：端口冲突 → 修改宿主机映射端口
# 常见：卷权限 → sudo chown -R 999:999 ./mysql-data
```

### backend 报"数据库连接失败"
- 检查 mysql 健康：`docker compose ps`（mysql 应该是 healthy）
- 检查环境变量：backend 容器内 `env | grep DB_`
- 手动进入 backend 容器重试：`docker compose exec backend node db/init.js`
