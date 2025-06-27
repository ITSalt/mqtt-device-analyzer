// transports/ws-transport.js - MQTT over WebSocket транспорт
const http = require('http');
const ws = require('websocket-stream');
const BaseTransport = require('./base-transport');

class WSTransport extends BaseTransport {
  constructor(port, config, aedes) {
    super('WebSocket', port, config);
    this.aedes = aedes;
    this.httpServer = null;
  }

  async initializeServer() {
    // Создаем HTTP сервер
    this.httpServer = http.createServer();
    
    // Создаем WebSocket сервер поверх HTTP
    this.server = ws.createServer({ 
      server: this.httpServer 
    }, this.aedes.handle);

    this.httpServer.on('connection', (socket) => {
      const clientId = `ws_${socket.remoteAddress}_${socket.remotePort}_${Date.now()}`;
      
      socket.on('error', (error) => {
        this.logError(error, `WebSocket connection from ${socket.remoteAddress}`);
        this.onClientDisconnected(clientId);
      });

      socket.on('close', () => {
        this.onClientDisconnected(clientId);
      });

      this.onClientConnected(clientId, socket);
    });

    this.httpServer.on('error', (error) => {
      this.logError(error, 'WebSocket HTTP server error');
      this.emit('error', error);
    });

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, (error) => {
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
          console.log(`🌐 WebSocket сервер закрыт`);
          resolve();
        });
      }));
    }
    
    if (this.httpServer) {
      promises.push(new Promise((resolve) => {
        this.httpServer.close(() => {
          console.log(`🌐 HTTP сервер для WebSocket на порту ${this.port} закрыт`);
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
      protocol: 'ws',
      secure: false,
      description: 'MQTT over WebSocket'
    };
  }
}

module.exports = WSTransport; 