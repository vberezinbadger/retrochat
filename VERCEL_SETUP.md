# Настройка проекта на Vercel

## Способ 1: Через веб-интерфейс Vercel (Рекомендуется)

### 1. Подготовка проекта
```bash
# Убедитесь, что проект загружен на GitHub
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Деплой на Vercel
1. Зайдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите ваш репозиторий
5. Нажмите "Deploy"

### 3. Настройка переменных окружения
1. После деплоя перейдите в настройки проекта
2. Откройте вкладку "Environment Variables"
3. Добавьте переменные:

| Name | Value | Environment |
|------|-------|-------------|
| `TELEGRAM_TOKEN` | Ваш токен бота | Production, Preview, Development |
| `TELEGRAM_CHAT_ID` | ID вашего чата | Production, Preview, Development |

### 4. Настройка Telegram Webhook
После деплоя выполните запрос для настройки webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-project.vercel.app/api/telegram-webhook"}'
```

Замените:
- `<YOUR_BOT_TOKEN>` на токен вашего бота
- `your-project.vercel.app` на URL вашего Vercel проекта

## Способ 2: Через Vercel CLI

### 1. Установка Vercel CLI
```bash
npm i -g vercel
```

### 2. Логин и деплой
```bash
vercel login
vercel
```

### 3. Добавление переменных окружения
```bash
vercel env add TELEGRAM_TOKEN
# Введите значение токена

vercel env add TELEGRAM_CHAT_ID
# Введите ID чата
```

### 4. Повторный деплой
```bash
vercel --prod
```

## Проверка настройки

### 1. Проверьте статус конфигурации
Откройте: `https://your-project.vercel.app/api/status`

Должен вернуться JSON:
```json
{
  "telegram_configured": true,
  "chat_configured": true,
  "environment": "production",
  "messages_count": 0
}
```

### 2. Проверьте webhook
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

## Получение данных для настройки

### Токен бота (@BotFather)
1. Напишите @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен (выглядит как: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### ID чата
1. Добавьте бота в чат
2. Напишите любое сообщение в чат
3. Откройте: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Найдите `"chat":{"id":-123456789}` в ответе
5. Скопируйте значение ID (например: `-123456789`)

## Структура файлов для Vercel

```
project/
├── server.js          # Основной сервер
├── vercel.json        # Конфигурация Vercel
├── package.json       # Зависимости
├── .env              # Локальные переменные (не загружать в git!)
├── .gitignore        # Исключения для git
└── public/           # Статические файлы
    ├── index.html
    ├── style.css
    └── script.js
```

## Полезные команды

```bash
# Просмотр логов
vercel logs

# Просмотр переменных окружения
vercel env ls

# Удаление переменной
vercel env rm VARIABLE_NAME

# Локальная разработка с Vercel
vercel dev
```

## Troubleshooting

### Проблема: "TELEGRAM_TOKEN не настроен"
- Проверьте переменные окружения в настройках Vercel
- Убедитесь, что переменные добавлены для всех окружений

### Проблема: Сообщения из Telegram не приходят
- Проверьте webhook: `/api/telegram-webhook`
- Убедитесь, что ID чата правильный
- Проверьте логи Vercel

### Проблема: 404 на статических файлах
- Убедитесь, что файлы находятся в папке `public/`
- Проверьте `vercel.json` конфигурацию
