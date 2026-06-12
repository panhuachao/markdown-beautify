import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import './SettingsPage.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, updateProfile, logout } = useAuth();

  // 资料
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // 密码
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  // 密钥
  const [keys, setKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPlain, setNewKeyPlain] = useState(null); // 明文（只显示一次）
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyMsg, setKeyMsg] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/settings' } });
      return;
    }
    loadKeys();
  }, [isLoggedIn, navigate]);

  const loadKeys = async () => {
    try {
      const res = await api.listKeys();
      setKeys(res.items || []);
    } catch (err) {
      setKeyMsg({ type: 'error', text: err.message });
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileLoading(true);
    try {
      const res = await api.updateMe({ nickname });
      updateProfile(res.user);
      setProfileMsg({ type: 'success', text: '✓ 资料已更新' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!oldPwd || !newPwd) {
      setPwdMsg({ type: 'error', text: '请填写旧密码和新密码' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ type: 'error', text: '新密码至少 6 位' });
      return;
    }
    setPwdLoading(true);
    try {
      await api.changePassword({ oldPassword: oldPwd, newPassword: newPwd });
      setPwdMsg({ type: 'success', text: '✓ 密码已更新，请重新登录' });
      setOldPwd('');
      setNewPwd('');
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 1500);
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.message });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    setKeyMsg(null);
    setNewKeyPlain(null);
    setKeyLoading(true);
    try {
      const res = await api.createKey({ name: newKeyName || 'Unnamed Key' });
      setNewKeyPlain(res.key);
      setNewKeyName('');
      await loadKeys();
    } catch (err) {
      setKeyMsg({ type: 'error', text: err.message });
    } finally {
      setKeyLoading(false);
    }
  };

  const handleDeleteKey = async (id) => {
    if (!confirm('确定删除这个 API 密钥？使用此 Key 的 Agent 将无法再发布。')) return;
    try {
      await api.deleteKey(id);
      await loadKeys();
    } catch (err) {
      setKeyMsg({ type: 'error', text: err.message });
    }
  };

  const copyKey = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1500);
    } catch (err) {
      alert('复制失败：' + err.message);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <div className="settings-page">
      <div className="container">
        <h1>⚙️ 设置</h1>

        {/* 个人资料 */}
        <section className="settings-card">
          <h2>个人资料</h2>
          <div className="user-info-row">
            <div className="user-avatar-lg">{user.email[0].toUpperCase()}</div>
            <div>
              <div className="user-name">{user.nickname}</div>
              <div className="user-email">{user.email}</div>
              <div className="user-id">ID: {user.id}</div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="settings-form">
            <div className="form-field">
              <label htmlFor="nickname">昵称</label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={32}
              />
            </div>
            {profileMsg && (
              <div className={`msg ${profileMsg.type}`}>{profileMsg.text}</div>
            )}
            <button type="submit" className="btn-primary" disabled={profileLoading}>
              {profileLoading ? '保存中…' : '保存'}
            </button>
          </form>
        </section>

        {/* 修改密码 */}
        <section className="settings-card">
          <h2>修改密码</h2>
          <form onSubmit={handleChangePassword} className="settings-form">
            <div className="form-field">
              <label htmlFor="oldPwd">旧密码</label>
              <input
                id="oldPwd"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="form-field">
              <label htmlFor="newPwd">新密码（至少 6 位）</label>
              <input
                id="newPwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {pwdMsg && <div className={`msg ${pwdMsg.type}`}>{pwdMsg.text}</div>}
            <button type="submit" className="btn-primary" disabled={pwdLoading}>
              {pwdLoading ? '修改中…' : '修改密码'}
            </button>
          </form>
        </section>

        {/* API 密钥 */}
        <section className="settings-card">
          <h2>🔑 API 密钥</h2>
          <p className="settings-hint">
            在 AI Agent（如 OpenClaw / WorkBuddy）中配置 <code>X-API-Key</code> header 来发布内容。
            密钥明文只在创建时显示一次。
          </p>

          <form onSubmit={handleCreateKey} className="settings-form key-form">
            <input
              type="text"
              placeholder="密钥名称（如：MacBook Skill）"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              maxLength={50}
            />
            <button type="submit" className="btn-primary" disabled={keyLoading}>
              {keyLoading ? '生成中…' : '+ 生成新密钥'}
            </button>
          </form>

          {newKeyPlain && (
            <div className="key-plain-box">
              <div className="key-plain-label">
                ⚠️ 请立即复制，关闭后将无法再看到明文
              </div>
              <div className="key-plain-row">
                <code className="key-plain-text">{newKeyPlain.key}</code>
                <button
                  className={`btn-copy ${copiedKey ? 'is-success' : ''}`}
                  onClick={() => copyKey(newKeyPlain.key)}
                >
                  {copiedKey ? '✓ 已复制' : '📋 复制'}
                </button>
              </div>
            </div>
          )}

          {keyMsg && <div className={`msg ${keyMsg.type}`}>{keyMsg.text}</div>}

          <div className="keys-list">
            {keys.length === 0 ? (
              <div className="keys-empty">还没有 API 密钥</div>
            ) : (
              keys.map((k) => (
                <div key={k.id} className="key-item">
                  <div className="key-item-info">
                    <div className="key-name">{k.name}</div>
                    <div className="key-meta">
                      <code>{k.prefix}</code>
                      <span>· 创建于 {formatDate(k.createdAt)}</span>
                      {k.lastUsedAt && (
                        <span>· 最后使用 {formatDate(k.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteKey(k.id)}
                    title="删除"
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 登出 */}
        <section className="settings-card logout-card">
          <h2>登出</h2>
          <button
            className="btn-secondary"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            退出登录
          </button>
        </section>
      </div>
    </div>
  );
}
