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
      console.error(`🔐 WSS TLS ошибка от ${socket.remoteAddress}:`, error.message);
      this.logError(error, `TLS client error from ${socket.remoteAddress}`);
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