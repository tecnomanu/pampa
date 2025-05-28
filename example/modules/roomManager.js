import { v4 as uuidv4 } from 'uuid';

/**
 * Gestiona las salas de chat
 */
export class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.initializeDefaultRooms();
    }

    /**
     * Inicializa las salas por defecto
     */
    initializeDefaultRooms() {
        const defaultRooms = [
            {
                id: 'general',
                name: 'General',
                description: 'Sala principal para conversaciones generales',
                isPublic: true,
                maxUsers: 100,
                createdBy: 'system'
            },
            {
                id: 'tecnologia',
                name: 'Tecnología',
                description: 'Discusiones sobre tecnología y programación',
                isPublic: true,
                maxUsers: 50,
                createdBy: 'system'
            },
            {
                id: 'random',
                name: 'Random',
                description: 'Conversaciones aleatorias y off-topic',
                isPublic: true,
                maxUsers: 30,
                createdBy: 'system'
            }
        ];

        defaultRooms.forEach(room => {
            this.rooms.set(room.id, {
                ...room,
                createdAt: new Date(),
                users: new Set(),
                messageCount: 0,
                lastActivity: new Date()
            });
        });

        console.log(`🏠 Salas inicializadas: ${defaultRooms.map(r => r.name).join(', ')}`);
    }

    /**
     * Crea una nueva sala
     */
    createRoom(roomData, creatorId) {
        const roomId = roomData.id || uuidv4();

        if (this.rooms.has(roomId)) {
            throw new Error(`La sala ${roomId} ya existe`);
        }

        const room = {
            id: roomId,
            name: roomData.name || `Sala ${roomId.slice(0, 8)}`,
            description: roomData.description || '',
            isPublic: roomData.isPublic !== false,
            maxUsers: roomData.maxUsers || 20,
            password: roomData.password || null,
            createdBy: creatorId,
            createdAt: new Date(),
            users: new Set(),
            messageCount: 0,
            lastActivity: new Date(),
            settings: {
                allowFileSharing: roomData.allowFileSharing !== false,
                allowEmojis: roomData.allowEmojis !== false,
                moderationEnabled: roomData.moderationEnabled || false
            }
        };

        this.rooms.set(roomId, room);
        console.log(`🏠 Nueva sala creada: ${room.name} (${roomId})`);
        return room;
    }

    /**
     * Elimina una sala
     */
    deleteRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`La sala ${roomId} no existe`);
        }

        if (room.createdBy !== userId && room.createdBy !== 'system') {
            throw new Error('No tienes permisos para eliminar esta sala');
        }

        if (room.createdBy === 'system') {
            throw new Error('No se pueden eliminar las salas del sistema');
        }

        this.rooms.delete(roomId);
        console.log(`🗑️ Sala eliminada: ${room.name} (${roomId})`);
        return true;
    }

    /**
     * Obtiene una sala por ID
     */
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    /**
     * Obtiene todas las salas
     */
    getAllRooms() {
        return Array.from(this.rooms.values()).map(room => ({
            ...room,
            users: Array.from(room.users),
            userCount: room.users.size
        }));
    }

    /**
     * Obtiene salas públicas
     */
    getPublicRooms() {
        return this.getAllRooms().filter(room => room.isPublic);
    }

    /**
     * Añade un usuario a una sala
     */
    addUserToRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`La sala ${roomId} no existe`);
        }

        if (room.users.size >= room.maxUsers) {
            throw new Error(`La sala ${room.name} está llena`);
        }

        room.users.add(userId);
        room.lastActivity = new Date();
        console.log(`➕ Usuario ${userId} añadido a la sala ${room.name}`);
        return true;
    }

    /**
     * Remueve un usuario de una sala
     */
    removeUserFromRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.users.delete(userId);
            console.log(`➖ Usuario ${userId} removido de la sala ${room.name}`);
            return true;
        }
        return false;
    }

    /**
     * Verifica si un usuario puede acceder a una sala
     */
    canUserAccessRoom(roomId, userId, password = null) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { allowed: false, reason: 'Sala no encontrada' };
        }

        if (!room.isPublic) {
            return { allowed: false, reason: 'Sala privada' };
        }

        if (room.password && room.password !== password) {
            return { allowed: false, reason: 'Contraseña incorrecta' };
        }

        if (room.users.size >= room.maxUsers) {
            return { allowed: false, reason: 'Sala llena' };
        }

        return { allowed: true };
    }

    /**
     * Actualiza la actividad de una sala
     */
    updateRoomActivity(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.lastActivity = new Date();
            room.messageCount++;
        }
    }

    /**
     * Obtiene estadísticas de las salas
     */
    getRoomStats() {
        const rooms = Array.from(this.rooms.values());
        return {
            totalRooms: rooms.length,
            publicRooms: rooms.filter(r => r.isPublic).length,
            privateRooms: rooms.filter(r => !r.isPublic).length,
            totalUsers: rooms.reduce((sum, room) => sum + room.users.size, 0),
            totalMessages: rooms.reduce((sum, room) => sum + room.messageCount, 0),
            mostActiveRoom: this.getMostActiveRoom(),
            roomsWithUsers: rooms.filter(r => r.users.size > 0).length
        };
    }

    /**
     * Obtiene la sala más activa
     */
    getMostActiveRoom() {
        const rooms = Array.from(this.rooms.values());
        if (rooms.length === 0) return null;

        return rooms.reduce((mostActive, current) => {
            return current.messageCount > mostActive.messageCount ? current : mostActive;
        });
    }

    /**
     * Busca salas por nombre
     */
    searchRooms(query) {
        const searchTerm = query.toLowerCase();
        return this.getAllRooms().filter(room =>
            room.name.toLowerCase().includes(searchTerm) ||
            room.description.toLowerCase().includes(searchTerm)
        );
    }

    /**
     * Obtiene salas recomendadas para un usuario
     */
    getRecommendedRooms(userId, limit = 5) {
        const publicRooms = this.getPublicRooms();

        // Ordenar por actividad y número de usuarios
        return publicRooms
            .filter(room => !room.users.includes(userId))
            .sort((a, b) => {
                const scoreA = a.userCount * 0.7 + a.messageCount * 0.3;
                const scoreB = b.userCount * 0.7 + b.messageCount * 0.3;
                return scoreB - scoreA;
            })
            .slice(0, limit);
    }
} 