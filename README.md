# PAMPA – Protocolo para Memoria Aumentada de Artefactos de Proyecto

**Versión 1.0.1** · **Compatible con MCP** · **Node.js**

Dale a tus agentes de IA una memoria siempre actualizada y consultable de cualquier base de código – en un comando `npx`.

## 🌟 ¿Por qué PAMPA?

Los agentes de modelos de lenguaje grandes pueden leer miles de tokens, pero los proyectos fácilmente alcanzan millones de caracteres. Sin una capa de recuperación inteligente, los agentes:

-   **Recrean funciones** que ya existen
-   **Nombran mal las APIs** (newUser vs. createUser)
-   **Desperdician tokens** cargando código repetitivo (`vendor/`, `node_modules/`...)
-   **Fallan** cuando el repositorio crece

PAMPA resuelve esto convirtiendo tu repositorio en un **grafo de memoria de código**:

1. **Chunking** – Cada función/clase se convierte en un chunk atómico
2. **Embedding** – Los chunks se vectorizan con `text-embedding-3-large`
3. **Indexing** – Vectores + metadatos viven en SQLite local
4. **Codemap** – Un `pampa.codemap.json` ligero se commitea a git para que el contexto siga al repo
5. **Serving** – Un servidor MCP expone herramientas para buscar y obtener código

Cualquier agente compatible con MCP (Cursor, Claude, etc.) ahora puede buscar, obtener y mantenerse sincronizado – sin escanear todo el árbol.

## 🏗️ Arquitectura

```
┌──────────── Repo (git) ───────────┐
│ app/… src/… package.json etc.     │
│ pampa.codemap.json                │
│ .pampa/chunks/*.gz                │
│ .pampa/pampa.db (SQLite)          │
└────────────────────────────────────┘
         ▲ ▲
         │ write │ read
┌─────────┴─────────┐ │
│ indexer.js        │ │
│ (pampa index)     │ │
└─────────▲─────────┘ │
          │ store     │ vector query
┌─────────┴──────────┐ │ gz fetch
│ SQLite (local)     │ │
└─────────▲──────────┘ │
          │ read       │
┌─────────┴──────────┐ │
│ mcp-server.js      │◄─┘
│ (pampa mcp)        │
└────────────────────┘
```

### Componentes Clave

| Capa             | Rol                                                                 | Tecnología                      |
| ---------------- | ------------------------------------------------------------------- | ------------------------------- |
| **Indexer**      | Corta código en chunks semánticos, embeds, escribe codemap y SQLite | tree-sitter, openai@v4, sqlite3 |
| **Codemap**      | JSON amigable con Git con {file, symbol, sha, lang} por chunk       | JSON plano                      |
| **Chunks dir**   | Cuerpos .gz de código (carga perezosa)                              | gzip                            |
| **SQLite**       | Almacena vectores y metadatos                                       | sqlite3                         |
| **Servidor MCP** | Expone herramientas y recursos sobre el protocolo MCP estándar      | @modelcontextprotocol/sdk       |

## 🚀 Inicio Rápido

### 1. Instalar e indexar el repo actual

```bash
# Con modelo local (gratis, privado)
npx pampa index --provider transformers

# O con OpenAI (mejor calidad, requiere API key)
export OPENAI_API_KEY="tu-api-key"
npx pampa index --provider openai

# O auto-detectar el mejor disponible
npx pampa index
```

### 2. Ejecutar el servidor MCP

```bash
npx pampa mcp
```

### 3. Probar búsqueda via CLI

```bash
npx pampa search "función de autenticación"
```

### 4. Configurar tu cliente MCP

El servidor MCP se ejecuta via stdio. Configura tu cliente MCP (Claude Desktop, Cursor, etc.) para conectarse a:

```bash
npx pampa mcp
```

## 🧠 Proveedores de Embeddings

PAMPA soporta múltiples proveedores para generar embeddings de código:

