// health-check.js - Расширенная проверка здоровья для всех протоколов
const net = require('net');
const http = require('http');
const https = require('https');
const tls = require('tls');
const config = require('./config');

// Проверка TCP порта (MQTT)
function checkTcpPort(port) {
  return new Promise((resolve) => {
    const client = net.createConnection(port, 'localhost', () => {
      client.end();
      resolve(true);
    });

    client.on('error', () => {
      resolve(false);
    });

    client.setTimeout(2000, () => {
      client.destroy();
      resolve(false);
    });
  });
}

// Проверка TLS порта (MQTTS)
function checkTlsPort(port) {
  return new Promise((resolve) => {
    const options = {
      host: 'localhost',
      port: port,
      rejectUnauthorized: false // Для самоподписанных сертификатов
    };

    const client = tls.connect(options, () => {
      client.end();
      resolve(true);
    });

    client.on('error', () => {
      resolve(false);
    });

    client.setTimeout(2000, () => {
      client.destroy();
      resolve(false);
    });
  });
}

// Проверка HTTP порта (WebSocket)
function checkHttpPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(res.statusCode < 500);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(2000, () => {
      req.abort();
      resolve(false);
    });
  });
}

// Проверка HTTPS порта (WebSocket Secure)
function checkHttpsPort(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      rejectUnauthorized: false // Для самоподписанных сертификатов
    };

    const req = https.get(options, (res) => {
      resolve(res.statusCode < 500);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(2000, () => {
      req.abort();
      resolve(false);
    });
  });
}

// Комплексная проверка всех сервисов
async function checkAllServices() {
  const cfg = config.get();
  const results = {};

  // Проверяем MQTT (TCP)
  if (config.isProtocolEnabled('mqtt')) {
    results.mqtt = {
      enabled: true,
      port: cfg.ports.mqtt,
      status: await checkTcpPort(cfg.ports.mqtt) ? 'running' : 'down',
      protocol: 'tcp',
      secure: false
    };
  } else {
    results.mqtt = { enabled: false, status: 'disabled' };
  }

  // Проверяем MQTTS (TLS)
  if (config.isProtocolEnabled('mqtts')) {
    results.mqtts = {
      enabled: true,
      port: cfg.ports.mqtts,
      status: await checkTlsPort(cfg.ports.mqtts) ? 'running' : 'down',
      protocol: 'tls',
      secure: true
    };
  } else {
    results.mqtts = { enabled: false, status: 'disabled' };
  }

  // Проверяем WebSocket (HTTP)
  if (config.isProtocolEnabled('ws')) {
    results.ws = {
      enabled: true,
      port: cfg.ports.ws,
      status: await checkHttpPort(cfg.ports.ws) ? 'running' : 'down',
      protocol: 'websocket',
      secure: false
    };
  } else {
    results.ws = { enabled: false, status: 'disabled' };
  }

  // Проверяем WebSocket Secure (HTTPS)
  if (config.isProtocolEnabled('wss')) {
    results.wss = {
      enabled: true,
      port: cfg.ports.wss,
      status: await checkHttpsPort(cfg.ports.wss) ? 'running' : 'down',
      protocol: 'websocket',
      secure: true
    };
  } else {
    results.wss = { enabled: false, status: 'disabled' };
  }

  return results;
}

// PM2 health check endpoint
const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    try {
      const services = await checkAllServices();
      
      // Подсчитываем статистику
      const enabledServices = Object.values(services).filter(s => s.enabled);
      const runningServices = enabledServices.filter(s => s.status === 'running');
      
      const overallStatus = runningServices.length === enabledServices.length ? 'healthy' : 
                          runningServices.length > 0 ? 'degraded' : 'unhealthy';

      const status = {
        status: overallStatus,
        services,
        summary: {
          enabled: enabledServices.length,
          running: runningServices.length,
          down: enabledServices.length - runningServices.length
        },
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      };

      const httpStatus = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;

      res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status, null, 2));
      
    } catch (error) {
      console.error('Health check error:', error);
      
      const errorStatus = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorStatus, null, 2));
    }
  } else if (req.url === '/') {
    // Простая страница со статусом
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>MQTT Broker Health</title></head>
        <body>
          <h1>MQTT Broker Health Check</h1>
          <p>Используйте <a href="/health">/health</a> для получения JSON статуса</p>
          <p>Время: ${new Date().toLocaleString()}</p>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const healthPort = config.getPort('health');
server.listen(healthPort, () => {
  console.log(`🏥 Health check сервер запущен на порту ${healthPort}`);
  console.log(`   URL: http://localhost:${healthPort}/health`);
});