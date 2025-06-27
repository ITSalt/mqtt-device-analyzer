#!/usr/bin/env node

// scripts/test-connections.js - Тестирование всех протоколов MQTT брокера

const mqtt = require('mqtt');
const WebSocket = require('ws');
const fs = require('fs');
const tls = require('tls');

// Конфигурация
const domain = process.env.MQTT_DOMAIN || 'localhost';
const config = {
  mqtt: { host: domain, port: process.env.MQTT_PORT || 1883 },
  mqtts: { host: domain, port: process.env.MQTTS_PORT || 8883, key: './certs/server.key', cert: './certs/server.crt' },
  ws: { url: `ws://${domain}:${process.env.WS_PORT || 8887}` },
  wss: { url: `wss://${domain}:${process.env.WSS_PORT || 8888}`, key: './certs/server.key', cert: './certs/server.crt' }
};

const testMessage = JSON.stringify({
  timestamp: new Date().toISOString(),
  type: 'test',
  message: 'Hello from test client',
  protocol: null // будет заполнено для каждого протокола
});

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, protocol, message) {
  console.log(`${color}[${protocol}]${colors.reset} ${message}`);
}

function testMQTT() {
  return new Promise((resolve) => {
    log(colors.blue, 'MQTT', 'Подключение к MQTT...');
    
    const client = mqtt.connect(`mqtt://${config.mqtt.host}:${config.mqtt.port}`);
    
    const timeout = setTimeout(() => {
      client.end();
      resolve({ protocol: 'MQTT', success: false, error: 'Timeout' });
    }, 5000);
    
    client.on('connect', () => {
      clearTimeout(timeout);
      log(colors.green, 'MQTT', 'Подключен! Отправка тестового сообщения...');
      
      const message = JSON.parse(testMessage);
      message.protocol = 'MQTT';
      
      client.publish('test/mqtt', JSON.stringify(message), (err) => {
        if (err) {
          log(colors.red, 'MQTT', `Ошибка отправки: ${err.message}`);
          client.end();
          resolve({ protocol: 'MQTT', success: false, error: err.message });
        } else {
          log(colors.green, 'MQTT', 'Сообщение отправлено успешно!');
          client.end();
          resolve({ protocol: 'MQTT', success: true });
        }
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      log(colors.red, 'MQTT', `Ошибка подключения: ${err.message}`);
      resolve({ protocol: 'MQTT', success: false, error: err.message });
    });
  });
}

function testMQTTS() {
  return new Promise((resolve) => {
    log(colors.magenta, 'MQTTS', 'Подключение к MQTTS...');
    
    // Проверяем наличие сертификатов
    if (!fs.existsSync(config.mqtts.cert)) {
      log(colors.red, 'MQTTS', 'SSL сертификат не найден');
      resolve({ protocol: 'MQTTS', success: false, error: 'Certificate not found' });
      return;
    }
    
    const clientOptions = {
      host: config.mqtts.host,
      port: config.mqtts.port,
      protocol: 'mqtts',
      rejectUnauthorized: false, // Для самоподписанных сертификатов
      ca: fs.readFileSync(config.mqtts.cert)
    };
    
    const client = mqtt.connect(clientOptions);
    
    const timeout = setTimeout(() => {
      client.end();
      resolve({ protocol: 'MQTTS', success: false, error: 'Timeout' });
    }, 5000);
    
    client.on('connect', () => {
      clearTimeout(timeout);
      log(colors.green, 'MQTTS', 'Безопасное подключение установлено! Отправка сообщения...');
      
      const message = JSON.parse(testMessage);
      message.protocol = 'MQTTS';
      
      client.publish('test/mqtts', JSON.stringify(message), (err) => {
        if (err) {
          log(colors.red, 'MQTTS', `Ошибка отправки: ${err.message}`);
          client.end();
          resolve({ protocol: 'MQTTS', success: false, error: err.message });
        } else {
          log(colors.green, 'MQTTS', 'Зашифрованное сообщение отправлено успешно!');
          client.end();
          resolve({ protocol: 'MQTTS', success: true });
        }
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      log(colors.red, 'MQTTS', `Ошибка подключения: ${err.message}`);
      resolve({ protocol: 'MQTTS', success: false, error: err.message });
    });
  });
}

function testWS() {
  return new Promise((resolve) => {
    log(colors.cyan, 'WS', 'Подключение к WebSocket...');
    
    const client = mqtt.connect(config.ws.url);
    
    const timeout = setTimeout(() => {
      client.end();
      resolve({ protocol: 'WS', success: false, error: 'Timeout' });
    }, 5000);
    
    client.on('connect', () => {
      clearTimeout(timeout);
      log(colors.green, 'WS', 'WebSocket подключение установлено! Отправка сообщения...');
      
      const message = JSON.parse(testMessage);
      message.protocol = 'WebSocket';
      
      client.publish('test/ws', JSON.stringify(message), (err) => {
        if (err) {
          log(colors.red, 'WS', `Ошибка отправки: ${err.message}`);
          client.end();
          resolve({ protocol: 'WS', success: false, error: err.message });
        } else {
          log(colors.green, 'WS', 'Сообщение через WebSocket отправлено!');
          client.end();
          resolve({ protocol: 'WS', success: true });
        }
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      log(colors.red, 'WS', `Ошибка подключения: ${err.message}`);
      resolve({ protocol: 'WS', success: false, error: err.message });
    });
  });
}

function testWSS() {
  return new Promise((resolve) => {
    log(colors.yellow, 'WSS', 'Подключение к WebSocket Secure...');
    
    // Проверяем наличие сертификатов
    if (!fs.existsSync(config.wss.cert)) {
      log(colors.red, 'WSS', 'SSL сертификат не найден');
      resolve({ protocol: 'WSS', success: false, error: 'Certificate not found' });
      return;
    }
    
    const clientOptions = {
      rejectUnauthorized: false, // Для самоподписанных сертификатов
      ca: fs.readFileSync(config.wss.cert)
    };
    
    const client = mqtt.connect(config.wss.url, clientOptions);
    
    const timeout = setTimeout(() => {
      client.end();
      resolve({ protocol: 'WSS', success: false, error: 'Timeout' });
    }, 5000);
    
    client.on('connect', () => {
      clearTimeout(timeout);
      log(colors.green, 'WSS', 'Безопасное WebSocket подключение установлено!');
      
      const message = JSON.parse(testMessage);
      message.protocol = 'WebSocket Secure';
      
      client.publish('test/wss', JSON.stringify(message), (err) => {
        if (err) {
          log(colors.red, 'WSS', `Ошибка отправки: ${err.message}`);
          client.end();
          resolve({ protocol: 'WSS', success: false, error: err.message });
        } else {
          log(colors.green, 'WSS', 'Зашифрованное сообщение через WSS отправлено!');
          client.end();
          resolve({ protocol: 'WSS', success: true });
        }
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      log(colors.red, 'WSS', `Ошибка подключения: ${err.message}`);
      resolve({ protocol: 'WSS', success: false, error: err.message });
    });
  });
}

async function runTests() {
  console.log(`${colors.bright}🧪 Тестирование всех MQTT протоколов...${colors.reset}`);
  console.log(`🌐 Домен: ${colors.cyan}${domain}${colors.reset}\n`);
  
  const tests = [
    testMQTT(),
    testMQTTS(), 
    testWS(),
    testWSS()
  ];
  
  const results = await Promise.all(tests);
  
  console.log(`\n${colors.bright}📊 Результаты тестирования:${colors.reset}`);
  console.log('═'.repeat(50));
  
  let successCount = 0;
  results.forEach(result => {
    const status = result.success ? 
      `${colors.green}✅ SUCCESS${colors.reset}` : 
      `${colors.red}❌ FAILED${colors.reset}`;
    
    console.log(`${result.protocol.padEnd(8)} | ${status} ${result.error ? `(${result.error})` : ''}`);
    
    if (result.success) successCount++;
  });
  
  console.log('═'.repeat(50));
  console.log(`Успешно: ${successCount}/${results.length} протоколов`);
  
  if (successCount === results.length) {
    console.log(`\n${colors.green}🎉 Все протоколы работают корректно!${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}⚠️  Некоторые протоколы недоступны. Проверьте конфигурацию.${colors.reset}`);
  }
}

// Проверяем, установлен ли mqtt пакет
try {
  require.resolve('mqtt');
} catch (e) {
  console.error(`${colors.red}❌ Пакет 'mqtt' не установлен. Установите его:`);
  console.error(`   npm install mqtt${colors.reset}`);
  process.exit(1);
}

runTests().catch(console.error); 