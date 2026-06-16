/**
 * MD-Beautify Backend Server (v0.4 · MySQL 存储)
 *
 * 变更:
 *  - 存储层由文件系统 (data/users|keys|markdown) 切到 MySQL
 *  - 启动前需执行 `node db/init.js` 创建表
 *  - 业务接口签名保持完全兼容（前端 / Skill 不用改）
 *
 * 启动: node server.js (默认端口 3000)
 */

// 优先加载 backend/.env（本地开发），其次回退到项目根 .env（docker compose 挂载）
const dotenv = require('dotenv');
const _envCandidates = [
  require('path').join(__dirname, '.env'),
  require('path').join(__dirname, '..', '.env')
];
const _envLoaded = _envCandidates.find((p) => require('fs').existsSync(p));
if (_envLoaded) dotenv.config({ path: _envLoaded });

const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { marked } = require('marked');
const hljs = require('highlight.js');
const { nanoid } = require('nanoid');

// 存储驱动：默认 mysql，可通过 DB_DRIVER=sqlite 切换（本地无 MySQL 时）
const DB_DRIVER = process.env.DB_DRIVER || 'mysql';
const db = DB_DRIVER === 'sqlite' ? require('./db/sqlite-adapter') : require('./db');

const app = express();
const PORT = process.env.PORT || 7001;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'md-beautify-dev-secret-change-in-prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// ---------- 中间件 ----------
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173'
    ],
    credentials: true
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ---------- marked 配置 ----------
marked.setOptions({
  gfm: true,
  breaks: true,
  highlight(code, lang) {
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

// ---------- 工具函数 ----------

function extractTitle(markdown, fallback) {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback || '未命名内容';
}
function extractExcerpt(markdown) {
  for (const line of markdown.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (/^[#`!>\-*+\d]/.test(t)) continue;
    const plain = t.replace(/[*_`>\[\]]/g, '');
    if (plain.length > 10) return plain.length > 120 ? plain.slice(0, 120) + '…' : plain;
  }
  return '';
}
function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- 认证中间件 ----------
async function authMiddleware(req, res, next) {
  req.user = null;

  // 1) JWT
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const u = await db.Users.findById(payload.sub);
      if (u) req.user = u;
    } catch (e) {
      // token 无效，继续尝试 API Key
    }
  }

  // 2) API Key
  if (!req.user) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      const keyRecord = await db.ApiKeys.findByPlainKey(apiKey);
      if (keyRecord) {
        const u = await db.Users.findById(keyRecord.userId);
        if (u) {
          req.user = u;
          // 异步 touchLastUsed 不阻塞
          db.ApiKeys.touchLastUsed(u.id, keyRecord.id).catch(() => {});
        }
      }
    }
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, error: '未登录或认证失败' });
  next();
}

// ============================================================
//                       基础路由
// ============================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', authMiddleware);


// ============================================================
//                      认证 API
// ============================================================

/**
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (req, res) => {
  const { email, password, nickname } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: '邮箱格式不正确' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ success: false, error: '密码至少 6 位' });
  }

  const exists = await db.Users.findByEmail(email.toLowerCase().trim());
  if (exists) {
    return res.status(409).json({ success: false, error: '该邮箱已注册' });
  }

  const user = await db.Users.create({
    id: nanoid(10),
    email: email.toLowerCase().trim(),
    nickname: (nickname && String(nickname).trim()) || email.split('@')[0],
    avatar: '',
    passwordHash: bcrypt.hashSync(password, 10)
  });

  const token = signToken(user);
  res.json({ success: true, token, user: publicUser(user) });
});

/**
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: '邮箱和密码必填' });
  }
  const user = await db.Users.findByEmail(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ success: false, error: '邮箱或密码错误' });
  }
  const token = signToken(user);
  res.json({ success: true, token, user: publicUser(user) });
});

/**
 * GET /api/auth/me
 */
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

/**
 * PATCH /api/auth/me
 */
app.patch('/api/auth/me', requireAuth, async (req, res) => {
  const { nickname, avatar } = req.body || {};
  const patch = {};
  if (typeof nickname === 'string' && nickname.trim()) {
    patch.nickname = nickname.trim().slice(0, 32);
  }
  if (typeof avatar === 'string') {
    patch.avatar = avatar.slice(0, 500);
  }
  const updated = await db.Users.update(req.user.id, patch);
  res.json({ success: true, user: publicUser(updated) });
});

/**
 * POST /api/auth/change-password
 */
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, error: '旧密码和新密码必填' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ success: false, error: '新密码至少 6 位' });
  }
  if (!bcrypt.compareSync(oldPassword, req.user.passwordHash)) {
    return res.status(401).json({ success: false, error: '旧密码错误' });
  }
  await db.Users.updatePassword(req.user.id, bcrypt.hashSync(newPassword, 10));
  res.json({ success: true, message: '密码已更新' });
});

// ============================================================
//                     API 密钥管理
// ============================================================

app.get('/api/keys', requireAuth, async (req, res) => {
  const keys = await db.ApiKeys.listByUser(req.user.id);
  res.json({
    success: true,
    total: keys.length,
    items: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }))
  });
});

app.post('/api/keys', requireAuth, async (req, res) => {
  const name = (req.body && req.body.name && String(req.body.name).trim()) || 'Unnamed Key';
  const plain = 'md_' + nanoid(32);
  const id = nanoid(8);
  const keyRecord = await db.ApiKeys.create({
    id,
    userId: req.user.id,
    name: name.slice(0, 50),
    prefix: plain.slice(0, 8) + '…',
    keyHash: bcrypt.hashSync(plain, 10)
  });
  res.json({
    success: true,
    key: {
      id: keyRecord.id,
      name: keyRecord.name,
      key: plain, // 仅此一次
      prefix: keyRecord.prefix,
      createdAt: keyRecord.createdAt
    }
  });
});

app.delete('/api/keys/:id', requireAuth, async (req, res) => {
  await db.ApiKeys.delete(req.user.id, req.params.id);
  res.json({ success: true, message: '已删除' });
});

// ============================================================
//                      内容 API
// ============================================================

/**
 * GET /api/contents
 *   - 已登录：默认仅看自己的内容，?all=1 看公开
 *   - 未登录：?all=1 看公开
 */
app.get('/api/contents', async (req, res) => {
  const all = req.query.all === '1';
  let items;
  if (req.user && !all) {
    items = await db.Contents.list({ userId: req.user.id });
  } else {
    items = await db.Contents.list({ publicOnly: true });
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    success: true,
    total: items.length,
    items: items.map((it) => ({
      contentId: it.slug,
      slug: it.slug,
      title: it.title,
      excerpt: it.excerpt,
      tags: it.tags,
      viewCount: it.viewCount,
      createdAt: it.createdAt,
      url: `${baseUrl}/p/${it.slug}`
    }))
  });
});

/**
 * GET /api/contents/:slug
 */
app.get('/api/contents/:slug', async (req, res) => {
  const meta = await db.Contents.findBySlug(req.params.slug);
  if (!meta) return res.status(404).json({ success: false, error: '内容不存在' });

  await db.Contents.incrementView(meta.slug);
  const html = marked.parse(meta.markdown);
  // viewCount 已经 +1，但 findBySlug 返回的是旧值
  meta.viewCount += 1;

  res.json({
    success: true,
    data: {
      ...meta,
      html,
      url: `${req.protocol}://${req.get('host')}/p/${meta.slug}`
    }
  });
});

/**
 * POST /api/publish
 */
app.post('/api/publish', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未登录或缺少 API Key' });
    }
    const { content, title, tags } = req.body || {};
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content 不能为空' });
    }

    const slug = nanoid(8);
    const finalTitle = title || extractTitle(content);
    const excerpt = extractExcerpt(content);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const now = new Date().toISOString();

    const meta = await db.Contents.create({
      slug,
      userId: req.user.id,
      title: finalTitle,
      excerpt,
      markdown: content,
      tags: Array.isArray(tags) ? tags : [],
      source: 'agent'
    });

    const url = `${baseUrl}/p/${slug}`;
    console.log(
      `[publish] user=${req.user.email} slug=${slug} title="${finalTitle}" tags=${JSON.stringify(tags || [])}`
    );
    res.json({ success: true, contentId: slug, slug, title: finalTitle, url, createdAt: meta.createdAt });
  } catch (err) {
    console.error('[publish] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/contents/:slug
 */
app.delete('/api/contents/:slug', requireAuth, async (req, res) => {
  const meta = await db.Contents.findBySlug(req.params.slug);
  if (!meta) return res.status(404).json({ success: false, error: '内容不存在' });
  if (meta.userId && meta.userId !== req.user.id) {
    return res.status(403).json({ success: false, error: '无权删除他人内容' });
  }
  await db.Contents.delete(req.params.slug);
  res.json({ success: true, message: '已删除' });
});

// ============================================================
//                       启动
// ============================================================

async function start() {
  try {
    // 启动时检查数据库连通性
    if (DB_DRIVER === 'mysql') {
      const pool = db.getPool();
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      console.log(`[startup] ✅ MySQL 已连接 (${process.env.DB_HOST}:${process.env.DB_PORT})`);
    } else {
      // sqlite 适配器在第一次查询时建表
      db.getDb();
      console.log(`[startup] ✅ SQLite dev DB 已就绪（仅供本地开发/测试）`);
    }
  } catch (err) {
    console.error('[startup] ❌ 数据库连接失败:', err.message);
    if (DB_DRIVER === 'mysql') {
      console.error('[startup] 请先执行: node db/init.js');
    }
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n🚀 MD-Beautify API Server v0.4 (driver: ${DB_DRIVER})`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${HOST}:${PORT}`);
    console.log(`\n📖 公开 API:`);
    console.log(`   POST   /api/auth/register        注册`);
    console.log(`   POST   /api/auth/login           登录`);
    console.log(`   GET    /api/contents             列出内容`);
    console.log(`   GET    /api/contents/:slug       内容详情`);
    console.log(`   POST   /api/publish              发布（需认证）`);
    console.log(`   GET    /health                   健康检查`);
    console.log(`\n🔐 需登录 API (Bearer Token):`);
    console.log(`   GET    /api/auth/me              当前用户`);
    console.log(`   PATCH  /api/auth/me              更新资料`);
    console.log(`   POST   /api/auth/change-password 修改密码`);
    console.log(`   GET    /api/keys                 我的 API 密钥`);
    console.log(`   POST   /api/keys                 生成 API 密钥`);
    console.log(`   DELETE /api/keys/:id             删除 API 密钥`);
    console.log(`   DELETE /api/contents/:slug       删除我的内容`);
    console.log(`\n🔑 API Key 认证 (X-API-Key header):`);
    console.log(`   POST   /api/publish              AI Agent Skill 调用\n`);
  });
}

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n[shutdown] closing pool...');
  if (DB_DRIVER === 'mysql') {
    await db.closePool();
  } else {
    db.closeDb();
  }
  process.exit(0);
});
process.on('SIGTERM', async () => {
  if (DB_DRIVER === 'mysql') {
    await db.closePool();
  } else {
    db.closeDb();
  }
  process.exit(0);
});

start();
