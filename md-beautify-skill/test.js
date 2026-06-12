/**
 * MD-Beautify Skill 测试脚本
 *
 * 使用方法：
 *   1. 先启动后端服务: cd backend && npm install && npm start
 *   2. 再运行此脚本: node md-beautify-skill/test.js
 *
 * 模拟 AI Agent 调用 publish action，验证整个发布链路。
 */

const skill = require('./index.js');

(async () => {
  console.log('='.repeat(60));
  console.log('MD-Beautify Skill - 端到端测试');
  console.log('='.repeat(60));
  console.log('\n[1] Skill manifest:');
  console.log(JSON.stringify(skill.manifest(), null, 2));

  console.log('\n[2] 执行 publish action...');
  const result = await skill.execute('publish', {
    title: '测试内容 · Hello MD-Beautify',
    content: `# 测试内容 · Hello MD-Beautify

这是一份**测试 Markdown**，用于验证 MVP 发布链路是否通畅。

## 功能验证

- [x] 接收 Markdown
- [x] 存储到服务器目录
- [x] 实时渲染为 HTML
- [x] 返回分享链接
- [ ] 数据库支持（暂未实现）

## 代码高亮

\`\`\`javascript
const skill = require('md-beautify-skill');
const result = await skill.execute('publish', {
  content: '# Hello'
});
console.log(result.url);
\`\`\`

## 表格示例

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| A1  | B1  | C1  |
| A2  | B2  | C2  |

## 引用

> MD-Beautify 致力于消除 AI 对话产出的"数字黑洞"。

---

🎉 访问返回的 URL 查看渲染效果！`,
    tags: ['test', 'mvp', 'demo']
  });

  console.log('\n[3] 发布结果:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n✅ 测试通过！请在浏览器中打开链接查看:');
    console.log(`   ${result.url}\n`);
  } else {
    console.log('\n❌ 测试失败');
    if (result.hint) console.log(`   💡 ${result.hint}\n`);
    process.exit(1);
  }
})();
