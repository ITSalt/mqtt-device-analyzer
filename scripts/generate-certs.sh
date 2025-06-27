#!/bin/bash

# scripts/generate-certs.sh - Генерация SSL сертификатов для MQTTS и WSS

set -e

# Настройки по умолчанию
DOMAIN=${MQTT_DOMAIN:-"localhost"}
COUNTRY=${SSL_COUNTRY:-"US"}
STATE=${SSL_STATE:-"California"}
CITY=${SSL_CITY:-"San Francisco"}
ORG=${SSL_ORG:-"MQTT Device Analyzer"}
OU=${SSL_OU:-"IT Department"}

CERT_DIR="./certs"
KEY_FILE="$CERT_DIR/server.key"
CERT_FILE="$CERT_DIR/server.crt"

echo "🔐 Генерация SSL сертификатов для MQTT брокера..."
echo "📍 Домен: $DOMAIN"

# Создаем директорию для сертификатов
mkdir -p "$CERT_DIR"

# Проверяем, существуют ли уже сертификаты
if [ -f "$KEY_FILE" ] && [ -f "$CERT_FILE" ]; then
    echo "⚠️  SSL сертификаты уже существуют:"
    echo "   Key: $KEY_FILE"
    echo "   Cert: $CERT_FILE"
    
    # Проверяем для какого домена создан сертификат
    EXISTING_DOMAIN=$(openssl x509 -in "$CERT_FILE" -text -noout | grep -E "DNS:|CN=" | head -1 | sed 's/.*=//' | sed 's/,.*//' | xargs)
    echo "   Текущий домен в сертификате: $EXISTING_DOMAIN"
    
    if [ "$EXISTING_DOMAIN" = "$DOMAIN" ]; then
        echo "✅ Сертификат уже создан для домена $DOMAIN"
        exit 0
    fi
    
    read -p "Перегенерировать для домена $DOMAIN? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Используем существующие сертификаты"
        exit 0
    fi
fi

# Генерация самоподписанного сертификата
echo "📝 Создание SSL сертификата для домена: $DOMAIN"

# Конфигурация для openssl
cat > "$CERT_DIR/openssl.conf" << EOF
[req]
default_bits = 4096
prompt = no
distinguished_name = dn
req_extensions = v3_req

[dn]
C=$COUNTRY
ST=$STATE
L=$CITY
O=$ORG
OU=$OU
CN=$DOMAIN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = *.$DOMAIN
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Если домен не localhost, добавляем поддержку wildcard
if [ "$DOMAIN" != "localhost" ]; then
    echo "DNS.4 = www.$DOMAIN" >> "$CERT_DIR/openssl.conf"
fi

# Генерируем приватный ключ и сертификат
openssl req -x509 -newkey rsa:4096 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days 365 \
    -nodes \
    -config "$CERT_DIR/openssl.conf" \
    -extensions v3_req

# Устанавливаем правильные права доступа
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

# Удаляем временный конфигурационный файл
rm "$CERT_DIR/openssl.conf"

echo "✅ SSL сертификаты успешно созданы для домена: $DOMAIN"
echo "   🔑 Private Key: $KEY_FILE"
echo "   📜 Certificate: $CERT_FILE"
echo ""

# Показываем информацию о сертификате
echo "📋 Информация о сертификате:"
openssl x509 -in "$CERT_FILE" -text -noout | grep -E "(Subject:|Issuer:|Not Before|Not After|DNS:|IP Address:)"

echo ""
echo "🚀 Теперь можно запускать MQTT брокер с поддержкой MQTTS и WSS!"
echo ""
echo "   Для тестирования MQTTS:"
echo "   mosquitto_pub -h $DOMAIN -p 8883 --cafile $CERT_FILE -t test -m 'Hello MQTTS'"
echo ""
echo "   Для тестирования WSS:"
echo "   wss://$DOMAIN:8888" 