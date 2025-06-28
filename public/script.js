(function() {
    var currentUser = null;
    var lastMessageTime = 0;
    var pollInterval;
    var isConnected = false;
    var retryCount = 0;
    var maxRetries = 5;
    
    // Элементы DOM
    var loginScreen = document.getElementById('loginScreen');
    var chatScreen = document.getElementById('chatScreen');
    var loginForm = document.getElementById('loginForm');
    var nicknameInput = document.getElementById('nicknameInput');
    var messageForm = document.getElementById('messageForm');
    var messageInput = document.getElementById('messageInput');
    var messagesList = document.getElementById('messagesList');
    var userNickname = document.getElementById('userNickname');
    var logoutBtn = document.getElementById('logoutBtn');
    var messagesContainer = document.getElementById('messagesContainer');
    
    // Инициализация
    function init() {
        // Проверка поддержки функций
        checkBrowserSupport();
        
        // Обработчики событий
        loginForm.addEventListener('submit', handleLogin);
        messageForm.addEventListener('submit', handleSendMessage);
        logoutBtn.addEventListener('click', handleLogout);
        
        // Обработка Enter в поле ввода сообщения
        messageInput.addEventListener('keypress', function(e) {
            if (e.keyCode === 13 || e.which === 13) {
                e.preventDefault();
                handleSendMessage(e);
            }
        });
        
        // Создание индикатора подключения
        createConnectionStatus();
        
        // Автофокус на поле никнейма
        nicknameInput.focus();
    }
    
    // Проверка поддержки браузера
    function checkBrowserSupport() {
        var body = document.body;
        
        // Проверка поддержки transform
        if (!supportsCSS('transform')) {
            body.className += ' no-transform';
        }
        
        // Проверка поддержки calc
        if (!supportsCSS('calc(100vh - 90px)', 'height')) {
            body.className += ' no-calc';
        }
        
        // Проверка поддержки анимаций
        if (!supportsCSS('animation')) {
            body.className += ' no-animation';
        }
        
        // Режим для очень старых браузеров
        if (isLegacyBrowser()) {
            body.className += ' legacy-mode';
        }
    }
    
    // Проверка поддержки CSS свойств
    function supportsCSS(property, value) {
        var element = document.createElement('div');
        var prefixes = ['', '-webkit-', '-moz-', '-ms-', '-o-'];
        
        for (var i = 0; i < prefixes.length; i++) {
            try {
                element.style[prefixes[i] + property] = value || 'test';
                if (element.style[prefixes[i] + property]) {
                    return true;
                }
            } catch (e) {}
        }
        return false;
    }
    
    // Определение старых браузеров
    function isLegacyBrowser() {
        var ua = navigator.userAgent.toLowerCase();
        return ua.indexOf('opera mini') !== -1 || 
               ua.indexOf('symbian') !== -1 ||
               ua.indexOf('windows ce') !== -1 ||
               (ua.indexOf('msie') !== -1 && parseInt(ua.split('msie')[1]) < 9);
    }
    
    // Создание индикатора подключения
    function createConnectionStatus() {
        var status = document.createElement('div');
        status.id = 'connectionStatus';
        status.className = 'connection-status';
        status.textContent = 'Подключение...';
        document.body.appendChild(status);
    }
    
    // Обновление статуса подключения
    function updateConnectionStatus(connected, message) {
        var status = document.getElementById('connectionStatus');
        if (!status) return;
        
        isConnected = connected;
        
        if (connected) {
            status.className = 'connection-status connected';
            status.textContent = message || 'Подключено';
            setTimeout(function() {
                status.className = 'connection-status';
            }, 2000);
        } else {
            status.className = 'connection-status show';
            status.textContent = message || 'Нет подключения';
        }
    }
    
    // Обработка входа в чат
    function handleLogin(e) {
        e.preventDefault();
        var nickname = nicknameInput.value.trim();
        
        if (nickname.length < 2) {
            alert('Никнейм должен содержать минимум 2 символа');
            return;
        }
        
        if (nickname.length > 20) {
            alert('Никнейм слишком длинный (максимум 20 символов)');
            return;
        }
        
        currentUser = nickname;
        userNickname.textContent = nickname;
        
        // Переключение экранов
        loginScreen.className = 'screen hidden';
        chatScreen.className = 'screen';
        
        messageInput.focus();
        
        // Добавляем приветственное сообщение
        displayMessage({
            nickname: 'Система',
            text: 'Добро пожаловать в чат, ' + nickname + '!',
            timestamp: Date.now(),
            source: 'system'
        });
        
        // Начинаем polling сообщений
        startPolling();
    }
    
    // Начало polling сообщений
    function startPolling() {
        updateConnectionStatus(false, 'Подключение...');
        
        // Загружаем существующие сообщения
        loadMessages();
        
        // Запускаем периодический опрос
        pollInterval = setInterval(loadMessages, 3000);
    }
    
    // Загрузка сообщений
    function loadMessages() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/messages?since=' + lastMessageTime, true);
        xhr.timeout = 10000; // 10 секунд таймаут
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var messages = JSON.parse(xhr.responseText);
                        var newMessages = 0;
                        
                        for (var i = 0; i < messages.length; i++) {
                            displayMessage(messages[i]);
                            if (messages[i].timestamp > lastMessageTime) {
                                lastMessageTime = messages[i].timestamp;
                                newMessages++;
                            }
                        }
                        
                        if (newMessages > 0 || !isConnected) {
                            updateConnectionStatus(true, 'Получено сообщений: ' + newMessages);
                        }
                        
                        retryCount = 0;
                    } catch (e) {
                        console.error('Ошибка парсинга сообщений:', e);
                        updateConnectionStatus(false, 'Ошибка данных');
                    }
                } else {
                    handleConnectionError();
                }
            }
        };
        
        xhr.ontimeout = function() {
            handleConnectionError('Таймаут соединения');
        };
        
        xhr.onerror = function() {
            handleConnectionError('Ошибка сети');
        };
        
        xhr.send();
    }
    
    // Обработка ошибок подключения
    function handleConnectionError(message) {
        retryCount++;
        updateConnectionStatus(false, message || 'Ошибка подключения');
        
        if (retryCount >= maxRetries) {
            clearInterval(pollInterval);
            updateConnectionStatus(false, 'Нет соединения. Попробуйте перезагрузить страницу.');
        }
    }
    
    // Отправка сообщения
    function handleSendMessage(e) {
        e.preventDefault();
        var message = messageInput.value.trim();
        
        if (!message) return;
        
        if (message.length > 500) {
            alert('Сообщение слишком длинное (максимум 500 символов)');
            return;
        }
        
        var sendButton = messageForm.querySelector('button');
        sendButton.disabled = true;
        sendButton.textContent = 'Отправка...';
        
        var messageData = {
            nickname: currentUser,
            text: message,
            timestamp: Date.now()
        };
        
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/messages', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 5000;
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                sendButton.disabled = false;
                sendButton.textContent = 'Отправить';
                
                if (xhr.status === 200) {
                    messageInput.value = '';
                    messageInput.focus();
                    // Принудительно обновляем сообщения
                    setTimeout(loadMessages, 500);
                } else {
                    alert('Ошибка отправки сообщения. Попробуйте еще раз.');
                }
            }
        };
        
        xhr.ontimeout = function() {
            sendButton.disabled = false;
            sendButton.textContent = 'Отправить';
            alert('Таймаут отправки. Попробуйте еще раз.');
        };
        
        xhr.onerror = function() {
            sendButton.disabled = false;
            sendButton.textContent = 'Отправить';
            alert('Ошибка сети. Проверьте подключение.');
        };
        
        xhr.send(JSON.stringify(messageData));
    }
    
    // Отображение сообщения
    function displayMessage(data) {
        // Проверяем, не дублируется ли сообщение
        var existingMessages = messagesList.querySelectorAll('.message');
        for (var i = 0; i < existingMessages.length; i++) {
            var existing = existingMessages[i];
            if (existing.getAttribute('data-timestamp') === data.timestamp.toString() &&
                existing.getAttribute('data-author') === data.nickname) {
                return; // Сообщение уже отображено
            }
        }
        
        var messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + (data.source || 'user');
        messageDiv.setAttribute('data-timestamp', data.timestamp);
        messageDiv.setAttribute('data-author', data.nickname);
        
        var authorDiv = document.createElement('div');
        authorDiv.className = 'message-author';
        authorDiv.textContent = data.nickname;
        
        var textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = data.text;
        
        var timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        var time = new Date(data.timestamp);
        var hours = time.getHours();
        var minutes = time.getMinutes();
        timeDiv.textContent = (hours < 10 ? '0' : '') + hours + ':' + 
            (minutes < 10 ? '0' : '') + minutes;
        
        messageDiv.appendChild(authorDiv);
        messageDiv.appendChild(textDiv);
        messageDiv.appendChild(timeDiv);
        
        messagesList.appendChild(messageDiv);
        
        // Автоскролл вниз
        setTimeout(function() {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
        
        // Ограничиваем количество сообщений для экономии памяти
        var messages = messagesList.querySelectorAll('.message');
        if (messages.length > 100) {
            for (var j = 0; j < 20; j++) {
                if (messages[j]) {
                    messagesList.removeChild(messages[j]);
                }
            }
        }
    }
    
    // Выход из чата
    function handleLogout() {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        
        currentUser = null;
        lastMessageTime = 0;
        retryCount = 0;
        messagesList.innerHTML = '';
        nicknameInput.value = '';
        
        var status = document.getElementById('connectionStatus');
        if (status) {
            status.className = 'connection-status';
        }
        
        chatScreen.className = 'screen hidden';
        loginScreen.className = 'screen';
        
        nicknameInput.focus();
    }
    
    // Запуск приложения
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();