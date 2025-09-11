/**
 * PAMPA Chat - Cliente JavaScript para PHP
 * Cliente para el chat en tiempo real con WebSockets
 */

class ChatClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.user = null;
        this.currentRoom = null;
        this.rooms = new Map();
        this.users = new Map();
        
        this.initializeElements();
        this.bindEvents();
        this.showRegisterModal();
    }
    
    initializeElements() {
        // Modales
        this.registerModal = document.getElementById('registerModal');
        this.registerForm = document.getElementById('registerForm');
        this.usernameInput = document.getElementById('usernameInput');
        
        // Interfaz principal
        this.chatInterface = document.getElementById('chatInterface');
        this.currentRoomElement = document.getElementById('currentRoom');
        this.userInfoElement = document.getElementById('userInfo');
        
        // Mensajes
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messages = document.getElementById('messages');
        
        // Entrada
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        
        // Sidebars
        this.roomsList = document.getElementById('roomsList');
        this.usersList = document.getElementById('usersList');
        
        // Notificaciones
        this.notifications = document.getElementById('notifications');
    }
    
    bindEvents() {
        // Registro
        this.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });
        
        // Envío de mensajes
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Botones del header
        document.getElementById('roomsBtn').addEventListener('click', () => {
            this.toggleSidebar('rooms');
        });
    }
    
    showRegisterModal() {
        this.registerModal.style.display = 'flex';
        this.usernameInput.focus();
    }
    
    hideRegisterModal() {
        this.registerModal.style.display = 'none';
    }
    
    async connectWebSocket() {
        // PHP WebSocket server runs on port 8081
        const wsUrl = 'ws://localhost:8081';
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('Conectado al servidor WebSocket PHP');
                this.isConnected = true;
            };
            
            this.ws.onmessage = (event) => {
                const lines = event.data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        try {
                            this.handleMessage(JSON.parse(line));
                        } catch (e) {
                            console.error('Error parsing message:', line, e);
                        }
                    }
                });
            };
            
            this.ws.onclose = () => {
                console.log('Desconectado del servidor WebSocket PHP');
                this.isConnected = false;
                this.showNotification('Conexión perdida. Intentando reconectar...', 'error');
                
                // Intentar reconexión
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.connectWebSocket();
                    }
                }, 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('Error de WebSocket:', error);
                this.showNotification('Error de conexión', 'error');
            };
            
        } catch (error) {
            console.error('Error conectando WebSocket:', error);
            this.showNotification('No se pudo conectar al servidor', 'error');
        }
    }
    
    register() {
        const username = this.usernameInput.value.trim();
        
        if (!username) {
            this.showNotification('Por favor ingresa un nombre de usuario', 'error');
            return;
        }
        
        if (username.length > 20) {
            this.showNotification('El nombre de usuario es demasiado largo', 'error');
            return;
        }
        
        this.connectWebSocket().then(() => {
            // Esperar a que la conexión esté lista
            const checkConnection = () => {
                if (this.isConnected) {
                    this.send({
                        type: 'register',
                        username: username
                    });
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            checkConnection();
        });
    }
    
    handleMessage(message) {
        console.log('Mensaje recibido:', message);
        
        switch (message.type) {
            case 'registration_result':
                this.handleRegistrationResult(message);
                break;
                
            case 'new_message':
                this.displayMessage(message.message);
                break;
                
            case 'system_message':
                this.displaySystemMessage(message.content, message.timestamp);
                break;
                
            case 'user_joined':
                this.handleUserJoined(message);
                break;
                
            case 'user_left':
                this.handleUserLeft(message);
                break;
                
            case 'message_history':
                this.displayMessageHistory(message.messages);
                break;
                
            case 'error':
                this.showNotification(message.message, 'error');
                break;
                
            default:
                console.log('Tipo de mensaje desconocido:', message.type);
        }
    }
    
    handleRegistrationResult(message) {
        if (message.success) {
            this.user = message.user;
            this.hideRegisterModal();
            this.chatInterface.style.display = 'block';
            this.updateUserInfo();
            this.showNotification(`¡Bienvenido ${this.user.username}!`, 'success');
            this.loadRooms();
        } else {
            this.showNotification(message.error, 'error');
        }
    }
    
    handleUserJoined(message) {
        this.displayEventMessage(`${message.user.username} se unió a la sala`, message.timestamp);
    }
    
    handleUserLeft(message) {
        this.displayEventMessage(`${message.user.username} salió de la sala`, message.timestamp);
    }
    
    displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        const avatarElement = document.createElement('div');
        avatarElement.className = 'message-avatar';
        avatarElement.style.backgroundColor = message.user.avatar;
        avatarElement.textContent = message.user.username.charAt(0).toUpperCase();
        
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        
        const headerElement = document.createElement('div');
        headerElement.className = 'message-header';
        
        const usernameElement = document.createElement('span');
        usernameElement.className = 'message-username';
        usernameElement.textContent = message.user.username;
        
        const timestampElement = document.createElement('span');
        timestampElement.className = 'message-timestamp';
        timestampElement.textContent = this.formatTimestamp(message.timestamp);
        
        const textElement = document.createElement('div');
        textElement.className = 'message-text';
        textElement.textContent = message.content;
        
        headerElement.appendChild(usernameElement);
        headerElement.appendChild(timestampElement);
        contentElement.appendChild(headerElement);
        contentElement.appendChild(textElement);
        messageElement.appendChild(avatarElement);
        messageElement.appendChild(contentElement);
        
        this.messages.appendChild(messageElement);
        this.scrollToBottom();
    }
    
    displaySystemMessage(content, timestamp) {
        const messageElement = document.createElement('div');
        messageElement.className = 'system-message';
        
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            if (index > 0) {
                messageElement.appendChild(document.createElement('br'));
            }
            messageElement.appendChild(document.createTextNode(line));
        });
        
        this.messages.appendChild(messageElement);
        this.scrollToBottom();
    }
    
    displayEventMessage(content, timestamp) {
        const messageElement = document.createElement('div');
        messageElement.className = 'event-message';
        messageElement.textContent = content;
        
        this.messages.appendChild(messageElement);
        this.scrollToBottom();
    }
    
    displayMessageHistory(messages) {
        this.messages.innerHTML = '';
        messages.forEach(message => {
            this.displayMessage(message);
        });
    }
    
    sendMessage() {
        const content = this.messageInput.value.trim();
        
        if (!content) return;
        
        if (content.length > 500) {
            this.showNotification('El mensaje es demasiado largo', 'error');
            return;
        }
        
        this.send({
            type: 'message',
            content: content
        });
        
        this.messageInput.value = '';
    }
    
    joinRoom(roomId) {
        this.send({
            type: 'join_room',
            room_id: roomId
        });
    }
    
    loadRooms() {
        // Simular carga de salas para PHP
        const defaultRooms = [
            { id: 'general', name: 'General', description: 'Sala principal' },
            { id: 'php', name: 'PHP', description: 'Todo sobre PHP' },
            { id: 'tecnologia', name: 'Tecnología', description: 'Discusiones sobre tecnología' }
        ];
        
        this.roomsList.innerHTML = '';
        defaultRooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'room-item';
            if (room.id === 'general') {
                roomElement.classList.add('active');
            }
            roomElement.innerHTML = `
                <i class="fas fa-hashtag"></i>
                ${room.name}
            `;
            roomElement.addEventListener('click', () => {
                this.selectRoom(room.id, roomElement);
            });
            this.roomsList.appendChild(roomElement);
        });
    }
    
    selectRoom(roomId, element) {
        // Actualizar selección visual
        document.querySelectorAll('.room-item').forEach(el => {
            el.classList.remove('active');
        });
        element.classList.add('active');
        
        // Unirse a la sala
        this.joinRoom(roomId);
        
        // Actualizar nombre de sala
        this.currentRoomElement.textContent = element.textContent.trim();
    }
    
    updateUserInfo() {
        if (this.user) {
            this.userInfoElement.innerHTML = `
                <span style="color: ${this.user.avatar}">●</span>
                ${this.user.username}
            `;
        }
    }
    
    toggleSidebar(type) {
        // Implementar toggle de sidebars en móvil
        console.log('Toggle sidebar:', type);
    }
    
    send(message) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.showNotification('No hay conexión al servidor', 'error');
        }
    }
    
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.notifications.appendChild(notification);
        
        // Auto-remove después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Inicializar el cliente cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    new ChatClient();
});
