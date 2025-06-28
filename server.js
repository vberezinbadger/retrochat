require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// Конфигурация
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Проверка наличия обязательных переменных
if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('⚠️  TELEGRAM_TOKEN не настроен');
    if (NODE_ENV === 'production') {
        console.error('❌ В production режиме TELEGRAM_TOKEN обязателен!');
    }
}

if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === 'YOUR_CHAT_ID_HERE') {
    console.warn('⚠️  TELEGRAM_CHAT_ID не настроен');
    if (NODE_ENV === 'production') {
        console.error('❌ В production режиме TELEGRAM_CHAT_ID обязателен!');
    }
}

// Инициализация Telegram бота (только для API роутов)
let bot = null;
if (TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    try {
        const TelegramBot = require('node-telegram-bot-api');
        bot = new TelegramBot(TELEGRAM_TOKEN);
        console.log('✅ Telegram бот подключен');
    } catch (error) {
        console.error('❌ Ошибка подключения к Telegram:', error.message);
    }
}

// Хранение сообщений (в продакшене лучше использовать базу данных)
let messages = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Отправка сообщения в Telegram
async function sendToTelegram(text) {
    if (bot && TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE') {
        try {
            await bot.sendMessage(TELEGRAM_CHAT_ID, text);
        } catch (error) {
            console.error('Ошибка отправки в Telegram:', error.message);
        }
    }
}

// API для получения сообщений
app.get('/api/messages', (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const recentMessages = messages.filter(msg => msg.timestamp > since);
    res.json(recentMessages);
});

// API для отправки сообщений
app.post('/api/messages', async (req, res) => {
    const message = req.body;
    
    // Валидация
    if (!message.nickname || !message.text) {
        return res.status(400).json({ error: 'Nickname and text are required' });
    }
    
    const messageData = {
        nickname: message.nickname,
        text: message.text,
        timestamp: Date.now(),
        source: 'user'
    };
    
    messages.push(messageData);
    
    // Отправка в Telegram
    await sendToTelegram(`💬 ${message.nickname}: ${message.text}`);
    
    res.json({ success: true });
});

// Webhook для Telegram (для получения сообщений из Telegram)
app.post('/api/telegram-webhook', (req, res) => {
    const update = req.body;
    
    if (update.message && TELEGRAM_CHAT_ID && update.message.chat.id.toString() === TELEGRAM_CHAT_ID) {
        const messageData = {
            nickname: update.message.from.first_name || update.message.from.username || 'Telegram User',
            text: update.message.text,
            timestamp: Date.now(),
            source: 'telegram'
        };
        
        messages.push(messageData);
    }
    
    res.json({ ok: true });
});

// API для получения статуса конфигурации
app.get('/api/status', (req, res) => {
    res.json({
        telegram_configured: !!(TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE'),
        chat_configured: !!(TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE'),
        environment: NODE_ENV,
        messages_count: messages.length
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Экспорт для Vercel
module.exports = app;

// Для локальной разработки
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
        console.log(`Откройте http://localhost:${PORT} в браузере`);
    });
}
