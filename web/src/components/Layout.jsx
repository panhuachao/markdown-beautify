import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const isDetail = location.pathname.startsWith('/p/');

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      navigate('/');
    }
  };

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
            {isLoggedIn && <Link to="/my" className="nav-link">我的</Link>}
            <Link to="/about" className="nav-link">关于</Link>
            {isLoggedIn ? (
              <>
                <Link to="/settings" className="nav-link nav-user" title="设置">
                  <span className="user-dot" />
                  {user.nickname}
                </Link>
                <button onClick={handleLogout} className="nav-link nav-btn">
                  退出
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">登录</Link>
                <Link to="/register" className="nav-link nav-link-cta">注册</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className={`main ${isDetail ? 'main--detail' : ''}`}>
        <Outlet />
      </main>

      <footer className="footer">
        <p>
          MD-Beautify · 由 AI Agent 内容驱动 · <Link to="/about">了解更多</Link>
        </p>
      </footer>
    </div>
  );
}
