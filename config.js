// config.js - Конфигурация MQTT брокера
const fs = require('fs');
const path = require('path');

class BrokerConfig {
  constructor() {
    this.config = {
      // Порты для различных протоколов
      ports: {
        mqtt: parseInt(process.env.MQTT_PORT) || 1883,
        mqtts: parseInt(process.env.MQTTS_PORT) || 8883,
        ws: parseInt(process.env.WS_PORT) || 8887,
        wss: parseInt(process.env.WSS_PORT) || 8888,
        health: parseInt(process.env.HEALTH_PORT) || 3001
      },

      // SSL/TLS конфигурация
      ssl: {
        enabled: process.env.SSL_ENABLED === 'true' || false,
        keyPath: process.env.SSL_KEY_PATH || './certs/server.key',
        certPath: process.env.SSL_CERT_PATH || './certs/server.crt',
        caPath: process.env.SSL_CA_PATH || null,
        rejectUnauthorized: process.env.SSL_REJECT_UNAUTHORIZED !== 'false'
      },

      // Домен для развертывания
      domain: {
        name: process.env.MQTT_DOMAIN || 'localhost',
        country: process.env.SSL_COUNTRY || 'US',
        state: process.env.SSL_STATE || 'California',
        city: process.env.SSL_CITY || 'San Francisco',
        organization: process.env.SSL_ORG || 'MQTT Device Analyzer',
        organizationalUnit: process.env.SSL_OU || 'IT Department'
      },

      // Протоколы для включения/отключения
      protocols: {
        mqtt: process.env.ENABLE_MQTT !== 'false',
        mqtts: process.env.ENABLE_MQTTS !== 'false',
        ws: process.env.ENABLE_WS !== 'false',
        wss: process.env.ENABLE_WSS !== 'false'
      },

      // Настройки брокера
      broker: {
        heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 60000,
        connectTimeout: parseInt(process.env.CONNECT_TIMEOUT) || 30000,
        maxConnections: parseInt(process.env.MAX_CONNECTIONS) || 1000
      },

      // Настройки логирования
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        directory: process.env.LOG_DIR || './mqtt_logs',
        rotateSize: process.env.LOG_ROTATE_SIZE || '10MB',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 10
      }
    };

    this.createDirectories();
    this.validateConfig();
  }

  createDirectories() {
    // Создаем директории если их нет
    const dirs = [
      this.config.logging.directory,
      './certs'
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Создана директория: ${dir}`);
      }
    });
  }

  validateConfig() {
    // Проверяем SSL сертификаты если SSL включен
    if (this.config.ssl.enabled || this.config.protocols.mqtts || this.config.protocols.wss) {
      if (!this.checkSSLCertificates()) {
        console.warn('⚠️  SSL сертификаты не найдены, создаю самоподписанные...');
        this.generateSelfSignedCertificates();
      }
    }
  }

  checkSSLCertificates() {
    return fs.existsSync(this.config.ssl.keyPath) && 
           fs.existsSync(this.config.ssl.certPath);
  }

  generateSelfSignedCertificates() {
    const { execSync } = require('child_process');
    
    try {
      // Создаем самоподписанный сертификат
      const certDir = path.dirname(this.config.ssl.certPath);
      
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
      }

      const opensslCmd = `openssl req -x509 -newkey rsa:4096 -keyout ${this.config.ssl.keyPath} -out ${this.config.ssl.certPath} -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;
      
      execSync(opensslCmd, { stdio: 'pipe' });
      console.log('✅ Самоподписанные SSL сертификаты созданы');
      
    } catch (error) {
      console.error('❌ Ошибка создания SSL сертификатов:', error.message);
      console.log('💡 Для создания сертификатов вручную используйте:');
      console.log(`   openssl req -x509 -newkey rsa:4096 -keyout ${this.config.ssl.keyPath} -out ${this.config.ssl.certPath} -days 365 -nodes`);
      
      // Отключаем SSL протоколы если сертификаты недоступны
      this.config.protocols.mqtts = false;
      this.config.protocols.wss = false;
    }
  }

  getSSLOptions() {
    if (!this.checkSSLCertificates()) {
      return null;
    }

    const options = {
      key: fs.readFileSync(this.config.ssl.keyPath),
      cert: fs.readFileSync(this.config.ssl.certPath)
    };

    if (this.config.ssl.caPath && fs.existsSync(this.config.ssl.caPath)) {
      options.ca = fs.readFileSync(this.config.ssl.caPath);
    }

    if (!this.config.ssl.rejectUnauthorized) {
      options.rejectUnauthorized = false;
    }

    return options;
  }

  get() {
    return this.config;
  }

  getPort(protocol) {
    return this.config.ports[protocol];
  }

  isProtocolEnabled(protocol) {
    return this.config.protocols[protocol];
  }

  displayConfiguration() {
    console.log('\n🔧 Конфигурация MQTT брокера:');
    console.log(`   🌐 Домен: ${this.config.domain.name}`);
    console.log('   📡 Протоколы:');
    
    Object.entries(this.config.protocols).forEach(([protocol, enabled]) => {
      const port = this.config.ports[protocol];
      const status = enabled ? '✅' : '❌';
      const secure = (protocol === 'mqtts' || protocol === 'wss') ? '🔐' : '';
      console.log(`   ${status} ${secure} ${protocol.toUpperCase()}: ${enabled ? `${this.config.domain.name}:${port}` : 'отключен'}`);
    });

    console.log(`\n   🔐 SSL: ${this.config.ssl.enabled ? '✅ включен' : '❌ отключен'}`);
    console.log(`   📁 Логи: ${this.config.logging.directory}`);
    console.log(`   🏥 Health Check: http://${this.config.domain.name}:${this.config.ports.health}/health`);
  }
}

module.exports = new BrokerConfig(); 