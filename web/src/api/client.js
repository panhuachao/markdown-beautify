/**
 * MD-Beautify API 客户端
 *
 * 通过 Vite 代理（dev）或相对路径（prod）调用后端。
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // 列出所有内容
  listContents() {
    return request('/contents');
  },

  // 获取内容详情（含渲染后的 HTML）
  getContent(slug) {
    return request(`/contents/${slug}`);
  },

  // 发布 Markdown（主要给 Web 端上传使用，Agent Skill 通常走 Skill 端）
  publish({ content, title, tags }) {
    return request('/publish', {
      method: 'POST',
      body: JSON.stringify({ content, title, tags })
    });
  },

  // 删除内容
  deleteContent(slug) {
    return request(`/contents/${slug}`, { method: 'DELETE' });
  },

  // 健康检查
  health() {
    return request('/health');
  }
};
