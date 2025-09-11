# PAMPA Chat - Ejemplo Go

Un ejemplo completo de aplicación de chat en tiempo real construida con Go, Gin Framework y Gorilla WebSockets.

## 🏗️ Arquitectura del Proyecto

Este proyecto demuestra cómo crear una aplicación de chat usando Go y tecnologías modernas:

### Backend (Go)

```
chat-app-go/
├── main.go                # Aplicación principal con Gin y WebSockets
├── go.mod                 # Módulo Go y dependencias
├── go.sum                 # Checksums de dependencias
├── static/
│   ├── index.html        # Interfaz de usuario
│   ├── styles.css        # Estilos CSS
│   └── chat.js          # Lógica del cliente
└── README.md            # Esta documentación
```

## 🚀 Características

### Funcionalidades de Chat

- ✅ **Chat en tiempo real** con Gorilla WebSockets
- ✅ **Múltiples salas** de chat (General, Go, Tecnología)
- ✅ **Concurrencia** con goroutines y channels
- ✅ **Historial de mensajes** por sala
- ✅ **Avatares coloridos** generados automáticamente
- ✅ **Notificaciones** de eventos en tiempo real

### Funcionalidades de Usuario

- ✅ **Registro simple** con nombre de usuario
- ✅ **Estados de conexión** visuales
- ✅ **Manejo robusto** de conexiones WebSocket
- ✅ **Logging estructurado** con Logrus

### Funcionalidades de Sala

- ✅ **Salas predefinidas** (General, Go, Tecnología)
- ✅ **Límites de usuarios** por sala
- ✅ **Broadcast eficiente** a usuarios en sala
- ✅ **Navegación** entre salas

## 📋 Comandos Disponibles

El chat incluye comandos básicos:

- Envío de mensajes en tiempo real
- Notificaciones de usuarios conectándose/desconectándose
- Historial de mensajes al unirse a una sala

## 🛠️ Instalación y Uso

### Prerrequisitos

- Go 1.21+
- Conexión a internet para descargar dependencias

### Instalación

1. **Navega al directorio del ejemplo:**

    ```bash
    cd examples/chat-app-go
    ```

2. **Descarga las dependencias:**

    ```bash
    go mod tidy
    ```

3. **Inicia el servidor:**

    ```bash
    go run main.go
    ```

4. **Abre tu navegador:**
    ```
    http://localhost:8082
    ```

### Scripts Disponibles

```bash
go run main.go        # Iniciar servidor de desarrollo
go build             # Compilar binario
./chat-app-go        # Ejecutar binario compilado
go mod tidy          # Actualizar dependencias
```

## 🔧 Configuración

### Puerto

- **Servidor**: `http://localhost:8082` (Gin + WebSockets)

### Personalización

#### Agregar Nuevas Salas

Edita `main.go` en el método `initializeDefaultRooms()`:

```go
Room{
    ID:          "mi-sala",
    Name:        "Mi Sala",
    Description: "Descripción de mi sala",
    IsPublic:    true,
    MaxUsers:    25,
    CreatedBy:   "system",
}
```

#### Modificar Comandos

Agrega nuevos comandos en `main.go` en el método `handleCommand()`:

```go
case "/micomando":
    response := SystemMessageResponse{
        Type:      MessageTypeSystemMsg,
        Content:   "Respuesta del comando",
        Timestamp: time.Now(),
    }
    return s.sendToUser(connID, response)
```

## 🏛️ Arquitectura Técnica

### Patrón de Diseño

- **Concurrencia**: Goroutines para cada conexión WebSocket
- **Channels**: Comunicación segura entre goroutines
- **Mutex**: Protección de datos compartidos
- **Struct-based**: Organización clara con tipos Go

### Flujo de Datos

1. **Cliente** se conecta via WebSocket
2. **Goroutine** maneja lectura/escritura por conexión
3. **ChatServer** coordina mensajes via channels
4. **Broadcast** eficiente a usuarios en sala

### Tecnologías Utilizadas

- **Gin**: Framework web rápido y minimalista
- **Gorilla WebSocket**: Implementación robusta de WebSockets
- **UUID**: Generación de identificadores únicos
- **Logrus**: Logging estructurado y configurable
- **Go Modules**: Gestión moderna de dependencias

## 🧪 Testing

Para probar el chat:

1. **Inicia el servidor** con `go run main.go`
2. **Abre múltiples pestañas** del navegador
3. **Regístrate con diferentes usuarios**
4. **Envía mensajes** y observa la sincronización
5. **Prueba desconexiones** y reconexiones

## 🔄 Extensiones Posibles

Este ejemplo puede extenderse fácilmente:

- **Base de datos**: PostgreSQL con GORM
- **Autenticación**: JWT tokens con middleware
- **Redis**: Cache y pub/sub para escalabilidad
- **Tests**: Testing con `testing` package
- **Docker**: Containerización multi-stage
- **gRPC**: Comunicación entre servicios

## 📚 Dependencias Principales

### Producción

- **gin-gonic/gin**: Framework web HTTP
- **gorilla/websocket**: WebSocket implementation
- **google/uuid**: UUID generation
- **sirupsen/logrus**: Structured logging

### Características Go

- **Goroutines**: Concurrencia ligera
- **Channels**: Comunicación segura
- **Interfaces**: Abstracciones limpias
- **Structs**: Tipos de datos organizados

## 🤝 Contribuciones

Este es un proyecto de ejemplo educativo. Siéntete libre de:

- Reportar bugs o problemas
- Sugerir mejoras
- Crear forks y extensiones
- Usar como base para tus proyectos

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

**¡Disfruta chateando con Go! 🐹💬**
