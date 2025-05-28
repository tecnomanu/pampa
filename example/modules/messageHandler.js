import { v4 as uuidv4 } from 'uuid';

/**
 * Gestiona los mensajes del chat
 */
export class MessageHandler {
    constructor(userManager, roomManager) {
        this.userManager = userManager;
        this.roomManager = roomManager;
        this.messages = new Map(); // roomId -> Array de mensajes
        this.messageHistory = new Map(); // messageId -> mensaje completo
        this.maxMessagesPerRoom = 1000;
    }

    /**
     * Procesa un nuevo mensaje
     */
    processMessage(connection, messageData) {
        const user = this.userManager.getUserByConnection(connection);
        if (!user) {
            return { error: 'Usuario no encontrado' };
        }

        const { type, content, roomId, targetUserId } = messageData;

        switch (type) {
            case 'chat':
                return this.handleChatMessage(user, content, roomId);
            case 'private':
                return this.handlePrivateMessage(user, content, targetUserId);
            case 'command':
                return this.handleCommand(user, content, roomId);
            case 'emoji':
                return this.handleEmojiReaction(user, content, roomId);
            default:
                return { error: 'Tipo de mensaje no válido' };
        }
    }

    /**
     * Maneja mensajes de chat normales
     */
    handleChatMessage(user, content, roomId) {
        if (!content || content.trim().length === 0) {
            return { error: 'El mensaje no puede estar vacío' };
        }

        if (content.length > 1000) {
            return { error: 'El mensaje es demasiado largo (máximo 1000 caracteres)' };
        }

        const room = this.roomManager.getRoom(roomId);
        if (!room) {
            return { error: 'Sala no encontrada' };
        }

        // Verificar si el usuario está en la sala
        if (!room.users.has(user.id)) {
            return { error: 'No estás en esta sala' };
        }

        const message = this.createMessage({
            type: 'chat',
            content: this.sanitizeContent(content),
            userId: user.id,
            username: user.username,
            avatar: user.avatar,
            roomId: roomId,
            timestamp: new Date()
        });

        this.saveMessage(roomId, message);
        this.roomManager.updateRoomActivity(roomId);

        console.log(`💬 [${room.name}] ${user.username}: ${content}`);
        return { success: true, message };
    }

    /**
     * Maneja mensajes privados
     */
    handlePrivateMessage(user, content, targetUserId) {
        if (!content || content.trim().length === 0) {
            return { error: 'El mensaje no puede estar vacío' };
        }

        const targetUser = this.userManager.getUserById(targetUserId);
        if (!targetUser) {
            return { error: 'Usuario destinatario no encontrado' };
        }

        if (!targetUser.isOnline) {
            return { error: 'El usuario no está conectado' };
        }

        const message = this.createMessage({
            type: 'private',
            content: this.sanitizeContent(content),
            userId: user.id,
            username: user.username,
            avatar: user.avatar,
            targetUserId: targetUserId,
            targetUsername: targetUser.username,
            timestamp: new Date()
        });

        // Los mensajes privados se guardan en una "sala" especial
        const privateRoomId = this.getPrivateRoomId(user.id, targetUserId);
        this.saveMessage(privateRoomId, message);

        console.log(`📩 [Privado] ${user.username} → ${targetUser.username}: ${content}`);
        return { success: true, message, targetUser };
    }

    /**
     * Maneja comandos especiales
     */
    handleCommand(user, content, roomId) {
        const [command, ...args] = content.split(' ');

        switch (command.toLowerCase()) {
            case '/help':
                return this.getHelpMessage();
            case '/users':
                return this.getUsersList(roomId);
            case '/rooms':
                return this.getRoomsList();
            case '/join':
                return this.joinRoomCommand(user, args[0]);
            case '/create':
                return this.createRoomCommand(user, args);
            case '/nick':
                return this.changeNickCommand(user, args[0]);
            case '/stats':
                return this.getStatsCommand(roomId);
            default:
                return { error: `Comando desconocido: ${command}` };
        }
    }

    /**
     * Maneja reacciones con emojis
     */
    handleEmojiReaction(user, content, roomId) {
        const { messageId, emoji } = content;

        const message = this.messageHistory.get(messageId);
        if (!message) {
            return { error: 'Mensaje no encontrado' };
        }

        if (!message.reactions) {
            message.reactions = {};
        }

        if (!message.reactions[emoji]) {
            message.reactions[emoji] = [];
        }

        // Toggle reaction
        const userIndex = message.reactions[emoji].indexOf(user.id);
        if (userIndex > -1) {
            message.reactions[emoji].splice(userIndex, 1);
            if (message.reactions[emoji].length === 0) {
                delete message.reactions[emoji];
            }
        } else {
            message.reactions[emoji].push(user.id);
        }

        return { success: true, message, type: 'reaction' };
    }

    /**
     * Crea un objeto mensaje
     */
    createMessage(data) {
        const messageId = uuidv4();
        const message = {
            id: messageId,
            ...data,
            edited: false,
            editedAt: null,
            reactions: {}
        };

        this.messageHistory.set(messageId, message);
        return message;
    }

