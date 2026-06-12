/**
 * MD-Beautify Skill (v0.3 · 用户认证)
 *
 * 供 OpenClaw / WorkBuddy / Claude Code / Cursor 等 AI Agent 框架调用。
 * 核心能力：将当前对话产出的 Markdown 一键发布到当前用户空间。
 *
 * 认证方式（按优先级）:
 *  1. 通过环境变量 MD_BEAUTIFY_API_KEY 传入 API Key（推荐）
 *  2. 通过 skill.json 的 config.apiKey 字段配置
 *
 * 调用示例:
 *   const result = await skill.execute('publish', {
 *     content: '# Hello\n这是正文...',
 *     title: '可选标题',
 *     tags: ['demo']
 *   });
 */

const fs = require('fs');
const path = require('path');

const skillConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'skill.json'), 'utf-8')
);

// 暴露 config 用于运行时覆盖（测试或多后端场景）
let runtimeConfig = { ...skillConfig.config };

function getConfig() {
  return { ...skillConfig.config, ...runtimeConfig };
}

// ---------------- 工具函数 ----------------

function httpPost(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? require('https') : require('http');

    const payload = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...extraHeaders
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '未命名内容';
}

function resolveApiKey() {
  // 优先级：环境变量 > skill.json config
  return (
    process.env.MD_BEAUTIFY_API_KEY ||
    (skillConfig.config && skillConfig.config.apiKey && skillConfig.config.apiKey.default) ||
    null
  );
}

// ---------------- Skill 主体 ----------------

const skill = {
  name: skillConfig.name,
  version: skillConfig.version,
  description: skillConfig.description,

  manifest() {
    return skillConfig;
  },

  /**
   * 运行时覆盖配置（多后端/测试场景）
   * @param {object} patch - 例如 { apiBaseUrl: { default: 'http://x.x.x.x' } }
   */
  setConfig(patch) {
    runtimeConfig = { ...runtimeConfig, ...patch };
  },

  /**
   * 执行 Skill Action
   * @param {string} action - 'publish'
   * @param {object} params
   * @param {string} params.content - Markdown 内容（必填）
   * @param {string} [params.title]
   * @param {string[]} [params.tags]
   * @param {string} [params.apiKey] - 可临时覆盖 API Key
   */
  async execute(action, params = {}) {
    if (action !== 'publish') {
      throw new Error(`Unknown action: ${action}. Supported: publish`);
    }

    const { content, title, tags, apiKey: overrideKey } = params;
    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new Error('content 不能为空');
    }

    const apiBaseUrl =
      (getConfig().apiBaseUrl && getConfig().apiBaseUrl.default) ||
      'http://localhost:3000';
    const apiUrl = `${apiBaseUrl}/api/publish`;

    const apiKey = overrideKey || getConfig().apiKey?.default || resolveApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: '未配置 API Key',
        hint: '请在 web 端"设置 → API 密钥"生成密钥，并设置环境变量 MD_BEAUTIFY_API_KEY 或在 skill.json 中配置'
      };
    }

    const finalTitle = title || extractTitle(content);
    console.log(`[md-beautify] Publishing "${finalTitle}" to ${apiUrl} (auth: API Key)`);

    try {
      const result = await httpPost(
        apiUrl,
        {
          content,
          title: finalTitle,
          tags: Array.isArray(tags) ? tags : []
        },
        { 'X-API-Key': apiKey }
      );

      if (result.status === 401) {
        return {
          success: false,
          error: 'API Key 无效或已过期',
          hint: '请在 web 端检查密钥状态或重新生成'
        };
      }
      if (result.status !== 200 || !result.body.success) {
        throw new Error(
          `Publish failed: ${result.status} ${JSON.stringify(result.body)}`
        );
      }

      const { contentId, url, createdAt } = result.body;
      console.log(`[md-beautify] ✅ Published!`);
      console.log(`[md-beautify]    URL: ${url}`);

      return {
        success: true,
        contentId,
        url,
        title: finalTitle,
        createdAt,
        message: `已发布到 MD-Beautify，分享链接：${url}`
      };
    } catch (err) {
      console.error(`[md-beautify] ❌ Publish failed:`, err.message);
      return {
        success: false,
        error: err.message,
        hint: '请确认后端服务已启动且 API Key 正确'
      };
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = skill;
}
if (typeof globalThis !== 'undefined') {
  globalThis.mdBeautifySkill = skill;
}

module.exports = skill;
