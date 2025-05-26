module.exports = {
  apps: [{
    name: 'mqtt-device-analyzer',
    script: './mqtt-broker.js',
    instances: 1,
    exec_mode: 'fork',

    // Автоматический перезапуск
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    restart_delay: 4000,

    // Переменные окружения
    env: {
      NODE_ENV: 'production',
      MQTT_PORT: 1883,
      WS_PORT: 8887,
      LOG_LEVEL: 'info'
    },
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug'
    },

    // Логирование
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true,

    // Дополнительные настройки
    min_uptime: '10s',
    listen_timeout: 3000,
    kill_timeout: 5000,

    // Мониторинг
    instance_var: 'INSTANCE_ID',

    // Обработка сигналов
    shutdown_with_message: true,
    wait_ready: true,

    // События жизненного цикла
    post_update: ['npm install'],

    // Интеграция с системой
    cron_restart: '0 2 * * *', // Перезапуск каждую ночь в 2:00
  }, {
      name: 'mqtt-health-check',
      script: './health-check.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      error_file: './logs/health-check-error.log',
      out_file: './logs/health-check-out.log',
    }],

  // Деплой конфигурация (опционально)
  deploy: {
    production: {
      user: 'node',
      host: '212.193.59.18',
      ref: 'origin/main',
      repo: 'https://github.com/ITSalt/mqtt-device-analyzer.git',
      path: '/var/www/mqtt-analyzer',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production server"'
    }
  }
};