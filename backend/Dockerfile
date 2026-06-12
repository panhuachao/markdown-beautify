# ===== 后端 Dockerfile =====
# Node.js + Express REST API 服务

FROM node:20-alpine

# 容器内工作目录
WORKDIR /app

# 先复制 package.json 单独装依赖（利用 Docker 缓存）
COPY package*.json ./

# 仅安装生产依赖
RUN npm install --omit=dev && npm cache clean --force

# 复制源码
COPY . .

# 创建数据目录（运行时挂载 volume 覆盖）
RUN mkdir -p /app/data/markdown /app/data/meta

# 环境变量
ENV NODE_ENV=production \
    PORT=7001 \
    HOST=0.0.0.0

# 暴露端口
EXPOSE 7001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7001/health || exit 1

# 启动命令
CMD ["node", "server.js"]
