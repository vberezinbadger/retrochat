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

// Хранение сообщений
let messages = [];

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
            console.log('Сообщение из Telegram:', {
                chat_id: msg.chat.id,
                expected_id: TELEGRAM_CHAT_ID,
                text: msg.text
            });
            
            // Проверяем ID чата и наличие текста
            if (TELEGRAM_CHAT_ID && 
                msg.chat.id.toString() === TELEGRAM_CHAT_ID.toString() && 
                msg.text && 
                msg.text.trim()) {
                
                const messageData = {
                    nickname: msg.from.first_name || msg.from.username || 'Telegram User',
                    text: msg.text.trim(),
                    timestamp: Date.now(),
                    source: 'telegram'
                };
                
                messages.push(messageData);
                console.log('Сообщение из Telegram добавлено в чат:', messageData.nickname, ':', messageData.text);
                
                // Ограничиваем количество сообщений
                if (messages.length > 100) {
                    messages = messages.slice(-80);
                }
            }
        });
        
        bot.on('error', (error) => {
            console.error('Ошибка Telegram бота:', error.message);
        });
        
        bot.on('polling_error', (error) => {
            console.error('Ошибка polling:', error.message);
        });
        
    } catch (error) {
        console.error('Ошибка подключения к Telegram:', error.message);
    }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Отправка в Telegram
async function sendToTelegram(nickname, text) {
    if (bot && TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE') {
        try {
            const message = `[WEB] ${nickname}: ${text}`;
            await bot.sendMessage(TELEGRAM_CHAT_ID, message);
            console.log('Отправлено в Telegram:', message);
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
    
    console.log('API запрос сообщений: since=' + since + ', найдено=' + recentMessages.length);
    
    res.json(recentMessages);
});

// API отправки сообщений
app.post('/api/messages', async (req, res) => {
    const { nickname, text, timestamp } = req.body;
    
    if (!nickname || !text) {
        return res.status(400).json({ error: 'Nickname and text required' });
    }
    
    const messageData = {
        nickname: nickname.trim(),
        text: text.trim(),
        timestamp: timestamp || Date.now(),
        source: 'user'
    };
    
    messages.push(messageData);
    console.log('Новое сообщение от пользователя:', messageData.nickname, ':', messageData.text);
    
    // Ограничиваем количество сообщений
    if (messages.length > 100) {
        messages = messages.slice(-80);
    }
    
    // Отправляем в Telegram
    await sendToTelegram(nickname, text);
    
    res.json({ success: true });
});

// Webhook для Telegram (для production)
app.post('/api/telegram-webhook', (req, res) => {
    const update = req.body;
    console.log('🔗 Webhook получен:', JSON.stringify(update, null, 2));
    
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
        console.log('✅ Сообщение из webhook добавлено');
        
        // Ограничиваем количество сообщений в памяти
        if (messages.length > 100) {
            messages = messages.slice(-100);
        }
    }
    
    res.json({ ok: true });
});

// Статус
app.get('/api/status', (req, res) => {
    res.json({
        telegram_configured: !!(TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE'),
        chat_configured: !!(TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE'),
        messages_count: messages.length,
        bot_status: bot ? 'connected' : 'disconnected',
        environment: NODE_ENV,
        last_messages: messages.slice(-3).map(m => ({
            nickname: m.nickname,
            source: m.source,
            timestamp: new Date(m.timestamp).toLocaleTimeString()
        }))
    });
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
            chat_id: TELEGRAM_CHAT_ID,
            messages_count: messages.length
        });
    } catch (error) {
        res.json({ 
            error: error.message 
        });
    }
});

// Экспорт для Vercel
module.exports = app;

// Для локальной разработки
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        console.log(`📱 Откройте http://localhost:${PORT} в браузере`);
        
        if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
            console.log('🤖 Telegram бот настроен и готов к работе');
        } else {
            console.log('⚠️  Настройте TELEGRAM_TOKEN и TELEGRAM_CHAT_ID в .env файле');
        }
    });
}
module.exports = app;

// Для локальной разработки
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        console.log(`📱 Откройте http://localhost:${PORT} в браузере`);
        
        if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
            console.log('🤖 Telegram бот настроен и готов к работе');
        } else {
            console.log('⚠️  Настройте TELEGRAM_TOKEN и TELEGRAM_CHAT_ID в .env файле');
        }
    });
}
