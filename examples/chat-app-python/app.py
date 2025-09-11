#!/usr/bin/env python3
"""
PAMPA Chat - Ejemplo en Python
Una aplicación de chat en tiempo real construida con FastAPI, WebSockets y Python.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Set

import uvicorn
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Crear instancia de FastAPI
app = FastAPI(title="PAMPA Chat Python", version="1.0.0")

# Configurar archivos estáticos y templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

class ConnectionManager:
    """Maneja las conexiones WebSocket y la lógica del chat"""
    
    def __init__(self):
        # Conexiones activas: {connection_id: websocket}
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Usuarios: {connection_id: user_info}
        self.users: Dict[str, Dict] = {}
        
        # Salas: {room_id: room_info}
        self.rooms: Dict[str, Dict] = {}
        
        # Usuarios por sala: {room_id: set(connection_ids)}
        self.room_users: Dict[str, Set[str]] = {}
        
        # Historial de mensajes: {room_id: [messages]}
        self.message_history: Dict[str, List[Dict]] = {}
        
        self._initialize_default_rooms()
    
    def _initialize_default_rooms(self):
        """Inicializar salas predeterminadas"""
        default_rooms = [
            {
                'id': 'general',
                'name': 'General',
                'description': 'Sala principal para conversaciones generales',
                'is_public': True,
                'max_users': 50,
                'created_by': 'system'
            },
            {
                'id': 'tecnologia',
                'name': 'Tecnología',
                'description': 'Discusiones sobre tecnología y programación',
                'is_public': True,
                'max_users': 30,
                'created_by': 'system'
            },
            {
                'id': 'python',
                'name': 'Python',
                'description': 'Todo sobre Python y sus frameworks',
                'is_public': True,
                'max_users': 25,
                'created_by': 'system'
            }
        ]
        
        for room in default_rooms:
            self.rooms[room['id']] = room
            self.room_users[room['id']] = set()
            self.message_history[room['id']] = []
    
    async def connect(self, websocket: WebSocket, connection_id: str):
        """Acepta una nueva conexión WebSocket"""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"Nueva conexión: {connection_id}")
    
    def disconnect(self, connection_id: str):
        """Desconecta un usuario"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        # Remover usuario de todas las salas
        user_rooms = []
        for room_id, users in self.room_users.items():
            if connection_id in users:
                users.remove(connection_id)
                user_rooms.append(room_id)
        
        # Notificar a las salas sobre la desconexión
        if connection_id in self.users:
            user = self.users[connection_id]
            for room_id in user_rooms:
                asyncio.create_task(self._broadcast_to_room(room_id, {
                    'type': 'user_left',
                    'user': user,
                    'room_id': room_id,
                    'timestamp': datetime.now().isoformat()
                }))
            
            del self.users[connection_id]
        
        logger.info(f"Desconectado: {connection_id}")
    
    async def register_user(self, connection_id: str, username: str) -> Dict:
        """Registra un nuevo usuario"""
        if connection_id in self.users:
            return {'success': False, 'error': 'Usuario ya registrado'}
        
        # Verificar si el nombre de usuario ya existe
        for user in self.users.values():
            if user['username'].lower() == username.lower():
                return {'success': False, 'error': 'Nombre de usuario ya en uso'}
        
        user = {
            'id': connection_id,
            'username': username,
            'avatar': self._generate_avatar_color(),
            'joined_at': datetime.now().isoformat(),
            'current_room': 'general'
        }
        
        self.users[connection_id] = user
        
        # Unir automáticamente a la sala general
        await self.join_room(connection_id, 'general')
        
        return {'success': True, 'user': user}
    
    def _generate_avatar_color(self) -> str:
        """Genera un color aleatorio para el avatar"""
        import random
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', 
                 '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43']
        return random.choice(colors)
    
    async def join_room(self, connection_id: str, room_id: str) -> Dict:
        """Une un usuario a una sala"""
        if connection_id not in self.users:
            return {'success': False, 'error': 'Usuario no registrado'}
        
        if room_id not in self.rooms:
            return {'success': False, 'error': 'Sala no encontrada'}
        
        room = self.rooms[room_id]
        user = self.users[connection_id]
        
        # Verificar límite de usuarios
        if len(self.room_users[room_id]) >= room['max_users']:
            return {'success': False, 'error': 'Sala llena'}
        
        # Remover de sala anterior
        old_room = user.get('current_room')
        if old_room and old_room in self.room_users:
            self.room_users[old_room].discard(connection_id)
            await self._broadcast_to_room(old_room, {
                'type': 'user_left',
                'user': user,
                'room_id': old_room,
                'timestamp': datetime.now().isoformat()
            })
        
        # Agregar a nueva sala
        self.room_users[room_id].add(connection_id)
        user['current_room'] = room_id
        
        # Notificar a la sala
        await self._broadcast_to_room(room_id, {
            'type': 'user_joined',
            'user': user,
            'room_id': room_id,
            'timestamp': datetime.now().isoformat()
        })
        
        # Enviar historial de mensajes al usuario
        if connection_id in self.active_connections:
            await self.active_connections[connection_id].send_text(json.dumps({
                'type': 'message_history',
                'messages': self.message_history[room_id][-50:],  # Últimos 50 mensajes
                'room_id': room_id
            }))
        
        return {'success': True, 'room': room}
    
    async def send_message(self, connection_id: str, content: str, message_type: str = 'message') -> Dict:
        """Envía un mensaje a la sala actual del usuario"""
        if connection_id not in self.users:
            return {'success': False, 'error': 'Usuario no registrado'}
        
        user = self.users[connection_id]
        room_id = user['current_room']
        
        if not room_id or room_id not in self.rooms:
            return {'success': False, 'error': 'No estás en una sala válida'}
        
        # Verificar si es un comando
        if content.startswith('/'):
            return await self._handle_command(connection_id, content)
        
        # Crear mensaje
        message = {
            'id': str(uuid.uuid4()),
            'type': message_type,
            'user': user,
            'content': content,
            'room_id': room_id,
            'timestamp': datetime.now().isoformat()
        }
        
        # Agregar al historial
        self.message_history[room_id].append(message)
        
        # Mantener solo los últimos 100 mensajes por sala
        if len(self.message_history[room_id]) > 100:
            self.message_history[room_id] = self.message_history[room_id][-100:]
        
        # Broadcast a la sala
        await self._broadcast_to_room(room_id, {
            'type': 'new_message',
            'message': message
        })
        
        return {'success': True, 'message': message}
    
    async def _handle_command(self, connection_id: str, command: str) -> Dict:
        """Maneja comandos especiales del chat"""
        user = self.users[connection_id]
        parts = command.split(' ', 1)
        cmd = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ''
        
        if cmd == '/help':
            help_text = """
Comandos disponibles:
/help - Muestra esta ayuda
/rooms - Lista todas las salas
/users - Lista usuarios en la sala actual
/join <sala> - Une a una sala específica
/nick <nuevo_nombre> - Cambia tu nombre de usuario
/stats - Muestra estadísticas de la sala actual
            """.strip()
            
            await self._send_system_message(connection_id, help_text)
            return {'success': True}
        
        elif cmd == '/rooms':
            rooms_info = []
            for room_id, room in self.rooms.items():
                user_count = len(self.room_users[room_id])
                rooms_info.append(f"• {room['name']} ({user_count}/{room['max_users']}) - {room['description']}")
            
            message = "Salas disponibles:\n" + "\n".join(rooms_info)
            await self._send_system_message(connection_id, message)
            return {'success': True}
        
        elif cmd == '/users':
            room_id = user['current_room']
            users_in_room = []
            for uid in self.room_users[room_id]:
                if uid in self.users:
                    users_in_room.append(self.users[uid]['username'])
            
            message = f"Usuarios en {self.rooms[room_id]['name']}: {', '.join(users_in_room)}"
            await self._send_system_message(connection_id, message)
            return {'success': True}
        
        elif cmd == '/join':
            if not args:
                await self._send_system_message(connection_id, "Uso: /join <nombre_sala>")
                return {'success': False}
            
            # Buscar sala por nombre o ID
            target_room = None
            for room_id, room in self.rooms.items():
                if room_id == args.lower() or room['name'].lower() == args.lower():
                    target_room = room_id
                    break
            
            if not target_room:
                await self._send_system_message(connection_id, f"Sala '{args}' no encontrada")
                return {'success': False}
            
            result = await self.join_room(connection_id, target_room)
            if result['success']:
                await self._send_system_message(connection_id, f"Te has unido a {self.rooms[target_room]['name']}")
            else:
                await self._send_system_message(connection_id, f"Error: {result['error']}")
            
            return result
        
        elif cmd == '/nick':
            if not args:
                await self._send_system_message(connection_id, "Uso: /nick <nuevo_nombre>")
                return {'success': False}
            
            # Verificar si el nombre ya existe
            for uid, u in self.users.items():
                if uid != connection_id and u['username'].lower() == args.lower():
                    await self._send_system_message(connection_id, "Ese nombre ya está en uso")
                    return {'success': False}
            
            old_name = user['username']
            user['username'] = args
            
            # Notificar a la sala actual
            room_id = user['current_room']
            await self._broadcast_to_room(room_id, {
                'type': 'user_renamed',
                'old_name': old_name,
                'new_name': args,
                'user': user,
                'room_id': room_id,
                'timestamp': datetime.now().isoformat()
            })
            
            return {'success': True}
        
        elif cmd == '/stats':
            room_id = user['current_room']
            room = self.rooms[room_id]
            user_count = len(self.room_users[room_id])
            message_count = len(self.message_history[room_id])
            
            stats = f"""
Estadísticas de {room['name']}:
• Usuarios conectados: {user_count}/{room['max_users']}
• Mensajes enviados: {message_count}
• Creada por: {room['created_by']}
            """.strip()
            
            await self._send_system_message(connection_id, stats)
            return {'success': True}
        
        else:
            await self._send_system_message(connection_id, f"Comando desconocido: {cmd}")
            return {'success': False}
    
    async def _send_system_message(self, connection_id: str, content: str):
        """Envía un mensaje del sistema a un usuario específico"""
        if connection_id in self.active_connections:
            await self.active_connections[connection_id].send_text(json.dumps({
                'type': 'system_message',
                'content': content,
                'timestamp': datetime.now().isoformat()
            }))
    
    async def _broadcast_to_room(self, room_id: str, message: Dict):
        """Envía un mensaje a todos los usuarios de una sala"""
        if room_id not in self.room_users:
            return
        
        disconnected = []
        for connection_id in self.room_users[room_id].copy():
            if connection_id in self.active_connections:
                try:
                    await self.active_connections[connection_id].send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error enviando mensaje a {connection_id}: {e}")
                    disconnected.append(connection_id)
            else:
                disconnected.append(connection_id)
        
        # Limpiar conexiones desconectadas
        for connection_id in disconnected:
            self.disconnect(connection_id)

