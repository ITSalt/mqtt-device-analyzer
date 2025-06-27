# MQTT Device Analyzer v2.0

🔥 **Многопротокольный MQTT брокер-ловушка** для анализа и реверс-инжиниринга IoT устройств с поддержкой всех основных MQTT протоколов.

## ✨ Возможности

### 🌐 Поддерживаемые протоколы
- **MQTT** (TCP, порт 1883) - стандартный MQTT
- **MQTTS** (TLS/SSL, порт 8883) - зашифрованный MQTT
- **WebSocket** (WS, порт 8887) - MQTT через WebSocket
- **WebSocket Secure** (WSS, порт 8888) - зашифрованный MQTT через WebSocket

### 🔍 Анализ данных
- Автоматический анализ различных форматов (JSON, binary, hex)
- Определение паттернов в payload
- Реверс-инжиниринг неизвестных протоколов
- Сохранение payload в отдельные файлы для анализа

### 📊 Мониторинг и логирование
- Детальное логирование по протоколам
- Health check для всех транспортов
- Периодическая генерация отчетов
- Статистика по транспортам и топикам

### 🔐 Безопасность
- Автоматическая генерация SSL сертификатов
- Поддержка собственных сертификатов
- Гибкая конфигурация SSL/TLS

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Генерация SSL сертификатов (для MQTTS/WSS)
```bash
chmod +x scripts/generate-certs.sh
./scripts/generate-certs.sh
```

### 3. Запуск
```bash
npm start
```

Брокер будет доступен на всех портах:
- 🔌 **MQTT**: `localhost:1883`
- 🔐 **MQTTS**: `localhost:8883` 
- 🌐 **WebSocket**: `ws://localhost:8887`
- 🔒 **WebSocket Secure**: `wss://localhost:8888`
- 🏥 **Health Check**: `http://localhost:3001/health`

### 4. Тестирование всех протоколов

#### Используйте встроенный тестировщик:
```bash
npm install mqtt  # если не установлен
node scripts/test-connections.js
```

#### Или тестируйте вручную:

**MQTT (стандартный):**
```bash
mosquitto_pub -h localhost -p 1883 -t test/mqtt -m "Hello MQTT"
```

**MQTTS (зашифрованный):**
```bash
mosquitto_pub -h localhost -p 8883 --cafile certs/server.crt -t test/mqtts -m "Hello MQTTS"
```

**WebSocket:**
```javascript
const mqtt = require('mqtt');
const client = mqtt.connect('ws://localhost:8887');
client.publish('test/ws', 'Hello WebSocket');
```

**WebSocket Secure:**
```javascript
const fs = require('fs');
const mqtt = require('mqtt');
const client = mqtt.connect('wss://localhost:8888', {
  ca: fs.readFileSync('certs/server.crt'),
  rejectUnauthorized: false
});
client.publish('test/wss', 'Hello WSS');
```

## ⚙️ Конфигурация

### Переменные окружения

```bash
# Протоколы (включить/отключить)
ENABLE_MQTT=true
ENABLE_MQTTS=true  
ENABLE_WS=true
ENABLE_WSS=true

# Порты
MQTT_PORT=1883
MQTTS_PORT=8883
WS_PORT=8887
WSS_PORT=8888
HEALTH_PORT=3001

# SSL настройки
SSL_ENABLED=true
SSL_KEY_PATH=./certs/server.key
SSL_CERT_PATH=./certs/server.crt
SSL_REJECT_UNAUTHORIZED=false

# Логирование
LOG_LEVEL=info
LOG_DIR=./mqtt_logs
```

### Конфигурация в файле
Все настройки также можно изменить в `config.js`.

## 🌐 Настройка домена

### Локальная разработка (по умолчанию)
```bash
npm run setup  # Использует localhost
```

### Продакшен домен
```bash
# Способ 1: Переменная окружения
export MQTT_DOMAIN=mqtt.yourdomain.com
npm run certs:generate
npm start

# Способ 2: npm script с параметром
npm run setup:domain --domain=mqtt.yourdomain.com

# Способ 3: .env файл
npm run config:copy  # Копирует domain-config.example в .env
# Отредактируйте .env файл
npm start
```