    /**
     * Guarda un mensaje en el historial de la sala
     */
    saveMessage(roomId, message) {
        if (!this.messages.has(roomId)) {
            this.messages.set(roomId, []);
        }

        const roomMessages = this.messages.get(roomId);
        roomMessages.push(message);

        // Limitar el número de mensajes por sala
        if (roomMessages.length > this.maxMessagesPerRoom) {
            const removedMessage = roomMessages.shift();
            this.messageHistory.delete(removedMessage.id);
        }
    }

    /**
     * Obtiene el historial de mensajes de una sala
     */
    getMessageHistory(roomId, limit = 50) {
        const roomMessages = this.messages.get(roomId) || [];
        return roomMessages.slice(-limit);
    }

    /**
     * Sanitiza el contenido del mensaje
     */
    sanitizeContent(content) {
        return content
            .trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]*>/g, '');
    }

    /**
     * Genera ID para sala privada
     */
    getPrivateRoomId(userId1, userId2) {
        const sortedIds = [userId1, userId2].sort();
        return `private_${sortedIds[0]}_${sortedIds[1]}`;
    }

    // Comandos específicos

    getHelpMessage() {
        const commands = [
            '/help - Muestra esta ayuda',
            '/users - Lista usuarios en la sala actual',
            '/rooms - Lista todas las salas disponibles',
            '/join <sala> - Únete a una sala',
            '/create <nombre> - Crea una nueva sala',
            '/nick <nombre> - Cambia tu nombre de usuario',
            '/stats - Muestra estadísticas de la sala'
        ];

        return {
            success: true,
            type: 'system',
            content: commands.join('\n')
        };
    }

    getUsersList(roomId) {
        const users = this.userManager.getUsersInRoom(roomId);
        const userList = users.map(u => `${u.avatar.emoji} ${u.username}`).join('\n');

        return {
            success: true,
            type: 'system',
            content: `Usuarios en la sala (${users.length}):\n${userList}`
        };
    }

    getRoomsList() {
        const rooms = this.roomManager.getPublicRooms();
        const roomList = rooms.map(r =>
            `🏠 ${r.name} (${r.userCount}/${r.maxUsers}) - ${r.description}`
        ).join('\n');

        return {
            success: true,
            type: 'system',
            content: `Salas disponibles:\n${roomList}`
        };
    }

    joinRoomCommand(user, roomId) {
        if (!roomId) {
            return { error: 'Especifica el ID de la sala' };
        }

        const access = this.roomManager.canUserAccessRoom(roomId, user.id);
        if (!access.allowed) {
            return { error: access.reason };
        }

        const oldRoom = user.currentRoom;
        this.roomManager.removeUserFromRoom(oldRoom, user.id);
        this.roomManager.addUserToRoom(roomId, user.id);
        this.userManager.changeUserRoom(user.id, roomId);

        return {
            success: true,
            type: 'room_change',
            oldRoom,
            newRoom: roomId
        };
    }

    createRoomCommand(user, args) {
        const roomName = args.join(' ');
        if (!roomName) {
            return { error: 'Especifica el nombre de la sala' };
        }

        try {
            const room = this.roomManager.createRoom({ name: roomName }, user.id);
            return {
                success: true,
                type: 'room_created',
                room
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    changeNickCommand(user, newNick) {
        if (!newNick) {
            return { error: 'Especifica el nuevo nombre' };
        }

        if (newNick.length > 20) {
            return { error: 'El nombre es demasiado largo (máximo 20 caracteres)' };
        }

        const oldNick = user.username;
        user.username = newNick;

        return {
            success: true,
            type: 'nick_change',
            oldNick,
            newNick
        };
    }

    getStatsCommand(roomId) {
        const room = this.roomManager.getRoom(roomId);
        const messages = this.getMessageHistory(roomId);

        const stats = [
            `📊 Estadísticas de ${room.name}:`,
            `👥 Usuarios: ${room.users.size}/${room.maxUsers}`,
            `💬 Mensajes: ${room.messageCount}`,
            `📅 Creada: ${room.createdAt.toLocaleDateString()}`,
            `⏰ Última actividad: ${room.lastActivity.toLocaleTimeString()}`
        ];

        return {
            success: true,
            type: 'system',
            content: stats.join('\n')
        };
    }

    /**
     * Busca mensajes por contenido
     */
    searchMessages(roomId, query, limit = 20) {
        const messages = this.getMessageHistory(roomId, 500);
        const searchTerm = query.toLowerCase();

        return messages
            .filter(msg => msg.content.toLowerCase().includes(searchTerm))
            .slice(-limit);
    }

    /**
     * Obtiene estadísticas generales de mensajes
     */
    getMessageStats() {
        const totalMessages = Array.from(this.messages.values())
            .reduce((sum, roomMessages) => sum + roomMessages.length, 0);

        const totalRooms = this.messages.size;
        const averageMessagesPerRoom = totalRooms > 0 ? totalMessages / totalRooms : 0;

        return {
            totalMessages,
            totalRooms,
            averageMessagesPerRoom: Math.round(averageMessagesPerRoom),
            totalStoredMessages: this.messageHistory.size
        };
    }
} 