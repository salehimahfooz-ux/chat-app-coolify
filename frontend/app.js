let socket = null;
let username = null;

function connect() {
    // آدرس IP سرور - اینجا IP خودت رو بذار
    const wsUrl = "ws://91.212.174.177:8765";
    console.log('🔗 Connecting to WebSocket:', wsUrl);
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('✅ Connected to chat server!');
        updateStatus(true);
    };
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 Received:', data);
            
            if (data.type === 'welcome') {
                showMessage(data.message, 'system');
            } else if (data.type === 'user_info') {
                showMessage('خوش آمدید ' + data.username + '!', 'system');
                username = data.username;
            } else if (data.type === 'message') {
                showMessage(data.username + ': ' + data.content, 'message');
            } else if (data.type === 'error') {
                showMessage('خطا: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('❌ Error parsing message:', error);
        }
    };
    
    socket.onclose = () => {
        console.log('❌ Disconnected from server');
        updateStatus(false);
        // تلاش مجدد بعد از 5 ثانیه
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connect();
        }, 5000);
    };
    
    socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
    };
}

function updateStatus(connected) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = connected ? '🟢 آنلاین' : '🔴 آفلاین';
        statusElement.style.color = connected ? '#28a745' : '#dc3545';
    }
}

function login() {
    const usernameInput = document.getElementById('usernameInput');
    const name = usernameInput.value.trim();
    
    if (name.length < 2) {
        alert('⚠️ نام کاربری باید حداقل ۲ کاراکتر باشد');
        return;
    }
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'register',
            username: name
        }));
        
        // مخفی کردن بخش login و نمایش چت
        const loginBox = document.getElementById('loginBox');
        const chatBox = document.getElementById('chatBox');
        if (loginBox) loginBox.style.display = 'none';
        if (chatBox) chatBox.style.display = 'block';
        
        const messageInput = document.getElementById('messageInput');
        if (messageInput) messageInput.focus();
    } else {
        alert('❌ اتصال به سرور برقرار نیست. لطفاً کمی صبر کنید...');
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'chat',
            content: message
        }));
        
        // نمایش پیام خود کاربر
        showMessage('شما: ' + message, 'own');
        input.value = '';
        input.focus();
    } else {
        alert('❌ اتصال برقرار نیست');
    }
}

function showMessage(text, type) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    // حذف پیام خوش‌آمدگویی اولیه
    const welcomeMsg = messagesContainer.querySelector('.welcome');
    if (welcomeMsg) welcomeMsg.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const time = new Date().toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // استایل‌های مختلف برای انواع پیام
    if (type === 'own') {
        messageDiv.style.textAlign = 'left';
        messageDiv.style.color = '#007bff';
        messageDiv.style.marginLeft = 'auto';
        messageDiv.style.maxWidth = '70%';
    } else if (type === 'system') {
        messageDiv.style.textAlign = 'center';
        messageDiv.style.color = '#6c757d';
        messageDiv.style.fontStyle = 'italic';
        messageDiv.style.margin = '10px 0';
    } else {
        messageDiv.style.textAlign = 'right';
        messageDiv.style.color = '#343a40';
        messageDiv.style.maxWidth = '70%';
    }
    
    messageDiv.innerHTML = `
        <div style="font-size: 12px; color: #6c757d; margin-bottom: 2px;">
            ${time}
        </div>
        <div>${text}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// شروع اتصال وقتی صفحه load شد
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Chat application starting...');
    connect();
    
    // رویداد Enter برای ورود
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
    }
    
    // رویداد Enter برای ارسال پیام
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendMessage();
        });
    }
});

// توابع global برای استفاده در onclick
window.login = login;
window.sendMessage = sendMessage;
