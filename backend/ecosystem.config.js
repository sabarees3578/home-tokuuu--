module.exports = {
  apps: [
    {
      name: 'home-security-system',
      cwd: '/home/ubuntu/home/backend',
      script: './server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/home/ubuntu/.pm2/logs/home-security-system-error.log',
      out_file: '/home/ubuntu/.pm2/logs/home-security-system-out.log',
      time: true
    }
  ]
};