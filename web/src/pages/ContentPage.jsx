import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import './ContentPage.css';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ContentPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null); // 'url' | 'md' | null
  const [showRaw, setShowRaw] = useState(false);
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

  /**
   * 通用复制方法 + Toast 反馈
   */
  const copyText = async (text, type) => {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        // 降级方案：临时 textarea + execCommand
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (e) {
      ok = false;
    }

    if (ok) {
      setCopied(type);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setCopied(null), 1800);
    } else {
      alert('复制失败，请手动复制');
    }
  };

  // ESC 关闭原始 MD 弹层
  useEffect(() => {
    if (!showRaw) return;
    const handler = (e) => {
      if (e.key === 'Escape') setShowRaw(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showRaw]);

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
            <button
              onClick={() => copyText(window.location.href, 'url')}
              className={`btn-share ${copied === 'url' ? 'is-success' : ''}`}
            >
              {copied === 'url' ? '✓ 已复制链接' : '🔗 复制分享链接'}
            </button>
            <button
              onClick={() => copyText(data.markdown, 'md')}
              className={`btn-copy-md ${copied === 'md' ? 'is-success' : ''}`}
            >
              {copied === 'md' ? '✓ 已复制 Markdown' : '📋 复制 Markdown'}
            </button>
            <button
              onClick={() => setShowRaw(true)}
              className="btn-raw"
            >
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
