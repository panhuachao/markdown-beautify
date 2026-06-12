npm run build
scp -r dist/assets root@47.113.101.234:/usr/share/nginx/markdown-beautify/
scp dist/*.* root@47.113.101.234:/usr/share/nginx/markdown-beautify/