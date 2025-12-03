class ChatApplication {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.username = null;
        this.currentRoom = 'general';
        this.isConnected = false;
        this.messageHistory = [];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.connectWebSocket();
        this.setupAutoLogin();
    }
    
    bindEvents() {
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        document.getElementById('newRoomInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });
        
        // کلیک روی اتاق‌ها
        document.querySelectorAll('.room-item').forEach(item => {
            item.addEventListener('click', () => {
                const room = item.getAttribute('data-room');
                this.joinRoom(room);
            });
        });
        
        window.addEventListener('beforeunload', () => {
            if (this.socket) this.socket.close();
        });
    }
    
    setupAutoLogin() {
        const savedUsername = localStorage.getItem('chat_username');
        if (savedUsername) {
            document.getElementById('usernameInput').value = savedUsername;
        }
    }
    
    connectWebSocket() {
        // در محیط Coolify از آدرس نسبی استفاده می‌کنیم
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        
        let wsUrl;
        
        // اگر در localhost هستیم
        if (host === 'localhost' || host === '127.0.0.1') {
            wsUrl = 'ws://localhost:8765';
        } else {
            // در محیط Coolify
            wsUrl = `${protocol}//${host}/ws`;
        }
        
        console.log('🔗 اتصال به:', wsUrl);
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
            console.log('✅ متصل شد');
            this.updateConnectionStatus(true);
            this.startHeartbeat();
        };
        
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('❌ خطای پردازش پیام:', error);
            }
        };
        
        this.socket.onclose = () => {
            console.log('❌ اتصال قطع شد');
            this.updateConnectionStatus(false);
            this.attemptReconnect();
        };
        
        this.socket.onerror = (error) => {
            console.error('❌ خطای WebSocket:', error);
        };
    }
    
    updateConnectionStatus(connected) {
        this.isConnected = connected;
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');
        
        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'متصل';
            statusText.style.color = '#2ecc71';
        } else {
            statusDot.className = 'status-dot';
            statusText.textContent = 'قطع ارتباط';
            statusText.style.color = '#e74c3c';
        }
    }
    
    startHeartbeat() {
        setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }
    
    attemptReconnect() {
        setTimeout(() => {
            console.log('♻️ تلاش برای اتصال مجدد...');
            this.connectWebSocket();
        }, 5000);
    }
    
    handleMessage(data) {
        console.log('📨 دریافت:', data);
        
        switch (data.type) {
            case 'welcome':
                this.handleWelcome(data);
                break;
            case 'message':
                this.displayMessage(data);
                break;
            case 'user_joined':
                this.handleUserJoined(data);
                break;
            case 'user_joined_room':
                this.handleUserJoinedRoom(data);
                break;
            case 'room_changed':
                this.handleRoomChanged(data);
                break;
            case 'users_list':
                this.updateUsersList(data);
                break;
            case 'error':
                alert('❌ خطا: ' + data.message);
                break;
        }
    }
    
    handleWelcome(data) {
        this.userId = data.user_id;
        this.username = data.username;
        
        localStorage.setItem('chat_username', this.username);
        
        document.getElementById('username').textContent = this.username;
        document.getElementById('userStatus').textContent = 'آنلاین';
        document.getElementById('loginPrompt').style.display = 'none';
        
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendButton').disabled = false;
        document.getElementById('messageInput').focus();
        
        this.showSystemMessage(data.message);
        this.getRoomUsers();
    }
    
    login() {
        const usernameInput = document.getElementById('usernameInput');
        const username = usernameInput.value.trim();
        
        if (username.length < 3) {
            alert('⚠️ نام کاربری باید حداقل ۳ کاراکتر باشد');
            return;
        }
        
        if (!this.isConnected) {
            alert('⚠️ در حال اتصال به سرور...');
            return;
        }
        
        this.send({
            type: 'register',
            username: username,
            user_id: 'user_' + Date.now()
        });
    }
    
    sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message) return;
        if (!this.isConnected) {
            alert('❌ اتصال برقرار نیست');
            return;
        }
        
        this.send({
            type: 'chat',
            content: message
        });
        
        input.value = '';
        input.focus();
    }
    
    displayMessage(data, isOwn = false) {
        const messagesContainer = document.getElementById('messagesContainer');
        
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.remove();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'user' : 'other'}`;
        
        const time = new Date(data.timestamp).toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-username">${isOwn ? 'شما' : data.username}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.content)}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.messageHistory.push({...data, isOwn});
    }
    
    showSystemMessage(text) {
        const messagesContainer = document.getElementById('messagesContainer');
        
        const systemDiv = document.createElement('div');
        systemDiv.className = 'message system';
        systemDiv.textContent = text;
        
        messagesContainer.appendChild(systemDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    handleUserJoined(data) {
        this.showSystemMessage(`${data.username} به چت پیوست (${data.total_users} کاربر)`);
        document.getElementById('onlineCount').textContent = data.total_users;
        this.getRoomUsers();
    }
    
    handleUserJoinedRoom(data) {
        if (data.username !== this.username) {
            this.showSystemMessage(`${data.username} وارد شد`);
        }
    }
    
    handleRoomChanged(data) {
        this.currentRoom = data.room;
        document.getElementById('currentRoom').textContent = `اتاق ${data.room}`;
        this.showSystemMessage(data.message);
        this.clearMessages();
        this.getRoomUsers();
        
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-room') === data.room) {
                item.classList.add('active');
            }
        });
    }
    
    joinRoom(roomName) {
        if (roomName === this.currentRoom) return;
        
        if (!this.isConnected) {
            alert('❌ اتصال برقرار نیست');
            return;
        }
        
        this.send({
            type: 'join_room',
            room: roomName
        });
    }
    
    createRoom() {
        const input = document.getElementById('newRoomInput');
        const roomName = input.value.trim();
        
        if (!roomName) return;
        if (roomName.length < 2) {
            alert('⚠️ نام اتاق باید حداقل ۲ کاراکتر باشد');
            return;
        }
        
        const roomList = document.getElementById('roomList');
        const roomItem = document.createElement('div');
        roomItem.className = 'room-item';
        roomItem.setAttribute('data-room', roomName);
        roomItem.innerHTML = `
            <span>${roomName}</span>
            <span class="room-users">0</span>
        `;
        
        roomItem.addEventListener('click', () => this.joinRoom(roomName));
        roomList.appendChild(roomItem);
        
        input.value = '';
        input.focus();
        
        this.joinRoom(roomName);
    }
    
    getRoomUsers() {
        if (!this.isConnected) return;
        
        this.send({
            type: 'get_users'
        });
    }
    
    updateUsersList(data) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        data.users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <span style="color: #4cc9f0">●</span>
                <span>${user.username}</span>
                <small style="margin-right: auto; color: #888;">
                    ${new Date(user.joined_at).toLocaleTimeString('fa-IR')}
                </small>
            `;
            usersList.appendChild(userItem);
        });
        
        document.getElementById('roomStats').textContent = `${data.users.length} کاربر`;
        
        document.querySelectorAll('.room-item').forEach(item => {
            if (item.getAttribute('data-room') === data.room) {
                item.querySelector('.room-users').textContent = data.users.length;
            }
        });
    }
    
    exportChat() {
        if (this.messageHistory.length === 0) {
            alert('⚠️ چتی برای ذخیره وجود ندارد');
            return;
        }
        
        const chatText = this.messageHistory.map(msg => {
            const time = new Date(msg.timestamp).toLocaleString('fa-IR');
            const sender = msg.isOwn ? 'شما' : msg.username;
            return `[${time}] ${sender}: ${msg.content}`;
        }).join('\n');
        
        const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    toggleEmojiPicker() {
        const picker = document.getElementById('emojiPicker');
        picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    }
    
    addEmoji(emoji) {
        const input = document.getElementById('messageInput');
        const cursorPos = input.selectionStart;
        const text = input.value;
        
        input.value = text.substring(0, cursorPos) + emoji + text.substring(cursorPos);
        input.focus();
        input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        
        document.getElementById('emojiPicker').style.display = 'none';
    }
    
    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.error('❌ WebSocket متصل نیست');
            alert('❌ اتصال برقرار نیست');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    clearMessages() {
        document.getElementById('messagesContainer').innerHTML = '';
    }
}

// ایجاد نمونه از کلاس
const chatApp = new ChatApplication();

// توابع global برای استفاده در onClick
window.chatApp = chatApp;