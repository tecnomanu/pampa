# PAMPA Chat - Ejemplo Distribuido

Un ejemplo completo de aplicación de chat en tiempo real construida con Node.js, WebSockets y una arquitectura modular distribuida en múltiples archivos.

## 🏗️ Arquitectura del Proyecto

Este proyecto demuestra cómo organizar una aplicación de chat compleja en múltiples módulos especializados:

### Backend (Node.js)

```
example/
├── server.js              # Servidor principal y configuración
├── package.json           # Dependencias del proyecto
├── modules/               # Módulos del backend
│   ├── userManager.js     # Gestión de usuarios
│   ├── roomManager.js     # Gestión de salas
│   ├── messageHandler.js  # Procesamiento de mensajes
│   └── chatManager.js     # Coordinador principal
└── public/                # Frontend
    ├── index.html         # Interfaz de usuario
    ├── styles.css         # Estilos CSS
    └── chat.js           # Lógica del cliente
```

### Módulos del Backend

#### 1. **UserManager** (`modules/userManager.js`)

-   Registro y autenticación de usuarios
-   Gestión de conexiones activas
-   Avatares aleatorios y estados de usuario
-   Estadísticas de usuarios

#### 2. **RoomManager** (`modules/roomManager.js`)

-   Creación y gestión de salas de chat
-   Control de acceso y capacidad
-   Salas públicas y privadas
-   Estadísticas de salas

#### 3. **MessageHandler** (`modules/messageHandler.js`)

-   Procesamiento de mensajes de chat
-   Comandos especiales (/help, /join, etc.)
-   Mensajes privados
-   Reacciones con emojis
-   Sanitización de contenido

#### 4. **ChatManager** (`modules/chatManager.js`)

-   Coordinación de WebSocket
-   Broadcast de mensajes
-   Manejo de eventos de conexión
-   Integración de todos los módulos

## 🚀 Características

### Funcionalidades de Chat

-   ✅ **Chat en tiempo real** con WebSockets
-   ✅ **Múltiples salas** de chat
-   ✅ **Mensajes privados** entre usuarios
-   ✅ **Indicadores de escritura** en tiempo real
-   ✅ **Reacciones con emojis** en mensajes
-   ✅ **Comandos especiales** (/help, /join, /create, etc.)
-   ✅ **Historial de mensajes** por sala
-   ✅ **Avatares coloridos** generados automáticamente

### Funcionalidades de Usuario

-   ✅ **Registro simple** con nombre de usuario
-   ✅ **Lista de usuarios** online por sala
-   ✅ **Cambio de nickname** dinámico
-   ✅ **Estados de conexión** visuales

### Funcionalidades de Sala

-   ✅ **Salas predefinidas** (General, Tecnología, Random)
-   ✅ **Creación de salas** personalizadas
-   ✅ **Límites de usuarios** por sala
-   ✅ **Información y estadísticas** de salas

### Interfaz de Usuario

-   ✅ **Diseño moderno** y responsivo
-   ✅ **Tema oscuro** profesional
-   ✅ **Notificaciones** en tiempo real
-   ✅ **Modales** para configuración
-   ✅ **Picker de emojis** integrado
-   ✅ **Indicadores visuales** de estado

## 📋 Comandos Disponibles

El chat incluye varios comandos especiales:

-   `/help` - Muestra la lista de comandos disponibles
-   `/users` - Lista usuarios en la sala actual
-   `/rooms` - Muestra todas las salas disponibles
-   `/join <sala>` - Únete a una sala específica
-   `/create <nombre>` - Crea una nueva sala
-   `/nick <nombre>` - Cambia tu nombre de usuario
-   `/stats` - Muestra estadísticas de la sala actual

## 🛠️ Instalación y Uso

### Prerrequisitos

-   Node.js 16+
-   npm o yarn

### Instalación

1. **Navega al directorio del ejemplo:**

    ```bash
    cd example
    ```

2. **Instala las dependencias:**

    ```bash
    npm install
    ```

3. **Inicia el servidor:**

    ```bash
    npm start
    ```

4. **Abre tu navegador:**
    ```
    http://localhost:3000
    ```

### Scripts Disponibles

```bash
npm start     # Inicia el servidor en modo producción
npm run dev   # Inicia el servidor con auto-reload
```

## 🔧 Configuración

### Variables de Entorno

Puedes configurar el servidor usando variables de entorno:

```bash
PORT=3000          # Puerto del servidor (default: 3000)
HOST=localhost     # Host del servidor (default: localhost)
```

### Personalización

#### Agregar Nuevas Salas

Edita `modules/roomManager.js` en el método `initializeDefaultRooms()`:

```javascript
{
  id: 'mi-sala',
  name: 'Mi Sala',
  description: 'Descripción de mi sala',
  isPublic: true,
  maxUsers: 25,
  createdBy: 'system'
}
```

#### Modificar Comandos

Agrega nuevos comandos en `modules/messageHandler.js` en el método `handleCommand()`:

```javascript
case '/micomando':
  return this.miNuevoComando(user, args);
```

## 🏛️ Arquitectura Técnica

### Patrón de Diseño

-   **Separación de responsabilidades**: Cada módulo tiene una función específica
-   **Inyección de dependencias**: Los módulos se pasan como parámetros
-   **Event-driven**: Comunicación basada en eventos WebSocket
-   **Modular**: Fácil de extender y mantener

### Flujo de Datos

1. **Cliente** envía mensaje via WebSocket
2. **ChatManager** recibe y enruta el mensaje
3. **MessageHandler** procesa el contenido
4. **UserManager/RoomManager** validan permisos
5. **ChatManager** hace broadcast del resultado
6. **Cliente** recibe y muestra la respuesta

### Seguridad

-   ✅ Sanitización de HTML para prevenir XSS
-   ✅ Validación de entrada en servidor
-   ✅ Límites de longitud de mensajes
-   ✅ Control de acceso a salas
-   ✅ Manejo seguro de conexiones WebSocket

## 🧪 Testing

Para probar el chat:

1. **Abre múltiples pestañas** del navegador
2. **Únete con diferentes usuarios** y salas
3. **Prueba los comandos** disponibles
4. **Envía mensajes** y reacciones
5. **Crea nuevas salas** y únete a ellas

## 🔄 Extensiones Posibles

Este ejemplo puede extenderse fácilmente:

-   **Base de datos**: Persistir usuarios y mensajes
-   **Autenticación**: Sistema de login completo
-   **Archivos**: Compartir imágenes y documentos
-   **Video/Audio**: Llamadas integradas
-   **Bots**: Usuarios automatizados
-   **Moderación**: Sistema de administración
-   **Temas**: Múltiples esquemas de colores
-   **Idiomas**: Internacionalización

## 📚 Tecnologías Utilizadas

### Backend

-   **Node.js** - Runtime de JavaScript
-   **Fastify** - Framework web rápido
-   **WebSockets** - Comunicación en tiempo real
-   **UUID** - Generación de IDs únicos

### Frontend

-   **HTML5** - Estructura semántica
-   **CSS3** - Estilos modernos con variables CSS
-   **JavaScript ES6+** - Lógica del cliente
-   **Font Awesome** - Iconografía

## 🤝 Contribuciones

Este es un proyecto de ejemplo educativo. Siéntete libre de:

-   Reportar bugs o problemas
-   Sugerir mejoras
-   Crear forks y extensiones
-   Usar como base para tus proyectos

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

**¡Disfruta chateando! 💬**
