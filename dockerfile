# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Установка PM2
RUN npm install -g pm2

# Копирование файлов
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Создание директорий
RUN mkdir -p logs mqtt_logs

# Порты
EXPOSE 1883 8887 3001

# Запуск через PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]