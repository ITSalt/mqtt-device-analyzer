// transports/base-transport.js - Базовый класс для транспортов
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class BaseTransport extends EventEmitter {
  constructor(name, port, config) {
    super();
    this.name = name;
    this.port = port;
    this.config = config;
    this.configData = config.get(); // Получаем данные конфигурации
    this.server = null;
    this.isRunning = false;
    this.connections = new Map();
    this.stats = {
      connectionsTotal: 0,
      connectionsActive: 0,
      messagesReceived: 0,
      bytesReceived: 0,
      startTime: null
    };
  }

  async start() {
    if (this.isRunning) {
      console.log(`⚠️  ${this.name} уже запущен на порту ${this.port}`);
      return;
    }

    try {
      await this.initializeServer();
      this.isRunning = true;
      this.stats.startTime = new Date();
      console.log(`✅ ${this.name} запущен на порту ${this.port}`);
      this.emit('started', { transport: this.name, port: this.port });
    } catch (error) {
      console.error(`❌ Ошибка запуска ${this.name}:`, error.message);
      this.emit('error', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.closeServer();
      this.isRunning = false;
      console.log(`🛑 ${this.name} остановлен`);
      this.emit('stopped', { transport: this.name });
    } catch (error) {
      console.error(`❌ Ошибка остановки ${this.name}:`, error.message);
      this.emit('error', error);
    }
  }

  // Абстрактные методы для переопределения в наследуемых классах
  async initializeServer() {
    throw new Error('initializeServer() должен быть реализован в наследуемом классе');
  }

  async closeServer() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }

  // Обработчики подключений
  onClientConnected(clientId, connection) {
    this.connections.set(clientId, {
      connection,
      connectedAt: new Date(),
      transport: this.name
    });
    
    this.stats.connectionsTotal++;
    this.stats.connectionsActive++;
    
    this.logConnection('CONNECT', clientId);
    this.emit('clientConnected', { clientId, transport: this.name });
  }

  onClientDisconnected(clientId) {
    if (this.connections.has(clientId)) {
      const connectionInfo = this.connections.get(clientId);
      this.connections.delete(clientId);
      this.stats.connectionsActive--;
      
      this.logConnection('DISCONNECT', clientId);
      this.emit('clientDisconnected', { clientId, transport: this.name });
    }
  }

  onMessageReceived(clientId, message) {
    this.stats.messagesReceived++;
    this.stats.bytesReceived += message.payload ? message.payload.length : 0;
    
    // Добавляем информацию о транспорте к сообщению
    const enrichedMessage = {
      ...message,
      transport: this.name,
      transportPort: this.port
    };
    
    this.emit('messageReceived', { clientId, message: enrichedMessage });
  }

  // Логирование
  logConnection(action, clientId) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} | ${action} | Transport: ${this.name} | Port: ${this.port} | Client: ${clientId}\n`;
      
      fs.appendFileSync(
        path.join(this.configData.logging.directory, 'connections.log'),
        logEntry
      );
    } catch (error) {
      console.error(`❌ Ошибка логирования подключения в ${this.name}:`, error.message);
    }
  }

  logError(error, context = '') {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} | ERROR | Transport: ${this.name} | Context: ${context} | Error: ${error.message}\n`;
      
      fs.appendFileSync(
        path.join(this.configData.logging.directory, 'errors.log'),
        logEntry
      );
    } catch (logError) {
      console.error(`❌ Ошибка логирования ошибки в ${this.name}:`, logError.message);
    }
  }

  // Получение статистики
  getStats() {
    return {
      ...this.stats,
      name: this.name,
      port: this.port,
      isRunning: this.isRunning,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0
    };
  }

  // Проверка работоспособности
  async healthCheck() {
    return {
      name: this.name,
      port: this.port,
      status: this.isRunning ? 'running' : 'stopped',
      connections: this.stats.connectionsActive,
      uptime: this.getStats().uptime
    };
  }
}

module.exports = BaseTransport; 