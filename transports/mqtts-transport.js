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
      console.error(`🔐 MQTTS TLS ошибка от ${socket.remoteAddress}:`, error.message);
      this.logError(error, `TLS client error from ${socket.remoteAddress}`);
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