/**
 * 初始化 MySQL 数据库
 * 1. 创建数据库（如不存在）
 * 2. 创建表（idempotent）
 *
 * 用法:
 *   node db/init.js
 *
 * 环境变量:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

// 优先加载 backend/.env（本地开发），其次回退到项目根 .env（docker compose 挂载）
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const candidates = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env')
];
const loaded = candidates.find((p) => fs.existsSync(p));
if (loaded) {
  dotenv.config({ path: loaded });
  console.log(`[init] 已加载环境变量: ${loaded}`);
}
const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'md_beautify';

  console.log(`[init] 连接 MySQL ${user}@${host}:${port}...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });
  console.log('[init] ✅ 已连接');

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

  console.log(`[init] 执行 schema（数据库: ${dbName}）...`);
  await conn.query(sql);
  console.log('[init] ✅ Schema 已就绪');

  // 验证表已创建
  await conn.changeUser({ database: dbName });
  const [tables] = await conn.query('SHOW TABLES');
  console.log('[init] 当前表:', tables.map((r) => Object.values(r)[0]).join(', '));

  await conn.end();
  console.log('[init] 🎉 初始化完成');
}

main().catch((err) => {
  // 打印完整错误，包含 code / errno / sqlMessage 等字段
  const details = {
    message: err.message,
    code: err.code,
    errno: err.errno,
    sqlState: err.sqlState,
    sqlMessage: err.sqlMessage
  };
  console.error('[init] ❌ 失败:', JSON.stringify(details, null, 2));
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
