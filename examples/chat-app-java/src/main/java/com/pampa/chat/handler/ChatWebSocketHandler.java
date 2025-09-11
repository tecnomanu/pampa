package com.pampa.chat.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pampa.chat.model.ChatMessage;
import com.pampa.chat.model.User;
import com.pampa.chat.service.ChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * WebSocket Handler for Chat
 * Handles WebSocket connections and messages
 */
@Component
public class ChatWebSocketHandler implements WebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ChatService chatService;

    public ChatWebSocketHandler(ChatService chatService) {
        this.chatService = chatService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        chatService.addSession(sessionId, session);
        logger.info("New WebSocket connection established: {}", sessionId);
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
        if (message instanceof TextMessage) {
            handleTextMessage(session, (TextMessage) message);
        }
    }

    private void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String sessionId = session.getId();
        String payload = message.getPayload();
        
        try {
            JsonNode jsonNode = objectMapper.readTree(payload);
            String type = jsonNode.get("type").asText();
            
            switch (type) {
                case "register":
                    handleRegistration(session, jsonNode);
                    break;
                case "message":
                    handleChatMessage(session, jsonNode);
                    break;
                case "join_room":
                    handleJoinRoom(session, jsonNode);
                    break;
                default:
                    sendError(session, "Unknown message type: " + type);
            }
        } catch (Exception e) {
            logger.error("Error handling message from session {}: {}", sessionId, e.getMessage());
            sendError(session, "Invalid message format");
        }
    }

    private void handleRegistration(WebSocketSession session, JsonNode message) throws IOException {
        String sessionId = session.getId();
        String username = message.get("username").asText();
        
        if (username == null || username.trim().isEmpty()) {
            sendRegistrationResponse(session, false, "Username is required", null);
            return;
        }
        
        if (chatService.registerUser(sessionId, username.trim())) {
            User user = chatService.getUser(sessionId);
            sendRegistrationResponse(session, true, null, user);
            
            // Send message history for general room
            List<ChatMessage> history = chatService.getMessageHistory("general");
            sendMessageHistory(session, history, "general");
            
            // Notify other users in the room
            notifyUserJoined(user, "general");
            
            logger.info("User registered: {} ({})", username, sessionId);
        } else {
            sendRegistrationResponse(session, false, "Username already taken", null);
        }
    }

    private void handleChatMessage(WebSocketSession session, JsonNode message) throws IOException {
        String sessionId = session.getId();
        User user = chatService.getUser(sessionId);
        
        if (user == null) {
            sendError(session, "User not registered");
            return;
        }
        
        String content = message.get("content").asText();
        if (content == null || content.trim().isEmpty()) {
            return;
        }
        
        String roomId = user.getCurrentRoom();
        if (roomId == null) {
            sendError(session, "User not in any room");
            return;
        }
        
        // Handle commands
        if (content.startsWith("/")) {
            handleCommand(session, content);
            return;
        }
        
        // Create and store message
        ChatMessage chatMessage = new ChatMessage(
            UUID.randomUUID().toString(),
            "message",
            user,
            content,
            roomId
        );
        
        chatService.addMessage(roomId, chatMessage);
        
        // Broadcast to room
        broadcastToRoom(roomId, createNewMessageResponse(chatMessage));
        
        logger.info("Message sent by {} in room {}: {}", user.getUsername(), roomId, content);
    }

    private void handleJoinRoom(WebSocketSession session, JsonNode message) throws IOException {
        String sessionId = session.getId();
        User user = chatService.getUser(sessionId);
        
        if (user == null) {
            sendError(session, "User not registered");
            return;
        }
        
        String roomId = message.get("room_id").asText();
        if (chatService.getRoom(roomId) == null) {
            sendError(session, "Room not found");
            return;
        }
        
        // Remove from old room
        String oldRoom = user.getCurrentRoom();
        if (oldRoom != null) {
            chatService.removeUserFromRoom(sessionId, oldRoom);
            notifyUserLeft(user, oldRoom);
        }
        
        // Add to new room
        chatService.addUserToRoom(sessionId, roomId);
        
        // Send message history
        List<ChatMessage> history = chatService.getMessageHistory(roomId);
        sendMessageHistory(session, history, roomId);
        
        // Notify room
        notifyUserJoined(user, roomId);
        
        logger.info("User {} joined room {}", user.getUsername(), roomId);
    }

    private void handleCommand(WebSocketSession session, String command) throws IOException {
        // Simple command handling - just send system message
        sendSystemMessage(session, "Commands not implemented in this demo");
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("Transport error for session {}: {}", session.getId(), exception.getMessage());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        String sessionId = session.getId();
        User user = chatService.getUser(sessionId);
        
        if (user != null) {
            String roomId = user.getCurrentRoom();
            if (roomId != null) {
                notifyUserLeft(user, roomId);
            }
            logger.info("User {} disconnected", user.getUsername());
        }
        
        chatService.removeSession(sessionId);
        logger.info("WebSocket connection closed: {}", sessionId);
    }

    @Override
    public boolean supportsPartialMessages() {
        return false;
    }

    // Helper methods for sending responses
    private void sendRegistrationResponse(WebSocketSession session, boolean success, String error, User user) throws IOException {
        Map<String, Object> response = new HashMap<>();
        response.put("type", "registration_result");
        response.put("success", success);
        if (error != null) {
            response.put("error", error);
        }
        if (user != null) {
            response.put("user", user);
        }
        
        sendMessage(session, response);
    }

    private void sendMessageHistory(WebSocketSession session, List<ChatMessage> messages, String roomId) throws IOException {
        Map<String, Object> response = new HashMap<>();
        response.put("type", "message_history");
        response.put("messages", messages);
        response.put("roomId", roomId);
        
        sendMessage(session, response);
    }

    private void sendSystemMessage(WebSocketSession session, String content) throws IOException {
        Map<String, Object> response = new HashMap<>();
        response.put("type", "system_message");
        response.put("content", content);
        response.put("timestamp", java.time.LocalDateTime.now());
        
        sendMessage(session, response);
    }

    private void sendError(WebSocketSession session, String error) throws IOException {
        Map<String, Object> response = new HashMap<>();
        response.put("type", "error");
        response.put("message", error);
        
        sendMessage(session, response);
    }

    private Map<String, Object> createNewMessageResponse(ChatMessage message) {
        Map<String, Object> response = new HashMap<>();
        response.put("type", "new_message");
        response.put("message", message);
        return response;
    }

    private void notifyUserJoined(User user, String roomId) {
        Map<String, Object> response = new HashMap<>();
        response.put("type", "user_joined");
        response.put("user", user);
        response.put("roomId", roomId);
        response.put("timestamp", java.time.LocalDateTime.now());
        
        broadcastToRoom(roomId, response);
    }

    private void notifyUserLeft(User user, String roomId) {
        Map<String, Object> response = new HashMap<>();
        response.put("type", "user_left");
        response.put("user", user);
        response.put("roomId", roomId);
        response.put("timestamp", java.time.LocalDateTime.now());
        
        broadcastToRoom(roomId, response);
    }

    private void sendMessage(WebSocketSession session, Object message) throws IOException {
        if (session.isOpen()) {
            String json = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(json));
        }
    }

    private void broadcastToRoom(String roomId, Object message) {
        Set<String> userIds = chatService.getRoomUsers(roomId);
        String json;
        
        try {
            json = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            logger.error("Error serializing broadcast message: {}", e.getMessage());
            return;
        }
        
        for (String userId : userIds) {
            WebSocketSession session = chatService.getSession(userId);
            if (session != null && session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(json));
                } catch (IOException e) {
                    logger.error("Error sending message to session {}: {}", userId, e.getMessage());
                }
            }
        }
    }
}
