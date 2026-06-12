# Web 前端 (React + Vite)

> MD-Beautify 的前端 SPA，通过 REST API 与后端通信。

## 技术栈

- **React 18** - UI 框架
- **Vite 5** - 构建工具 / 开发服务器
- **React Router 6** - 路由管理
- **原生 CSS** - Mobile-First 响应式样式

## 启动

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 3. 生产构建（输出到 dist/）
npm run build

# 4. 预览构建产物
npm run preview
```

## 关键配置

### `vite.config.js` - API 代理
开发态自动将 `/api/*` 代理到后端 `http://localhost:3000`，避免 CORS 问题。

```js
server: {
  port: 5173,
  proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true }
  }
}
```

### 生产部署
将 `npm run build` 生成的 `dist/` 部署到任意静态服务器（Nginx / CDN / Vercel / Netlify 等），并配置反向代理：
```
/api/*  →  后端服务地址
其他路径 →  dist/ 下的静态资源
```

## 目录结构

```
web/
├── src/
│   ├── pages/            # 页面组件
│   │   ├── HomePage.jsx     # 内容列表
│   │   ├── ContentPage.jsx  # 内容详情
│   │   └── AboutPage.jsx    # 关于
│   ├── components/       # 通用组件
│   │   ├── Layout.jsx       # 顶部导航 + Footer
│   │   └── ContentCard.jsx  # 内容卡片
│   ├── api/
│   │   └── client.js        # API 客户端封装
│   ├── styles/
│   │   └── global.css       # 全局样式
│   ├── App.jsx              # 路由配置
│   └── main.jsx             # React 入口
├── public/               # 静态资源
│   └── favicon.svg
├── index.html
├── package.json
└── vite.config.js
```

## 页面说明

### HomePage (`/`)
- Hero 区域（紫色渐变 + 标题）
- 内容卡片列表（标题/时间/浏览数/标签/摘要）
- Loading / Error / Empty 三态
- Mobile-First：单列卡片 → PC 多栏宽版

### ContentPage (`/p/:slug`)
- 内容标题、元信息（时间/浏览数/标签）
- 操作区：复制分享链接 / 返回首页
- Markdown 渲染区域（高亮代码 / 表格 / 引用等）
- Mobile-First：单列 → PC 多栏

### AboutPage (`/about`)
- 项目介绍 / 工作流程 / 技术栈 / API 端点

## API 客户端

`src/api/client.js` 封装了所有后端调用：

```js
import { api } from '@/api/client';

const { items } = await api.listContents();
const { data } = await api.getContent('slug-xxx');
const result = await api.publish({ content, title, tags });
```

基础路径通过 `import.meta.env.VITE_API_BASE` 配置（默认 `/api`，开发态由 Vite 代理处理）。

## 样式规范

- 全局样式在 `src/styles/global.css`
- 各组件/页面自带 `<Name>.css`，就近维护
- **Mobile-First**：CSS 默认写移动端，`@media (min-width: 768px)` 升级 PC
- 单位：优先 `rem` / `%` / `em`；`px` 仅用于边框/小尺寸
