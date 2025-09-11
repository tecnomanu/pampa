# PAMPA Chat - Ejemplo Java

Un ejemplo completo de aplicación de chat en tiempo real construida con Java, Spring Boot y WebSockets.

## 🏗️ Arquitectura del Proyecto

Este proyecto demuestra cómo crear una aplicación de chat usando Java moderno y Spring Boot:

### Backend (Java)

```
chat-app-java/
├── src/main/java/com/pampa/chat/
│   ├── ChatApplication.java          # Aplicación principal Spring Boot
│   ├── config/
│   │   └── WebSocketConfig.java      # Configuración WebSocket
│   ├── controller/
│   │   └── HomeController.java       # Controlador web
│   ├── handler/
│   │   └── ChatWebSocketHandler.java # Manejador WebSocket
│   ├── model/
│   │   ├── User.java                 # Modelo de usuario
│   │   ├── ChatMessage.java          # Modelo de mensaje
│   │   └── Room.java                 # Modelo de sala
│   └── service/
│       └── ChatService.java          # Servicio de chat
├── src/main/resources/
│   ├── static/
│   │   ├── index.html               # Interfaz de usuario
│   │   ├── styles.css               # Estilos CSS
│   │   └── chat.js                  # Lógica del cliente
│   └── application.properties       # Configuración de aplicación
├── pom.xml                          # Dependencias Maven
└── README.md                        # Esta documentación
```

## 🚀 Características

### Funcionalidades de Chat

- ✅ **Chat en tiempo real** con Spring WebSocket
- ✅ **Múltiples salas** de chat (General, Java, Tecnología)
- ✅ **Arquitectura MVC** con Spring Boot
- ✅ **Historial de mensajes** por sala
- ✅ **Avatares coloridos** generados automáticamente
- ✅ **Notificaciones** de eventos en tiempo real

### Funcionalidades de Usuario

- ✅ **Registro simple** con nombre de usuario
- ✅ **Estados de conexión** visuales
- ✅ **Manejo robusto** de conexiones WebSocket
- ✅ **Logging estructurado** con SLF4J

### Funcionalidades de Sala

- ✅ **Salas predefinidas** (General, Java, Tecnología)
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

- Java 17+
- Maven 3.6+
- Conexión a internet para descargar dependencias

### Instalación

1. **Navega al directorio del ejemplo:**

    ```bash
    cd examples/chat-app-java
    ```

2. **Compila e instala dependencias:**

    ```bash
    mvn clean install
    ```

3. **Inicia el servidor:**

    ```bash
    mvn spring-boot:run
    ```

4. **Abre tu navegador:**
    ```
    http://localhost:8083
    ```

### Scripts Disponibles

```bash
mvn spring-boot:run     # Iniciar servidor de desarrollo
mvn clean install      # Compilar y ejecutar tests
mvn package            # Crear JAR ejecutable
java -jar target/chat-app-java-1.0.0.jar  # Ejecutar JAR
mvn test              # Ejecutar tests
```

## 🔧 Configuración

### Puerto

- **Servidor**: `http://localhost:8083` (Spring Boot + WebSockets)

### Personalización

#### Agregar Nuevas Salas

Edita `ChatService.java` en el método `initializeDefaultRooms()`:

```java
new Room("mi-sala", "Mi Sala", "Descripción de mi sala", true, 25, "system")
```

#### Modificar Comandos

Agrega nuevos comandos en `ChatWebSocketHandler.java` en el método `handleCommand()`:

```java
private void handleCommand(WebSocketSession session, String command) throws IOException {
    // Implementar lógica de comandos
    sendSystemMessage(session, "Comando procesado: " + command);
}
```

## 🏛️ Arquitectura Técnica

### Patrón de Diseño

- **MVC**: Separación clara de responsabilidades
- **Dependency Injection**: Inyección de dependencias con Spring
- **Service Layer**: Lógica de negocio encapsulada
- **POJO**: Modelos simples con getters/setters

### Flujo de Datos

1. **Cliente** se conecta via WebSocket
2. **WebSocketHandler** maneja conexiones y mensajes
3. **ChatService** coordina la lógica de negocio
4. **Broadcast** a usuarios usando Spring WebSocket

### Tecnologías Utilizadas

- **Spring Boot**: Framework de aplicación
- **Spring WebSocket**: Implementación WebSocket
- **Jackson**: Serialización JSON
- **SLF4J**: Sistema de logging
- **Maven**: Gestión de dependencias y build

## 🧪 Testing

Para probar el chat:

1. **Inicia el servidor** con `mvn spring-boot:run`
2. **Abre múltiples pestañas** del navegador
3. **Regístrate con diferentes usuarios**
4. **Envía mensajes** y observa la sincronización
5. **Prueba desconexiones** y reconexiones

## 🔄 Extensiones Posibles

Este ejemplo puede extenderse fácilmente:

- **Base de datos**: JPA con H2/PostgreSQL
- **Autenticación**: Spring Security con JWT
- **Cache**: Redis con Spring Data Redis
- **Tests**: JUnit 5 y Mockito
- **Docker**: Containerización con Spring Boot
- **Microservicios**: Spring Cloud para escalabilidad

## 📚 Dependencias Principales

### Producción

- **spring-boot-starter-web**: Framework web
- **spring-boot-starter-websocket**: WebSocket support
- **jackson-databind**: JSON processing
- **spring-boot-starter-thymeleaf**: Template engine

### Desarrollo

- **spring-boot-devtools**: Hot reload
- **spring-boot-starter-test**: Testing framework

### Características Java

- **Annotations**: Configuración declarativa
- **Streams**: Procesamiento funcional
- **Collections**: Estructuras de datos concurrentes
- **Exception Handling**: Manejo robusto de errores

## 🤝 Contribuciones

Este es un proyecto de ejemplo educativo. Siéntete libre de:

- Reportar bugs o problemas
- Sugerir mejoras
- Crear forks y extensiones
- Usar como base para tus proyectos

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

**¡Disfruta chateando con Java! ☕💬**
