# ===== 后端 Dockerfile =====
# Node.js + Express REST API + MySQL 驱动
# 启动时自动跑 db/init.js 建表，再启动服务

FROM node:20-alpine

# 容器内工作目录
WORKDIR /app

# 先复制 package.json 单独装依赖（利用 Docker 缓存）
COPY package*.json ./

# 安装生产依赖
RUN npm install --omit=dev && npm cache clean --force

# 复制源码（含 db/schema.sql、db/init.js、server.js）
COPY . .

# 环境变量默认值（生产用 docker-compose 覆盖）
ENV NODE_ENV=production \
    PORT=7001 \
    HOST=0.0.0.0

EXPOSE 7001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7001/health || exit 1

# 启动入口：先建表，再启服务
CMD ["sh", "-c", "node db/init.js && node server.js"]
