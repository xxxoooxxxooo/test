module.exports = {
  apps: [
    {
      name: 'crevas-ai',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
