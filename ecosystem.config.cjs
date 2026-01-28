module.exports = {
  apps: [
    {
      name: 'magicodex-api',
      cwd: '/var/www/magicodex/backend',
      script: 'dist/server.js',
      instances: '1',  // Utilise tous les CPU disponibles (mode cluster)
      exec_mode: 'fork',
      
      // Variables d'environnement
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // Gestion des logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/magicodex/error.log',
      out_file: '/var/log/magicodex/out.log',
      merge_logs: true,
      
      // Gestion de la mémoire
      max_memory_restart: '500M',
      
      // Redémarrage automatique
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000
    }
  ]
};
