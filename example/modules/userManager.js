import { v4 as uuidv4 } from 'uuid';

/**
 * Gestiona los usuarios conectados al chat
 */
export class UserManager {
    constructor() {
        this.users = new Map(); // userId -> userData
        this.connections = new Map(); // connection -> userId
    }

    /**
     * Registra un nuevo usuario
     */
    registerUser(connection, userData) {
        const userId = uuidv4();
        const user = {
            id: userId,
            username: userData.username || `Usuario_${userId.slice(0, 8)}`,
            avatar: userData.avatar || this.generateAvatar(),
            joinedAt: new Date(),
            isOnline: true,
            currentRoom: userData.room || 'general'
        };

        this.users.set(userId, user);
        this.connections.set(connection, userId);

        console.log(`👤 Usuario registrado: ${user.username} (${userId})`);
        return user;
    }

    /**
     * Desconecta un usuario
     */
    disconnectUser(connection) {
        const userId = this.connections.get(connection);
        if (userId) {
            const user = this.users.get(userId);
            if (user) {
                user.isOnline = false;
                user.disconnectedAt = new Date();
                console.log(`👋 Usuario desconectado: ${user.username}`);
            }
            this.connections.delete(connection);
            return userId;
        }
        return null;
    }

    /**
     * Obtiene un usuario por su conexión
     */
    getUserByConnection(connection) {
        const userId = this.connections.get(connection);
        return userId ? this.users.get(userId) : null;
    }

    /**
     * Obtiene un usuario por su ID
     */
    getUserById(userId) {
        return this.users.get(userId);
    }

    /**
     * Obtiene todos los usuarios
     */
    getAllUsers() {
        return Array.from(this.users.values());
    }

    /**
     * Obtiene usuarios online
     */
    getOnlineUsers() {
        return Array.from(this.users.values()).filter(user => user.isOnline);
    }

    /**
     * Obtiene usuarios en una sala específica
     */
    getUsersInRoom(roomId) {
        return Array.from(this.users.values()).filter(
            user => user.currentRoom === roomId && user.isOnline
        );
    }

    /**
     * Cambia un usuario de sala
     */
    changeUserRoom(userId, newRoomId) {
        const user = this.users.get(userId);
        if (user) {
            const oldRoom = user.currentRoom;
            user.currentRoom = newRoomId;
            console.log(`🚪 ${user.username} se movió de ${oldRoom} a ${newRoomId}`);
            return { oldRoom, newRoom: newRoomId };
        }
        return null;
    }

    /**
     * Actualiza el estado de un usuario
     */
    updateUserStatus(userId, status) {
        const user = this.users.get(userId);
        if (user) {
            user.status = status;
            user.lastActivity = new Date();
            return true;
        }
        return false;
    }

    /**
     * Genera un avatar aleatorio
     */
    generateAvatar() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        const emojis = ['😀', '😎', '🤖', '🦄', '🐱', '🐶', '🦊', '🐼', '🦁', '🐸'];

        return {
            color: colors[Math.floor(Math.random() * colors.length)],
            emoji: emojis[Math.floor(Math.random() * emojis.length)]
        };
    }

    /**
     * Obtiene estadísticas de usuarios
     */
    getStats() {
        const total = this.users.size;
        const online = this.getOnlineUsers().length;
        const offline = total - online;

        return {
            total,
            online,
            offline,
            rooms: this.getRoomDistribution()
        };
    }

    /**
     * Obtiene la distribución de usuarios por sala
     */
    getRoomDistribution() {
        const distribution = {};
        this.getOnlineUsers().forEach(user => {
            distribution[user.currentRoom] = (distribution[user.currentRoom] || 0) + 1;
        });
        return distribution;
    }
} 