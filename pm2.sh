NODE_ENV=production pm2 start dist/server/index.mjs --name 'my-pastebin' --max-memory-restart 128M
