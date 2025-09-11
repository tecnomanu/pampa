package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// Message types
type MessageType string

const (
	MessageTypeRegister     MessageType = "register"
	MessageTypeMessage      MessageType = "message"
	MessageTypeJoinRoom     MessageType = "join_room"
	MessageTypeSystemMsg    MessageType = "system_message"
	MessageTypeNewMessage   MessageType = "new_message"
	MessageTypeUserJoined   MessageType = "user_joined"
	MessageTypeUserLeft     MessageType = "user_left"
	MessageTypeHistory      MessageType = "message_history"
	MessageTypeError        MessageType = "error"
	MessageTypeRegResult    MessageType = "registration_result"
)

// User represents a connected user
type User struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	Avatar      string    `json:"avatar"`
	JoinedAt    time.Time `json:"joinedAt"`
	CurrentRoom string    `json:"currentRoom"`
}

// Room represents a chat room
type Room struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPublic    bool   `json:"isPublic"`
	MaxUsers    int    `json:"maxUsers"`
	CreatedBy   string `json:"createdBy"`
}

// ChatMessage represents a chat message
type ChatMessage struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	User      User      `json:"user"`
	Content   string    `json:"content"`
	RoomID    string    `json:"roomId"`
	Timestamp time.Time `json:"timestamp"`
}

// WebSocket message structure
type WSMessage struct {
	Type     MessageType `json:"type"`
	Username string      `json:"username,omitempty"`
	Content  string      `json:"content,omitempty"`
	RoomID   string      `json:"room_id,omitempty"`
}

