// transport-manager.js - Менеджер всех транспортов
const EventEmitter = require('events');
const MQTTTransport = require('./transports/mqtt-transport');
const MQTTSTransport = require('./transports/mqtts-transport');
const WSTransport = require('./transports/ws-transport');
const WSSTransport = require('./transports/wss-transport');

class TransportManager extends EventEmitter {
  constructor(config, aedes) {
    super();
    this.config = config;
    this.aedes = aedes;
    this.transports = new Map();
    this.isStarted = false;
  }

  async initializeTransports() {
    const config = this.config.get();
    
    // Инициализируем транспорты в зависимости от конфигурации
    if (this.config.isProtocolEnabled('mqtt')) {
      const mqttTransport = new MQTTTransport(
        this.config.getPort('mqtt'),
        this.config,
        this.aedes
      );
      this.transports.set('mqtt', mqttTransport);
      this.setupTransportEventHandlers(mqttTransport);
    }

    if (this.config.isProtocolEnabled('mqtts')) {
      try {
        const mqttsTransport = new MQTTSTransport(
          this.config.getPort('mqtts'),
          this.config,
          this.aedes
        );
        this.transports.set('mqtts', mqttsTransport);
        this.setupTransportEventHandlers(mqttsTransport);
      } catch (error) {
        console.warn('⚠️  MQTTS транспорт отключен:', error.message);
      }
    }

    if (this.config.isProtocolEnabled('ws')) {
      const wsTransport = new WSTransport(
        this.config.getPort('ws'),
        this.config,
        this.aedes
      );
      this.transports.set('ws', wsTransport);
      this.setupTransportEventHandlers(wsTransport);
    }

    if (this.config.isProtocolEnabled('wss')) {
      try {
        const wssTransport = new WSSTransport(
          this.config.getPort('wss'),
          this.config,
          this.aedes
        );
        this.transports.set('wss', wssTransport);
        this.setupTransportEventHandlers(wssTransport);
      } catch (error) {
        console.warn('⚠️  WSS транспорт отключен:', error.message);
      }
    }

    console.log(`\n📡 Инициализировано ${this.transports.size} транспортов`);
  }

  setupTransportEventHandlers(transport) {
    // Перенаправляем события транспорта
    transport.on('started', (data) => {
      this.emit('transportStarted', data);
    });

    transport.on('stopped', (data) => {
      this.emit('transportStopped', data);
    });

    transport.on('error', (error) => {
      console.error(`❌ Ошибка транспорта ${transport.name}:`, error.message);
      this.emit('transportError', { transport: transport.name, error });
    });

    transport.on('clientConnected', (data) => {
      this.emit('clientConnected', data);
    });

    transport.on('clientDisconnected', (data) => {
      this.emit('clientDisconnected', data);
    });

    transport.on('messageReceived', (data) => {
      this.emit('messageReceived', data);
    });
  }

  async startAll() {
    if (this.isStarted) {
      console.log('⚠️  Менеджер транспортов уже запущен');
      return;
    }

    console.log('\n🚀 Запуск всех транспортов...');
    
    const startPromises = [];
    for (const [name, transport] of this.transports) {
      startPromises.push(
        transport.start().catch(error => {
          console.error(`❌ Не удалось запустить ${name}:`, error.message);
          return { name, error };
        })
      );
    }

    const results = await Promise.allSettled(startPromises);
    
    // Подсчитываем успешно запущенные транспорты
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failedCount = results.length - successCount;

    console.log(`\n✅ Запущено транспортов: ${successCount}`);
    if (failedCount > 0) {
      console.log(`❌ Не удалось запустить: ${failedCount}`);
    }

    this.isStarted = true;
    this.config.displayConfiguration();
    
    return {
      started: successCount,
      failed: failedCount,
      total: this.transports.size
    };
  }

  async stopAll() {
    if (!this.isStarted) {
      return;
    }

    console.log('\n🛑 Остановка всех транспортов...');
    
    const stopPromises = [];
    for (const [name, transport] of this.transports) {
      stopPromises.push(
        transport.stop().catch(error => {
          console.error(`❌ Ошибка остановки ${name}:`, error.message);
          return { name, error };
        })
      );
    }

    await Promise.allSettled(stopPromises);
    this.isStarted = false;
    console.log('✅ Все транспорты остановлены');
  }

  async restartTransport(transportName) {
    const transport = this.transports.get(transportName);
    if (!transport) {
      throw new Error(`Транспорт ${transportName} не найден`);
    }

    console.log(`🔄 Перезапуск транспорта ${transportName}...`);
    await transport.stop();
    await transport.start();
    console.log(`✅ Транспорт ${transportName} перезапущен`);
  }

  getTransportStats() {
    const stats = {};
    
    for (const [name, transport] of this.transports) {
      stats[name] = transport.getStats();
    }

    return stats;
  }

  async getHealthStatus() {
    const health = {
      overall: 'unknown',
      transports: {},
      summary: {
        total: this.transports.size,
        running: 0,
        stopped: 0,
        errors: 0
      }
    };

    for (const [name, transport] of this.transports) {
      try {
        health.transports[name] = await transport.healthCheck();
        if (health.transports[name].status === 'running') {
          health.summary.running++;
        } else {
          health.summary.stopped++;
        }
      } catch (error) {
        health.transports[name] = {
          name,
          status: 'error',
          error: error.message
        };
        health.summary.errors++;
      }
    }

    // Определяем общий статус
    if (health.summary.running === health.summary.total) {
      health.overall = 'healthy';
    } else if (health.summary.running > 0) {
      health.overall = 'degraded';
    } else {
      health.overall = 'unhealthy';
    }

    return health;
  }

  getTransport(name) {
    return this.transports.get(name);
  }

  getTransportNames() {
    return Array.from(this.transports.keys());
  }

  getActiveTransports() {
    const active = [];
    for (const [name, transport] of this.transports) {
      if (transport.isRunning) {
        active.push({
          name,
          port: transport.port,
          stats: transport.getStats()
        });
      }
    }
    return active;
  }

  async gracefulShutdown() {
    console.log('\n🛑 Начинаем graceful shutdown...');
    
    // Даем время активным соединениям завершиться
    if (this.isStarted) {
      console.log('⏳ Ожидание завершения активных соединений (5 сек)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    await this.stopAll();
    console.log('✅ Graceful shutdown завершен');
  }
}

module.exports = TransportManager; 