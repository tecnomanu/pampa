import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fastify from 'fastify';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ChatManager } from './modules/chatManager.js';
import { MessageHandler } from './modules/messageHandler.js';
import { RoomManager } from './modules/roomManager.js';
import { UserManager } from './modules/userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración del servidor
const server = fastify({
    logger: true,
    connectionTimeout: 60000,
    keepAliveTimeout: 30000
});

// Registro de plugins
await server.register(fastifyWebsocket);
await server.register(fastifyStatic, {
    root: join(__dirname, 'public'),
    prefix: '/'
});

// Inicialización de managers
const userManager = new UserManager();
const roomManager = new RoomManager();
const messageHandler = new MessageHandler(userManager, roomManager);
const chatManager = new ChatManager(userManager, roomManager, messageHandler);

// Ruta principal
server.get('/', async (request, reply) => {
    return reply.sendFile('index.html');
});

// WebSocket para el chat
server.register(async function (fastify) {
    fastify.get('/chat', { websocket: true }, (connection, req) => {
        chatManager.handleConnection(connection, req);
    });
});

// API REST para obtener información
server.get('/api/rooms', async (request, reply) => {
    return roomManager.getAllRooms();
});

server.get('/api/users', async (request, reply) => {
    return userManager.getAllUsers();
});

server.get('/api/messages/:roomId', async (request, reply) => {
    const { roomId } = request.params;
    return messageHandler.getMessageHistory(roomId);
});

// Manejo de errores
server.setErrorHandler((error, request, reply) => {
    server.log.error(error);
    reply.status(500).send({ error: 'Error interno del servidor' });
});

// Inicio del servidor
const start = async () => {
    try {
        const port = process.env.PORT || 3000;
        const host = process.env.HOST || 'localhost';

        await server.listen({ port, host });
        console.log(`🚀 Servidor de chat iniciado en http://${host}:${port}`);
        console.log(`📱 WebSocket disponible en ws://${host}:${port}/chat`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start(); 