// Response structures
type RegistrationResponse struct {
	Type    MessageType `json:"type"`
	Success bool        `json:"success"`
	User    *User       `json:"user,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type SystemMessageResponse struct {
	Type      MessageType `json:"type"`
	Content   string      `json:"content"`
	Timestamp time.Time   `json:"timestamp"`
}

type NewMessageResponse struct {
	Type    MessageType `json:"type"`
	Message ChatMessage `json:"message"`
}

type UserEventResponse struct {
	Type      MessageType `json:"type"`
	User      User        `json:"user"`
	RoomID    string      `json:"roomId"`
	Timestamp time.Time   `json:"timestamp"`
}

type MessageHistoryResponse struct {
	Type     MessageType   `json:"type"`
	Messages []ChatMessage `json:"messages"`
	RoomID   string        `json:"roomId"`
}

type ErrorResponse struct {
	Type    MessageType `json:"type"`
	Message string      `json:"message"`
}

// Connection represents a WebSocket connection
type Connection struct {
	ws     *websocket.Conn
	send   chan []byte
	server *ChatServer
	userID string
}

// ChatServer manages all connections and chat logic
type ChatServer struct {
	connections    map[string]*Connection
	users          map[string]*User
	rooms          map[string]*Room
	roomUsers      map[string][]string
	messageHistory map[string][]ChatMessage
	register       chan *Connection
	unregister     chan *Connection
	broadcast      chan []byte
	mutex          sync.RWMutex
	logger         *logrus.Logger
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow connections from any origin
	},
}

// NewChatServer creates a new chat server instance
func NewChatServer() *ChatServer {
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	server := &ChatServer{
		connections:    make(map[string]*Connection),
		users:          make(map[string]*User),
		rooms:          make(map[string]*Room),
		roomUsers:      make(map[string][]string),
		messageHistory: make(map[string][]ChatMessage),
		register:       make(chan *Connection),
		unregister:     make(chan *Connection),
		broadcast:      make(chan []byte),
		logger:         logger,
	}

	server.initializeDefaultRooms()
	return server
}

func (s *ChatServer) initializeDefaultRooms() {
	defaultRooms := []Room{
		{
			ID:          "general",
			Name:        "General",
			Description: "Sala principal para conversaciones generales",
			IsPublic:    true,
			MaxUsers:    50,
			CreatedBy:   "system",
		},
		{
			ID:          "go",
			Name:        "Go",
			Description: "Todo sobre Go y sus frameworks",
			IsPublic:    true,
			MaxUsers:    30,
			CreatedBy:   "system",
		},
		{
			ID:          "tecnologia",
			Name:        "Tecnología",
			Description: "Discusiones sobre tecnología y programación",
			IsPublic:    true,
			MaxUsers:    25,
			CreatedBy:   "system",
		},
	}

	for _, room := range defaultRooms {
		s.rooms[room.ID] = &room
		s.roomUsers[room.ID] = make([]string, 0)
		s.messageHistory[room.ID] = make([]ChatMessage, 0)
	}
}

func (s *ChatServer) run() {
	for {
		select {
		case connection := <-s.register:
			s.handleRegister(connection)

		case connection := <-s.unregister:
			s.handleUnregister(connection)

		case message := <-s.broadcast:
			s.handleBroadcast(message)
		}
	}
}

func (s *ChatServer) handleRegister(conn *Connection) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	connID := uuid.New().String()
	conn.userID = connID
	s.connections[connID] = conn
	s.logger.Infof("New connection registered: %s", connID)
}

func (s *ChatServer) handleUnregister(conn *Connection) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, ok := s.connections[conn.userID]; ok {
		// Remove user from room
		if user, exists := s.users[conn.userID]; exists {
			s.removeUserFromRoom(conn.userID, user.CurrentRoom)
			delete(s.users, conn.userID)
		}

		delete(s.connections, conn.userID)
		close(conn.send)
		s.logger.Infof("Connection unregistered: %s", conn.userID)
	}
}

func (s *ChatServer) handleBroadcast(message []byte) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	for _, conn := range s.connections {
		select {
		case conn.send <- message:
		default:
			close(conn.send)
			delete(s.connections, conn.userID)
		}
	}
}

func (s *ChatServer) registerUser(connID, username string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Check if username already exists
	for _, user := range s.users {
		if user.Username == username {
			return fmt.Errorf("username already taken")
		}
	}

	user := &User{
		ID:          connID,
		Username:    username,
		Avatar:      s.generateAvatarColor(),
		JoinedAt:    time.Now(),
		CurrentRoom: "general",
	}

	s.users[connID] = user
	s.addUserToRoom(connID, "general")

	s.logger.Infof("User registered: %s (%s)", username, connID)
	return nil
}

func (s *ChatServer) generateAvatarColor() string {
	colors := []string{"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57",
		"#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3", "#FF9F43"}
	return colors[time.Now().UnixNano()%int64(len(colors))]
}

func (s *ChatServer) addUserToRoom(userID, roomID string) {
	if _, exists := s.roomUsers[roomID]; !exists {
		s.roomUsers[roomID] = make([]string, 0)
	}
	s.roomUsers[roomID] = append(s.roomUsers[roomID], userID)
}

func (s *ChatServer) removeUserFromRoom(userID, roomID string) {
	if users, exists := s.roomUsers[roomID]; exists {
		for i, id := range users {
			if id == userID {
				s.roomUsers[roomID] = append(users[:i], users[i+1:]...)
				break
			}
		}
	}
}

func (s *ChatServer) handleChatMessage(connID, content string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	user, exists := s.users[connID]
	if !exists {
		return fmt.Errorf("user not registered")
	}

	roomID := user.CurrentRoom
	if roomID == "" {
		return fmt.Errorf("user not in any room")
	}

	// Handle commands
	if content[0] == '/' {
		return s.handleCommand(connID, content)
	}

	message := ChatMessage{
		ID:        uuid.New().String(),
		Type:      "message",
		User:      *user,
		Content:   content,
		RoomID:    roomID,
		Timestamp: time.Now(),
	}

	// Add to history
	s.messageHistory[roomID] = append(s.messageHistory[roomID], message)

	// Keep only last 100 messages
	if len(s.messageHistory[roomID]) > 100 {
		s.messageHistory[roomID] = s.messageHistory[roomID][len(s.messageHistory[roomID])-100:]
	}

	// Broadcast to room
	response := NewMessageResponse{
		Type:    MessageTypeNewMessage,
		Message: message,
	}

	s.broadcastToRoom(roomID, response)
	return nil
}

func (s *ChatServer) handleCommand(connID, command string) error {
	// Implementation of chat commands would go here
	// For brevity, just send a system message
	response := SystemMessageResponse{
		Type:      MessageTypeSystemMsg,
		Content:   "Commands not implemented in this demo",
		Timestamp: time.Now(),
	}

	return s.sendToUser(connID, response)
}

func (s *ChatServer) sendToUser(userID string, data interface{}) error {
	if conn, exists := s.connections[userID]; exists {
		jsonData, err := json.Marshal(data)
		if err != nil {
			return err
		}

		select {
		case conn.send <- jsonData:
			return nil
		default:
			return fmt.Errorf("failed to send message")
		}
	}
	return fmt.Errorf("user not found")
}

func (s *ChatServer) broadcastToRoom(roomID string, data interface{}) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		s.logger.Error("Failed to marshal broadcast data:", err)
		return
	}

	if users, exists := s.roomUsers[roomID]; exists {
		for _, userID := range users {
			if conn, exists := s.connections[userID]; exists {
				select {
				case conn.send <- jsonData:
				default:
					s.logger.Warnf("Failed to send to user %s", userID)
				}
			}
		}
	}
}

// Connection methods
func (c *Connection) readPump() {
	defer func() {
		c.server.unregister <- c
		c.ws.Close()
	}()

	c.ws.SetReadLimit(512)
	c.ws.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.ws.SetPongHandler(func(string) error {
		c.ws.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, messageData, err := c.ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.server.logger.Error("WebSocket error:", err)
			}
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(messageData, &msg); err != nil {
			c.server.logger.Error("Failed to unmarshal message:", err)
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *Connection) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.ws.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.ws.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.ws.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Connection) handleMessage(msg WSMessage) {
	switch msg.Type {
	case MessageTypeRegister:
		if err := c.server.registerUser(c.userID, msg.Username); err != nil {
			response := RegistrationResponse{
				Type:    MessageTypeRegResult,
				Success: false,
				Error:   err.Error(),
			}
			c.server.sendToUser(c.userID, response)
		} else {
			user := c.server.users[c.userID]
			response := RegistrationResponse{
				Type:    MessageTypeRegResult,
				Success: true,
				User:    user,
			}
			c.server.sendToUser(c.userID, response)

			// Send message history
			c.server.mutex.RLock()
			history := c.server.messageHistory["general"]
			c.server.mutex.RUnlock()

			historyResponse := MessageHistoryResponse{
				Type:     MessageTypeHistory,
				Messages: history,
				RoomID:   "general",
			}
			c.server.sendToUser(c.userID, historyResponse)
		}

	case MessageTypeMessage:
		if err := c.server.handleChatMessage(c.userID, msg.Content); err != nil {
			response := ErrorResponse{
				Type:    MessageTypeError,
				Message: err.Error(),
			}
			c.server.sendToUser(c.userID, response)
		}
	}
}

func handleWebSocket(server *ChatServer) gin.HandlerFunc {
	return func(c *gin.Context) {
		ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			server.logger.Error("Failed to upgrade connection:", err)
			return
		}

		conn := &Connection{
			ws:     ws,
			send:   make(chan []byte, 256),
			server: server,
		}

		server.register <- conn

		go conn.writePump()
		go conn.readPump()
	}
}

func main() {
	server := NewChatServer()
	go server.run()

	r := gin.Default()

	// Serve static files
	r.Static("/static", "./static")

	// WebSocket endpoint
	r.GET("/ws", handleWebSocket(server))

	// Main page
	r.GET("/", func(c *gin.Context) {
		c.File("./static/index.html")
	})

	fmt.Println("🚀 PAMPA Chat Go Server starting...")
	fmt.Println("📡 WebSocket server: ws://localhost:8082/ws")
	fmt.Println("🌐 Web interface: http://localhost:8082")
	fmt.Println("💡 Use Ctrl+C to stop the server")

	log.Fatal(http.ListenAndServe(":8082", r))
}
