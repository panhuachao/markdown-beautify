/**
 * MD-Beautify Backend Server (MVP - 纯 API 模式)
 *
 * 前后端分离：后端只暴露 REST API，前端由 React + Vite (web/) 独立构建。
 *
 * 核心能力：
 *  1. 接收 AI Agent Skill 上传的 Markdown 内容
 *  2. 将原始 MD 存储到服务器目录
 *  3. 实时渲染为 HTML（在 API 响应中返回，由前端 React 渲染展示）
 *  4. 提供 REST API 供前端 SPA 调用
 *
 * 启动: node server.js  (默认端口 3000)
 * 前端: cd ../web && npm install && npm run dev  (默认端口 5173)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const cors = require('cors');
const { marked } = require('marked');
const hljs = require('highlight.js');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 7001;
const HOST = process.env.HOST || '0.0.0.0';

const DATA_DIR = path.join(__dirname, 'data');
const MD_DIR = path.join(DATA_DIR, 'markdown');
const META_DIR = path.join(DATA_DIR, 'meta');

// 确保目录存在
[DATA_DIR, MD_DIR, META_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// CORS - 允许前端开发服务器跨域访问
app.use(cors({
  origin: [
    'http://localhost:3000',  // Vite 默认
    'http://localhost:4173',  // Vite preview
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173'
  ],
  credentials: true
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 配置 marked：代码高亮 + GFM
marked.setOptions({
  gfm: true,
  breaks: true,
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (e) { /* fall through */ }
    }
    try {
      return hljs.highlightAuto(code).value;
    } catch (e) {
      return code;
    }
  }
});

// ---------------- 工具函数 ----------------

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return fallback || '未命名内容';
}

function extractExcerpt(markdown) {
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('```')) continue;
    if (trimmed.startsWith('!')) continue;
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) continue;
    const plain = trimmed.replace(/[*_`>\[\]]/g, '');
    if (plain.length > 10) {
      return plain.length > 120 ? plain.slice(0, 120) + '…' : plain;
    }
  }
  return '';
}

function generateSlug() {
  return nanoid(8);
}

function getMeta(slug) {
  const metaPath = path.join(META_DIR, `${slug}.json`);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function saveMeta(slug, meta) {
  const metaPath = path.join(META_DIR, `${slug}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

function listAllMeta() {
  if (!fs.existsSync(META_DIR)) return [];
  const files = fs.readdirSync(META_DIR).filter(f => f.endsWith('.json'));
  const items = [];
  for (const file of files) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(META_DIR, file), 'utf-8'));
      items.push(meta);
    } catch (e) { /* skip */ }
  }
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// ---------------- API 路由 ----------------

/**
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

/**
 * GET /api/contents  - 列出所有内容（按时间倒序）
 */
app.get('/api/contents', (req, res) => {
  const items = listAllMeta();
  const baseUrl = getBaseUrl(req);
  res.json({
    success: true,
    total: items.length,
    items: items.map(it => ({
      contentId: it.slug,
      slug: it.slug,
      title: it.title,
      excerpt: it.excerpt,
      tags: it.tags,
      viewCount: it.viewCount,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      url: `${baseUrl}/p/${it.slug}`
    }))
  });
});

/**
 * GET /api/contents/:slug  - 获取单个内容（包含原始 MD 和渲染后的 HTML）
 */
app.get('/api/contents/:slug', async (req, res) => {
  const { slug } = req.params;
  const meta = getMeta(slug);
  if (!meta) {
    return res.status(404).json({ success: false, error: '内容不存在' });
  }

  const mdPath = path.join(MD_DIR, `${slug}.md`);
  if (!fs.existsSync(mdPath)) {
    return res.status(404).json({ success: false, error: '内容文件不存在' });
  }

  const markdown = await fsp.readFile(mdPath, 'utf-8');
  const html = marked.parse(markdown);

  // 浏览数 +1
  meta.viewCount = (meta.viewCount || 0) + 1;
  saveMeta(slug, meta);

  res.json({
    success: true,
    data: {
      ...meta,
      markdown,
      html,
      url: `${getBaseUrl(req)}/p/${slug}`
    }
  });
});

/**
 * POST /api/publish  - AI Agent Skill 上传 Markdown
 *
 * Body: { content: string, title?: string, tags?: string[] }
 */
app.post('/api/publish', async (req, res) => {
  try {
    const { content, title, tags } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'content 不能为空'
      });
    }

    const slug = generateSlug();
    const finalTitle = title || extractTitle(content);
    const excerpt = extractExcerpt(content);
    const baseUrl = getBaseUrl(req);
    const now = new Date().toISOString();

    // 存储原始 MD
    const mdPath = path.join(MD_DIR, `${slug}.md`);
    await fsp.writeFile(mdPath, content, 'utf-8');

    // 写入元数据
    const meta = {
      slug,
      title: finalTitle,
      excerpt,
      tags: Array.isArray(tags) ? tags : [],
      createdAt: now,
      updatedAt: now,
      viewCount: 0,
      source: 'agent'
    };
    saveMeta(slug, meta);

    const url = `${baseUrl}/p/${slug}`;
    console.log(`[publish] slug=${slug} title="${finalTitle}" tags=${JSON.stringify(tags || [])}`);

    res.json({
      success: true,
      contentId: slug,
      slug,
      title: finalTitle,
      url,
      createdAt: now
    });
  } catch (err) {
    console.error('[publish] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/contents/:slug  - 删除内容（MVP 简易版）
 */
app.delete('/api/contents/:slug', async (req, res) => {
  const { slug } = req.params;
  const meta = getMeta(slug);
  if (!meta) {
    return res.status(404).json({ success: false, error: '内容不存在' });
  }

  const mdPath = path.join(MD_DIR, `${slug}.md`);
  const metaPath = path.join(META_DIR, `${slug}.json`);

  try {
    if (fs.existsSync(mdPath)) await fsp.unlink(mdPath);
    if (fs.existsSync(metaPath)) await fsp.unlink(metaPath);
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- 启动 ----------------

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 MD-Beautify API Server (前后端分离模式)`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${HOST}:${PORT}`);
  console.log(`\n📖 REST API:`);
  console.log(`   GET    /api/contents          列出内容`);
  console.log(`   GET    /api/contents/:slug    内容详情 (含渲染HTML)`);
  console.log(`   POST   /api/publish           发布 Markdown`);
  console.log(`   DELETE /api/contents/:slug    删除内容`);
  console.log(`   GET    /health                健康检查`);
  console.log(`\n🌐 前端请启动: cd ../web && npm run dev (Vite 默认 http://localhost:3000)\n`);
});
