module.exports = {
  apps: [{
    name: 'old-z-api',
    script: 'tsx',
    args: 'api/server.ts',
    cwd: '/www/wwwroot/old-z',
    interpreter: 'none',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/www/wwwlogs/old-z-error.log',
    out_file: '/www/wwwlogs/old-z-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
