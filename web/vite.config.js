import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// MD-Beautify 前端 Vite 配置
//
// 端口策略：
//  - 前端 dev server: 5173
//  - 后端 API:        3000
//  - Docker 部署时前端构建产物由 nginx 托管，反代 /api → backend:3000
//
// 如需调整后端端口，请同步修改 proxy.target 和 backend/.env

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false, // 端口被占用时自动选择下一个可用端口（避免静默失败）
    open: false,
    proxy: {
      // 开发态代理后端 API，避免浏览器跨域
      '/api': {
        target: 'http://localhost:7001',
        changeOrigin: true
      },
      // 健康检查透传
      '/health': {
        target: 'http://localhost:7001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
