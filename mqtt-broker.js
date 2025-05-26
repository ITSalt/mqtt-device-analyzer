const process = require('process');
const aedes = require('aedes')();
const ws = require('websocket-stream');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Создаем директорию для логов
const logsDir = './mqtt_logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// TCP сервер для MQTT
const tcpServer = net.createServer(aedes.handle);
tcpServer.listen(1883, () => {
  console.log('MQTT брокер запущен на порту 1883');
});

// WebSocket сервер для MQTT over WS
const wsServer = require('http').createServer();
ws.createServer({ server: wsServer }, aedes.handle);
wsServer.listen(8887, () => {
  console.log('MQTT over WebSocket запущен на порту 8887');
});

// Структура для хранения данных
const deviceData = {
  clients: {},
  topics: {},
  messages: []
};

// Обработчик подключения клиента
aedes.on('client', (client) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Клиент подключен: ${client.id}`);

  deviceData.clients[client.id] = {
    connectedAt: timestamp,
    messages: []
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

  const message = {
    timestamp,
    clientId: client.id,
    topic: packet.topic,
    qos: packet.qos,
    retain: packet.retain,
    payload: analysis
  };

  // Выводим в консоль
  console.log(`\n[${timestamp}] Новое сообщение:`);
  console.log(`  Клиент: ${client.id}`);
  console.log(`  Топик: ${packet.topic}`);
  console.log(`  QoS: ${packet.qos}, Retain: ${packet.retain}`);
  console.log(`  Данные (UTF8): ${analysis.utf8}`);
  console.log(`  Данные (HEX): ${analysis.hex}`);
  console.log(`  Тип: ${analysis.type}`);

  if (analysis.json) {
    console.log(`  JSON:`, analysis.json);
  }

  // Сохраняем в структуру
  deviceData.messages.push(message);
  if (!deviceData.topics[packet.topic]) {
    deviceData.topics[packet.topic] = [];
  }
  deviceData.topics[packet.topic].push(message);

  // Логируем в файл
  fs.appendFileSync(
    path.join(logsDir, 'messages.log'),
    JSON.stringify(message, null, 2) + '\n---\n'
  );

  // Сохраняем payload в отдельный файл для анализа
  const payloadFile = path.join(logsDir, `payload_${Date.now()}.bin`);
  fs.writeFileSync(payloadFile, packet.payload);
});

// Обработчик подписки
aedes.on('subscribe', (subscriptions, client) => {
  console.log(`\nКлиент ${client.id} подписался на:`,
    subscriptions.map(s => s.topic).join(', '));
});

// Периодическое сохранение анализа
setInterval(() => {
  const analysisFile = path.join(logsDir, 'analysis.json');
  fs.writeFileSync(analysisFile, JSON.stringify(deviceData, null, 2));

  // Генерируем отчет по топикам
  const report = {
    totalMessages: deviceData.messages.length,
    topics: {}
  };

  for (const topic in deviceData.topics) {
    const messages = deviceData.topics[topic];
    report.topics[topic] = {
      count: messages.length,
      payloadTypes: [...new Set(messages.map(m => m.payload.type))],
      averageSize: messages.reduce((sum, m) => sum + m.payload.length, 0) / messages.length
    };
  }

  fs.writeFileSync(
    path.join(logsDir, 'report.json'),
    JSON.stringify(report, null, 2)
  );
}, 30000); // Каждые 30 секунд

// Обработка ошибок
aedes.on('error', (err) => {
  console.error('Ошибка брокера:', err);
});

console.log('MQTT брокер-анализатор запущен!');
console.log('Логи сохраняются в:', logsDir);

// Добавляем graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
  console.log('Получен сигнал завершения, закрываем соединения...');

  // Закрываем серверы
  tcpServer.close(() => {
    console.log('TCP сервер остановлен');
  });

  wsServer.close(() => {
    console.log('WebSocket сервер остановлен');
  });

  // Закрываем брокер
  aedes.close(() => {
    console.log('MQTT брокер остановлен');
    process.exit(0);
  });

  // Принудительное завершение через 10 секунд
  setTimeout(() => {
    console.error('Принудительное завершение');
    process.exit(1);
  }, 10000);
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