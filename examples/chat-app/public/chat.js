/**
 * Cliente de Chat PAMPA - Ejemplo Distribuido
 * Maneja toda la lógica del frontend del chat
 */

class ChatClient {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = 'general';
        this.isConnected = false;
        this.typingTimer = null;
        this.isTyping = false;

        this.init();
    }

    /**
     * Inicializa el cliente
     */
    init() {
        this.bindEvents();
        this.setupWebSocket();
    }

    /**
     * Configura los eventos del DOM
     */
    bindEvents() {
        // Formulario de login
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));

        // Entrada de mensajes
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        messageInput.addEventListener('input', (e) => {
            this.handleTyping();
            this.toggleSendButton();
        });

        sendBtn.addEventListener('click', () => this.sendMessage());

        // Botones de emoji
        const emojiBtn = document.getElementById('emoji-btn');
        const emojiPicker = document.getElementById('emoji-picker');

        emojiBtn.addEventListener('click', () => {
            emojiPicker.classList.toggle('hidden');
        });

        // Selección de emojis
        const emojiElements = document.querySelectorAll('.emoji');
        emojiElements.forEach(emoji => {
            emoji.addEventListener('click', (e) => {
                this.insertEmoji(e.target.dataset.emoji);
                emojiPicker.classList.add('hidden');
            });
        });

        // Botón de crear sala
        const createRoomBtn = document.getElementById('create-room-btn');
        createRoomBtn.addEventListener('click', () => this.showCreateRoomModal());

        // Formulario de crear sala
        const createRoomForm = document.getElementById('create-room-form');
        createRoomForm.addEventListener('submit', (e) => this.handleCreateRoom(e));

        // Botón de información de sala
        const infoBtn = document.getElementById('info-btn');
        infoBtn.addEventListener('click', () => this.showRoomInfo());

        // Cerrar modales
        const closeModalBtns = document.querySelectorAll('.close-modal');
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Cerrar modal al hacer clic en el overlay
        const modalOverlay = document.getElementById('modal-overlay');
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModals();
            }
        });

        // Cerrar emoji picker al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.emoji-picker') && !e.target.closest('#emoji-btn')) {
                emojiPicker.classList.add('hidden');
            }
        });
    }

    /**
     * Configura la conexión WebSocket
     */
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/chat`;

        this.updateConnectionStatus('connecting');

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('🔌 Conectado al servidor WebSocket');
                this.isConnected = true;
                this.updateConnectionStatus('connected');
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.socket.onclose = () => {
                console.log('🔌 Conexión WebSocket cerrada');
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.showNotification('Conexión perdida. Intentando reconectar...', 'warning');

                // Intentar reconectar después de 3 segundos
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.setupWebSocket();
                    }
                }, 3000);
            };

            this.socket.onerror = (error) => {
                console.error('❌ Error en WebSocket:', error);
                this.showNotification('Error de conexión', 'error');
            };

        } catch (error) {
            console.error('❌ Error creando WebSocket:', error);
            this.updateConnectionStatus('disconnected');
        }
    }

    /**
     * Maneja el login del usuario
     */
    handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const room = document.getElementById('room-select').value;

        if (!username) {
            this.showNotification('Por favor ingresa un nombre de usuario', 'error');
            return;
        }

        if (!this.isConnected) {
            this.showNotification('No hay conexión con el servidor', 'error');
            return;
        }

        this.sendToServer({
            type: 'join',
            username: username,
            room: room
        });
    }

    /**
     * Maneja mensajes recibidos del servidor
     */
    handleMessage(data) {
        console.log('📨 Mensaje del servidor:', data.type);

        switch (data.type) {
            case 'welcome':
                this.handleWelcome(data);
                break;
            case 'join_success':
                this.handleJoinSuccess(data);
                break;
            case 'new_message':
                this.displayMessage(data.message);
                break;
            case 'message_history':
                this.displayMessageHistory(data.messages);
                break;
            case 'user_joined':
                this.handleUserJoined(data.user);
                break;
            case 'user_left':
                this.handleUserLeft(data.user);
                break;
            case 'users_list':
                this.updateUsersList(data.users);
                break;
            case 'room_changed':
                this.handleRoomChanged(data);
                break;
            case 'room_created':
                this.handleRoomCreated(data.room);
                break;
            case 'system_message':
                this.displaySystemMessage(data.content);
                break;
            case 'typing':
                this.handleTypingIndicator(data);
                break;
            case 'emoji_reaction':
                this.handleEmojiReaction(data);
                break;
            case 'error':
                this.showNotification(data.message, 'error');
                break;
            case 'pong':
                // Respuesta al ping
                break;
            default:
                console.log('Tipo de mensaje no manejado:', data.type);
        }
    }

    /**
     * Maneja el mensaje de bienvenida
     */
    handleWelcome(data) {
        console.log('👋 Bienvenida recibida');
        this.updateRoomsList(data.rooms);
    }

    /**
     * Maneja el éxito del join
     */
    handleJoinSuccess(data) {
        this.currentUser = data.user;
        this.currentRoom = data.user.currentRoom;

        // Cambiar a la pantalla de chat
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('chat-screen').classList.add('active');

        // Actualizar información del usuario
        this.updateUserInfo();

        // Actualizar información de la sala
        this.updateRoomInfo(data.room);

        this.showNotification(`¡Bienvenido ${data.user.username}!`, 'success');
    }

    /**
     * Maneja cuando un usuario se une
     */
    handleUserJoined(user) {
        this.displaySystemMessage(`${user.username} se unió a la sala`);
    }

    /**
     * Maneja cuando un usuario se va
     */
    handleUserLeft(user) {
        this.displaySystemMessage(`${user.username} salió de la sala`);
    }

    /**
     * Maneja cambio de sala
     */
    handleRoomChanged(data) {
        this.currentRoom = data.newRoom;
        this.updateRoomInfo(data.room);
        this.clearMessages();
        this.showNotification(`Te uniste a ${data.room.name}`, 'info');
    }

    /**
     * Maneja sala creada
     */
    handleRoomCreated(room) {
        this.showNotification(`Sala "${room.name}" creada exitosamente`, 'success');
        this.closeModals();
        // Actualizar lista de salas
        this.requestRoomsList();
    }

    /**
     * Maneja indicador de escritura
     */
    handleTypingIndicator(data) {
        const indicator = document.getElementById('typing-indicator');
        const usersSpan = document.getElementById('typing-users');

        if (data.isTyping) {
            indicator.classList.remove('hidden');
            usersSpan.textContent = `${data.username} está escribiendo...`;

            // Ocultar después de 3 segundos
            setTimeout(() => {
                indicator.classList.add('hidden');
            }, 3000);
        } else {
            indicator.classList.add('hidden');
        }
    }

    /**
     * Maneja reacciones con emoji
     */
    handleEmojiReaction(data) {
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            this.updateMessageReactions(messageElement, data.reactions);
        }
    }

    /**
     * Envía un mensaje al servidor
     */
    sendToServer(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            this.showNotification('No hay conexión con el servidor', 'error');
        }
    }

    /**
     * Envía un mensaje de chat
     */
    sendMessage() {
        const input = document.getElementById('message-input');
        const content = input.value.trim();

        if (!content) return;

        // Verificar si es un comando
        if (content.startsWith('/')) {
            this.sendToServer({
                type: 'command',
                content: content
            });
        } else {
            this.sendToServer({
                type: 'message',
                content: content,
                roomId: this.currentRoom
            });
        }

        input.value = '';
        this.toggleSendButton();
        this.stopTyping();
    }

    /**
     * Maneja el indicador de escritura
     */
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.sendToServer({
                type: 'typing',
                isTyping: true
            });
        }

        // Reiniciar el timer
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.stopTyping();
        }, 2000);
    }

    /**
     * Detiene el indicador de escritura
     */
    stopTyping() {
        if (this.isTyping) {
            this.isTyping = false;
            this.sendToServer({
                type: 'typing',
                isTyping: false
            });
        }
        clearTimeout(this.typingTimer);
    }

    /**
     * Inserta un emoji en el input
     */
    insertEmoji(emoji) {
        const input = document.getElementById('message-input');
        const cursorPos = input.selectionStart;
        const textBefore = input.value.substring(0, cursorPos);
        const textAfter = input.value.substring(cursorPos);

        input.value = textBefore + emoji + textAfter;
        input.focus();
        input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);

        this.toggleSendButton();
    }

    /**
     * Alterna el estado del botón de enviar
     */
    toggleSendButton() {
        const input = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');

        sendBtn.disabled = !input.value.trim();
    }

    /**
     * Muestra un mensaje en el chat
     */
    displayMessage(message) {
        const messagesList = document.getElementById('messages-list');
        const messageElement = this.createMessageElement(message);

        messagesList.appendChild(messageElement);
        this.scrollToBottom();
    }

    /**
     * Muestra el historial de mensajes
     */
    displayMessageHistory(messages) {
        const messagesList = document.getElementById('messages-list');
        messagesList.innerHTML = '';

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesList.appendChild(messageElement);
        });

        this.scrollToBottom();
    }

    /**
     * Muestra un mensaje del sistema
     */
    displaySystemMessage(content) {
        const messagesList = document.getElementById('messages-list');
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-text">${this.escapeHtml(content)}</div>
      </div>
    `;

        messagesList.appendChild(messageElement);
        this.scrollToBottom();
    }

    /**
     * Crea un elemento de mensaje
     */
    createMessageElement(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.userId === this.currentUser?.id ? 'own' : ''}`;
        messageElement.dataset.messageId = message.id;

        const time = new Date(message.timestamp).toLocaleTimeString();
        const isOwn = message.userId === this.currentUser?.id;

        messageElement.innerHTML = `
      <div class="message-avatar" style="background-color: ${message.avatar.color}">
        ${message.avatar.emoji}
      </div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-username">${this.escapeHtml(message.username)}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${this.escapeHtml(message.content)}</div>
        <div class="message-reactions"></div>
      </div>
    `;

        // Agregar event listener para reacciones
        messageElement.addEventListener('dblclick', () => {
            this.showEmojiReactionPicker(message.id);
        });

        return messageElement;
    }

    /**
     * Actualiza las reacciones de un mensaje
     */
    updateMessageReactions(messageElement, reactions) {
        const reactionsContainer = messageElement.querySelector('.message-reactions');
        reactionsContainer.innerHTML = '';

        Object.entries(reactions).forEach(([emoji, users]) => {
            if (users.length > 0) {
                const reactionElement = document.createElement('span');
                reactionElement.className = 'reaction';
                reactionElement.textContent = `${emoji} ${users.length}`;
                reactionElement.addEventListener('click', () => {
                    this.toggleReaction(messageElement.dataset.messageId, emoji);
                });
                reactionsContainer.appendChild(reactionElement);
            }
        });
    }

    /**
     * Alterna una reacción
     */
    toggleReaction(messageId, emoji) {
        this.sendToServer({
            type: 'emoji_reaction',
            messageId: messageId,
            emoji: emoji
        });
    }

    /**
     * Actualiza la información del usuario
     */
    updateUserInfo() {
        if (!this.currentUser) return;

        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');

        userAvatar.style.backgroundColor = this.currentUser.avatar.color;
        userAvatar.textContent = this.currentUser.avatar.emoji;
        userName.textContent = this.currentUser.username;
    }

    /**
     * Actualiza la información de la sala
     */
    updateRoomInfo(room) {
        const roomName = document.getElementById('current-room-name');
        const roomDescription = document.getElementById('current-room-description');

        roomName.textContent = room.name;
        roomDescription.textContent = room.description;
    }

    /**
     * Actualiza la lista de salas
     */
    updateRoomsList(rooms) {
        const roomsList = document.getElementById('rooms-list');
        roomsList.innerHTML = '';

        rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = `room-item ${room.id === this.currentRoom ? 'active' : ''}`;
            roomElement.innerHTML = `
        <div class="room-info">
          <div class="room-name">${this.escapeHtml(room.name)}</div>
          <div class="room-users">${room.userCount || 0} usuarios</div>
        </div>
      `;

            roomElement.addEventListener('click', () => {
                if (room.id !== this.currentRoom) {
                    this.joinRoom(room.id);
                }
            });

            roomsList.appendChild(roomElement);
        });
    }

    /**
     * Actualiza la lista de usuarios
     */
    updateUsersList(users) {
        const usersList = document.getElementById('users-list');
        const usersCount = document.getElementById('users-count');

        usersList.innerHTML = '';
        usersCount.textContent = users.length;

        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.innerHTML = `
        <div class="avatar" style="background-color: ${user.avatar.color}">
          ${user.avatar.emoji}
        </div>
        <span class="username">${this.escapeHtml(user.username)}</span>
      `;

            usersList.appendChild(userElement);
        });
    }

    /**
     * Se une a una sala
     */
    joinRoom(roomId) {
        this.sendToServer({
            type: 'command',
            content: `/join ${roomId}`
        });
    }

    /**
     * Solicita la lista de salas
     */
    requestRoomsList() {
        fetch('/api/rooms')
            .then(response => response.json())
            .then(rooms => this.updateRoomsList(rooms))
            .catch(error => console.error('Error obteniendo salas:', error));
    }

    /**
     * Muestra el modal de crear sala
     */
    showCreateRoomModal() {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('create-room-modal');

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');

        // Focus en el primer input
        document.getElementById('new-room-name').focus();
    }

    /**
     * Maneja la creación de sala
     */
    handleCreateRoom(e) {
        e.preventDefault();

        const name = document.getElementById('new-room-name').value.trim();
        const description = document.getElementById('new-room-description').value.trim();
        const maxUsers = document.getElementById('new-room-max-users').value;

        if (!name) {
            this.showNotification('El nombre de la sala es requerido', 'error');
            return;
        }

        this.sendToServer({
            type: 'command',
            content: `/create ${name}`
        });
    }

    /**
     * Muestra información de la sala
     */
    showRoomInfo() {
        this.sendToServer({
            type: 'command',
            content: '/stats'
        });
    }

    /**
     * Cierra todos los modales
     */
    closeModals() {
        const overlay = document.getElementById('modal-overlay');
        const modals = document.querySelectorAll('.modal');

        overlay.classList.add('hidden');
        modals.forEach(modal => modal.classList.add('hidden'));

        // Limpiar formularios
        document.getElementById('create-room-form').reset();
    }

    /**
     * Actualiza el estado de conexión
     */
    updateConnectionStatus(status) {
        const indicator = document.getElementById('connection-indicator');
        const icon = indicator.querySelector('i');

        indicator.className = `status-${status}`;

        switch (status) {
            case 'connected':
                indicator.innerHTML = '<i class="fas fa-circle"></i> Conectado';
                break;
            case 'connecting':
                indicator.innerHTML = '<i class="fas fa-circle"></i> Conectando...';
                break;
            case 'disconnected':
                indicator.innerHTML = '<i class="fas fa-circle"></i> Desconectado';
                break;
        }
    }

    /**
     * Muestra una notificación
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications-container');
        const notification = document.createElement('div');

        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        // Remover después de 5 segundos
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    /**
     * Limpia los mensajes
     */
    clearMessages() {
        const messagesList = document.getElementById('messages-list');
        messagesList.innerHTML = '';
    }

    /**
     * Hace scroll al final de los mensajes
     */
    scrollToBottom() {
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Envía ping periódico para mantener conexión
     */
    startPingInterval() {
        setInterval(() => {
            if (this.isConnected) {
                this.sendToServer({ type: 'ping' });
            }
        }, 30000); // Cada 30 segundos
    }
}

// Inicializar el cliente cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.chatClient = new ChatClient();
    window.chatClient.startPingInterval();
}); 