#!/bin/bash
# setup-pm2.sh

echo "=== Установка и настройка PM2 ==="

# Установка PM2 глобально
echo "1. Устанавливаем PM2..."
sudo npm install -g pm2

# Установка pm2-logrotate для ротации логов
echo "2. Устанавливаем модуль ротации логов..."
pm2 install pm2-logrotate

# Настройка ротации логов
echo "3. Настраиваем ротацию логов..."
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:workerInterval 3600
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'

# Создание директории для логов
echo "4. Создаем директорию для логов..."
mkdir -p logs
mkdir -p mqtt_logs

# Запуск приложения
echo "5. Запускаем приложение..."
pm2 start ecosystem.config.js --env production

# Сохранение конфигурации
echo "6. Сохраняем конфигурацию PM2..."
pm2 save

# Настройка автозапуска
echo "7. Настраиваем автозапуск при загрузке системы..."
sudo pm2 startup systemd -u $USER --hp $HOME
sudo systemctl enable pm2-$USER

echo "=== Установка завершена ==="
echo ""
echo "Полезные команды:"
echo "  pm2 status          - статус процессов"
echo "  pm2 logs            - просмотр логов"
echo "  pm2 monit           - мониторинг в реальном времени"
echo "  pm2 restart all     - перезапуск всех процессов"
echo "  pm2 reload all      - graceful reload"
echo "  pm2 stop all        - остановка всех процессов"