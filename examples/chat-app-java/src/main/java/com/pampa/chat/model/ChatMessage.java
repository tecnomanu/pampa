package com.pampa.chat.model;

import java.time.LocalDateTime;

/**
 * ChatMessage model representing a chat message
 */
public class ChatMessage {
    private String id;
    private String type;
    private User user;
    private String content;
    private String roomId;
    private LocalDateTime timestamp;

    public ChatMessage() {}

    public ChatMessage(String id, String type, User user, String content, String roomId) {
        this.id = id;
        this.type = type;
        this.user = user;
        this.content = content;
        this.roomId = roomId;
        this.timestamp = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}
