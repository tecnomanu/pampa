package com.pampa.chat.model;

import java.time.LocalDateTime;

/**
 * User model representing a chat user
 */
public class User {
    private String id;
    private String username;
    private String avatar;
    private LocalDateTime joinedAt;
    private String currentRoom;

    public User() {}

    public User(String id, String username, String avatar, String currentRoom) {
        this.id = id;
        this.username = username;
        this.avatar = avatar;
        this.currentRoom = currentRoom;
        this.joinedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }

    public String getCurrentRoom() { return currentRoom; }
    public void setCurrentRoom(String currentRoom) { this.currentRoom = currentRoom; }
}
