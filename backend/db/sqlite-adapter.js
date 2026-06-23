/**
 * 本地无 MySQL 环境下的"逻辑验证"用 SQLite 适配
 *
 * 目的：在没有 Docker / MySQL 的开发机中验证 db 抽象层和 server.js 的连接是否正确。
 * 用法：DB_DRIVER=sqlite node server.js
 *
 * ⚠️ 仅供本地开发/测试使用。生产请用 MySQL。
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

let dbInstance = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contents (
  slug TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  markdown TEXT NOT NULL,
  tags_json TEXT DEFAULT '[]',
  view_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'agent',
  status TEXT NOT NULL DEFAULT 'published',
  shared INTEGER NOT NULL DEFAULT 0,
  `read` INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL

);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
`;

function getDb() {
  if (dbInstance) return dbInstance;
  const dbPath = path.join(__dirname, '..', 'data-dev.sqlite');
  dbInstance = new Database(dbPath);
  dbInstance.exec(SCHEMA);
  console.log(`[sqlite] dev DB at ${dbPath}`);
  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function toISO(s) {
  if (!s) return null;
  let date;
  if (typeof s === 'string' && /Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    date = new Date(s);
  } else {
    // SQLite datetime('now') 返回 "YYYY-MM-DD HH:MM:SS"（无时区），
    // 当作 UTC 处理
    date = new Date(String(s).replace(' ', 'T') + 'Z');
  }
  // 转换为东八区时间并返回带时区偏移的 ISO 字符串
  const offset = 8 * 60; // 东八区分钟偏移
  const local = new Date(date.getTime() + offset * 60 * 1000);
  const iso = local.toISOString().replace('Z', '');
  const sign = '+';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  return iso + sign + hours + ':' + minutes;
}

const Users = {
  async create({ id, email, nickname, passwordHash, avatar = '' }) {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO users (id, email, nickname, avatar, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, email, nickname, avatar, passwordHash, now, now);
    return this.findById(id);
  },
  async findById(id) {
    const r = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!r) return null;
    return {
      id: r.id,
      email: r.email,
      nickname: r.nickname,
      avatar: r.avatar || '',
      passwordHash: r.password_hash,
      createdAt: toISO(r.created_at),
      updatedAt: toISO(r.updated_at)
    };
  },
  async findByEmail(email) {
    const r = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!r) return null;
    return {
      id: r.id,
      email: r.email,
      nickname: r.nickname,
      avatar: r.avatar || '',
      passwordHash: r.password_hash,
      createdAt: toISO(r.created_at),
      updatedAt: toISO(r.updated_at)
    };
  },
  async update(id, { nickname, avatar }) {
    const cur = await this.findById(id);
    if (!cur) return null;
    const newNick = nickname !== undefined ? nickname : cur.nickname;
    const newAv = avatar !== undefined ? avatar : cur.avatar;
    getDb()
      .prepare('UPDATE users SET nickname = ?, avatar = ?, updated_at = ? WHERE id = ?')
      .run(newNick, newAv, new Date().toISOString(), id);
    return this.findById(id);
  },
  async updatePassword(id, passwordHash) {
    getDb()
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, new Date().toISOString(), id);
  }
};

const Contents = {
  async create({ slug, userId, title, excerpt, markdown, tags, source = 'agent', shared = false }) {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO contents (slug, user_id, title, excerpt, markdown, tags_json, source, shared, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(slug, userId || null, title, excerpt || '', markdown, JSON.stringify(tags || []), source, shared ? 1 : 0, now, now);
    return this.findBySlug(slug);
  },
  async findBySlug(slug) {
    const r = getDb().prepare('SELECT * FROM contents WHERE slug = ?').get(slug);
    if (!r) return null;
    return {
      slug: r.slug,
      userId: r.user_id,
      title: r.title,
      excerpt: r.excerpt || '',
      markdown: r.markdown,
      tags: JSON.parse(r.tags_json || '[]'),
      viewCount: r.view_count || 0,
      source: r.source,
      status: r.status,
      shared: !!r.shared,
      read: !!r.read,
      createdAt: toISO(r.created_at),
      updatedAt: toISO(r.updated_at)
    };
  },
  async list({ userId, publicOnly, unread, since, limit = 200, offset = 0 } = {}) {
    let sql = 'SELECT * FROM contents';
    const where = [];
    const params = [];
    if (userId) {
      where.push('user_id = ?');
      params.push(userId);
    }
    if (publicOnly) {
      where.push('shared = 1');
    }
    if (unread) {
      where.push('`read` = 0');
    }
    if (since) {
      where.push('created_at >= ?');
      params.push(new Date(since).toISOString());
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = getDb().prepare(sql).all(...params);
    return rows.map((r) => ({
      slug: r.slug,
      userId: r.user_id,
      title: r.title,
      excerpt: r.excerpt || '',
      markdown: r.markdown,
      tags: JSON.parse(r.tags_json || '[]'),
      viewCount: r.view_count || 0,
      source: r.source,
      status: r.status,
      read: !!r.read,
      createdAt: toISO(r.created_at),
      updatedAt: toISO(r.updated_at)
    }));

  },
  async count({ userId, publicOnly } = {}) {
    let sql = 'SELECT COUNT(*) AS n FROM contents';
    const where = [];
    const params = [];
    if (userId) {
      where.push('user_id = ?');
      params.push(userId);
    }
    if (publicOnly) {
      where.push('user_id IS NULL');
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    const r = getDb().prepare(sql).get(...params);
    return r.n;
  },
  async incrementView(slug) {
    getDb()
      .prepare('UPDATE contents SET view_count = view_count + 1 WHERE slug = ?')
      .run(slug);
  },
  async updateShared(slug, shared) {
    getDb()
      .prepare('UPDATE contents SET shared = ? WHERE slug = ?')
      .run(shared ? 1 : 0, slug);
  },
  async markAsRead(slug) {
    getDb()
      .prepare('UPDATE contents SET `read` = 1 WHERE slug = ?')
      .run(slug);
  },
  async delete(slug) {

    const r = getDb().prepare('DELETE FROM contents WHERE slug = ?').run(slug);
    return r.changes > 0;
  }
};

const ApiKeys = {
  async create({ id, userId, name, prefix, keyHash }) {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO api_keys (id, user_id, name, prefix, key_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, userId, name, prefix, keyHash, now);
    return this.findById(userId, id);
  },
  async findById(userId, id) {
    const r = getDb()
      .prepare('SELECT * FROM api_keys WHERE user_id = ? AND id = ?')
      .get(userId, id);
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      prefix: r.prefix,
      keyHash: r.key_hash,
      lastUsedAt: toISO(r.last_used_at),
      createdAt: toISO(r.created_at)
    };
  },
  async findByPlainKey(plain) {
    const rows = getDb().prepare('SELECT * FROM api_keys').all();
    for (const r of rows) {
      if (bcrypt.compareSync(plain, r.key_hash)) {
        return {
          id: r.id,
          userId: r.user_id,
          name: r.name,
          prefix: r.prefix,
          keyHash: r.key_hash,
          lastUsedAt: toISO(r.last_used_at),
          createdAt: toISO(r.created_at)
        };
      }
    }
    return null;
  },
  async listByUser(userId) {
    const rows = getDb()
      .prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      prefix: r.prefix,
      keyHash: r.key_hash,
      lastUsedAt: toISO(r.last_used_at),
      createdAt: toISO(r.created_at)
    }));
  },
  async touchLastUsed(userId, id) {
    getDb()
      .prepare('UPDATE api_keys SET last_used_at = ? WHERE user_id = ? AND id = ?')
      .run(new Date().toISOString(), userId, id);
  },
  async delete(userId, id) {
    const r = getDb()
      .prepare('DELETE FROM api_keys WHERE user_id = ? AND id = ?')
      .run(userId, id);
    return r.changes > 0;
  }
};

module.exports = {
  getDb,
  closeDb,
  Users,
  Contents,
  ApiKeys
};
