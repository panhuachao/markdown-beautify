/**
 * MD-Beautify Backend Server (v0.3 · 用户系统版)
 *
 * 能力矩阵：
 *  公开 API:
 *    GET    /health
 *    POST   /api/auth/register      注册（邮箱+密码）
 *    POST   /api/auth/login         登录（返回 JWT）
 *    GET    /api/contents           列出当前用户内容（可选 ?all=1 看公开）
 *    GET    /api/contents/:slug     内容详情（含 HTML 渲染）
 *    POST   /api/publish            发布 Markdown（JWT 或 API Key 认证）
 *    DELETE /api/contents/:slug     删除自己的内容
 *    GET    /p/:slug                公开分享落地页（无需登录）
 *
 *  需登录 API (Bearer Token):
 *    GET    /api/auth/me            当前用户信息
 *    POST   /api/auth/change-password  修改密码
 *    GET    /api/keys               列出我的 API 密钥（不含明文）
 *    POST   /api/keys               生成新的 API 密钥（明文只返回一次）
 *    DELETE /api/keys/:id           删除密钥
 *    PATCH  /api/auth/me            更新昵称/头像
 *
 *  API Key 认证 (X-API-Key header):
 *    POST   /api/publish            AI Agent Skill 调用
 *
 * 启动: node server.js (默认端口 3000)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { marked } = require('marked');
const hljs = require('highlight.js');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 7001;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'md-beautify-dev-secret-change-in-prod';
const JWT_EXPIRES_IN = '30d';

const DATA_DIR = path.join(__dirname, 'data');
const MD_DIR = path.join(DATA_DIR, 'markdown');
const META_DIR = path.join(DATA_DIR, 'meta');
const USERS_DIR = path.join(DATA_DIR, 'users');
const KEYS_DIR = path.join(DATA_DIR, 'keys');

[DATA_DIR, MD_DIR, META_DIR, USERS_DIR, KEYS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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

// ---------- 数据访问层 ----------

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function getUser(userId) {
  return readJSON(path.join(USERS_DIR, `${userId}.json`));
}

function saveUser(user) {
  writeJSON(path.join(USERS_DIR, `${user.id}.json`), user);
}

function findUserByEmail(email) {
  if (!fs.existsSync(USERS_DIR)) return null;
  const norm = String(email).toLowerCase().trim();
  for (const file of fs.readdirSync(USERS_DIR)) {
    const u = readJSON(path.join(USERS_DIR, file));
    if (u && u.email === norm) return u;
  }
  return null;
}

function findUserByApiKey(apiKey) {
  if (!fs.existsSync(KEYS_DIR)) return null;
  // keys 以 userId-keyId.json 命名
  for (const file of fs.readdirSync(KEYS_DIR)) {
    const k = readJSON(path.join(KEYS_DIR, file));
    if (k && k.keyHash && bcrypt.compareSync(apiKey, k.keyHash)) {
      return { key: k, user: getUser(k.userId) };
    }
  }
  return null;
}

function getMeta(slug) {
  return readJSON(path.join(META_DIR, `${slug}.json`));
}
function saveMeta(slug, meta) {
  writeJSON(path.join(META_DIR, `${slug}.json`), meta);
}
function listAllMeta() {
  if (!fs.existsSync(META_DIR)) return [];
  return fs
    .readdirSync(META_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJSON(path.join(META_DIR, f)))
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function listUserMeta(userId) {
  return listAllMeta().filter((m) => m.userId === userId);
}
function listUserKeys(userId) {
  if (!fs.existsSync(KEYS_DIR)) return [];
  return fs
    .readdirSync(KEYS_DIR)
    .filter((f) => f.startsWith(`${userId}-`) && f.endsWith('.json'))
    .map((f) => readJSON(path.join(KEYS_DIR, f)))
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function deleteUserKey(userId, keyId) {
  const p = path.join(KEYS_DIR, `${userId}-${keyId}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

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

// ---------- 认证中间件 ----------
// 优先尝试 JWT (Authorization: Bearer ...)，再尝试 API Key (X-API-Key: ...)
// 任一成功即通过，req.user 会被填充

function authMiddleware(req, res, next) {
  req.user = null;

  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const u = getUser(payload.sub);
      if (u) req.user = u;
    } catch (e) {
      // token 无效，继续尝试 API Key
    }
  }

  if (!req.user) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      const found = findUserByApiKey(apiKey);
      if (found) req.user = found.user;
    }
  }

  next();
}

// 要求登录（401）
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, error: '未登录或认证失败' });
  next();
}

// 邮箱格式校验
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
//                       API 路由
// ============================================================

// ---------- 健康 ----------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// 应用认证中间件到 /api/*
app.use('/api', authMiddleware);

// ============================================================
//                      认证 API
// ============================================================

/**
 * POST /api/auth/register
 * body: { email, password, nickname? }
 */
