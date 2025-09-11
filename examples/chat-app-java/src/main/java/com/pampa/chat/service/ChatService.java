package com.pampa.chat.service;

import com.pampa.chat.model.ChatMessage;
import com.pampa.chat.model.Room;
import com.pampa.chat.model.User;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Chat Service
 * Manages chat rooms, users, and messages
 */
@Service
public class ChatService {
    
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, User> users = new ConcurrentHashMap<>();
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> roomUsers = new ConcurrentHashMap<>();
    private final Map<String, List<ChatMessage>> messageHistory = new ConcurrentHashMap<>();

    public ChatService() {
        initializeDefaultRooms();
    }

    private void initializeDefaultRooms() {
        List<Room> defaultRooms = Arrays.asList(
            new Room("general", "General", "Sala principal para conversaciones generales", true, 50, "system"),
            new Room("java", "Java", "Todo sobre Java y Spring", true, 30, "system"),
            new Room("tecnologia", "Tecnología", "Discusiones sobre tecnología y programación", true, 25, "system")
        );

        for (Room room : defaultRooms) {
            rooms.put(room.getId(), room);
            roomUsers.put(room.getId(), ConcurrentHashMap.newKeySet());
            messageHistory.put(room.getId(), Collections.synchronizedList(new ArrayList<>()));
        }
    }

    public void addSession(String sessionId, WebSocketSession session) {
        sessions.put(sessionId, session);
    }

    public void removeSession(String sessionId) {
        sessions.remove(sessionId);
        
        // Remove user and clean up
        User user = users.remove(sessionId);
        if (user != null) {
            String roomId = user.getCurrentRoom();
            if (roomId != null) {
                removeUserFromRoom(sessionId, roomId);
            }
        }
    }

    public boolean registerUser(String sessionId, String username) {
        // Check if username already exists
        for (User user : users.values()) {
            if (user.getUsername().equalsIgnoreCase(username)) {
                return false;
            }
        }

        User user = new User(sessionId, username, generateAvatarColor(), "general");
        users.put(sessionId, user);
        addUserToRoom(sessionId, "general");
        return true;
    }

    public User getUser(String sessionId) {
        return users.get(sessionId);
    }

    public WebSocketSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    public Set<String> getRoomUsers(String roomId) {
        return roomUsers.getOrDefault(roomId, Collections.emptySet());
    }

    public List<ChatMessage> getMessageHistory(String roomId) {
        return messageHistory.getOrDefault(roomId, Collections.emptyList());
    }

    public void addUserToRoom(String userId, String roomId) {
        roomUsers.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(userId);
        User user = users.get(userId);
        if (user != null) {
            user.setCurrentRoom(roomId);
        }
    }

    public void removeUserFromRoom(String userId, String roomId) {
        Set<String> users = roomUsers.get(roomId);
        if (users != null) {
            users.remove(userId);
        }
    }

    public void addMessage(String roomId, ChatMessage message) {
        List<ChatMessage> history = messageHistory.get(roomId);
        if (history != null) {
            history.add(message);
            
            // Keep only last 100 messages
            if (history.size() > 100) {
                history.subList(0, history.size() - 100).clear();
            }
        }
    }

    public Room getRoom(String roomId) {
        return rooms.get(roomId);
    }

    public Collection<Room> getAllRooms() {
        return rooms.values();
    }

    private String generateAvatarColor() {
        String[] colors = {"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57",
                          "#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3", "#FF9F43"};
        return colors[new Random().nextInt(colors.length)];
    }
}
