<?php

declare(strict_types=1);

namespace PampaChat;

use React\EventLoop\Loop;
use React\Socket\SocketServer;
use React\Stream\WritableResourceStream;
use Ramsey\Uuid\Uuid;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;

/**
 * PAMPA Chat Server - PHP Implementation
 * WebSocket server for real-time chat functionality
 */
class ChatServer
{
    private array $connections = [];
    private array $users = [];
    private array $rooms = [];
    private array $roomUsers = [];
    private array $messageHistory = [];
    private Logger $logger;

    public function __construct()
    {
        $this->logger = new Logger('pampa-chat');
        $this->logger->pushHandler(new StreamHandler('php://stdout', Logger::INFO));

        $this->initializeDefaultRooms();
    }

    private function initializeDefaultRooms(): void
    {
        $defaultRooms = [
            [
                'id' => 'general',
                'name' => 'General',
                'description' => 'Sala principal para conversaciones generales',
                'isPublic' => true,
                'maxUsers' => 50,
                'createdBy' => 'system'
            ],
            [
                'id' => 'php',
                'name' => 'PHP',
                'description' => 'Todo sobre PHP y sus frameworks',
                'isPublic' => true,
                'maxUsers' => 30,
                'createdBy' => 'system'
            ],
            [
                'id' => 'tecnologia',
                'name' => 'Tecnología',
                'description' => 'Discusiones sobre tecnología y programación',
                'isPublic' => true,
                'maxUsers' => 25,
                'createdBy' => 'system'
            ]
        ];

        foreach ($defaultRooms as $room) {
            $this->rooms[$room['id']] = $room;
            $this->roomUsers[$room['id']] = [];
            $this->messageHistory[$room['id']] = [];
        }
    }

    public function start(int $port = 8081): void
    {
        $loop = Loop::get();
        $socket = new SocketServer("0.0.0.0:$port", [], $loop);

        $this->logger->info("PAMPA Chat Server started on port $port");

        $socket->on('connection', function ($connection) {
            $connectionId = Uuid::uuid4()->toString();
            $this->connections[$connectionId] = $connection;

            $this->logger->info("New connection: $connectionId");

            $connection->on('data', function ($data) use ($connectionId) {
                $this->handleMessage($connectionId, $data);
            });

            $connection->on('close', function () use ($connectionId) {
                $this->handleDisconnection($connectionId);
            });

            $connection->on('error', function (\Exception $e) use ($connectionId) {
                $this->logger->error("Connection error for $connectionId: " . $e->getMessage());
                $this->handleDisconnection($connectionId);
            });
        });

        $loop->run();
    }

    private function handleMessage(string $connectionId, string $data): void
    {
        try {
            $message = json_decode($data, true);

            if (!$message || !isset($message['type'])) {
                $this->sendError($connectionId, 'Invalid message format');
                return;
            }

            switch ($message['type']) {
                case 'register':
                    $this->handleRegistration($connectionId, $message['username'] ?? '');
                    break;

                case 'message':
                    $this->handleChatMessage($connectionId, $message['content'] ?? '');
                    break;

                case 'join_room':
                    $this->handleJoinRoom($connectionId, $message['room_id'] ?? '');
                    break;

                default:
                    $this->sendError($connectionId, 'Unknown message type');
            }
        } catch (\Exception $e) {
            $this->logger->error("Error handling message: " . $e->getMessage());
            $this->sendError($connectionId, 'Internal server error');
        }
    }

    private function handleRegistration(string $connectionId, string $username): void
    {
        $username = trim($username);

        if (empty($username)) {
            $this->sendMessage($connectionId, [
                'type' => 'registration_result',
                'success' => false,
                'error' => 'Username is required'
            ]);
            return;
        }

        // Check if username already exists
        foreach ($this->users as $user) {
            if (strtolower($user['username']) === strtolower($username)) {
                $this->sendMessage($connectionId, [
                    'type' => 'registration_result',
                    'success' => false,
                    'error' => 'Username already taken'
                ]);
                return;
            }
        }

        $user = [
            'id' => $connectionId,
            'username' => $username,
            'avatar' => $this->generateAvatarColor(),
            'joinedAt' => date('c'),
            'currentRoom' => 'general'
        ];

        $this->users[$connectionId] = $user;

        // Auto-join general room
        $this->joinRoom($connectionId, 'general');

        $this->sendMessage($connectionId, [
            'type' => 'registration_result',
            'success' => true,
            'user' => $user
        ]);

        $this->logger->info("User registered: {$user['username']} ($connectionId)");
    }

