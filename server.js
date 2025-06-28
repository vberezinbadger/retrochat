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

// Инициализация Telegram бота
let bot = null;
if (TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    try {
        const TelegramBot = require('node-telegram-bot-api');
        
        // В production используем webhook, в development - polling
        const usePolling = NODE_ENV === 'development';
        bot = new TelegramBot(TELEGRAM_TOKEN, { polling: usePolling });
        
        console.log('✅ Telegram бот подключен', usePolling ? '(polling)' : '(webhook)');
        
        // Обработчик входящих сообщений
        bot.on('message', (msg) => {
            console.log('📨 Получено сообщение из Telegram:', msg);
            
            if (TELEGRAM_CHAT_ID && msg.chat.id.toString() === TELEGRAM_CHAT_ID) {
                const messageData = {
                    nickname: msg.from.first_name || msg.from.username || 'Telegram User',
                    text: msg.text || msg.caption || '[Медиа]',
                    timestamp: Date.now(),
                    source: 'telegram'
                };
                
                messages.push(messageData);
                console.log('💾 Сообщение добавлено в чат:', messageData);
            }
        });
        
        // Обработчик ошибок
        bot.on('error', (error) => {
            console.error('❌ Ошибка Telegram бота:', error.message);
        });
        
        // Обработчик polling ошибок
        bot.on('polling_error', (error) => {
            console.error('❌ Ошибка polling:', error.message);
        });
        
    } catch (error) {
        console.error('❌ Ошибка подключения к Telegram:', error.message);
    }
}

// Хранение сообщений (в продакшене лучше использовать базу данных)
let messages = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для обработки старых браузеров
app.use((req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const isVeryOldBrowser = 
        userAgent.includes('Opera Mini') ||
        userAgent.includes('Symbian') ||
        userAgent.includes('Series60') ||
        userAgent.includes('MSIE 6') ||
        userAgent.includes('MSIE 7');
    
    req.isVeryOldBrowser = isVeryOldBrowser;
    next();
});

// Отправка сообщения в Telegram
async function sendToTelegram(text) {
    if (bot && TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE') {
        try {
            await bot.sendMessage(TELEGRAM_CHAT_ID, text);
            console.log('📤 Сообщение отправлено в Telegram:', text);
        } catch (error) {
            console.error('❌ Ошибка отправки в Telegram:', error.message);
        }
    }
}

// API для получения сообщений
app.get('/api/messages', (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const limit = parseInt(req.query.limit) || 50;
    
    let recentMessages;
    if (since === 0) {
        // При первом запросе отдаем последние сообщения
        recentMessages = messages.slice(-limit);
    } else {
        // При последующих запросах отдаем новые сообщения
        recentMessages = messages.filter(msg => msg.timestamp > since);
    }
    
    console.log(`📋 Запрос сообщений с ${since}, найдено: ${recentMessages.length}`);
    res.json(recentMessages);
});

// API для отправки сообщений - добавим поддержку form data
app.post('/api/messages', async (req, res) => {
    console.log('📝 Получен запрос:', req.body);
    
    let message;
    
    // Поддержка и JSON и form data
    if (req.is('application/json')) {
        message = req.body;
    } else {
        // Form data от старых браузеров
        message = {
            nickname: req.body.nickname,
            text: req.body.text,
            timestamp: Date.now()
        };
    }
    
    // Валидация
    if (!message.nickname || !message.text) {
        if (req.is('application/json')) {
            return res.status(400).json({ error: 'Nickname and text are required' });
        } else {
            // Для старых браузеров - редирект обратно
            return res.redirect('/?error=empty_fields');
        }
    }
    
    const messageData = {
        nickname: message.nickname,
        text: message.text,
        timestamp: message.timestamp || Date.now(),
        source: 'user'
    };
    
    messages.push(messageData);
    console.log('💾 Сообщение добавлено в чат:', messageData);
    
    // Отправка в Telegram
    await sendToTelegram(`💬 ${message.nickname}: ${message.text}`);
    
    if (req.is('application/json')) {
        res.json({ success: true });
    } else {
        // Для старых браузеров - редирект с успехом
        res.redirect('/?success=message_sent');
    }
});

// Webhook для Telegram (для production)
app.post('/api/telegram-webhook', (req, res) => {
    const update = req.body;
    console.log('🔗 Webhook от Telegram:', update);
    
    if (update.message && TELEGRAM_CHAT_ID && update.message.chat.id.toString() === TELEGRAM_CHAT_ID) {
        const messageData = {
            nickname: update.message.from.first_name || update.message.from.username || 'Telegram User',
            text: update.message.text || update.message.caption || '[Медиа]',
            timestamp: Date.now(),
            source: 'telegram'
        };
        
        messages.push(messageData);
        console.log('💾 Сообщение из webhook добавлено:', messageData);
    }
    
    res.json({ ok: true });
});

// API для получения статуса конфигурации
app.get('/api/status', (req, res) => {
    res.json({
        telegram_configured: !!(TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE'),
        chat_configured: !!(TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE'),
        environment: NODE_ENV,
        messages_count: messages.length,
        bot_status: bot ? 'connected' : 'disconnected'
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
            chat_id: TELEGRAM_CHAT_ID 
        });
    } catch (error) {
        res.json({ 
            error: error.message 
        });
    }
});

// Главная страница с определением типа браузера
app.get('/', (req, res) => {
    if (req.isVeryOldBrowser) {
        // Отправляем упрощенную версию
        res.sendFile(path.join(__dirname, 'public', 'fallback.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
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
