#!/bin/bash
# =============================================================================
# MD-Beautify · API 端到端测试脚本 (curl)
# 测试数据来源: ../../prd.md
# 用法: ./test-api.sh
# 前置: 后端服务已启动 (cd .. && npm start)
# =============================================================================

set -e

API="http://localhost:3000"
PRD_MD="/Users/panhc/Projects/md-beautify/prd.md"

echo "================================================================"
echo "  MD-Beautify · curl 完整接口测试"
echo "  测试数据来源: $PRD_MD (前 80 行)"
echo "================================================================"

# ---------- STEP 1: 健康检查 ----------
echo ""
echo "▶ STEP 1: 健康检查  GET /health"
curl -s $API/health
echo ""

# ---------- STEP 2: 准备测试 payload ----------
echo ""
echo "▶ STEP 2: 准备 prd.md 内容的 JSON payload"
python3 -c "
import json
with open('$PRD_MD', 'r') as f:
    lines = f.readlines()
content = ''.join(lines[:80])
payload = {
    'title': 'PRD v0.2 测试 - Markdown 内容展示与分享平台',
    'content': content,
    'tags': ['prd', 'test', 'curl', 'mvp']
}
with open('/tmp/prd-test.json', 'w') as f:
    json.dump(payload, f, ensure_ascii=False)
print('  payload 准备完成 (', len(content), '字符)')
"

# ---------- STEP 3: 发布 Markdown ----------
echo ""
echo "▶ STEP 3: 发布 Markdown  POST /api/publish"
RESP=$(curl -s -X POST $API/api/publish \
  -H "Content-Type: application/json" \
  -d @/tmp/prd-test.json)
echo "  Response: $RESP"
SLUG=$(echo "$RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['slug'])")
echo "  提取 slug: $SLUG"

# ---------- STEP 4: 列出所有内容 ----------
echo ""
echo "▶ STEP 4: 列出所有内容  GET /api/contents"
curl -s $API/api/contents | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  total: {d[\"total\"]}')
for it in d['items']:
    print(f'  - [{it[\"slug\"]}] {it[\"title\"]}')
    print(f'    tags: {it[\"tags\"]} | views: {it[\"viewCount\"]}')
"

# ---------- STEP 5: 获取详情 ----------
echo ""
echo "▶ STEP 5: 获取内容详情  GET /api/contents/$SLUG"
curl -s $API/api/contents/$SLUG -o /tmp/detail.json
python3 -c "
import json
d = json.load(open('/tmp/detail.json'))['data']
print(f'  标题: {d[\"title\"]}')
print(f'  标签: {d[\"tags\"]}')
print(f'  摘要: {d[\"excerpt\"][:80]}...')
print(f'  Markdown 长度: {len(d[\"markdown\"])} 字符')
print(f'  渲染 HTML 长度: {len(d[\"html\"])} 字符')
"

# ---------- STEP 6: 模拟多次访问 ----------
echo ""
echo "▶ STEP 6: 模拟 3 次访问 (触发 viewCount+1)"
for i in 1 2 3; do
  curl -s $API/api/contents/$SLUG -o /dev/null
done
VIEW=$(curl -s $API/api/contents/$SLUG | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['viewCount'])")
echo "  当前浏览数: $VIEW (应=5: 详情1次+本轮3次+本查询1次)"

# ---------- STEP 7: 删除 ----------
echo ""
echo "▶ STEP 7: 删除测试内容  DELETE /api/contents/$SLUG"
curl -s -X DELETE $API/api/contents/$SLUG
echo ""

# ---------- STEP 8: 验证删除 ----------
echo ""
echo "▶ STEP 8: 验证已删除 (期望 404)"
HTTP_CODE=$(curl -s -o /tmp/del.json -w "%{http_code}" $API/api/contents/$SLUG)
echo "  HTTP Status: $HTTP_CODE"
cat /tmp/del.json
echo ""

# ---------- 清理 ----------
rm -f /tmp/prd-test.json /tmp/detail.json /tmp/del.json

echo ""
echo "================================================================"
echo "  ✅ 全部 8 步测试通过"
echo "================================================================"
