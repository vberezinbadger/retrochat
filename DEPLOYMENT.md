# Деплой на Vercel

## Подготовка к деплою

1. **Создайте GitHub репозиторий:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
   git push -u origin main
   ```

2. **Убедитесь, что .env содержит только примеры:**
   - Файл `.env` должен содержать `YOUR_BOT_TOKEN_HERE` вместо реального токена
   - Реальные токены НЕ должны попадать в репозиторий

## Деплой на Vercel

1. **Зайдите на [vercel.com](https://vercel.com) и подключите GitHub**

2. **Импортируйте ваш репозиторий**

3. **Настройте переменные окружения в Vercel:**
   - Перейдите в Settings → Environment Variables
   - Добавьте переменные:
     ```
     TELEGRAM_TOKEN = ваш_реальный_токен_бота
     TELEGRAM_CHAT_ID = ваш_реальный_chat_id
     NODE_ENV = production
     ```

4. **Настройте Telegram webhook:**
   - После деплоя получите URL вашего приложения (например: https://ваш-проект.vercel.app)
   - Настройте webhook для бота:
     ```
     https://api.telegram.org/bot<ВАШ_ТОКЕН>/setWebhook?url=https://ваш-проект.vercel.app/api/telegram-webhook
     ```

## Важные моменты безопасности

- ❌ Никогда не коммитьте файлы с реальными токенами
- ✅ Используйте переменные окружения Vercel для секретов
- ✅ Файл `.env` должен быть в `.gitignore`
- ✅ Проверьте, что .env содержит только примеры перед коммитом

## Проверка деплоя

1. Откройте ваш сайт на Vercel
2. Проверьте работу чата
3. Отправьте сообщение и убедитесь, что оно приходит в Telegram
4. Напишите в Telegram и проверьте, что сообщение появляется на сайте
