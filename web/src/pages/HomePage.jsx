import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './HomePage.css';

export default function HomePage() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="landing-page">
      {/* ===== Hero 区 ===== */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">v0.3 · 用户系统上线</div>
          <h1 className="hero-title">
            AI 对话产物的<br />
            <span className="hero-gradient">最佳归宿</span>
          </h1>
          <p className="hero-subtitle">
            将 AI Agent 生成的 Markdown 一键发布，自动渲染为移动端优先的精美网页。
            <br />
            短链接可发到任何聊天窗口，对方零门槛阅读。
          </p>
          <div className="hero-actions">
            {isLoggedIn ? (
              <Link to="/my" className="btn-primary-lg">📂 进入我的空间</Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary-lg">免费注册</Link>
                <Link to="/login" className="btn-secondary-lg">已有账号 · 登录</Link>
              </>
            )}
          </div>
          <div className="hero-demo">
            <div className="hero-demo-item">
              <code>POST /api/publish</code>
              <span>→ 返回可分享 URL</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 痛点区 ===== */}
      <section className="section">
        <div className="section-inner">
          <h2 className="section-title">你是否遇到过这些痛点？</h2>
          <div className="pain-grid">
            <div className="pain-card">
              <div className="pain-emoji">🕳️</div>
              <h3>数字黑洞</h3>
              <p>AI 输出的内容困在对话历史，需要手动复制粘贴整理才能分享。</p>
            </div>
            <div className="pain-card">
              <div className="pain-emoji">🔗</div>
              <h3>分享门槛</h3>
              <p>Markdown 写好了，但发给他人时对方在手机上排版错乱、看不清。</p>
            </div>
            <div className="pain-card">
              <div className="pain-emoji">📚</div>
              <h3>内容散落</h3>
              <p>多 Agent 多对话产出的内容碎片化，缺乏统一的个人内容仓库。</p>
            </div>
            <div className="pain-card">
              <div className="pain-emoji">⏰</div>
              <h3>无法触达</h3>
              <p>AI 产出了但你不知道，要主动"上线查看"，缺乏主动通知机制。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 解决方案 ===== */}
      <section className="section section-alt">
        <div className="section-inner">
          <h2 className="section-title">MD-Beautify 如何解决</h2>
          <div className="solution-flow">
            <div className="flow-step">
              <div className="flow-num">1</div>
              <h3>在 AI Agent 中调用</h3>
              <p>通过 OpenClaw / WorkBuddy 等 Agent 框架安装 Skill</p>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <div className="flow-num">2</div>
              <h3>一键发布</h3>
              <p>传入 Markdown 文本，自动渲染为精美 HTML 页面</p>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <div className="flow-num">3</div>
              <h3>短链直达</h3>
              <p>返回形如 <code>md-beautify.com/p/abc</code> 的可分享链接</p>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <div className="flow-num">4</div>
              <h3>移动端优先</h3>
              <p>对方在微信/手机浏览器打开，自动适配最佳阅读布局</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 核心特性 ===== */}
      <section className="section">
        <div className="section-inner">
          <h2 className="section-title">核心特性</h2>
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon">🤖</div>
              <h3>AI Agent 原生</h3>
              <p>非编辑器、非博客平台。内容从 Agent 来，零人工干预。</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📱</div>
              <h3>Mobile-First</h3>
              <p>默认移动端布局渲染，PC 端自动升级为多栏宽版。</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔑</div>
              <h3>API 密钥认证</h3>
              <p>每个用户独立的 API Key，AI Agent 通过 <code>X-API-Key</code> 头调用。</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📂</div>
              <h3>个人空间</h3>
              <p>注册即拥有独立空间，按时间维度（今日/所有）浏览。</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🎨</div>
              <h3>代码高亮</h3>
              <p>10+ 编程语言自动高亮，表格、引用、列表等富文本完整支持。</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <h3>内容可私密</h3>
              <p>未配置密钥时发布的内容归为"公开"，登录后默认仅自己可见。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 接入方式 ===== */}
      <section className="section section-alt">
        <div className="section-inner">
          <h2 className="section-title">3 步接入 AI Agent</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">01</div>
              <h3>注册账号</h3>
              <p>邮箱注册即用，无需审核。</p>
            </div>
            <div className="step-card">
              <div className="step-num">02</div>
              <h3>生成 API 密钥</h3>
              <p>在"设置 → API 密钥"中创建，复制明文（仅显示一次）。</p>
            </div>
            <div className="step-card">
              <div className="step-num">03</div>
              <h3>配置 Agent</h3>
              <p>将密钥填入 Skill 配置，即可让 AI 一键发布。</p>
            </div>
          </div>

          <div className="code-block">
            <div className="code-label">示例：AI Agent 调用</div>
            <pre>{`# Skill 调用（环境变量方式）
export MD_BEAUTIFY_API_KEY="md_xxxxx..."

# Agent 在对话中识别"发布到 MD-Beautify"后自动执行:
const result = await skill.execute('publish', {
  content: '# Q2 市场分析\\n\\n报告正文...',
  title: 'Q2 市场分析',
  tags: ['analysis', 'q2']
});
// → { success: true, url: 'https://...', ... }`}</pre>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="cta-section">
        <div className="section-inner">
          <h2>立即开始使用</h2>
          <p>几秒钟注册，永久拥有你的 AI 内容空间</p>
          <div className="hero-actions">
            {isLoggedIn ? (
              <Link to="/my" className="btn-primary-lg">📂 进入我的空间</Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary-lg">免费注册</Link>
                <Link to="/login" className="btn-secondary-lg">已有账号</Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
