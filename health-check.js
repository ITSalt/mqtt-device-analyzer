// health-check.js
const net = require('net');
const http = require('http');

// Проверка MQTT порта
function checkMqttPort(port = 1883) {
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

// Проверка WebSocket порта
function checkWebSocketPort(port = 8887) {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}`, (res) => {
      resolve(res.statusCode < 500);
    }).on('error', () => {
      resolve(false);
    }).setTimeout(2000);
  });
}

// PM2 health check endpoint
const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    const mqttOk = await checkMqttPort();
    const wsOk = await checkWebSocketPort();

    const status = {
      status: mqttOk && wsOk ? 'healthy' : 'unhealthy',
      services: {
        mqtt: mqttOk ? 'running' : 'down',
        websocket: wsOk ? 'running' : 'down'
      },
      timestamp: new Date().toISOString()
    };

    res.writeHead(mqttOk && wsOk ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3001, () => {
  console.log('Health check сервер запущен на порту 3001');
});