# Instancia global del manager
manager = ConnectionManager()

@app.get("/", response_class=HTMLResponse)
async def get_chat_page(request: Request):
    """Página principal del chat"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Endpoint WebSocket para el chat"""
    connection_id = str(uuid.uuid4())
    await manager.connect(websocket, connection_id)
    
    try:
        while True:
            # Recibir mensaje del cliente
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get('type')
            
            if message_type == 'register':
                username = message.get('username', '').strip()
                if not username:
                    await websocket.send_text(json.dumps({
                        'type': 'error',
                        'message': 'Nombre de usuario requerido'
                    }))
                    continue
                
                result = await manager.register_user(connection_id, username)
                await websocket.send_text(json.dumps({
                    'type': 'registration_result',
                    **result
                }))
            
            elif message_type == 'message':
                content = message.get('content', '').strip()
                if content:
                    result = await manager.send_message(connection_id, content)
                    if not result['success']:
                        await websocket.send_text(json.dumps({
                            'type': 'error',
                            'message': result['error']
                        }))
            
            elif message_type == 'join_room':
                room_id = message.get('room_id')
                if room_id:
                    result = await manager.join_room(connection_id, room_id)
                    await websocket.send_text(json.dumps({
                        'type': 'join_result',
                        **result
                    }))
    
    except WebSocketDisconnect:
        manager.disconnect(connection_id)
    except Exception as e:
        logger.error(f"Error en WebSocket {connection_id}: {e}")
        manager.disconnect(connection_id)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
