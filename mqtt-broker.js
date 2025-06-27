const process = require('process');
const aedes = require('aedes')();
const fs = require('fs');
const path = require('path');

// Импорт новой архитектуры
const config = require('./config');
const TransportManager = require('./transport-manager');
const PatternAnalyzer = require('./pattern-analyzer');

// Инициализация
const transportManager = new TransportManager(config, aedes);
const patternAnalyzer = new PatternAnalyzer();

// Структура для хранения данных
const deviceData = {
  clients: {},
  topics: {},
  messages: [],
  transports: {}
};

// Получаем конфигурацию логирования
const logsDir = config.get().logging.directory;

// Обработчик подключения клиента
aedes.on('client', (client) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Клиент подключен: ${client.id}`);

  deviceData.clients[client.id] = {
    connectedAt: timestamp,
    messages: [],
    transport: 'unknown' // Будет обновлено через события транспорта
  };

  // Логируем подключение
  fs.appendFileSync(
    path.join(logsDir, 'connections.log'),
    `${timestamp} | CONNECT | Client: ${client.id}\n`
  );
});

// Обработчик отключения
aedes.on('clientDisconnect', (client) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Клиент отключен: ${client.id}`);

  fs.appendFileSync(
    path.join(logsDir, 'connections.log'),
    `${timestamp} | DISCONNECT | Client: ${client.id}\n`
  );
});

// Обработчики событий транспортов
transportManager.on('clientConnected', ({ clientId, transport }) => {
  console.log(`🔗 Новое подключение через ${transport}: ${clientId}`);
  
  if (deviceData.clients[clientId]) {
    deviceData.clients[clientId].transport = transport;
  }
  
  // Обновляем статистику транспортов
  if (!deviceData.transports[transport]) {
    deviceData.transports[transport] = { connections: 0, messages: 0 };
  }
  deviceData.transports[transport].connections++;
});

transportManager.on('clientDisconnected', ({ clientId, transport }) => {
  console.log(`🔌 Отключение через ${transport}: ${clientId}`);
  
  if (deviceData.transports[transport]) {
    deviceData.transports[transport].connections--;
  }
});

transportManager.on('transportStarted', ({ transport, port }) => {
  console.log(`🚀 Транспорт ${transport} запущен на порту ${port}`);
});

transportManager.on('transportError', ({ transport, error }) => {
  console.error(`❌ Ошибка транспорта ${transport}:`, error.message);
  
  // Логируем ошибку
  fs.appendFileSync(
    path.join(logsDir, 'errors.log'),
    `${new Date().toISOString()} | TRANSPORT_ERROR | ${transport} | ${error.message}\n`
  );
});

// Анализатор payload
function analyzePayload(payload) {
  const analysis = {
    raw: payload,
    hex: payload.toString('hex'),
    utf8: payload.toString('utf8'),
    base64: payload.toString('base64'),
    length: payload.length
  };

  // Попытка парсинга как JSON
  try {
    analysis.json = JSON.parse(payload.toString('utf8'));
    analysis.type = 'JSON';
  } catch (e) {
    // Проверка на бинарный протокол
    if (payload.length > 4) {
      analysis.possibleStructure = {
        header: payload.slice(0, 4).toString('hex'),
        body: payload.slice(4).toString('hex')
      };
    }

    // Проверка на числовые данные
    if (payload.length === 4) {
      analysis.int32 = payload.readInt32BE(0);
      analysis.float32 = payload.readFloatBE(0);
    }

    analysis.type = 'BINARY';
  }

  return analysis;
}

// Обработчик публикации сообщений
aedes.on('publish', (packet, client) => {
  if (!client) return; // Игнорируем внутренние сообщения

  const timestamp = new Date().toISOString();
  const analysis = analyzePayload(packet.payload);

  // Получаем информацию о транспорте клиента
  const clientTransport = deviceData.clients[client.id]?.transport || 'unknown';

  const message = {
    timestamp,
    clientId: client.id,
    topic: packet.topic,
    qos: packet.qos,
    retain: packet.retain,
    payload: analysis,
    transport: clientTransport
  };

  // Анализ паттернов
  const patternStructure = patternAnalyzer.analyze(packet.topic, packet.payload);

  // Выводим в консоль с информацией о транспорте
  console.log(`\n[${timestamp}] Новое сообщение через ${clientTransport}:`);
  console.log(`  Клиент: ${client.id}`);
  console.log(`  Топик: ${packet.topic}`);
  console.log(`  QoS: ${packet.qos}, Retain: ${packet.retain}`);
  console.log(`  Данные (UTF8): ${analysis.utf8}`);
  console.log(`  Данные (HEX): ${analysis.hex}`);
  console.log(`  Тип: ${analysis.type}`);

  if (analysis.json) {
    console.log(`  JSON:`, analysis.json);
  }

  if (patternStructure) {
    console.log(`  Паттерн:`, patternStructure);
  }

  // Обновляем статистику транспорта
  if (deviceData.transports[clientTransport]) {
    deviceData.transports[clientTransport].messages++;
  }

  // Сохраняем в структуру
  deviceData.messages.push(message);
  if (!deviceData.topics[packet.topic]) {
    deviceData.topics[packet.topic] = [];
  }
  deviceData.topics[packet.topic].push(message);

  // Обновляем сообщения клиента
  if (deviceData.clients[client.id]) {
    deviceData.clients[client.id].messages.push({
      timestamp,
      topic: packet.topic,
      payload: analysis,
      transport: clientTransport
    });
  }

  // Логируем в файл
  fs.appendFileSync(
    path.join(logsDir, 'messages.log'),
    JSON.stringify(message, null, 2) + '\n---\n'
  );

  // Сохраняем payload в отдельный файл для анализа
  const payloadFile = path.join(logsDir, `payload_${Date.now()}_${clientTransport}.bin`);
  fs.writeFileSync(payloadFile, packet.payload);
});

