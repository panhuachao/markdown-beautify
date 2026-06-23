/**
 * MD-Beautify API 客户端
 * 通过 Vite 代理（dev）或相对路径（prod）调用后端
 *
 * 自动从 localStorage 读取 JWT 注入 Authorization header
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function getToken() {
  return localStorage.getItem('md-beautify-token');
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  // 自动注入 token
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // ========== 认证 ==========
  register({ email, password, nickname }) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname })
    });
  },
  login({ email, password }) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  me() {
    return request('/auth/me');
  },
  updateMe(payload) {
    return request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  changePassword({ oldPassword, newPassword }) {
    return request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    });
  },

  // ========== API 密钥 ==========
  listKeys() {
    return request('/keys');
  },
  createKey({ name }) {
    return request('/keys', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },
  deleteKey(id) {
    return request(`/keys/${id}`, { method: 'DELETE' });
  },

  // ========== 内容 ==========
  listContents(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/contents${qs ? '?' + qs : ''}`);
  },
  getContent(slug) {
    return request(`/contents/${slug}`);
  },
  publish({ content, title, tags }) {
    return request('/publish', {
      method: 'POST',
      body: JSON.stringify({ content, title, tags })
    });
  },
  updateContent(slug, payload) {
    return request(`/contents/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  markAsRead(slug) {
    return request(`/contents/${slug}/read`, {
      method: 'POST'
    });
  },
  deleteContent(slug) {

    return request(`/contents/${slug}`, { method: 'DELETE' });
  },

  // ========== 健康 ==========
  health() {
    return request('/health');
  }
};
