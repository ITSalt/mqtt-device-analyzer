// transports/mqtt-transport.js - MQTT over TCP транспорт
const net = require('net');
const BaseTransport = require('./base-transport');

class MQTTTransport extends BaseTransport {
  constructor(port, config, aedes) {
    super('MQTT', port, config);
    this.aedes = aedes;
  }

  async initializeServer() {
    this.server = net.createServer(this.aedes.handle);
    
    this.server.on('connection', (socket) => {
      const clientId = `mqtt_${socket.remoteAddress}_${socket.remotePort}_${Date.now()}`;
      
      socket.on('error', (error) => {
        this.logError(error, `TCP connection from ${socket.remoteAddress}`);
        this.onClientDisconnected(clientId);
      });

      socket.on('close', () => {
        this.onClientDisconnected(clientId);
      });

      // Регистрируем подключение
      this.onClientConnected(clientId, socket);
    });

    this.server.on('error', (error) => {
      this.logError(error, 'TCP server error');
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
          console.log(`🔌 MQTT TCP сервер на порту ${this.port} закрыт`);
          resolve();
        });
      });
    }
  }

  async healthCheck() {
    const baseHealth = await super.healthCheck();
    
    return {
      ...baseHealth,
      protocol: 'mqtt',
      secure: false,
      description: 'Standard MQTT over TCP'
    };
  }
}

module.exports = MQTTTransport; 