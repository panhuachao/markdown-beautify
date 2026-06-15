/**
 * MD-Beautify · MySQL 数据库抽象层
 *
 * 提供对 users / contents / api_keys 三张表的所有 CRUD 操作。
 * 连接池单例；所有方法返回 Promise。
 */

const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'md_beautify',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    // 关键：把 JSON 列解析为对象
    typeCast: function (field, next) {
      if (field.type === 'JSON') {
        const v = field.string();
        return v == null ? null : JSON.parse(v);
      }
      return next();
    }
  });
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ============== 行转换工具 ==============

/** DB 行 → JS 对象（统一字段命名：snake_case → camelCase，日期 ISO） */
function rowToUser(r) {
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
}

function rowToContent(r) {
  if (!r) return null;
  return {
    slug: r.slug,
    userId: r.user_id,
    title: r.title,
    excerpt: r.excerpt || '',
    markdown: r.markdown,
    tags: Array.isArray(r.tags_json) ? r.tags_json : [],
    viewCount: r.view_count || 0,
    source: r.source,
    status: r.status,
    createdAt: toISO(r.created_at),
    updatedAt: toISO(r.updated_at)
  };
}

function rowToKey(r) {
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
}

function toISO(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
}

// ============================================================
//                          Users
// ============================================================

const Users = {
  async create({ id, email, nickname, passwordHash, avatar = '' }) {
    const sql = `INSERT INTO users (id, email, nickname, avatar, password_hash)
                 VALUES (?, ?, ?, ?, ?)`;
    await getPool().execute(sql, [id, email, nickname, avatar, passwordHash]);
    return this.findById(id);
  },

  async findById(id) {
    const [rows] = await getPool().execute(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rowToUser(rows[0]);
  },

  async findByEmail(email) {
    const [rows] = await getPool().execute(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return rowToUser(rows[0]);
  },

  async update(id, { nickname, avatar }) {
    const fields = [];
    const params = [];
    if (nickname !== undefined) {
      fields.push('nickname = ?');
      params.push(nickname);
    }
    if (avatar !== undefined) {
      fields.push('avatar = ?');
      params.push(avatar);
    }
    if (fields.length === 0) return this.findById(id);
    params.push(id);
    await getPool().execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    return this.findById(id);
  },

  async updatePassword(id, passwordHash) {
    await getPool().execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, id]
    );
  }
};

// ============================================================
//                        Contents
// ============================================================

const Contents = {
  async create({ slug, userId, title, excerpt, markdown, tags, source = 'agent' }) {
    const sql = `INSERT INTO contents
                 (slug, user_id, title, excerpt, markdown, tags_json, source)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await getPool().execute(sql, [
      slug,
      userId || null,
      title,
      excerpt || '',
      markdown,
      JSON.stringify(tags || []),
      source
    ]);
    return this.findBySlug(slug);
  },

  async findBySlug(slug) {
    const [rows] = await getPool().execute(
      'SELECT * FROM contents WHERE slug = ? LIMIT 1',
      [slug]
    );
    return rowToContent(rows[0]);
  },

  /**
   * 列出内容。
   * options:
   *   - userId: 仅看某用户的内容
   *   - publicOnly: 仅看公开（user_id IS NULL）的内容
   *   - since: ISO 时间字符串，仅返回 created_at >= since
   *   - limit, offset
   */
  async list({ userId, publicOnly, since, limit = 200, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (userId) {
      where.push('user_id = ?');
      params.push(userId);
    }
    if (publicOnly) {
      where.push('user_id IS NULL');
    }
    if (since) {
      where.push('created_at >= ?');
      params.push(new Date(since));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    // LIMIT/OFFSET 强制转整数后内联，避免 mysql2 prepared statement 对整型 LIMIT 报错
    // （ER_WRONG_ARGUMENTS "Incorrect arguments to mysqld_stmt_execute"）
    const safeLimit = Math.max(0, Math.min(1000, parseInt(limit, 10) || 0));
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
    const sql = `SELECT * FROM contents ${whereSql}
                 ORDER BY created_at DESC
                 LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const [rows] = await getPool().query(sql, params);
    return rows.map(rowToContent);
  },

  async count({ userId, publicOnly } = {}) {
    const where = [];
    const params = [];
    if (userId) {
      where.push('user_id = ?');
      params.push(userId);
    }
    if (publicOnly) {
      where.push('user_id IS NULL');
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await getPool().execute(
      `SELECT COUNT(*) AS n FROM contents ${whereSql}`,
      params
    );
    return rows[0].n;
  },

  async incrementView(slug) {
    await getPool().execute(
      'UPDATE contents SET view_count = view_count + 1 WHERE slug = ?',
      [slug]
    );
  },

  async delete(slug) {
    const [res] = await getPool().execute(
      'DELETE FROM contents WHERE slug = ?',
      [slug]
    );
    return res.affectedRows > 0;
  }
};

// ============================================================
//                         API Keys
// ============================================================

const ApiKeys = {
  async create({ id, userId, name, prefix, keyHash }) {
    const sql = `INSERT INTO api_keys (id, user_id, name, prefix, key_hash)
                 VALUES (?, ?, ?, ?, ?)`;
    await getPool().execute(sql, [id, userId, name, prefix, keyHash]);
    return this.findById(userId, id);
  },

  async findById(userId, id) {
    const [rows] = await getPool().execute(
      'SELECT * FROM api_keys WHERE user_id = ? AND id = ? LIMIT 1',
      [userId, id]
    );
    return rowToKey(rows[0]);
  },

  /**
   * 在所有用户中查找匹配此明文 key 的记录。
   * 注：API Key 长度固定 (md_xxxx… 36字符)，bcrypt 校验需要逐条比对。
   * MVP 阶段 key 量小可接受；大规模时建议给 key 加 unique 前缀索引。
   */
  async findByPlainKey(plain) {
    const [rows] = await getPool().execute(
      'SELECT * FROM api_keys'
    );
    const bcrypt = require('bcryptjs');
    for (const r of rows) {
      if (bcrypt.compareSync(plain, r.key_hash)) {
        return rowToKey(r);
      }
    }
    return null;
  },

  async listByUser(userId) {
    const [rows] = await getPool().execute(
      'SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(rowToKey);
  },

  async touchLastUsed(userId, id) {
    await getPool().execute(
      'UPDATE api_keys SET last_used_at = NOW() WHERE user_id = ? AND id = ?',
      [userId, id]
    );
  },

  async delete(userId, id) {
    const [res] = await getPool().execute(
      'DELETE FROM api_keys WHERE user_id = ? AND id = ?',
      [userId, id]
    );
    return res.affectedRows > 0;
  }
};

module.exports = {
  getPool,
  closePool,
  Users,
  Contents,
  ApiKeys
};