app.post('/api/auth/register', async (req, res) => {
  const { email, password, nickname } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: '邮箱格式不正确' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ success: false, error: '密码至少 6 位' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ success: false, error: '该邮箱已注册' });
  }

  const id = nanoid(10);
  const user = {
    id,
    email: email.toLowerCase().trim(),
    nickname: (nickname && String(nickname).trim()) || email.split('@')[0],
    avatar: '',
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString()
  };
  saveUser(user);

  const token = signToken(user);
  res.json({ success: true, token, user: publicUser(user) });
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: '邮箱和密码必填' });
  }
  const user = findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ success: false, error: '邮箱或密码错误' });
  }
  const token = signToken(user);
  res.json({ success: true, token, user: publicUser(user) });
});

/**
 * GET /api/auth/me  (需登录)
 */
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

/**
 * PATCH /api/auth/me  (需登录)
 * body: { nickname?, avatar? }
 */
app.patch('/api/auth/me', requireAuth, (req, res) => {
  const { nickname, avatar } = req.body || {};
  if (typeof nickname === 'string' && nickname.trim()) {
    req.user.nickname = nickname.trim().slice(0, 32);
  }
  if (typeof avatar === 'string') {
    req.user.avatar = avatar.slice(0, 500);
  }
  req.user.updatedAt = new Date().toISOString();
  saveUser(req.user);
  res.json({ success: true, user: publicUser(req.user) });
});

/**
 * POST /api/auth/change-password  (需登录)
 * body: { oldPassword, newPassword }
 */
app.post('/api/auth/change-password', requireAuth, (req, res) => {
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
  req.user.passwordHash = bcrypt.hashSync(newPassword, 10);
  req.user.updatedAt = new Date().toISOString();
  saveUser(req.user);
  res.json({ success: true, message: '密码已更新' });
});

// ============================================================
//                     API 密钥管理
// ============================================================

/**
 * GET /api/keys  (需登录)
 * 返回当前用户的所有 API 密钥（不含明文）
 */
app.get('/api/keys', requireAuth, (req, res) => {
  const keys = listUserKeys(req.user.id).map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix, // 脱敏前缀
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt
  }));
  res.json({ success: true, total: keys.length, items: keys });
});

/**
 * POST /api/keys  (需登录)
 * body: { name }
 * 返回明文 API Key（仅此一次！）
 */
app.post('/api/keys', requireAuth, (req, res) => {
  const name = (req.body && req.body.name && String(req.body.name).trim()) || 'Unnamed Key';
  const plain = 'md_' + nanoid(32);
  const id = nanoid(8);
  const keyRecord = {
    id,
    userId: req.user.id,
    name: name.slice(0, 50),
    prefix: plain.slice(0, 8) + '…', // 脱敏
    keyHash: bcrypt.hashSync(plain, 10),
    createdAt: new Date().toISOString(),
    lastUsedAt: null
  };
  writeJSON(path.join(KEYS_DIR, `${req.user.id}-${id}.json`), keyRecord);
  res.json({
    success: true,
    key: {
      id,
      name: keyRecord.name,
      key: plain, // 仅此一次返回明文
      prefix: keyRecord.prefix,
      createdAt: keyRecord.createdAt
    }
  });
});

