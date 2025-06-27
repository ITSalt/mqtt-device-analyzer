// transports/mqtts-transport.js - MQTT over TLS/SSL транспорт
const tls = require('tls');
const BaseTransport = require('./base-transport');

class MQTTSTransport extends BaseTransport {
  constructor(port, config, aedes) {
    super('MQTTS', port, config);
    this.aedes = aedes;
    this.sslOptions = null;
  }

  async initializeServer() {
    // Получаем SSL опции из конфигурации
    this.sslOptions = this.config.getSSLOptions();
    
    if (!this.sslOptions) {
      throw new Error('SSL сертификаты не найдены или недоступны для MQTTS');
    }

    this.server = tls.createServer(this.sslOptions, (socket) => {
      // Пропускаем TLS соединение через aedes
      this.aedes.handle(socket);
    });

    this.server.on('secureConnection', (socket) => {
      const clientId = `mqtts_${socket.remoteAddress}_${socket.remotePort}_${Date.now()}`;
      
      console.log(`🔐 Безопасное MQTTS подключение от ${socket.remoteAddress}:${socket.remotePort}`);
      
      // Информация о TLS соединении
      const cipher = socket.getCipher();
      const cert = socket.getPeerCertificate();
      
      console.log(`   Шифр: ${cipher.name}/${cipher.version}`);
      if (cert && cert.subject) {
        console.log(`   Сертификат клиента: ${cert.subject.CN || 'N/A'}`);
      }

      socket.on('error', (error) => {
        this.logError(error, `MQTTS connection from ${socket.remoteAddress}`);
        this.onClientDisconnected(clientId);
      });

      socket.on('close', () => {
        this.onClientDisconnected(clientId);
      });

      this.onClientConnected(clientId, socket);
    });

    this.server.on('tlsClientError', (error, socket) => {
      const clientIP = socket.remoteAddress;
      console.error(`🔐 MQTTS TLS ошибка от ${clientIP}:`, error.message);
      
      // Детальная информация об ошибке
      if (error.message.includes('certificate unknown')) {
        console.error(`   💡 Подсказка: Клиент не доверяет SSL сертификату.`);
        console.error(`   💡 Возможно, нужно пересоздать сертификат для домена или использовать --insecure`);
      }
      
      this.logError(error, `TLS client error from ${clientIP} - ${this.getTLSErrorHint(error.message)}`);
    });

    this.server.on('error', (error) => {
      this.logError(error, 'MQTTS server error');
      this.emit('error', error);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async closeServer() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log(`🔐 MQTTS TLS сервер на порту ${this.port} закрыт`);
          resolve();
        });
      });
    }
  }

  getTLSErrorHint(errorMessage) {
    if (errorMessage.includes('certificate unknown')) {
      return 'Certificate not trusted by client';
    } else if (errorMessage.includes('handshake failure')) {
      return 'TLS handshake failed';
    } else if (errorMessage.includes('certificate verify failed')) {
      return 'Certificate verification failed';
    } else if (errorMessage.includes('unknown ca')) {
      return 'Certificate Authority unknown';
    } else {
      return 'SSL/TLS error';
    }
  }

  async healthCheck() {
    const baseHealth = await super.healthCheck();
    
    return {
      ...baseHealth,
      protocol: 'mqtts',
      secure: true,
      description: 'MQTT over TLS/SSL',
      sslInfo: this.sslOptions ? {
        certificatePresent: true,
        keyPresent: true
      } : null
    };
  }
}

module.exports = MQTTSTransport; 