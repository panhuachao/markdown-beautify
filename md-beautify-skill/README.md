# MD-Beautify Skill

> AI Agent Skill · 用于 OpenClaw / WorkBuddy / Claude Code / Cursor 等框架

## 作用

将 AI Agent 生成的 Markdown 一键发布到 MD-Beautify 平台，返回可分享的网页链接。

## 文件

- `skill.json` - Skill 清单（框架通过此文件发现 Skill）
- `index.js` - Skill 入口，导出 `execute(action, params)` 方法
- `test.js` - 端到端测试脚本

## 接入步骤（以 OpenClaw 为例）

1. 将 `md-beautify-skill/` 复制到 OpenClaw 的 skills 目录
2. 框架读取 `skill.json` 中的 `triggers`（如 "发布到 MD-Beautify"）注册命令
3. 框架在用户对话中识别触发词后，调用 `index.js` 的 `execute('publish', {...})`

## 配置

通过 `skill.json` 的 `config` 字段配置后端地址：

```json
"config": {
  "apiBaseUrl": {
    "type": "string",
    "default": "http://localhost:3000"
  }
}
```

生产环境需修改为实际后端地址（如 `https://api.md-beautify.com`）。

## 测试

```bash
node test.js
```

输出示例：
```
[md-beautify] Publishing "..." to http://localhost:3000/api/publish...
[md-beautify] ✅ Published!
[md-beautify]    URL: http://localhost:3000/p/a1b2c3d4
```

## 调用协议

### Action: `publish`

**输入参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | ✅ | Markdown 文本 |
| title | string | ❌ | 标题，不传则从第一个 H1 自动提取 |
| tags | string[] | ❌ | 标签数组 |

**返回：**

```json
{
  "success": true,
  "contentId": "a1b2c3d4",
  "url": "http://localhost:3000/p/a1b2c3d4",
  "title": "标题",
  "createdAt": "2026-06-12T..."
}
```

Agent 在对话中拿到 `url` 后，可直接呈现给用户作为"已发布"的反馈。
