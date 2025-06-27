# 🌐 Настройка домена для MQTT брокера

Данное руководство поможет настроить MQTT брокер для работы с конкретным доменом.

## 🚀 Быстрый старт

### Локальная разработка (localhost)
```bash
# По умолчанию настроен для localhost
npm run setup
npm start
```

### Продакшен домен
```bash
# 1. Установите переменную домена
export MQTT_DOMAIN=mqtt.yourdomain.com

# 2. Сгенерируйте сертификаты для домена
npm run certs:generate

# 3. Запустите брокер
npm start
```

## 📋 Конфигурация домена

### Способ 1: Переменные окружения

```bash
# Основной домен
export MQTT_DOMAIN=mqtt.yourdomain.com

# SSL информация (опционально)
export SSL_COUNTRY=RU
export SSL_STATE=Moscow
export SSL_CITY=Moscow
export SSL_ORG="Your Company"
export SSL_OU="IT Department"

# Генерация сертификатов
npm run certs:generate

# Запуск
npm start
```

### Способ 2: .env файл

Создайте `.env` файл на основе `domain-config.example`:

```bash
# Скопируйте пример
cp domain-config.example .env

# Отредактируйте домен
# MQTT_DOMAIN=mqtt.yourdomain.com
```

### Способ 3: Docker с переменными

```bash
# Docker Compose
MQTT_DOMAIN=mqtt.yourdomain.com docker-compose up -d

# Или создайте .env файл для Docker
echo "MQTT_DOMAIN=mqtt.yourdomain.com" > .env
docker-compose up -d
```

## 🔐 SSL сертификаты

### Автоматическая генерация (самоподписанные)

```bash
# Для localhost
npm run certs:generate

# Для домена
MQTT_DOMAIN=mqtt.yourdomain.com npm run certs:generate
```

### Использование собственных сертификатов

```bash
# Скопируйте ваши сертификаты
cp /path/to/your/server.key certs/server.key
cp /path/to/your/server.crt certs/server.crt

# Или укажите пути в переменных
export SSL_KEY_PATH=/path/to/your/server.key
export SSL_CERT_PATH=/path/to/your/server.crt
```

### Let's Encrypt сертификаты

```bash
# Пример для Let's Encrypt
export SSL_KEY_PATH=/etc/letsencrypt/live/mqtt.yourdomain.com/privkey.pem
export SSL_CERT_PATH=/etc/letsencrypt/live/mqtt.yourdomain.com/fullchain.pem
export SSL_REJECT_UNAUTHORIZED=true
```

## 🌍 Примеры конфигурации

### Локальная разработка
```bash
MQTT_DOMAIN=localhost
ENABLE_MQTTS=false
ENABLE_WSS=false
SSL_ENABLED=false
```

### Staging сервер
```bash
MQTT_DOMAIN=mqtt-staging.yourdomain.com
SSL_REJECT_UNAUTHORIZED=false
LOG_LEVEL=debug
```

### Production сервер
```bash
MQTT_DOMAIN=mqtt.yourdomain.com
SSL_REJECT_UNAUTHORIZED=true
LOG_LEVEL=warn
NODE_ENV=production
```

### Поддомен компании
```bash
MQTT_DOMAIN=broker.company.com
SSL_ORG="Company Name Inc"
SSL_COUNTRY=US
SSL_STATE=California
```

## 🚀 Развертывание

### PM2 с доменом

```bash
# Установите переменную окружения
export MQTT_DOMAIN=mqtt.yourdomain.com

# Запустите с PM2
npm run pm2:start

# Или напрямую
MQTT_DOMAIN=mqtt.yourdomain.com pm2 start ecosystem.config.js
```

### Docker с доменом

```bash
# Через переменную окружения
MQTT_DOMAIN=mqtt.yourdomain.com docker-compose up -d

# Через .env файл
cat > .env << EOF
MQTT_DOMAIN=mqtt.yourdomain.com
SSL_COUNTRY=RU
SSL_ORG=My Company
EOF

docker-compose up -d
```

### Nginx проксирование

```nginx
# /etc/nginx/sites-available/mqtt-broker
server {
    listen 80;
    server_name mqtt.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mqtt.yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket Secure proxy
    location /mqtt {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🧪 Тестирование домена

### Автоматическое тестирование
```bash
# Обновите домен в тестовом скрипте
MQTT_DOMAIN=mqtt.yourdomain.com npm run test:connections
```

### Ручное тестирование

```bash
# MQTT
mosquitto_pub -h mqtt.yourdomain.com -p 1883 -t test -m "Hello"

# MQTTS
mosquitto_pub -h mqtt.yourdomain.com -p 8883 --cafile certs/server.crt -t test -m "Hello"

# Health check
curl https://mqtt.yourdomain.com:3001/health
```

### Проверка SSL сертификата

```bash
# Проверка сертификата
openssl s_client -connect mqtt.yourdomain.com:8883 -servername mqtt.yourdomain.com

# Информация о сертификате
openssl x509 -in certs/server.crt -text -noout
```

## 🔧 DNS настройки

Убедитесь, что ваш DNS настроен правильно:

```bash
# A-записи
mqtt.yourdomain.com.     IN A     YOUR_SERVER_IP

# Или CNAME
mqtt.yourdomain.com.     IN CNAME your-server.yourdomain.com.
```

### Поддомены для разных сред

```bash
# Разработка
mqtt-dev.yourdomain.com     -> DEV_SERVER_IP

# Staging  
mqtt-staging.yourdomain.com -> STAGING_SERVER_IP

# Production
mqtt.yourdomain.com         -> PROD_SERVER_IP
```

## 🛡️ Безопасность

### Firewall настройки

```bash
# Откройте необходимые порты
sudo ufw allow 1883  # MQTT
sudo ufw allow 8883  # MQTTS
sudo ufw allow 8887  # WebSocket
sudo ufw allow 8888  # WebSocket Secure
sudo ufw allow 3001  # Health Check
```

### SSL best practices

```bash
# Продакшен настройки
export SSL_REJECT_UNAUTHORIZED=true
export NODE_TLS_REJECT_UNAUTHORIZED=1

# Отключите слабые протоколы
export SSL_PROTOCOLS="TLSv1.2 TLSv1.3"
```

## 📊 Мониторинг

### Health Check URL

```bash
# Общий статус
curl https://mqtt.yourdomain.com:3001/health

# Красивый вывод
curl -s https://mqtt.yourdomain.com:3001/health | jq
```

### Логи

```bash
# PM2 логи
pm2 logs mqtt-device-analyzer

# Файловые логи
tail -f mqtt_logs/connections.log
tail -f mqtt_logs/messages.log
```

## ❗ Troubleshooting

### Проблемы с SSL

```bash
# Перегенерация сертификатов
rm -rf certs/
MQTT_DOMAIN=mqtt.yourdomain.com npm run certs:generate

# Проверка прав доступа
ls -la certs/
chmod 600 certs/server.key
chmod 644 certs/server.crt
```

### Проблемы с доменом

```bash
# Проверка DNS
nslookup mqtt.yourdomain.com
dig mqtt.yourdomain.com

# Проверка доступности портов
telnet mqtt.yourdomain.com 1883
telnet mqtt.yourdomain.com 8883
```

### Проблемы с Docker

```bash
# Проверка переменных
docker-compose config

# Пересборка с новым доменом
docker-compose down
docker-compose build --no-cache
MQTT_DOMAIN=mqtt.yourdomain.com docker-compose up -d
``` 