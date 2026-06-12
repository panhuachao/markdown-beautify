import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ContentCard from '../components/ContentCard.jsx';
import './HomePage.css';

export default function HomePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listContents()
      .then((data) => setItems(data.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-page">
      <section className="hero">
        <h1>📝 AI Agent 内容展示与分享空间</h1>
        <p>通过 OpenClaw / WorkBuddy 安装 Skill，将 Markdown 一键发布到 Web。</p>
      </section>

      <section className="container">
        {loading && <div className="state">加载中…</div>}
        {error && <div className="state state--error">加载失败：{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="state state--empty">
            <p>📭 还没有任何内容</p>
            <p className="hint">通过 Skill 上传 Markdown 后会显示在这里。</p>
          </div>
        )}
        {!loading && !error && items.map((item) => (
          <ContentCard key={item.slug} item={item} />
        ))}
      </section>
    </div>
  );
}
