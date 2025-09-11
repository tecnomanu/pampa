package com.pampa.chat.model;

/**
 * Room model representing a chat room
 */
public class Room {
    private String id;
    private String name;
    private String description;
    private boolean isPublic;
    private int maxUsers;
    private String createdBy;

    public Room() {}

    public Room(String id, String name, String description, boolean isPublic, int maxUsers, String createdBy) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.isPublic = isPublic;
        this.maxUsers = maxUsers;
        this.createdBy = createdBy;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isPublic() { return isPublic; }
    public void setPublic(boolean isPublic) { this.isPublic = isPublic; }

    public int getMaxUsers() { return maxUsers; }
    public void setMaxUsers(int maxUsers) { this.maxUsers = maxUsers; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
}
