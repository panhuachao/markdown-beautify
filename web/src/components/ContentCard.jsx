import { Link } from 'react-router-dom';
import './ContentCard.css';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ContentCard({ item }) {
  return (
    <Link to={`/p/${item.slug}`} className="content-card">
      <h2 className="content-card-title">{item.title}</h2>
      <div className="content-card-meta">
        <span>📅 {formatDate(item.createdAt)}</span>
        <span>👁 {item.viewCount || 0}</span>
      </div>
      {item.excerpt && (
        <p className="content-card-excerpt">{item.excerpt}</p>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="content-card-tags">
          {item.tags.map((t) => (
            <span key={t} className="tag">#{t}</span>
          ))}
        </div>
      )}
    </Link>
  );
}
