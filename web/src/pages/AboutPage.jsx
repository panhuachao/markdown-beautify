import './AboutPage.css';

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="container">
        <h1>关于 MD-Beautify</h1>

        <section className="card">
          <h2>这是什么？</h2>
          <p>
            MD-Beautify 是一个<strong>AI Agent 内容展示与分享平台</strong>。
            通过 OpenClaw / WorkBuddy 等 Agent 框架安装 Skill，将 AI 生成的
            Markdown 一键发布，获得可分享的移动端优先渲染网页。
          </p>
        </section>

        <section className="card">
          <h2>工作流程</h2>
          <ol>
            <li>在 AI Agent 中调用 <code>md-beautify</code> Skill</li>
            <li>传入 Markdown 内容（可附标题、标签）</li>
            <li>系统返回 <code>/p/{'{slug}'}</code> 形式的短链接</li>
            <li>用户通过手机/PC 浏览器访问，实时渲染为精美页面</li>
          </ol>
        </section>

        <section className="card">
          <h2>技术栈</h2>
          <ul>
            <li>前端：React 18 + Vite 5 + React Router 6</li>
            <li>后端：Node.js + Express + marked + highlight.js</li>
            <li>存储：本地文件系统（MVP）</li>
            <li>样式：Mobile-First 响应式 CSS（&lt;768px 单列 / ≥768px 多栏）</li>
          </ul>
        </section>

        <section className="card">
          <h2>API 端点</h2>
          <ul className="api-list">
            <li><code>GET    /api/contents</code> — 列出所有内容</li>
            <li><code>GET    /api/contents/:slug</code> — 内容详情（含渲染 HTML）</li>
            <li><code>POST   /api/publish</code> — 发布 Markdown</li>
            <li><code>DELETE /api/contents/:slug</code> — 删除内容</li>
            <li><code>GET    /health</code> — 健康检查</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