### Docker с доменом
```bash
# Простой запуск
MQTT_DOMAIN=mqtt.yourdomain.com docker-compose up -d

# С .env файлом
echo "MQTT_DOMAIN=mqtt.yourdomain.com" > .env
docker-compose up -d
```

### Быстрые команды для развертывания
```bash
# Staging
npm run deploy:staging

# Production
npm run deploy:prod

# Проверка текущего домена
npm run domain:info
```

**📖 Подробное руководство:** См. [DOMAIN-SETUP.md](./DOMAIN-SETUP.md)

## 🛠️ PM2 управление

```bash
# Запуск в продакшене
npm run pm2:start

# Запуск в режиме разработки (без SSL)
npm run pm2:start:dev

# Просмотр логов
npm run pm2:logs

# Мониторинг
npm run pm2:monit

# Status всех процессов
npm run pm2:status

# Перезапуск
npm run pm2:restart

# Остановка
npm run pm2:stop
```

## 🐳 Docker

### Простой запуск
```bash
docker-compose up -d
```

### Генерация сертификатов в Docker
```bash
# Генерируем сертификаты
docker-compose --profile tools run cert-generator

# Запускаем брокер
docker-compose up -d mqtt-analyzer
```

### Переопределение портов
```bash
# Кастомные порты
MQTT_PORT=1884 MQTTS_PORT=8884 docker-compose up -d
```

## 📊 Мониторинг

### Health Check
```bash
curl http://localhost:3001/health
```

Пример ответа:
```json
{
  "status": "healthy",
  "services": {
    "mqtt": {"enabled": true, "status": "running", "port": 1883},
    "mqtts": {"enabled": true, "status": "running", "port": 8883},
    "ws": {"enabled": true, "status": "running", "port": 8887},
    "wss": {"enabled": true, "status": "running", "port": 8888}
  },
  "summary": {"enabled": 4, "running": 4, "down": 0}
}
```

### Структура логов
```
mqtt_logs/
├── connections.log         # Подключения/отключения
├── messages.log           # Все сообщения с указанием протокола
├── errors.log             # Ошибки транспортов
├── analysis.json          # Полный анализ данных
├── report.json            # Отчеты по топикам и транспортам
└── payload_*_protocol.bin # Бинарные данные с протоколом
```

## 🔧 Продвинутое использование

### Отключение протоколов
```bash
# Только MQTT и WebSocket (без SSL)
ENABLE_MQTTS=false ENABLE_WSS=false npm start
```

### Собственные SSL сертификаты
```bash
# Поместите ваши сертификаты в папку certs/
cp your-server.key certs/server.key
cp your-server.crt certs/server.crt
```

### Анализ неизвестных протоколов
Брокер автоматически:
- Анализирует binary данные
- Определяет JSON структуры  
- Выявляет повторяющиеся паттерны
- Сохраняет raw payload для ручного анализа

## 🏗️ Архитектура

```
mqtt-broker.js           # Главный файл
├── config.js           # Конфигурация
├── transport-manager.js # Менеджер транспортов
├── transports/         # Модули протоколов
│   ├── base-transport.js
│   ├── mqtt-transport.js  
│   ├── mqtts-transport.js
│   ├── ws-transport.js
│   └── wss-transport.js
├── scripts/            # Утилиты
├── certs/             # SSL сертификаты
└── mqtt_logs/         # Логи и анализ
```

## 🐛 Диагностика

### Проблемы с SSL
```bash
# Перегенерируйте сертификаты
./scripts/generate-certs.sh

# Проверьте права доступа
ls -la certs/
```

### Проблемы с портами
```bash
# Проверьте занятые порты
netstat -tulpn | grep -E "(1883|8883|8887|8888|3001)"

# Используйте другие порты
MQTT_PORT=11883 npm start
```

### Тестирование
```bash
# Проверьте все протоколы
node scripts/test-connections.js

# Health check
curl -s http://localhost:3001/health | jq
```

## 📈 Производительность

- ⚡ Поддержка тысяч одновременных подключений
- 🔄 Асинхронная обработка всех протоколов
- 📦 Минимальное влияние на производительность
- 🛡️ Graceful shutdown с сохранением данных

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch
3. Внесите изменения с тестами
4. Создайте Pull Request

## 📝 Лицензия

MIT License