    private function generateAvatarColor(): string
    {
        $colors = [
            '#FF6B6B',
            '#4ECDC4',
            '#45B7D1',
            '#96CEB4',
            '#FECA57',
            '#FF9FF3',
            '#54A0FF',
            '#5F27CD',
            '#00D2D3',
            '#FF9F43'
        ];
        return $colors[array_rand($colors)];
    }

    private function handleChatMessage(string $connectionId, string $content): void
    {
        if (!isset($this->users[$connectionId])) {
            $this->sendError($connectionId, 'User not registered');
            return;
        }

        $content = trim($content);
        if (empty($content)) {
            return;
        }

        $user = $this->users[$connectionId];
        $roomId = $user['currentRoom'];

        if (!$roomId || !isset($this->rooms[$roomId])) {
            $this->sendError($connectionId, 'Invalid room');
            return;
        }

        // Handle commands
        if (str_starts_with($content, '/')) {
            $this->handleCommand($connectionId, $content);
            return;
        }

        $message = [
            'id' => Uuid::uuid4()->toString(),
            'type' => 'message',
            'user' => $user,
            'content' => $content,
            'roomId' => $roomId,
            'timestamp' => date('c')
        ];

        // Add to history
        $this->messageHistory[$roomId][] = $message;

        // Keep only last 100 messages per room
        if (count($this->messageHistory[$roomId]) > 100) {
            $this->messageHistory[$roomId] = array_slice($this->messageHistory[$roomId], -100);
        }

        // Broadcast to room
        $this->broadcastToRoom($roomId, [
            'type' => 'new_message',
            'message' => $message
        ]);

        $this->logger->info("Message sent by {$user['username']} in room $roomId");
    }

    private function handleCommand(string $connectionId, string $command): void
    {
        $user = $this->users[$connectionId];
        $parts = explode(' ', $command, 2);
        $cmd = strtolower($parts[0]);
        $args = $parts[1] ?? '';

        switch ($cmd) {
            case '/help':
                $helpText = "Comandos disponibles:\n" .
                    "/help - Muestra esta ayuda\n" .
                    "/rooms - Lista todas las salas\n" .
                    "/users - Lista usuarios en la sala actual\n" .
                    "/join <sala> - Une a una sala específica\n" .
                    "/nick <nuevo_nombre> - Cambia tu nombre de usuario\n" .
                    "/stats - Muestra estadísticas de la sala actual";

                $this->sendSystemMessage($connectionId, $helpText);
                break;

            case '/rooms':
                $roomsInfo = [];
                foreach ($this->rooms as $roomId => $room) {
                    $userCount = count($this->roomUsers[$roomId]);
                    $roomsInfo[] = "• {$room['name']} ({$userCount}/{$room['maxUsers']}) - {$room['description']}";
                }

                $message = "Salas disponibles:\n" . implode("\n", $roomsInfo);
                $this->sendSystemMessage($connectionId, $message);
                break;

            case '/users':
                $roomId = $user['currentRoom'];
                $usersInRoom = [];
                foreach ($this->roomUsers[$roomId] as $uid) {
                    if (isset($this->users[$uid])) {
                        $usersInRoom[] = $this->users[$uid]['username'];
                    }
                }

                $message = "Usuarios en {$this->rooms[$roomId]['name']}: " . implode(', ', $usersInRoom);
                $this->sendSystemMessage($connectionId, $message);
                break;

            case '/join':
                if (empty($args)) {
                    $this->sendSystemMessage($connectionId, "Uso: /join <nombre_sala>");
                    return;
                }

                $targetRoom = null;
                foreach ($this->rooms as $roomId => $room) {
                    if ($roomId === strtolower($args) || strtolower($room['name']) === strtolower($args)) {
                        $targetRoom = $roomId;
                        break;
                    }
                }

                if (!$targetRoom) {
                    $this->sendSystemMessage($connectionId, "Sala '$args' no encontrada");
                    return;
                }

                $this->joinRoom($connectionId, $targetRoom);
                $this->sendSystemMessage($connectionId, "Te has unido a {$this->rooms[$targetRoom]['name']}");
                break;

            case '/stats':
                $roomId = $user['currentRoom'];
                $room = $this->rooms[$roomId];
                $userCount = count($this->roomUsers[$roomId]);
                $messageCount = count($this->messageHistory[$roomId]);

                $stats = "Estadísticas de {$room['name']}:\n" .
                    "• Usuarios conectados: {$userCount}/{$room['maxUsers']}\n" .
                    "• Mensajes enviados: $messageCount\n" .
                    "• Creada por: {$room['createdBy']}";

                $this->sendSystemMessage($connectionId, $stats);
                break;

            default:
                $this->sendSystemMessage($connectionId, "Comando desconocido: $cmd");
        }
    }

