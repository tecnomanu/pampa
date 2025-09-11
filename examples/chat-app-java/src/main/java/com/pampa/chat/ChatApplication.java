package com.pampa.chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * PAMPA Chat Application - Java with Spring Boot
 * Main application class for the chat server
 */
@SpringBootApplication
public class ChatApplication {

    public static void main(String[] args) {
        System.out.println("🚀 Starting PAMPA Chat Java Server...");
        System.out.println("🌐 Web interface will be available at http://localhost:8083");
        System.out.println("📡 WebSocket endpoint: ws://localhost:8083/ws");
        System.out.println("💡 Use Ctrl+C to stop the server\n");
        
        SpringApplication.run(ChatApplication.class, args);
    }
}
