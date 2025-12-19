module.exports = {
  apps: [
    {
      name: 'vendai-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/home/u920217121/domains/vendai.com.br/public_html/Appvendai',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'vendai-admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: '/home/u920217121/domains/vendai.com.br/public_html/adminVendai',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
