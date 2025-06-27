#!/usr/bin/env node

// scripts/check-ssl.js - Диагностика SSL сертификатов

const fs = require('fs');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkCertificates() {
  console.log('🔐 Проверка SSL сертификатов...\n');

  const keyPath = './certs/server.key';
  const certPath = './certs/server.crt';

  // Проверка существования файлов
  if (!fs.existsSync(keyPath)) {
    log(colors.red, '❌ Файл server.key не найден');
    return false;
  }

  if (!fs.existsSync(certPath)) {
    log(colors.red, '❌ Файл server.crt не найден');
    return false;
  }

  log(colors.green, '✅ SSL файлы найдены');

  // Проверка прав доступа
  try {
    const keyStats = fs.statSync(keyPath);
    const certStats = fs.statSync(certPath);

    const keyMode = (keyStats.mode & parseInt('777', 8)).toString(8);
    const certMode = (certStats.mode & parseInt('777', 8)).toString(8);

    console.log(`📁 Права доступа:`);
    console.log(`   server.key: ${keyMode} ${keyMode === '600' ? '✅' : '⚠️'}`);
    console.log(`   server.crt: ${certMode} ${certMode === '644' ? '✅' : '⚠️'}`);

    if (keyMode !== '600') {
      log(colors.yellow, '💡 Рекомендуется: chmod 600 certs/server.key');
    }
  } catch (error) {
    log(colors.red, `❌ Ошибка проверки прав: ${error.message}`);
  }

  // Анализ сертификата
  try {
    console.log('\n📋 Информация о сертификате:');
    
    const certInfo = execSync(`openssl x509 -in ${certPath} -text -noout`, { encoding: 'utf8' });
    
    // Извлекаем основную информацию
    const subjectMatch = certInfo.match(/Subject: (.+)/);
    const issuerMatch = certInfo.match(/Issuer: (.+)/);
    const validFromMatch = certInfo.match(/Not Before: (.+)/);
    const validToMatch = certInfo.match(/Not After : (.+)/);

    if (subjectMatch) {
      console.log(`   Subject: ${subjectMatch[1]}`);
    }
    
    if (issuerMatch) {
      console.log(`   Issuer: ${issuerMatch[1]}`);
    }

    if (validFromMatch && validToMatch) {
      const validFrom = new Date(validFromMatch[1]);
      const validTo = new Date(validToMatch[1]);
      const now = new Date();

      console.log(`   Valid from: ${validFrom.toLocaleDateString()}`);
      console.log(`   Valid to: ${validTo.toLocaleDateString()}`);

      if (now < validFrom) {
        log(colors.red, '   ❌ Сертификат еще не действителен');
      } else if (now > validTo) {
        log(colors.red, '   ❌ Сертификат истек');
      } else {
        const daysLeft = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));
        log(colors.green, `   ✅ Сертификат действителен (осталось ${daysLeft} дней)`);
      }
    }

    // Извлекаем SAN записи
    const sanMatch = certInfo.match(/X509v3 Subject Alternative Name:\s*\n\s*(.+)/);
    if (sanMatch) {
      console.log(`\n🌐 Subject Alternative Names:`);
      const sans = sanMatch[1].split(', ');
      sans.forEach(san => {
        console.log(`   ${san}`);
      });
    }

    // Проверяем домен
    const domain = process.env.MQTT_DOMAIN || 'localhost';
    console.log(`\n🎯 Проверка для домена: ${domain}`);

    const cnMatch = certInfo.match(/CN\s*=\s*([^,\n]+)/);
    const cn = cnMatch ? cnMatch[1].trim() : null;

    if (cn === domain) {
      log(colors.green, '   ✅ CN совпадает с доменом');
    } else {
      log(colors.yellow, `   ⚠️  CN (${cn}) не совпадает с доменом (${domain})`);
    }

    if (sanMatch) {
      const hasDomainInSan = sanMatch[1].includes(`DNS:${domain}`) || sanMatch[1].includes(`DNS:*.${domain.split('.').slice(1).join('.')}`);
      if (hasDomainInSan) {
        log(colors.green, '   ✅ Домен найден в SAN записях');
      } else {
        log(colors.red, '   ❌ Домен НЕ найден в SAN записях');
        log(colors.cyan, '   💡 Пересоздайте сертификат: MQTT_DOMAIN=' + domain + ' npm run certs:recreate');
      }
    }

  } catch (error) {
    log(colors.red, `❌ Ошибка анализа сертификата: ${error.message}`);
  }

  return true;
}

function checkSSLConnection() {
  const domain = process.env.MQTT_DOMAIN || 'localhost';
  const ports = [8883, 8888]; // MQTTS и WSS

  console.log(`\n🔌 Проверка SSL соединений с ${domain}:`);

  ports.forEach(port => {
    try {
      console.log(`\n   Порт ${port}:`);
      const result = execSync(
        `timeout 5s openssl s_client -connect ${domain}:${port} -servername ${domain} </dev/null 2>&1 || echo "Connection failed"`,
        { encoding: 'utf8' }
      );

      if (result.includes('Verify return code: 0')) {
        log(colors.green, '   ✅ SSL соединение успешно');
      } else if (result.includes('certificate verify failed')) {
        log(colors.yellow, '   ⚠️  Сертификат не прошел проверку (самоподписанный)');
      } else if (result.includes('Connection refused') || result.includes('Connection failed')) {
        log(colors.red, '   ❌ Соединение отклонено (сервер не запущен?)');
      } else {
        log(colors.yellow, '   ⚠️  Неопределенный статус соединения');
      }
    } catch (error) {
      log(colors.red, `   ❌ Ошибка проверки порта ${port}: ${error.message}`);
    }
  });
}

function main() {
  console.log('🔐 SSL Диагностика MQTT брокера\n');

  if (checkCertificates()) {
    checkSSLConnection();
  }

  console.log('\n💡 Полезные команды:');
  console.log('   npm run certs:recreate  - Пересоздать сертификаты');
  console.log('   npm run test:connections - Тестировать все протоколы');
  console.log('   npm run health          - Проверить статус брокера');
}

main(); 