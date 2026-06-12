# ===== 前端 Dockerfile (多阶段构建) =====
# Stage 1: 用 Node 构建 Vite 产物
# Stage 2: 用 nginx 托管静态文件 + 反向代理 /api

# ---------------- Stage 1: Build ----------------
FROM node:20-alpine AS builder

WORKDIR /app

# 单独复制 package.json 利用 Docker 缓存
COPY package*.json ./

# 安装依赖
RUN npm install && npm cache clean --force

# 复制源码并构建
COPY . .

# 构建参数：后端 API 地址（默认同源反代到 /api，由 nginx 处理）
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# ---------------- Stage 2: Nginx 托管 ----------------
FROM nginx:1.27-alpine AS runtime

# 删除默认配置
RUN rm -rf /etc/nginx/conf.d/default.conf

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从 builder 阶段复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx 容器自带健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

# nginx 前台运行
CMD ["nginx", "-g", "daemon off;"]
