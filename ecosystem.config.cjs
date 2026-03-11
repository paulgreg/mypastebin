module.exports = {
  apps: [
    {
      name: 'my-pastebin',
      script: 'dist/server/index.mjs',
      max_memory_restart: '128M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

