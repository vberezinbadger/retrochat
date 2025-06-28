(function() {
    var socket;
    var currentUser = null;
    var isOldBrowser = false;
    var lastMessageTime = 0;
    var pollInterval;
    var isConnected = false;
    var retryCount = 0;
    var maxRetries = 5;
    var isHistoryLoaded = false;
    
    // Детектор старых браузеров
    function detectOldBrowser() {
        var ua = navigator.userAgent.toLowerCase();
        isOldBrowser = ua.indexOf('opera mini') > -1 || 
                      ua.indexOf('symbian') > -1 ||
                      ua.indexOf('series60') > -1 ||
                      !document.querySelector ||
                      !window.JSON;
        
        if (isOldBrowser) {
            document.body.className += ' opera-mini';
        }
    }
    
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
        detectOldBrowser();
        
        // Фикс для старых браузеров - простые обработчики событий
        if (loginForm.addEventListener) {
            loginForm.addEventListener('submit', handleLogin, false);
            messageForm.addEventListener('submit', handleSendMessage, false);
            logoutBtn.addEventListener('click', handleLogout, false);
        } else {
            // Для IE8 и старше
            loginForm.attachEvent('onsubmit', handleLogin);
            messageForm.attachEvent('onsubmit', handleSendMessage);
            logoutBtn.attachEvent('onclick', handleLogout);
        }
        
        // Автофокус на поле ввода для удобства
        if (nicknameInput.focus) {
            setTimeout(function() {
                nicknameInput.focus();
            }, 100);
        }
    }
    
    // Обработка входа в чат
    function handleLogin(e) {
        if (e.preventDefault) {
            e.preventDefault();
        } else {
            e.returnValue = false;
        }
        
        var nickname = nicknameInput.value;
        if (nickname.replace) {
            nickname = nickname.replace(/^\s+|\s+$/g, '');
        }
        
        if (nickname.length < 2) {
            alert('Никнейм должен содержать минимум 2 символа');
            return false;
        }
        
        currentUser = nickname;
        userNickname.innerHTML = nickname;
        
        // Очистить список сообщений
        messagesList.innerHTML = '<div class="loading">⏳ Загрузка сообщений...</div>';
        
        // Загрузить историю сообщений
        loadMessageHistory();
        
        // Переключение экранов
        loginScreen.className = 'screen hidden';
        chatScreen.className = 'screen';
        
        if (messageInput.focus) {
            setTimeout(function() {
                messageInput.focus();
            }, 100);
        }
        
        return false;
    }
    
    // Загрузка истории сообщений
    function loadMessageHistory() {
        var xhr = createXHR();
        if (!xhr) {
            startPolling();
            return;
        }
        
        xhr.open('GET', '/api/messages?limit=20', true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                var loadingElement = document.querySelector('.loading');
                if (loadingElement && loadingElement.parentNode) {
                    loadingElement.parentNode.removeChild(loadingElement);
                }
                
                if (xhr.status === 200) {
                    try {
                        var messages = JSON.parse(xhr.responseText);
                        console.log('📚 Загружена история:', messages.length, 'сообщений');
                        
                        for (var i = 0; i < messages.length; i++) {
                            displayMessage(messages[i]);
                            if (messages[i].timestamp > lastMessageTime) {
                                lastMessageTime = messages[i].timestamp;
                            }
                        }
                        
                        isHistoryLoaded = true;
                        isConnected = true;
                        retryCount = 0;
                        
                        // Запустить polling для новых сообщений
                        startPolling();
                        
                    } catch (e) {
                        console.error('Ошибка парсинга истории:', e);
                        showConnectionError();
                        startPolling();
                    }
                } else {
                    console.error('Ошибка загрузки истории:', xhr.status);
                    showConnectionError();
                    startPolling();
                }
            }
        };
        
        xhr.onerror = function() {
            var loadingElement = document.querySelector('.loading');
            if (loadingElement && loadingElement.parentNode) {
                loadingElement.parentNode.removeChild(loadingElement);
            }
            showConnectionError();
            startPolling();
        };
        
        xhr.send();
    }
    
    // Подключение к серверу
    function connectToServer() {
        // Загрузить историю сообщений
        loadMessageHistory();
    }
    
    // Запуск polling
    function startPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        
        pollInterval = setInterval(function() {
            var xhr = createXHR();
            if (!xhr) return;
            
            xhr.open('GET', '/api/messages?since=' + lastMessageTime, true);
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            var messages = JSON.parse(xhr.responseText);
                            
                            if (messages.length > 0) {
                                console.log('📨 Получено новых сообщений:', messages.length);
                                
                                for (var i = 0; i < messages.length; i++) {
                                    // Не показываем свои собственные сообщения повторно
                                    if (!(messages[i].source === 'user' && messages[i].nickname === currentUser)) {
                                        displayMessage(messages[i]);
                                    }
                                    
                                    if (messages[i].timestamp > lastMessageTime) {
                                        lastMessageTime = messages[i].timestamp;
                                    }
                                }
                            }
                            
                            isConnected = true;
                            retryCount = 0;
                            
                        } catch (e) {
                            console.error('Ошибка парсинга сообщений:', e);
                        }
                    } else {
                        console.error('Ошибка получения сообщений:', xhr.status);
                        isConnected = false;
                        retryCount++;
                        
                        if (retryCount >= maxRetries) {
                            showConnectionError();
                        }
                    }
                }
            };
            
            xhr.onerror = function() {
                console.error('Ошибка сетевого запроса');
                isConnected = false;
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    showConnectionError();
                }
            };
            
            xhr.send();
        }, 2000);
    }
    
    // Альтернативный метод для старых браузеров
    function pollMessages() {
        startPolling();
    }
    
    // Показать ошибку соединения
    function showConnectionError() {
        var errorDiv = document.createElement('div');
        errorDiv.className = 'connection-error';
        errorDiv.innerHTML = 'Ошибка соединения. Проверьте интернет.';
        
        var existingError = document.querySelector('.connection-error');
        if (existingError) {
            existingError.parentNode.removeChild(existingError);
        }
        
        messagesList.appendChild(errorDiv);
    }
    
    // Создание XHR объекта для старых браузеров
    function createXHR() {
        if (window.XMLHttpRequest) {
            return new XMLHttpRequest();
        } else if (window.ActiveXObject) {
            try {
                return new ActiveXObject('Microsoft.XMLHTTP');
            } catch (e) {
                return null;
            }
        }
        return null;
    }
    
    // Отправка сообщения
    function handleSendMessage(e) {
        if (e.preventDefault) {
            e.preventDefault();
        } else {
            e.returnValue = false;
        }
        
        var message = messageInput.value;
        if (message.replace) {
            message = message.replace(/^\s+|\s+$/g, '');
        }
        
        if (!message) return false;
        
        var messageData = {
            nickname: currentUser,
            text: message,
            timestamp: new Date().getTime()
        };
        
        // Показываем сообщение сразу для лучшего UX
        displayMessage({
            nickname: currentUser,
            text: message,
            timestamp: messageData.timestamp,
            source: 'user'
        });
        
        // Отправляем на сервер
        var xhr = createXHR();
        if (xhr) {
            xhr.open('POST', '/api/messages', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        console.log('✅ Сообщение отправлено успешно');
                        // Обновляем lastMessageTime чтобы не получить своё сообщение обратно
                        lastMessageTime = messageData.timestamp;
                    } else {
                        console.error('Ошибка отправки сообщения:', xhr.status);
                        showSendError();
                    }
                }
            };
            xhr.send(JSON.stringify(messageData));
        }
        
        messageInput.value = '';
        return false;
    }
    
    // Показать ошибку отправки
    function showSendError() {
        var errorDiv = document.createElement('div');
        errorDiv.className = 'send-error';
        errorDiv.innerHTML = 'Ошибка отправки сообщения';
        
        messagesList.appendChild(errorDiv);
        
        setTimeout(function() {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }
    
    // Отображение сообщения
    function displayMessage(data) {
        var messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + (data.source || 'user');
        
        var authorDiv = document.createElement('div');
        authorDiv.className = 'message-author';
        authorDiv.innerHTML = data.nickname;
        
        var textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = data.text;
        
        var timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        var time = new Date(data.timestamp);
        var hours = time.getHours();
        var minutes = time.getMinutes();
        if (minutes < 10) minutes = '0' + minutes;
        timeDiv.innerHTML = hours + ':' + minutes;
        
        messageDiv.appendChild(authorDiv);
        messageDiv.appendChild(textDiv);
        messageDiv.appendChild(timeDiv);
        
        messagesList.appendChild(messageDiv);
        
        // Прокрутка вниз
        if (messagesContainer.scrollTop !== undefined) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    // Выход из чата
    function handleLogout() {
        if (socket && socket.close) {
            socket.close();
        }
        
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        
        currentUser = null;
        messagesList.innerHTML = '';
        nicknameInput.value = '';
        lastMessageTime = 0;
        isConnected = false;
        retryCount = 0;
        isHistoryLoaded = false;
        
        chatScreen.className = 'screen hidden';
        loginScreen.className = 'screen';
        
        if (nicknameInput.focus) {
            setTimeout(function() {
                nicknameInput.focus();
            }, 100);
        }
    }
    
    // Запуск приложения
    if (document.readyState === 'loading') {
        if (document.addEventListener) {
            document.addEventListener('DOMContentLoaded', init, false);
        } else {
            document.attachEvent('onreadystatechange', function() {
                if (document.readyState === 'complete') {
                    init();
                }
            });
        }
    } else {
        init();
    }
})();