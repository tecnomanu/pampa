<?php

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use PampaChat\ChatServer;

/**
 * PAMPA Chat WebSocket Server Entry Point
 * Start the WebSocket server for real-time chat
 */

echo "🚀 Starting PAMPA Chat WebSocket Server...\n";
echo "📡 WebSocket server will run on ws://localhost:8081\n";
echo "🌐 Web interface available at http://localhost:8080\n";
echo "💡 Use Ctrl+C to stop the server\n\n";

try {
    $server = new ChatServer();
    $server->start(8081);
} catch (Exception $e) {
    echo "❌ Error starting server: " . $e->getMessage() . "\n";
    exit(1);
}
