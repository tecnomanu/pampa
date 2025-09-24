# 📖 Guía de Uso de PAMPA

## 🚀 Instalación y Configuración

### 1. Configurar OpenAI API Key

PAMPA requiere una API key de OpenAI para generar embeddings:

```bash
export OPENAI_API_KEY="tu-api-key-aqui"
```

O crea un archivo `.env` en tu proyecto:

```
OPENAI_API_KEY=tu-api-key-aqui
```

### 2. Instalar dependencias

```bash
npm install
```

## 📋 Comandos Disponibles

### `pampa index [path]`

Indexa un proyecto y crea la base de datos de código.

```bash
# Indexar el directorio actual
npx pampa index

# Indexar un directorio específico
npx pampa index /ruta/a/tu/proyecto
```

**¿Qué hace?**

-   Escanea archivos de código (.js, .ts, .tsx, .jsx, .php, .go, .java)
-   Extrae funciones y clases usando tree-sitter
-   Genera embeddings con OpenAI
-   Guarda todo en SQLite local y archivos comprimidos
-   Crea `pampa.codemap.json` para git

### `pampa search <query> [-k N]`

Busca código semánticamente en el proyecto indexado.

```bash
# Buscar funciones de autenticación
npx pampa search "función de autenticación"

# Buscar con límite de resultados
npx pampa search "manejo de errores" -k 5
```

### `pampa info`

Muestra estadísticas del proyecto indexado.

```bash
npx pampa info
```

### `pampa mcp`

Inicia el servidor MCP para integración con agentes de IA.

```bash
npx pampa mcp
```

## 🤖 Integración con Agentes de IA

### Claude Desktop

1. Localiza tu archivo de configuración:

    - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
    - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Agrega la configuración de PAMPA:

```json
{
	"mcpServers": {
		"pampa": {
			"command": "npx",
			"args": ["pampa", "mcp"],
			"env": {
				"OPENAI_API_KEY": "tu-api-key-aqui"
			}
		}
	}
}
```

3. Reinicia Claude Desktop

### Cursor

Configura Cursor para usar PAMPA como servidor MCP en la configuración del workspace.

## 🔧 Herramientas MCP Disponibles

Una vez conectado a un agente de IA, tendrás acceso a estas herramientas:

### `search_code`

```
Busca código semánticamente en el proyecto.
Parámetros:
- query (string): Consulta de búsqueda
- limit (number, opcional): Máximo de resultados (default: 10)
```

### `get_code_chunk`

```
Obtiene el código completo de una función específica.
Parámetros:
- sha (string): Identificador SHA del chunk
```

### `index_project`

```
Indexa un proyecto desde el agente.
Parámetros:
- path (string, opcional): Ruta del proyecto (default: ".")
```

### `get_project_stats`

```
Obtiene estadísticas del proyecto indexado.
Parámetros:
- path (string, opcional): Ruta del proyecto (default: ".")
```

## 📊 Recursos MCP Disponibles

### `pampa://codemap`

Acceso directo al mapa de código completo del proyecto.

### `pampa://overview`

Resumen de las principales funciones del proyecto.

## 🎯 Prompts MCP Disponibles

### `analyze_code`

```
Plantilla para analizar código encontrado.
Parámetros:
- query (string): Consulta de búsqueda
- focus (string, opcional): Aspecto específico a analizar
```

### `find_similar_functions`

```
Plantilla para encontrar funciones existentes similares.
Parámetros:
- functionality (string): Descripción de la funcionalidad buscada
```

## 💡 Ejemplos de Uso con Agentes

### Buscar funciones existentes

```
Agente: "Busca funciones de validación de email en el proyecto"
→ Usa search_code con query "validación email"
→ Examina resultados con get_code_chunk
```

### Analizar código específico

```
Agente: "Analiza las funciones de autenticación para problemas de seguridad"
→ Usa prompt analyze_code con query "autenticación" y focus "seguridad"
```

### Evitar código duplicado

```
Agente: "Antes de crear una función de hash de contraseñas, verifica si ya existe"
→ Usa prompt find_similar_functions con functionality "hash contraseñas"
```

## 🗂️ Estructura de Archivos

```
tu-proyecto/
├── pampa.codemap.json          # Mapa de código (commitear a git)
├── .pampa/
│   ├── pampa.db               # Base de datos SQLite
│   └── chunks/                # Código comprimido
│       ├── abc123.gz(.enc)
│       └── def456.gz(.enc)
└── [tu código...]
```

## 🔍 Lenguajes Soportados

-   **JavaScript** (.js) - funciones, métodos, clases
-   **TypeScript** (.ts) - funciones, métodos, clases
-   **JSX/TSX** (.jsx, .tsx) - funciones, clases
-   **PHP** (.php) - funciones, métodos
-   **Go** (.go) - funciones, métodos
-   **Java** (.java) - métodos, clases

## ⚠️ Consideraciones

### Costos de OpenAI

-   Cada función indexada genera un embedding (~$0.0001 por función)
-   Un proyecto de 1000 funciones cuesta ~$0.10 indexar

### Archivos Ignorados

Por defecto se ignoran:

-   `node_modules/`
-   `vendor/`
-   `.git/`
-   `storage/`
-   `dist/`
-   `build/`

### Límites

-   Código truncado a 8192 caracteres por función
-   Embeddings de 3072 dimensiones

## 🐛 Solución de Problemas

### Error: "No se encontraron resultados"

1. Verifica que el proyecto esté indexado: `npx pampa info`
2. Si no está indexado: `npx pampa index`
3. Verifica que tengas OPENAI_API_KEY configurado

### Error: "Chunk no encontrado"

El archivo comprimido fue eliminado. Re-indexa el proyecto:

```bash
npx pampa index
```

### Error de conexión MCP

1. Verifica que el servidor esté ejecutándose: `npx pampa mcp`
2. Revisa la configuración del cliente MCP
3. Asegúrate de que OPENAI_API_KEY esté disponible

## 📈 Mejores Prácticas

1. **Indexa regularmente**: Ejecuta `npx pampa index` después de cambios importantes
2. **Commitea el codemap**: Incluye `pampa.codemap.json` en git
3. **Ignora .pampa/**: Agrega `.pampa/` a `.gitignore`
4. **Usa búsquedas específicas**: "función de login" es mejor que "login"
5. **Aprovecha los prompts**: Usa `analyze_code` y `find_similar_functions`

## 🔄 Flujo de Trabajo Recomendado

1. **Configuración inicial**:

    ```bash
    export OPENAI_API_KEY="tu-key"
    npx pampa index
    git add pampa.codemap.json
    git commit -m "Add PAMPA codemap"
    ```

2. **Desarrollo diario**:

    - Usa agente de IA con PAMPA para buscar código existente
    - Re-indexa después de cambios importantes
    - Commitea actualizaciones del codemap

3. **Colaboración**:
    - El codemap viaja con el repo
    - Cada desarrollador puede re-indexar localmente
    - Los embeddings se regeneran automáticamente

¡Disfruta de una experiencia de desarrollo más inteligente con PAMPA! 🚀
