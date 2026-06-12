/**
 * MD-Beautify Skill (MVP)
 *
 * 供 OpenClaw / WorkBuddy / Claude Code / Cursor 等 AI Agent 框架调用。
 * 核心能力：将当前对话产出的 Markdown 一键发布，返回可分享的移动端优先渲染链接。
 *
 * 调用方式（示例）:
 *   const result = await skill.execute('publish', {
 *     content: '# Hello\n这是正文...',
 *     title: '可选标题',
 *     tags: ['demo', 'test']
 *   });
 */

const fs = require('fs');
const path = require('path');

// 读取 skill.json 配置
const skillConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'skill.json'), 'utf-8')
);

// ---------------- 工具函数 ----------------

/**
 * 发送 HTTP POST 请求（不依赖第三方库，最大兼容性）
 */
function httpPost(url, body) {
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
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
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

/**
 * 从 Markdown 提取第一个 H1 标题
 */
function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '未命名内容';
}

// ---------------- Skill 主体 ----------------

const skill = {
  name: skillConfig.name,
  version: skillConfig.version,
  description: skillConfig.description,

  /**
   * 获取 skill 元信息（供 Agent 框架发现）
   */
  manifest() {
    return skillConfig;
  },

  /**
   * 执行 Skill Action
   * @param {string} action - 'publish'
   * @param {object} params
   * @param {string} params.content - Markdown 内容
   * @param {string} [params.title]
   * @param {string[]} [params.tags]
   */
  async execute(action, params = {}) {
    if (action !== 'publish') {
      throw new Error(`Unknown action: ${action}. Supported: publish`);
    }

    const { content, title, tags } = params;
    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new Error('content 不能为空');
    }

    const apiBaseUrl = (skillConfig.config && skillConfig.config.apiBaseUrl.default) || 'http://localhost:3000';
    const apiUrl = `${apiBaseUrl}/api/publish`;

    const finalTitle = title || extractTitle(content);

    console.log(`[md-beautify] Publishing "${finalTitle}" to ${apiUrl}...`);

    try {
      const result = await httpPost(apiUrl, {
        content,
        title: finalTitle,
        tags: Array.isArray(tags) ? tags : []
      });

      if (result.status !== 200 || !result.body.success) {
        throw new Error(`Publish failed: ${result.status} ${JSON.stringify(result.body)}`);
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
        hint: '请确认后端服务已启动（cd backend && npm install && npm start）'
      };
    }
  }
};

// 兼容多种 Skill 加载方式
if (typeof module !== 'undefined' && module.exports) {
  module.exports = skill;
}
if (typeof globalThis !== 'undefined') {
  globalThis.mdBeautifySkill = skill;
}

module.exports = skill;
