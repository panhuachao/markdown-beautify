import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import './ContentPage.css';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 通用复制方法
 * @returns {Promise<boolean>} 是否复制成功
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // 降级方案：临时 textarea + execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

export default function ContentPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null); // 'url' | 'md' | null
  const [showRaw, setShowRaw] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    setLoading(true);
    api.getContent(slug)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // 卸载时清理 toast 计时器
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((type) => {
    setCopied(type);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setCopied(null), 1800);
  }, []);

  const handleCopyLink = useCallback(async () => {
    const ok = await copyToClipboard(window.location.href);
    if (ok) showToast('url');
    else alert('复制失败，请手动复制');
  }, [showToast]);

  const handleCopyMd = useCallback(async () => {
    if (!data) return;
    const ok = await copyToClipboard(data.markdown);
    if (ok) showToast('md');
    else alert('复制失败，请手动复制');
  }, [data, showToast]);

  /** 点击分享按钮：先调用后端设置 shared=true，再打开弹窗 */
  const handleOpenShare = useCallback(async () => {
    // 只有作者才能设置分享
    if (user && data && data.userId === user.id) {
      setSharing(true);
      try {
        await api.updateContent(slug, { shared: true });
        setData((prev) => prev ? { ...prev, shared: true } : prev);
      } catch (e) {
        console.error('设置分享失败:', e);
      } finally {
        setSharing(false);
      }
    }
    setShowShare(true);
  }, [slug, user, data]);

  // ESC 关闭弹层
  useEffect(() => {
    if (!showRaw && !showShare) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        setShowRaw(false);
        setShowShare(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showRaw, showShare]);

  if (loading) {
    return <div className="content-page"><div className="state">加载中…</div></div>;
  }

  if (error) {
    return (
      <div className="content-page">
        <div className="container">
          <div className="state state--error">
            <h2>😢 内容未找到</h2>
            <p>{error}</p>
            <Link to="/" className="back-link">← 返回首页</Link>
          </div>
        </div>
      </div>
    );
  }

  const pageUrl = window.location.href;
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedTitle = encodeURIComponent(data.title);

  return (
    <div className="content-page">
      <article className="container">
        <header className="content-header">
          <h1 className="content-title">{data.title}</h1>
          <div className="content-meta">
            <span>📅 {formatDate(data.createdAt)}</span>
            <span>👁 {data.viewCount || 0} 次浏览</span>
            {data.tags && data.tags.map((t) => (
              <span key={t} className="tag">#{t}</span>
            ))}
          </div>
          <div className="content-actions">
            <button onClick={handleOpenShare} className="btn-share" disabled={sharing}>
              {sharing ? '⏳ 处理中…' : '📤 分享'}
            </button>
            <button
              onClick={handleCopyMd}
              className={`btn-copy-md ${copied === 'md' ? 'is-success' : ''}`}
            >
              {copied === 'md' ? '✓ 已复制' : '📋 复制 Markdown'}
            </button>
            <button onClick={() => setShowRaw(true)} className="btn-raw">
              📄 查看原始
            </button>
            <Link to="/" className="btn-back">← 返回</Link>
          </div>
        </header>

        <div
          className="content-body markdown-body"
          dangerouslySetInnerHTML={{ __html: data.html }}
        />
      </article>

      {/* 复制成功 Toast */}
      {copied && (
        <div className="copy-toast">
          {copied === 'url' ? '🔗 分享链接已复制到剪贴板' : '📋 Markdown 原文已复制到剪贴板'}
        </div>
      )}

      {/* 分享弹层 — 仅显示链接 + 复制按钮 */}
      {showShare && (
        <div className="share-modal-mask" onClick={() => setShowShare(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3 className="share-modal-title">📤 分享链接</h3>
              <button
                className="share-modal-close"
                onClick={() => setShowShare(false)}
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className="share-modal-body">
              <div className="share-section">
                <label className="share-label">将此链接发送给好友，即可查看内容</label>
                <div className="share-url-row">
                  <input
                    className="share-url-input"
                    value={pageUrl}
                    readOnly
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`share-copy-btn ${copied === 'url' ? 'is-success' : ''}`}
                  >
                    {copied === 'url' ? '✓ 已复制' : '复制链接'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 原始 Markdown 弹层 */}
      {showRaw && (
        <div className="raw-modal-mask" onClick={() => setShowRaw(false)}>
          <div className="raw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="raw-modal-header">
              <h3 className="raw-modal-title">📄 原始 Markdown 源码</h3>
              <button
                className="raw-modal-close"
                onClick={() => setShowRaw(false)}
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className="raw-modal-body">
              <pre className="raw-modal-pre">{data.markdown}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
