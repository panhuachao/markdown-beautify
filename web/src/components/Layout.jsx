import { Outlet, Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const isDetail = location.pathname.startsWith('/p/');

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="logo">
            <span className="logo-icon">📝</span>
            <span className="logo-text">MD-Beautify</span>
          </Link>
          <nav className="nav">
            <Link to="/" className="nav-link">首页</Link>
            <Link to="/about" className="nav-link">关于</Link>
          </nav>
        </div>
      </header>

      <main className={`main ${isDetail ? 'main--detail' : ''}`}>
        <Outlet />
      </main>

      <footer className="footer">
        <p>
          MD-Beautify · 由 AI Agent 内容驱动 ·{' '}
          <Link to="/about">了解更多</Link>
        </p>
      </footer>
    </div>
  );
}
