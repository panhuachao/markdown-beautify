import { useEffect, useState } from 'react';
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getContent(slug)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const copyUrl = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

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
            <button onClick={copyUrl} className="btn-share">
              {copied ? '✓ 已复制' : '🔗 复制分享链接'}
            </button>
            <Link to="/" className="btn-back">← 返回首页</Link>
          </div>
        </header>

        <div
          className="content-body markdown-body"
          dangerouslySetInnerHTML={{ __html: data.html }}
        />
      </article>
    </div>
  );
}
