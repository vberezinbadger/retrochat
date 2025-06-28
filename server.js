require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// Конфигурация
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Проверка переменных
if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('TELEGRAM_TOKEN не настроен');
}

if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === 'YOUR_CHAT_ID_HERE') {
    console.warn('TELEGRAM_CHAT_ID не настроен');
}

// Инициализация Telegram бота
let bot = null;
if (TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    try {
        const TelegramBot = require('node-telegram-bot-api');
        bot = new TelegramBot(TELEGRAM_TOKEN, { 
            polling: NODE_ENV === 'development',
            webHook: false 
        });
        
        console.log('Telegram бот подключен');
        
        // Обработчик сообщений из Telegram
        bot.on('message', (msg) => {
            if (TELEGRAM_CHAT_ID && msg.chat.id.toString() === TELEGRAM_CHAT_ID && msg.text) {
                const messageData = {
                    nickname: msg.from.first_name || msg.from.username || 'Telegram User',
                    text: msg.text,
                    timestamp: Date.now(),
                    source: 'telegram'
                };
                
                messages.push(messageData);
                console.log('Сообщение из Telegram добавлено');
            }
        });
        
        bot.on('error', (error) => {
            console.error('Ошибка Telegram бота:', error.message);
        });
        
    } catch (error) {
        console.error('Ошибка подключения к Telegram:', error.message);
    }
}

// Хранение сообщений
let messages = [];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Отправка в Telegram
async function sendToTelegram(text) {
    if (bot && TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE') {
        try {
            await bot.sendMessage(TELEGRAM_CHAT_ID, text);
            console.log('Отправлено в Telegram');
        } catch (error) {
            console.error('Ошибка отправки в Telegram:', error.message);
        }
    }
}

// API получения сообщений
app.get('/api/messages', (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const limit = parseInt(req.query.limit) || 30;
    
    let recentMessages;
    if (since === 0) {
        recentMessages = messages.slice(-limit);
    } else {
        recentMessages = messages.filter(msg => msg.timestamp > since);
    }
    
    res.json(recentMessages);
});

// API отправки сообщений
app.post('/api/messages', async (req, res) => {
    const { nickname, text } = req.body;
    
    if (!nickname || !text) {
        return res.status(400).json({ error: 'Nickname and text required' });
    }
    
    const messageData = {
        nickname: nickname,
        text: text,
        timestamp: Date.now(),
        source: 'user'
    };
    
    messages.push(messageData);
    
    // Отправляем в Telegram
    await sendToTelegram(`${nickname}: ${text}`);
    
    res.json({ success: true });
});

// Webhook для Telegram
app.post('/api/telegram-webhook', (req, res) => {
    const update = req.body;
    
    if (update.message && TELEGRAM_CHAT_ID && 
        update.message.chat.id.toString() === TELEGRAM_CHAT_ID && 
        update.message.text) {
        
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

// Статус
app.get('/api/status', (req, res) => {
    res.json({
        telegram_configured: !!(TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE'),
        chat_configured: !!(TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE'),
        messages_count: messages.length,
        bot_status: bot ? 'connected' : 'disconnected'
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API для тестирования Telegram соединения
app.get('/api/test-telegram', async (req, res) => {
    if (!bot) {
        return res.json({ error: 'Telegram бот не подключен' });
    }
    
    try {
        const me = await bot.getMe();
        res.json({ 
            success: true, 
            bot_info: me,
            chat_id: TELEGRAM_CHAT_ID 
        });
    } catch (error) {
        res.json({ 
            error: error.message 
        });
    }
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
