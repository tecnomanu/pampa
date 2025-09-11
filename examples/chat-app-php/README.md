# PAMPA Chat - Ejemplo PHP

Un ejemplo completo de aplicación de chat en tiempo real construida con PHP, Slim Framework y ReactPHP WebSockets.

## 🏗️ Arquitectura del Proyecto

Este proyecto demuestra cómo crear una aplicación de chat usando PHP moderno y tecnologías asíncronas:

### Backend (PHP)

```
chat-app-php/
├── src/
│   └── ChatServer.php       # Servidor WebSocket con ReactPHP
├── public/
│   ├── index.php           # Aplicación web Slim Framework
│   ├── styles.css          # Estilos CSS
│   └── chat.js            # Lógica del cliente
├── websocket-server.php    # Punto de entrada del servidor WebSocket
├── composer.json          # Dependencias de PHP
└── README.md             # Esta documentación
```

## 🚀 Características

### Funcionalidades de Chat

- ✅ **Chat en tiempo real** con ReactPHP WebSockets
- ✅ **Múltiples salas** de chat (General, PHP, Tecnología)
- ✅ **Comandos especiales** (/help, /join, /rooms, etc.)
- ✅ **Historial de mensajes** por sala
- ✅ **Avatares coloridos** generados automáticamente
- ✅ **Notificaciones** de eventos en tiempo real

### Funcionalidades de Usuario

- ✅ **Registro simple** con nombre de usuario
- ✅ **Cambio de nickname** dinámico con `/nick`
- ✅ **Estados de conexión** visuales
- ✅ **Lista de usuarios** online por sala

### Funcionalidades de Sala

- ✅ **Salas predefinidas** (General, PHP, Tecnología)
- ✅ **Límites de usuarios** por sala
- ✅ **Estadísticas** de salas con `/stats`
- ✅ **Navegación** entre salas

## 📋 Comandos Disponibles

El chat incluye varios comandos especiales:

- `/help` - Muestra la lista de comandos disponibles
- `/users` - Lista usuarios en la sala actual
- `/rooms` - Muestra todas las salas disponibles
- `/join <sala>` - Únete a una sala específica
- `/nick <nombre>` - Cambia tu nombre de usuario
- `/stats` - Muestra estadísticas de la sala actual

## 🛠️ Instalación y Uso

### Prerrequisitos

- PHP 8.1+
- Composer (gestor de dependencias de PHP)
- Extensiones PHP: `sockets`, `json`, `mbstring`

### Instalación

1. **Navega al directorio del ejemplo:**

    ```bash
    cd examples/chat-app-php
    ```

2. **Instala las dependencias:**

    ```bash
    composer install
    ```

3. **Inicia el servidor WebSocket (Terminal 1):**

    ```bash
    php websocket-server.php
    ```

4. **Inicia el servidor web (Terminal 2):**

    ```bash
    composer start
    # o alternativamente:
    php -S localhost:8080 -t public
    ```

5. **Abre tu navegador:**
    ```
    http://localhost:8080
    ```

### Scripts Disponibles

```bash
composer install          # Instalar dependencias
composer start            # Servidor web en puerto 8080
composer websocket        # Servidor WebSocket en puerto 8081
php websocket-server.php  # Iniciar WebSocket manualmente
```

## 🔧 Configuración

### Puertos

- **Servidor Web**: `http://localhost:8080` (Slim Framework)
- **WebSocket Server**: `ws://localhost:8081` (ReactPHP)

### Personalización

#### Agregar Nuevas Salas

Edita `src/ChatServer.php` en el método `initializeDefaultRooms()`:

```php
[
    'id' => 'mi-sala',
    'name' => 'Mi Sala',
    'description' => 'Descripción de mi sala',
    'isPublic' => true,
    'maxUsers' => 25,
    'createdBy' => 'system'
]
```

#### Modificar Comandos

Agrega nuevos comandos en `src/ChatServer.php` en el método `handleCommand()`:

```php
case '/micomando':
    $this->sendSystemMessage($connectionId, "Respuesta del comando");
    break;
```

## 🏛️ Arquitectura Técnica

### Patrón de Diseño

- **Separación de responsabilidades**: Web server y WebSocket server separados
- **Programación orientada a objetos**: Clase `ChatServer` centralizada
- **Event-driven**: ReactPHP para operaciones asíncronas
- **PSR-4**: Autoloading estándar de PHP

### Flujo de Datos

1. **Cliente** se conecta al servidor web (Slim)
2. **JavaScript** establece conexión WebSocket (ReactPHP)
3. **ChatServer** maneja conexiones y mensajes
4. **Servidor** hace broadcast a usuarios en tiempo real

### Tecnologías Utilizadas

- **ReactPHP**: Programación asíncrona y WebSockets
- **Slim Framework**: Aplicación web ligera
- **Ramsey/UUID**: Generación de IDs únicos
- **Monolog**: Sistema de logging
- **Composer**: Gestión de dependencias

## 🧪 Testing

Para probar el chat:

1. **Inicia ambos servidores** (WebSocket y Web)
2. **Abre múltiples pestañas** del navegador
3. **Regístrate con diferentes usuarios**
4. **Prueba los comandos** disponibles
5. **Navega entre salas** usando `/join`

## 🔄 Extensiones Posibles

Este ejemplo puede extenderse fácilmente:

- **Base de datos**: MySQL/PostgreSQL con PDO
- **Autenticación**: Sistema de login con sesiones
- **Archivos**: Subida de imágenes con PSR-7
- **Tests**: PHPUnit para pruebas automatizadas
- **Docker**: Containerización con PHP-FPM
- **Redis**: Cache y pub/sub para escalabilidad

## 📚 Dependencias Principales

### Producción

- **slim/slim**: Framework web minimalista
- **react/socket**: WebSockets asíncronos
- **ramsey/uuid**: Generación de UUIDs
- **monolog/monolog**: Sistema de logging

### Desarrollo

- **phpunit/phpunit**: Framework de testing

## 🤝 Contribuciones

Este es un proyecto de ejemplo educativo. Siéntete libre de:

- Reportar bugs o problemas
- Sugerir mejoras
- Crear forks y extensiones
- Usar como base para tus proyectos

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

**¡Disfruta chateando con PHP! 🐘💬**