// Обработчик подписки
aedes.on('subscribe', (subscriptions, client) => {
  console.log(`\nКлиент ${client.id} подписался на:`,
    subscriptions.map(s => s.topic).join(', '));
});

// Периодическое сохранение анализа
setInterval(async () => {
  const analysisFile = path.join(logsDir, 'analysis.json');
  fs.writeFileSync(analysisFile, JSON.stringify(deviceData, null, 2));

  // Генерируем расширенный отчет
  const report = {
    timestamp: new Date().toISOString(),
    totalMessages: deviceData.messages.length,
    totalClients: Object.keys(deviceData.clients).length,
    transports: {},
    topics: {}
  };

  // Добавляем статистику транспортов
  const transportStats = transportManager.getTransportStats();
  for (const [transportName, stats] of Object.entries(transportStats)) {
    report.transports[transportName] = {
      ...stats,
      messagesFromData: deviceData.transports[transportName]?.messages || 0,
      connectionsFromData: deviceData.transports[transportName]?.connections || 0
    };
  }

  // Генерируем отчет по топикам с информацией о транспортах
  for (const topic in deviceData.topics) {
    const messages = deviceData.topics[topic];
    const transportBreakdown = {};
    
    messages.forEach(message => {
      const transport = message.transport || 'unknown';
      if (!transportBreakdown[transport]) {
        transportBreakdown[transport] = 0;
      }
      transportBreakdown[transport]++;
    });

    report.topics[topic] = {
      count: messages.length,
      payloadTypes: [...new Set(messages.map(m => m.payload.type))],
      averageSize: messages.reduce((sum, m) => sum + m.payload.length, 0) / messages.length,
      transportBreakdown
    };
  }

  // Добавляем статус здоровья транспортов
  try {
    const healthStatus = await transportManager.getHealthStatus();
    report.transportHealth = healthStatus;
  } catch (error) {
    report.transportHealth = { error: error.message };
  }

  fs.writeFileSync(
    path.join(logsDir, 'report.json'),
    JSON.stringify(report, null, 2)
  );

  // Выводим краткую статистику в консоль
  console.log(`\n📊 Статистика (${new Date().toLocaleTimeString()}):`);
  console.log(`   Сообщений: ${report.totalMessages}`);
  console.log(`   Клиентов: ${report.totalClients}`);
  console.log(`   Активных транспортов: ${Object.values(transportStats).filter(s => s.isRunning).length}`);
  
  Object.entries(report.transports).forEach(([name, stats]) => {
    if (stats.isRunning) {
      console.log(`   ${name}: ${stats.connectionsActive} подключений, ${stats.messagesReceived} сообщений`);
    }
  });
}, 30000); // Каждые 30 секунд

// Обработка ошибок
aedes.on('error', (err) => {
  console.error('Ошибка брокера:', err);
});

// Главная функция инициализации
async function initialize() {
  console.log('🚀 Запуск MQTT брокера-анализатора...\n');
  
  try {
    // Инициализируем транспорты
    await transportManager.initializeTransports();
    
    // Запускаем все транспорты
    const results = await transportManager.startAll();
    
    if (results.started === 0) {
      console.error('❌ Не удалось запустить ни одного транспорта!');
      process.exit(1);
    }
    
    console.log(`\n✅ MQTT брокер-анализатор успешно запущен!`);
    console.log(`📁 Логи сохраняются в: ${logsDir}`);
    console.log(`📊 Статистика обновляется каждые 30 секунд`);
    
    // Принудительное завершение через 10 секунд если процесс зависнет
    const forceExitTimeout = setTimeout(() => {
      console.error('❌ Принудительное завершение через timeout');
      process.exit(1);
    }, 300000); // 5 минут
    
    // Убираем timeout после успешного запуска
    clearTimeout(forceExitTimeout);
    
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error.message);
    process.exit(1);
  }
}

// Запускаем инициализацию
initialize().catch(error => {
  console.error('❌ Критическая ошибка:', error.message);
  process.exit(1);
});

// Добавляем graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
  console.log('\n🛑 Получен сигнал завершения, закрываем соединения...');

  try {
    // Graceful shutdown всех транспортов
    await transportManager.gracefulShutdown();

    // Закрываем брокер aedes
    await new Promise((resolve) => {
      aedes.close(() => {
        console.log('✅ MQTT брокер aedes остановлен');
        resolve();
      });
    });

    console.log('✅ Graceful shutdown завершен успешно');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при graceful shutdown:', error.message);
    process.exit(1);
  }
}

// Сигнал готовности для PM2
if (process.send) {
  process.send('ready');
}

// Обработка неперехваченных ошибок
process.on('uncaughtException', (err) => {
  console.error('Неперехваченная ошибка:', err);
  fs.appendFileSync(
    path.join(logsDir, 'errors.log'),
    `${new Date().toISOString()} | UNCAUGHT | ${err.stack}\n`
  );
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный rejection:', reason);
  fs.appendFileSync(
    path.join(logsDir, 'errors.log'),
    `${new Date().toISOString()} | UNHANDLED | ${reason}\n`
  );
});