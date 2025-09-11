/**
 * Gestiona las conexiones WebSocket y coordina todos los módulos del chat
 */
export class ChatManager {
    constructor(userManager, roomManager, messageHandler) {
        this.userManager = userManager;
        this.roomManager = roomManager;
        this.messageHandler = messageHandler;
        this.connections = new Set();
    }

    /**
     * Maneja una nueva conexión WebSocket
     */
    handleConnection(connection, request) {
        console.log('🔌 Nueva conexión WebSocket establecida');

        this.connections.add(connection);

        // Configurar eventos de la conexión
        connection.socket.on('message', (data) => {
            this.handleMessage(connection, data);
        });

        connection.socket.on('close', () => {
            this.handleDisconnection(connection);
        });

        connection.socket.on('error', (error) => {
            console.error('❌ Error en WebSocket:', error);
            this.handleDisconnection(connection);
        });

        // Enviar mensaje de bienvenida
        this.sendWelcomeMessage(connection);
    }

    /**
     * Maneja mensajes recibidos por WebSocket
     */
    handleMessage(connection, rawData) {
        try {
            const data = JSON.parse(rawData.toString());
            console.log('📨 Mensaje recibido:', data.type);

            switch (data.type) {
                case 'join':
                    this.handleUserJoin(connection, data);
                    break;
                case 'message':
                    this.handleChatMessage(connection, data);
                    break;
                case 'private_message':
                    this.handlePrivateMessage(connection, data);
                    break;
                case 'command':
                    this.handleCommand(connection, data);
                    break;
                case 'emoji_reaction':
                    this.handleEmojiReaction(connection, data);
                    break;
                case 'typing':
                    this.handleTypingIndicator(connection, data);
                    break;
                case 'ping':
                    this.handlePing(connection);
                    break;
                default:
                    this.sendError(connection, 'Tipo de mensaje no reconocido');
            }
        } catch (error) {
            console.error('❌ Error procesando mensaje:', error);
            this.sendError(connection, 'Error procesando mensaje');
        }
    }

