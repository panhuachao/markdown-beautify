import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import ContentCard from '../components/ContentCard.jsx';
import UploadModal from '../components/UploadModal.jsx';
import './MyPage.css';

const TABS = [
  { key: 'today', label: '今日', match: (d) => isSameDay(d, new Date()) },
  { key: 'all', label: '所有', match: () => true }
];

/** 判断两个 Date 是否是同一天（本地时区） */
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoggedIn, loading: authLoading, user } = useAuth();

  const initialTab = searchParams.get('tab') === 'all' ? 'all' : 'today';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  // 登录保护：等待 authLoading 完成后才做判断
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/my' } });
    }
  }, [isLoggedIn, authLoading, navigate]);


  // 加载内容
  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError(null);
    api
      .listContents()
      .then((res) => setItems(res.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // tab 同步到 URL
  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
  };

  // 按 tab 过滤
  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab) || TABS[0];
    return items.filter((it) => tab.match(new Date(it.createdAt)));
  }, [items, activeTab]);

  // 统计
  const todayCount = useMemo(
    () => items.filter((it) => isSameDay(new Date(it.createdAt), new Date())).length,
    [items]
  );
  const totalCount = items.length;

  const handleUploadSuccess = async () => {
    setShowUpload(false);
    setLoading(true);
    try {
      const res = await api.listContents();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (slug) => {
    if (!confirm('确定删除这条内容？')) return;
    try {
      await api.deleteContent(slug);
      setItems((prev) => prev.filter((it) => it.slug !== slug));
    } catch (e) {
      alert('删除失败：' + e.message);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <div className="my-page">
      {/* 顶部用户条 */}
      <section className="my-header">
        <div className="my-header-inner">
          <div className="my-user">
            <div className="my-avatar">
              {user.email[0].toUpperCase()}
            </div>
            <div>
              <div className="my-name">{user.nickname}</div>
              <div className="my-email">{user.email}</div>
            </div>
          </div>
          <button className="btn-upload" onClick={() => setShowUpload(true)}>
            ➕ 发布新内容
          </button>
        </div>
      </section>

      {/* Tab 切换 */}
      <div className="my-tabs-wrap">
        <div className="my-tabs">
          {TABS.map((tab) => {
            const count = tab.key === 'today' ? todayCount : totalCount;
            return (
              <button
                key={tab.key}
                className={`my-tab ${activeTab === tab.key ? 'is-active' : ''}`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
                <span className="my-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 内容列表 */}
      <section className="my-content">
        <div className="my-container">
          {loading && <div className="state">加载中…</div>}
          {error && <div className="state state--error">加载失败：{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="state state--empty">
              {activeTab === 'today' ? (
                <>
                  <p>📭 今天还没有内容</p>
                  <p className="hint">通过 AI Agent 发布的内容会出现在这里</p>
                </>
              ) : (
                <>
                  <p>📭 还没有任何内容</p>
                  <p className="hint">点击右上角"发布新内容"开始</p>
                </>
              )}
            </div>
          )}
          {!loading &&
            !error &&
            filtered.map((item) => (
              <div key={item.slug} className="content-row">
                <ContentCard item={item} />
                <div className="content-row-meta">
                  <span className="content-row-time">发布于 {formatDate(item.createdAt)}</span>
                  <button
                    className="btn-card-delete"
                    onClick={() => handleDelete(item.slug)}
                    title="删除"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
