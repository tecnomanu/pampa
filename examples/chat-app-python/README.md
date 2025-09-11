# PAMPA Chat - Ejemplo Python

Un ejemplo completo de aplicación de chat en tiempo real construida con Python, FastAPI y WebSockets.

## 🏗️ Arquitectura del Proyecto

Este proyecto demuestra cómo crear una aplicación de chat usando Python y tecnologías modernas:

### Backend (Python)

```
chat-app-python/
├── app.py                 # Aplicación principal FastAPI
├── requirements.txt       # Dependencias de Python
├── templates/            # Templates HTML (Jinja2)
│   └── index.html        # Interfaz de usuario
├── static/              # Archivos estáticos
│   ├── styles.css       # Estilos CSS
│   └── chat.js         # Lógica del cliente
└── README.md           # Esta documentación
```

## 🚀 Características

### Funcionalidades de Chat

-   ✅ **Chat en tiempo real** con WebSockets
-   ✅ **Múltiples salas** de chat (General, Tecnología, Python)
-   ✅ **Comandos especiales** (/help, /join, /rooms, etc.)
-   ✅ **Historial de mensajes** por sala
-   ✅ **Avatares coloridos** generados automáticamente
-   ✅ **Notificaciones** de eventos en tiempo real

### Funcionalidades de Usuario

-   ✅ **Registro simple** con nombre de usuario
-   ✅ **Cambio de nickname** dinámico con `/nick`
-   ✅ **Estados de conexión** visuales
-   ✅ **Lista de usuarios** online por sala

### Funcionalidades de Sala

-   ✅ **Salas predefinidas** (General, Tecnología, Python)
-   ✅ **Límites de usuarios** por sala
-   ✅ **Estadísticas** de salas con `/stats`
-   ✅ **Navegación** entre salas

## 📋 Comandos Disponibles

El chat incluye varios comandos especiales:

-   `/help` - Muestra la lista de comandos disponibles
-   `/users` - Lista usuarios en la sala actual
-   `/rooms` - Muestra todas las salas disponibles
-   `/join <sala>` - Únete a una sala específica
-   `/nick <nombre>` - Cambia tu nombre de usuario
-   `/stats` - Muestra estadísticas de la sala actual

## 🛠️ Instalación y Uso

### Prerrequisitos

-   Python 3.8+
-   pip (gestor de paquetes de Python)

### Instalación

1. **Navega al directorio del ejemplo:**

    ```bash
    cd examples/chat-app-python
    ```

2. **Crea un entorno virtual (recomendado):**

    ```bash
    python -m venv venv

    # En Windows:
    venv\Scripts\activate

    # En macOS/Linux:
    source venv/bin/activate
    ```

3. **Instala las dependencias:**

    ```bash
    pip install -r requirements.txt
    ```

4. **Inicia el servidor:**

    ```bash
    python app.py
    ```

5. **Abre tu navegador:**
    ```
    http://localhost:8000
    ```

### Scripts Disponibles

```bash
python app.py           # Inicia el servidor
uvicorn app:app --reload # Inicia con auto-reload para desarrollo
```

## 🔧 Configuración

### Variables de Entorno

Puedes configurar el servidor usando variables de entorno:

```bash
HOST=0.0.0.0          # Host del servidor (default: 0.0.0.0)
PORT=8000             # Puerto del servidor (default: 8000)
```

### Personalización

#### Agregar Nuevas Salas

Edita `app.py` en el método `_initialize_default_rooms()`:

```python
{
    'id': 'mi-sala',
    'name': 'Mi Sala',
    'description': 'Descripción de mi sala',
    'is_public': True,
    'max_users': 25,
    'created_by': 'system'
}
```

#### Modificar Comandos

Agrega nuevos comandos en `app.py` en el método `_handle_command()`:

```python
elif cmd == '/micomando':
    # Tu lógica aquí
    await self._send_system_message(connection_id, "Respuesta del comando")
    return {'success': True}
```

## 🏛️ Arquitectura Técnica

### Patrón de Diseño

-   **Clase única**: `ConnectionManager` maneja toda la lógica del chat
-   **Async/Await**: Operaciones asíncronas para mejor rendimiento
-   **WebSockets**: Comunicación bidireccional en tiempo real
-   **FastAPI**: Framework web moderno y rápido

### Flujo de Datos

1. **Cliente** se conecta via WebSocket
2. **ConnectionManager** acepta la conexión
3. **Cliente** envía mensaje de registro
4. **Servidor** procesa y responde
5. **Cliente** envía mensajes de chat
6. **Servidor** hace broadcast a usuarios en la sala

### Seguridad

-   ✅ Validación de entrada en servidor
-   ✅ Límites de longitud de mensajes
-   ✅ Control de acceso a salas
-   ✅ Manejo seguro de conexiones WebSocket
-   ✅ Sanitización de nombres de usuario

## 🧪 Testing

Para probar el chat:

1. **Abre múltiples pestañas** del navegador
2. **Regístrate con diferentes usuarios**
3. **Prueba los comandos** disponibles
4. **Navega entre salas** usando `/join`
5. **Cambia tu nombre** con `/nick`

## 🔄 Extensiones Posibles

Este ejemplo puede extenderse fácilmente:

-   **Base de datos**: Usar SQLAlchemy para persistir datos
-   **Autenticación**: Sistema de login con JWT
-   **Archivos**: Subida de imágenes y documentos
-   **Moderación**: Sistema de administración
-   **Tests**: Pruebas unitarias con pytest
-   **Docker**: Containerización de la aplicación

## 📚 Tecnologías Utilizadas

### Backend

-   **Python 3.8+** - Lenguaje de programación
-   **FastAPI** - Framework web moderno
-   **WebSockets** - Comunicación en tiempo real
-   **Uvicorn** - Servidor ASGI
-   **Jinja2** - Motor de templates

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

**¡Disfruta chateando con Python! 🐍💬**
