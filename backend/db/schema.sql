-- =============================================================================
-- MD-Beautify · MySQL Schema
-- 数据库: md_beautify
-- 字符集: utf8mb4 (支持 emoji)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS md_beautify
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE md_beautify;

-- -----------------------------------------------------------------------------
-- 用户表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(16)   NOT NULL PRIMARY KEY,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  nickname      VARCHAR(64)   NOT NULL,
  avatar        VARCHAR(500)  DEFAULT '',
  password_hash VARCHAR(255)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 内容表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contents (
  slug         VARCHAR(16)   NOT NULL PRIMARY KEY,
  user_id      VARCHAR(16)   DEFAULT NULL,           -- NULL = 公开/匿名内容
  title        VARCHAR(255)  NOT NULL,
  excerpt      TEXT          DEFAULT NULL,
  markdown     MEDIUMTEXT    NOT NULL,              -- 原始 Markdown
  tags_json    JSON          DEFAULT NULL,          -- ["a","b","c"]
  view_count   INT UNSIGNED  NOT NULL DEFAULT 0,
  source       VARCHAR(16)   NOT NULL DEFAULT 'agent',
  status       VARCHAR(16)   NOT NULL DEFAULT 'published',
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_contents_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- API 密钥表 (仅存 hash，明文只在创建时返回一次)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id          VARCHAR(16)   NOT NULL,
  user_id     VARCHAR(16)   NOT NULL,
  name        VARCHAR(64)   NOT NULL,
  prefix      VARCHAR(16)   NOT NULL,               -- 脱敏前缀 md_xxxx…
  key_hash    VARCHAR(255)  NOT NULL,               -- bcrypt hash
  last_used_at DATETIME     DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, id),
  INDEX idx_key_hash (key_hash(64)),
  CONSTRAINT fk_keys_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