    private function joinRoom(string $connectionId, string $roomId): void
    {
        if (!isset($this->rooms[$roomId])) {
            return;
        }

        $user = $this->users[$connectionId];
        $room = $this->rooms[$roomId];

        // Remove from old room
        $oldRoom = $user['currentRoom'] ?? null;
        if ($oldRoom && isset($this->roomUsers[$oldRoom])) {
            $key = array_search($connectionId, $this->roomUsers[$oldRoom]);
            if ($key !== false) {
                unset($this->roomUsers[$oldRoom][$key]);
            }

            $this->broadcastToRoom($oldRoom, [
                'type' => 'user_left',
                'user' => $user,
                'roomId' => $oldRoom,
                'timestamp' => date('c')
            ]);
        }

        // Add to new room
        $this->roomUsers[$roomId][] = $connectionId;
        $this->users[$connectionId]['currentRoom'] = $roomId;

        // Send message history
        $this->sendMessage($connectionId, [
            'type' => 'message_history',
            'messages' => array_slice($this->messageHistory[$roomId], -50), // Last 50 messages
            'roomId' => $roomId
        ]);

        // Notify room
        $this->broadcastToRoom($roomId, [
            'type' => 'user_joined',
            'user' => $user,
            'roomId' => $roomId,
            'timestamp' => date('c')
        ]);
    }

    private function handleDisconnection(string $connectionId): void
    {
        if (isset($this->connections[$connectionId])) {
            unset($this->connections[$connectionId]);
        }

        if (isset($this->users[$connectionId])) {
            $user = $this->users[$connectionId];

            // Remove from room
            $roomId = $user['currentRoom'];
            if ($roomId && isset($this->roomUsers[$roomId])) {
                $key = array_search($connectionId, $this->roomUsers[$roomId]);
                if ($key !== false) {
                    unset($this->roomUsers[$roomId][$key]);
                }

                $this->broadcastToRoom($roomId, [
                    'type' => 'user_left',
                    'user' => $user,
                    'roomId' => $roomId,
                    'timestamp' => date('c')
                ]);
            }

            unset($this->users[$connectionId]);
            $this->logger->info("User disconnected: {$user['username']} ($connectionId)");
        }
    }

    private function sendMessage(string $connectionId, array $message): void
    {
        if (isset($this->connections[$connectionId])) {
            $this->connections[$connectionId]->write(json_encode($message) . "\n");
        }
    }

    private function sendError(string $connectionId, string $error): void
    {
        $this->sendMessage($connectionId, [
            'type' => 'error',
            'message' => $error
        ]);
    }

    private function sendSystemMessage(string $connectionId, string $content): void
    {
        $this->sendMessage($connectionId, [
            'type' => 'system_message',
            'content' => $content,
            'timestamp' => date('c')
        ]);
    }

    private function broadcastToRoom(string $roomId, array $message): void
    {
        if (!isset($this->roomUsers[$roomId])) {
            return;
        }

        $disconnected = [];
        foreach ($this->roomUsers[$roomId] as $connectionId) {
            if (isset($this->connections[$connectionId])) {
                try {
                    $this->connections[$connectionId]->write(json_encode($message) . "\n");
                } catch (\Exception $e) {
                    $this->logger->error("Error sending message to $connectionId: " . $e->getMessage());
                    $disconnected[] = $connectionId;
                }
            } else {
                $disconnected[] = $connectionId;
            }
        }

        // Clean up disconnected users
        foreach ($disconnected as $connectionId) {
            $this->handleDisconnection($connectionId);
        }
    }
}