/**
 * DELETE /api/keys/:id  (需登录)
 */
app.delete('/api/keys/:id', requireAuth, (req, res) => {
  deleteUserKey(req.user.id, req.params.id);
  res.json({ success: true, message: '已删除' });
});

// ============================================================
//                      内容 API
// ============================================================

/**
 * GET /api/contents
 * - 已登录：默认仅看自己的内容，?all=1 看公开内容
 * - 未登录：可看公开内容（userId 为 null 的历史数据）
 */
app.get('/api/contents', (req, res) => {
  const all = req.query.all === '1';
  let items;
  if (req.user && !all) {
    items = listUserMeta(req.user.id);
  } else {
    // 公开内容 = 无 userId 字段的（兼容旧数据） 或显式 public
    items = listAllMeta().filter((m) => !m.userId);
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
 * GET /api/contents/:slug  公开访问（无需登录），浏览数 +1
 */
app.get('/api/contents/:slug', async (req, res) => {
  const { slug } = req.params;
  const meta = getMeta(slug);
  if (!meta) return res.status(404).json({ success: false, error: '内容不存在' });
  const mdPath = path.join(MD_DIR, `${slug}.md`);
  if (!fs.existsSync(mdPath)) {
    return res.status(404).json({ success: false, error: '内容文件不存在' });
  }
  const markdown = await fsp.readFile(mdPath, 'utf-8');
  const html = marked.parse(markdown);

  // 浏览数 +1
  meta.viewCount = (meta.viewCount || 0) + 1;
  saveMeta(slug, meta);

  // 如果是 API Key 访问，更新 lastUsedAt
  if (req.user) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      const apiKey = req.headers['x-api-key'];
      if (apiKey) {
        // 找到对应 key 记录
        const found = findUserByApiKey(apiKey);
        if (found) {
          found.key.lastUsedAt = new Date().toISOString();
          writeJSON(
            path.join(KEYS_DIR, `${found.user.id}-${found.key.id}.json`),
            found.key
          );
        }
      }
    }
  }

  res.json({
    success: true,
    data: { ...meta, markdown, html, url: `${req.protocol}://${req.get('host')}/p/${slug}` }
  });
});

/**
 * POST /api/publish  发布 Markdown
 * 认证：JWT Bearer 或 X-API-Key，任一即可
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

    await fsp.writeFile(path.join(MD_DIR, `${slug}.md`), content, 'utf-8');

    const meta = {
      slug,
      userId: req.user.id, // 关联到用户
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
    console.log(
      `[publish] user=${req.user.email} slug=${slug} title="${finalTitle}" tags=${JSON.stringify(tags || [])}`
    );
    res.json({ success: true, contentId: slug, slug, title: finalTitle, url, createdAt: now });
  } catch (err) {
    console.error('[publish] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/contents/:slug  (需登录且是本人内容)
 */
app.delete('/api/contents/:slug', requireAuth, (req, res) => {
  const { slug } = req.params;
  const meta = getMeta(slug);
  if (!meta) return res.status(404).json({ success: false, error: '内容不存在' });
  if (meta.userId && meta.userId !== req.user.id) {
    return res.status(403).json({ success: false, error: '无权删除他人内容' });
  }
  const mdPath = path.join(MD_DIR, `${slug}.md`);
  const metaPath = path.join(META_DIR, `${slug}.json`);
  if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  res.json({ success: true, message: '已删除' });
});

// ============================================================
//               旧数据兼容：把匿名内容标记为"公开"
// ============================================================
// 已有 meta 没有 userId 字段 → 视为"历史匿名内容"，所有人可查看
// 通过 GET /api/contents?all=1 看

// ============================================================
//                       启动
// ============================================================

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 MD-Beautify API Server v0.3 (用户系统)`);
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