    /**
     * Maneja cuando un usuario se une al chat
     */
    handleUserJoin(connection, data) {
        try {
            const user = this.userManager.registerUser(connection, data);

            // Añadir usuario a la sala inicial
            this.roomManager.addUserToRoom(user.currentRoom, user.id);

            // Enviar confirmación al usuario
            this.sendToConnection(connection, {
                type: 'join_success',
                user: user,
                room: this.roomManager.getRoom(user.currentRoom)
            });

            // Enviar historial de mensajes
            const messages = this.messageHandler.getMessageHistory(user.currentRoom, 20);
            this.sendToConnection(connection, {
                type: 'message_history',
                messages: messages
            });

            // Notificar a otros usuarios en la sala
            this.broadcastToRoom(user.currentRoom, {
                type: 'user_joined',
                user: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar
                }
            }, connection);

            // Enviar lista de usuarios online
            this.sendUsersList(connection, user.currentRoom);

            console.log(`✅ Usuario ${user.username} se unió a ${user.currentRoom}`);
        } catch (error) {
            console.error('❌ Error en join:', error);
            this.sendError(connection, 'Error al unirse al chat');
        }
    }

    /**
     * Maneja mensajes de chat
     */
    handleChatMessage(connection, data) {
        const result = this.messageHandler.processMessage(connection, {
            type: 'chat',
            content: data.content,
            roomId: data.roomId
        });

        if (result.error) {
            this.sendError(connection, result.error);
            return;
        }

        // Broadcast del mensaje a todos los usuarios en la sala
        this.broadcastToRoom(data.roomId, {
            type: 'new_message',
            message: result.message
        });
    }

    /**
     * Maneja mensajes privados
     */
    handlePrivateMessage(connection, data) {
        const result = this.messageHandler.processMessage(connection, {
            type: 'private',
            content: data.content,
            targetUserId: data.targetUserId
        });

        if (result.error) {
            this.sendError(connection, result.error);
            return;
        }

        // Enviar mensaje al destinatario
        const targetConnection = this.getConnectionByUserId(result.targetUser.id);
        if (targetConnection) {
            this.sendToConnection(targetConnection, {
                type: 'private_message',
                message: result.message
            });
        }

        // Confirmar al remitente
        this.sendToConnection(connection, {
            type: 'private_message_sent',
            message: result.message
        });
    }

    /**
     * Maneja comandos
     */
    handleCommand(connection, data) {
        const user = this.userManager.getUserByConnection(connection);
        if (!user) {
            this.sendError(connection, 'Usuario no encontrado');
            return;
        }

        const result = this.messageHandler.processMessage(connection, {
            type: 'command',
            content: data.content,
            roomId: user.currentRoom
        });

        if (result.error) {
            this.sendError(connection, result.error);
            return;
        }

        // Manejar diferentes tipos de respuesta de comandos
        switch (result.type) {
            case 'system':
                this.sendToConnection(connection, {
                    type: 'system_message',
                    content: result.content
                });
                break;
            case 'room_change':
                this.handleRoomChange(connection, result);
                break;
            case 'room_created':
                this.sendToConnection(connection, {
                    type: 'room_created',
                    room: result.room
                });
                break;
            case 'nick_change':
                this.handleNickChange(connection, result);
                break;
        }
    }

    /**
     * Maneja reacciones con emojis
     */
    handleEmojiReaction(connection, data) {
        const user = this.userManager.getUserByConnection(connection);
        if (!user) return;

        const result = this.messageHandler.processMessage(connection, {
            type: 'emoji',
            content: data,
            roomId: user.currentRoom
        });

        if (result.success) {
            this.broadcastToRoom(user.currentRoom, {
                type: 'emoji_reaction',
                messageId: data.messageId,
                emoji: data.emoji,
                userId: user.id,
                reactions: result.message.reactions
            });
        }
    }

    /**
     * Maneja indicadores de escritura
     */
    handleTypingIndicator(connection, data) {
        const user = this.userManager.getUserByConnection(connection);
        if (!user) return;

        this.broadcastToRoom(user.currentRoom, {
            type: 'typing',
            userId: user.id,
            username: user.username,
            isTyping: data.isTyping
        }, connection);
    }

    /**
     * Maneja ping para mantener conexión viva
     */
    handlePing(connection) {
        this.sendToConnection(connection, { type: 'pong' });
    }

    /**
     * Maneja cambio de sala
     */
    handleRoomChange(connection, result) {
        const user = this.userManager.getUserByConnection(connection);
        if (!user) return;

        // Notificar salida de sala anterior
        this.broadcastToRoom(result.oldRoom, {
            type: 'user_left',
            user: {
                id: user.id,
                username: user.username
            }
        }, connection);

        // Notificar entrada a nueva sala
        this.broadcastToRoom(result.newRoom, {
            type: 'user_joined',
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar
            }
        }, connection);

        // Enviar confirmación al usuario
        this.sendToConnection(connection, {
            type: 'room_changed',
            oldRoom: result.oldRoom,
            newRoom: result.newRoom,
            room: this.roomManager.getRoom(result.newRoom)
        });

        // Enviar historial de la nueva sala
        const messages = this.messageHandler.getMessageHistory(result.newRoom, 20);
        this.sendToConnection(connection, {
            type: 'message_history',
            messages: messages
        });

        // Enviar lista de usuarios de la nueva sala
        this.sendUsersList(connection, result.newRoom);
    }

    /**
     * Maneja cambio de nickname
     */
    handleNickChange(connection, result) {
        const user = this.userManager.getUserByConnection(connection);
        if (!user) return;

        // Notificar a todos en la sala
        this.broadcastToRoom(user.currentRoom, {
            type: 'nick_changed',
            userId: user.id,
            oldNick: result.oldNick,
            newNick: result.newNick
        });
    }

    /**
     * Maneja desconexión de usuario
     */
    handleDisconnection(connection) {
        const userId = this.userManager.disconnectUser(connection);
        if (userId) {
            const user = this.userManager.getUserById(userId);
            if (user) {
                // Remover de la sala actual
                this.roomManager.removeUserFromRoom(user.currentRoom, userId);

                // Notificar a otros usuarios
                this.broadcastToRoom(user.currentRoom, {
                    type: 'user_left',
                    user: {
                        id: user.id,
                        username: user.username
                    }
                });
            }
        }

        this.connections.delete(connection);
        console.log('🔌 Conexión WebSocket cerrada');
    }

    /**
     * Envía mensaje de bienvenida
     */
    sendWelcomeMessage(connection) {
        this.sendToConnection(connection, {
            type: 'welcome',
            message: '¡Bienvenido al chat! Envía tu información para unirte.',
            rooms: this.roomManager.getPublicRooms(),
            commands: [
                '/help - Ver comandos disponibles',
                '/rooms - Ver salas disponibles',
                '/users - Ver usuarios en la sala'
            ]
        });
    }

    /**
     * Envía lista de usuarios de una sala
     */
    sendUsersList(connection, roomId) {
        const users = this.userManager.getUsersInRoom(roomId);
        this.sendToConnection(connection, {
            type: 'users_list',
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                avatar: u.avatar,
                status: u.status
            }))
        });
    }

    /**
     * Envía un mensaje a una conexión específica
     */
    sendToConnection(connection, data) {
        try {
            if (connection.socket.readyState === 1) { // WebSocket.OPEN
                connection.socket.send(JSON.stringify(data));
            }
        } catch (error) {
            console.error('❌ Error enviando mensaje:', error);
        }
    }

    /**
     * Envía un mensaje de error
     */
    sendError(connection, message) {
        this.sendToConnection(connection, {
            type: 'error',
            message: message
        });
    }

    /**
     * Broadcast a todos los usuarios en una sala
     */
    broadcastToRoom(roomId, data, excludeConnection = null) {
        const users = this.userManager.getUsersInRoom(roomId);

        users.forEach(user => {
            const connection = this.getConnectionByUserId(user.id);
            if (connection && connection !== excludeConnection) {
                this.sendToConnection(connection, data);
            }
        });
    }

    /**
     * Broadcast a todas las conexiones
     */
    broadcastToAll(data, excludeConnection = null) {
        this.connections.forEach(connection => {
            if (connection !== excludeConnection) {
                this.sendToConnection(connection, data);
            }
        });
    }

    /**
     * Obtiene la conexión de un usuario por su ID
     */
    getConnectionByUserId(userId) {
        for (const [connection, connUserId] of this.userManager.connections) {
            if (connUserId === userId) {
                return connection;
            }
        }
        return null;
    }

    /**
     * Obtiene estadísticas del chat
     */
    getStats() {
        return {
            connections: this.connections.size,
            users: this.userManager.getStats(),
            rooms: this.roomManager.getRoomStats(),
            messages: this.messageHandler.getMessageStats()
        };
    }

    /**
     * Envía estadísticas a una conexión
     */
    sendStats(connection) {
        this.sendToConnection(connection, {
            type: 'stats',
            data: this.getStats()
        });
    }

    /**
     * Limpia conexiones inactivas
     */
    cleanupInactiveConnections() {
        const inactiveConnections = [];

        this.connections.forEach(connection => {
            if (connection.socket.readyState !== 1) { // No está abierta
                inactiveConnections.push(connection);
            }
        });

        inactiveConnections.forEach(connection => {
            this.handleDisconnection(connection);
        });

        if (inactiveConnections.length > 0) {
            console.log(`🧹 Limpiadas ${inactiveConnections.length} conexiones inactivas`);
        }
    }
}

// Configurar limpieza periódica de conexiones
setInterval(() => {
    // Esta función se ejecutará cuando se instancie ChatManager
}, 30000); // Cada 30 segundos 