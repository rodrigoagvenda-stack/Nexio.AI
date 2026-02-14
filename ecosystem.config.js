/**
 * Configuração PM2 para produção no VPS
 *
 * Para usar:
 * 1. pm2 start ecosystem.config.js
 * 2. pm2 save
 * 3. pm2 startup (para iniciar automaticamente no boot)
 */

module.exports = {
  apps: [
    {
      name: 'nexio-crm',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 2, // Cluster mode - 2 instâncias sempre rodando
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Auto restart em caso de crash
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Keep-alive
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],
};
