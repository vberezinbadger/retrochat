require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// Конфигурация
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('Запуск сервера...');
console.log('TELEGRAM_TOKEN настроен:', !!(TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE'));
console.log('TELEGRAM_CHAT_ID настроен:', !!(TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE'));

// Хранение сообщений
let messages = [];

// Инициализация Telegram бота
let bot = null;
if (TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    try {
        const TelegramBot = require('node-telegram-bot-api');
        
        bot = new TelegramBot(TELEGRAM_TOKEN, { 
            polling: NODE_ENV === 'development'
        });
        
        console.log('✅ Telegram бот подключен (polling=' + (NODE_ENV === 'development') + ')');
        
        // Обработчик сообщений из Telegram
        bot.on('message', (msg) => {
            console.log('📨 Получено из Telegram:', {
                chat_id: msg.chat.id,
                expected_chat_id: TELEGRAM_CHAT_ID,
                from: msg.from.first_name,
                text: msg.text
            });
            
            // Проверяем что это наш чат и есть текст
            if (TELEGRAM_CHAT_ID && 
                msg.chat.id.toString() === TELEGRAM_CHAT_ID.toString() && 
                msg.text && 
                msg.text.trim() &&
                !msg.text.startsWith('[WEB]')) { // Не обрабатываем свои сообщения
                
                const messageData = {
                    nickname: msg.from.first_name || msg.from.username || 'Telegram User',
                    text: msg.text.trim(),
                    timestamp: Date.now(),
                    source: 'telegram'
                };
                
                messages.push(messageData);
                console.log('✅ Сообщение из Telegram добавлено:', messageData);
                
                // Ограничиваем количество сообщений
                if (messages.length > 100) {
                    messages = messages.slice(-50);
                }
            }
        });
        
        bot.on('error', (error) => {
            console.error('❌ Ошибка Telegram бота:', error.message);
        });
        
        bot.on('polling_error', (error) => {
            console.error('❌ Ошибка polling:', error.message);
        });
        
    } catch (error) {
        console.error('❌ Ошибка подключения к Telegram:', error.message);
    }
} else {
    console.warn('⚠️ Telegram бот не настроен');
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
            console.log('📤 Отправлено в Telegram:', message);
            return true;
        } catch (error) {
            console.error('❌ Ошибка отправки в Telegram:', error.message);
            return false;
        }
    }
    return false;
}

// API получения сообщений
app.get('/api/messages', (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const limit = parseInt(req.query.limit) || 20;
    
    let recentMessages;
    if (since === 0) {
        // Первый запрос - последние сообщения
        recentMessages = messages.slice(-limit);
    } else {
        // Новые сообщения после указанного времени
        recentMessages = messages.filter(msg => msg.timestamp > since);
    }
    
    console.log(`📋 API /messages: since=${since}, limit=${limit}, найдено=${recentMessages.length}`);
    res.json(recentMessages);
});

// API отправки сообщений
app.post('/api/messages', async (req, res) => {
    const { nickname, text } = req.body;
    
    if (!nickname || !text) {
        console.log('❌ Некорректные данные:', req.body);
        return res.status(400).json({ error: 'Nickname and text required' });
    }
    
    const messageData = {
        nickname: nickname.trim(),
        text: text.trim(),
        timestamp: Date.now(),
        source: 'user'
    };
    
    messages.push(messageData);
    console.log('💬 Новое сообщение от пользователя:', messageData);
    
    // Ограничиваем количество сообщений
    if (messages.length > 100) {
        messages = messages.slice(-50);
    }
    
    // Отправляем в Telegram
    const telegramSent = await sendToTelegram(nickname, text);
    
    res.json({ 
        success: true, 
        telegram_sent: telegramSent 
    });
});

// Webhook для production
app.post('/api/telegram-webhook', (req, res) => {
    const update = req.body;
    console.log('🔗 Webhook получен:', update);
    
    if (update.message && TELEGRAM_CHAT_ID && 
        update.message.chat.id.toString() === TELEGRAM_CHAT_ID.toString() && 
        update.message.text &&
        !update.message.text.startsWith('[WEB]')) {
        
        const messageData = {
            nickname: update.message.from.first_name || update.message.from.username || 'Telegram User',
            text: update.message.text.trim(),
            timestamp: Date.now(),
            source: 'telegram'
        };
        
        messages.push(messageData);
        console.log('✅ Сообщение из webhook добавлено:', messageData);
        
        if (messages.length > 100) {
            messages = messages.slice(-50);
        }
    }
    
    res.json({ ok: true });
});

// Статус API
app.get('/api/status', (req, res) => {
    res.json({
        telegram_configured: !!(TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE'),
        chat_configured: !!(TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE'),
        messages_count: messages.length,
        bot_status: bot ? 'connected' : 'disconnected',
        environment: NODE_ENV
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        console.log(`🌐 Откройте http://localhost:${PORT}`);
        
        if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
            console.log('Telegram бот настроен и готов к работе');
        } else {
            console.log('Настройте TELEGRAM_TOKEN и TELEGRAM_CHAT_ID в .env файле');
        }
    });
}
