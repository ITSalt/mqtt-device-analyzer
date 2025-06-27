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
      
      // Домен (обязательно для продакшена)
      MQTT_DOMAIN: process.env.MQTT_DOMAIN || 'localhost',
      SSL_COUNTRY: process.env.SSL_COUNTRY || 'US',
      SSL_STATE: process.env.SSL_STATE || 'California', 
      SSL_CITY: process.env.SSL_CITY || 'San Francisco',
      SSL_ORG: process.env.SSL_ORG || 'MQTT Device Analyzer',
      SSL_OU: process.env.SSL_OU || 'IT Department',
      
      // Порты
      MQTT_PORT: process.env.MQTT_PORT || 1883,
      MQTTS_PORT: process.env.MQTTS_PORT || 8883,
      WS_PORT: process.env.WS_PORT || 8887,
      WSS_PORT: process.env.WSS_PORT || 8888,
      HEALTH_PORT: process.env.HEALTH_PORT || 3001,
      
      // Протоколы (включены по умолчанию)
      ENABLE_MQTT: process.env.ENABLE_MQTT || 'true',
      ENABLE_MQTTS: process.env.ENABLE_MQTTS || 'true', 
      ENABLE_WS: process.env.ENABLE_WS || 'true',
      ENABLE_WSS: process.env.ENABLE_WSS || 'true',
      
      // SSL настройки
      SSL_ENABLED: process.env.SSL_ENABLED || 'true',
      SSL_KEY_PATH: process.env.SSL_KEY_PATH || './certs/server.key',
      SSL_CERT_PATH: process.env.SSL_CERT_PATH || './certs/server.crt',
      SSL_REJECT_UNAUTHORIZED: process.env.SSL_REJECT_UNAUTHORIZED || 'false',
      
      // Логирование
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      LOG_DIR: process.env.LOG_DIR || './mqtt_logs'
    },
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      
      // В разработке можно отключить SSL протоколы
      ENABLE_MQTTS: 'false',
      ENABLE_WSS: 'false',
      SSL_ENABLED: 'false'
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