| Proveedor           | Costo                    | Privacidad | Instalación                                                 |
| ------------------- | ------------------------ | ---------- | ----------------------------------------------------------- |
| **Transformers.js** | 🟢 Gratis                | 🟢 Total   | `npm install @xenova/transformers`                          |
| **Ollama**          | 🟢 Gratis                | 🟢 Total   | [Instalar Ollama](https://ollama.ai) + `npm install ollama` |
| **OpenAI**          | 🔴 ~$0.10/1000 funciones | 🔴 Ninguna | Configurar `OPENAI_API_KEY`                                 |
| **Cohere**          | 🟡 ~$0.05/1000 funciones | 🔴 Ninguna | Configurar `COHERE_API_KEY` + `npm install cohere-ai`       |

**Recomendación:** Usa **Transformers.js** para desarrollo personal (gratis y privado) u **OpenAI** para máxima calidad.

Ver [PROVEEDORES_EMBEDDINGS.md](./PROVEEDORES_EMBEDDINGS.md) para detalles completos.

## 📋 Referencia CLI

| Comando                                  | Propósito                                                 |
| ---------------------------------------- | --------------------------------------------------------- |
| `npx pampa index [path] [--provider X]`  | Escanear proyecto, actualizar SQLite y pampa.codemap.json |
| `npx pampa mcp`                          | Iniciar servidor MCP (stdio)                              |
| `npx pampa search <query> [-k N] [-p X]` | Búsqueda vectorial local rápida (debug)                   |
| `npx pampa info`                         | Mostrar estadísticas del proyecto indexado                |

**Proveedores disponibles:** `auto` (default), `transformers`, `openai`, `ollama`, `cohere`

## 🔧 Herramientas MCP Disponibles

El servidor MCP expone las siguientes herramientas que los agentes pueden usar:

### `search_code`

Busca código semánticamente en el proyecto indexado.

-   **Parámetros**: `query` (string), `limit` (number, opcional)
-   **Ejemplo**: "función de autenticación", "manejo de errores"

### `get_code_chunk`

Obtiene el código completo de un chunk específico.

-   **Parámetros**: `sha` (string)
-   **Retorna**: Código fuente completo

### `index_project`

Indexa un proyecto desde el agente.

-   **Parámetros**: `path` (string, opcional)
-   **Efecto**: Actualiza la base de datos y codemap

### `get_project_stats`

Obtiene estadísticas del proyecto indexado.

-   **Parámetros**: `path` (string, opcional)
-   **Retorna**: Estadísticas por lenguaje y archivo

## 📊 Recursos MCP Disponibles

### `pampa://codemap`

Acceso al mapa de código completo del proyecto.

### `pampa://overview`

Resumen de las principales funciones del proyecto.

## 🎯 Prompts MCP Disponibles

### `analyze_code`

Plantilla para analizar código encontrado con enfoque específico.

### `find_similar_functions`

Plantilla para encontrar funciones existentes similares.

## 🔍 Cómo Funciona la Recuperación

-   **Búsqueda vectorial** – Similitud coseno en `text-embedding-3-large` (3,072-D)
-   **Fallback de resumen** – Si un agente envía una consulta vacía, PAMPA retorna los resúmenes de nivel superior para que el agente entienda el territorio
-   **Granularidad de chunk** – Por defecto = función/método/clase. Ajustable por lenguaje

## 📝 Decisiones de Diseño

-   **Solo Node** → Los devs ejecutan todo via `npx`, sin Python, sin Docker
-   **SQLite sobre HelixDB** → Una base de datos local para vectores y relaciones, sin dependencias externas
-   **Codemap commiteado** → El contexto viaja con el repo → clonar funciona offline
-   **Granularidad de chunk** → Por defecto = función/método/clase. Ajustable por lenguaje
-   **Solo lectura por defecto** → El servidor solo expone métodos de lectura. La escritura se hace via CLI

## 🧩 Extendiendo PAMPA

| Idea                          | Pista                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| **Más lenguajes**             | Instala la gramática tree-sitter y agrégala a `LANG_RULES`                                      |
| **Embeddings personalizados** | Exporta `OPENAI_API_KEY` o cambia OpenAI por cualquier proveedor que retorne `vector: number[]` |
| **Seguridad**                 | Ejecuta detrás de un proxy reverso con autenticación                                            |
| **Plugin VS Code**            | Apunta un cliente MCP WebView a tu servidor local                                               |

## 🔧 Configuración para Clientes MCP

### Claude Desktop

Agrega a tu configuración de Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` en macOS):

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

**Nota:** La `OPENAI_API_KEY` es opcional. Sin ella, PAMPA usará modelos locales automáticamente.

### Cursor

Configura Cursor para usar PAMPA como servidor MCP en la configuración del workspace.

## 🤝 Contribuyendo

1. **Fork** → crear rama de feature (`feat/...`)
2. **Ejecutar** `npm test` (próximamente) & `npx pampa index` antes del PR
3. **Abrir PR** con contexto: por qué + screenshots/logs

Todas las discusiones en GitHub Issues.

## 📜 Licencia

MIT – haz lo que quieras, solo mantén el copyright.

## 🚀 Ejemplo de Uso

```bash
# Indexar tu proyecto
npx pampa index

# Ver estadísticas
npx pampa info

# Buscar funciones
npx pampa search "validación de usuario"

# Iniciar servidor MCP para agentes
npx pampa mcp
```

¡Feliz hacking! 💙
