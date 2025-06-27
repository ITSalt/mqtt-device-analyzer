// transports/wss-transport.js - MQTT over WebSocket Secure транспорт
const https = require('https');
const ws = require('websocket-stream');
const BaseTransport = require('./base-transport');

class WSSTransport extends BaseTransport {
  constructor(port, config, aedes) {
    super('WebSocket Secure', port, config);
    this.aedes = aedes;
    this.httpsServer = null;
    this.sslOptions = null;
  }

  async initializeServer() {
    // Получаем SSL опции из конфигурации
    this.sslOptions = this.config.getSSLOptions();
    
    if (!this.sslOptions) {
      throw new Error('SSL сертификаты не найдены или недоступны для WSS');
    }

    // Создаем HTTPS сервер
    this.httpsServer = https.createServer(this.sslOptions);
    
    // Создаем WebSocket Secure сервер поверх HTTPS
    this.server = ws.createServer({ 
      server: this.httpsServer 
    }, this.aedes.handle);

    this.httpsServer.on('secureConnection', (socket) => {
      const clientId = `wss_${socket.remoteAddress}_${socket.remotePort}_${Date.now()}`;
      
      console.log(`🔐 Безопасное WSS подключение от ${socket.remoteAddress}:${socket.remotePort}`);
      
      // Информация о TLS соединении
      const cipher = socket.getCipher();
      const cert = socket.getPeerCertificate();
      
      console.log(`   Шифр: ${cipher.name}/${cipher.version}`);
      if (cert && cert.subject) {
        console.log(`   Сертификат клиента: ${cert.subject.CN || 'N/A'}`);
      }

      socket.on('error', (error) => {
        this.logError(error, `WSS connection from ${socket.remoteAddress}`);
        this.onClientDisconnected(clientId);
      });

      socket.on('close', () => {
        this.onClientDisconnected(clientId);
      });

      this.onClientConnected(clientId, socket);
    });

    this.httpsServer.on('tlsClientError', (error, socket) => {
      const clientIP = socket.remoteAddress;
      console.error(`🔐 WSS TLS ошибка от ${clientIP}:`, error.message);
      
      // Детальная информация об ошибке
      if (error.message.includes('certificate unknown')) {
        console.error(`   💡 Подсказка: Клиент не доверяет SSL сертификату.`);
        console.error(`   💡 Возможно, нужно пересоздать сертификат для домена или использовать --insecure`);
      }
      
      this.logError(error, `TLS client error from ${clientIP} - ${this.getTLSErrorHint(error.message)}`);
    });

    this.httpsServer.on('error', (error) => {
      this.logError(error, 'WSS HTTPS server error');
      this.emit('error', error);
    });

    return new Promise((resolve, reject) => {
      this.httpsServer.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async closeServer() {
    const promises = [];
    
    if (this.server) {
      promises.push(new Promise((resolve) => {
        this.server.close(() => {
          console.log(`🔐 WSS сервер закрыт`);
          resolve();
        });
      }));
    }
    
    if (this.httpsServer) {
      promises.push(new Promise((resolve) => {
        this.httpsServer.close(() => {
          console.log(`🔐 HTTPS сервер для WSS на порту ${this.port} закрыт`);
          resolve();
        });
      }));
    }
    
    return Promise.all(promises);
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
      protocol: 'wss',
      secure: true,
      description: 'MQTT over WebSocket Secure',
      sslInfo: this.sslOptions ? {
        certificatePresent: true,
        keyPresent: true
      } : null
    };
  }
}

module.exports = WSSTransport; 