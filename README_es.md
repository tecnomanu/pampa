# PAMPA – Protocolo para Memoria Aumentada de Artefactos de Proyecto

**Versión 1.5.0** · **Compatible con MCP** · **Node.js**

<p align="center">
  <img src="assets/pampa_banner.jpg" alt="Agent Rules Kit Logo" width="729" />
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/pampa.svg" alt="Version" />
  <img src="https://img.shields.io/npm/dm/pampa.svg" alt="Downloads" />
  <img src="https://img.shields.io/github/license/tecnomanu/pampa" alt="License" />
  <img src="https://img.shields.io/github/last-commit/tecnomanu/pampa" alt="Last Commit" />
  <img src="https://img.shields.io/github/actions/workflow/status/tecnomanu/pampa/CI" alt="Build Status" />
</p>

Dale a tus agentes de IA una memoria siempre actualizada y consultable de cualquier base de código – en un comando `npx`.

> 🇪🇸 **Versión en Español** | 🇺🇸 **[English Version](README.md)**

## 🌟 ¿Por qué PAMPA?

Los agentes de modelos de lenguaje grandes pueden leer miles de tokens, pero los proyectos fácilmente alcanzan millones de caracteres. Sin una capa de recuperación inteligente, los agentes:

-   **Recrean funciones** que ya existen
-   **Nombran mal las APIs** (newUser vs. createUser)
-   **Desperdician tokens** cargando código repetitivo (`vendor/`, `node_modules/`...)
-   **Fallan** cuando el repositorio crece

PAMPA resuelve esto convirtiendo tu repositorio en un **grafo de memoria de código**:

1. **Chunking** – Cada función/clase se convierte en un chunk atómico
2. **Embedding** – Los chunks se vectorizan con modelos de embedding avanzados
3. **Indexing** – Vectores + metadatos viven en SQLite local
4. **Codemap** – Un `pampa.codemap.json` ligero se commitea a git para que el contexto siga al repo
5. **Serving** – Un servidor MCP expone herramientas para buscar y obtener código

Cualquier agente compatible con MCP (Cursor, Claude, etc.) ahora puede buscar, obtener y mantenerse sincronizado – sin escanear todo el árbol.

## 📑 Índice

-   [🚀 Instalación como MCP (Recomendado)](#-instalación-como-mcp-recomendado)
-   [💻 Uso Directo con CLI](#-uso-directo-con-cli)
-   [🧠 Proveedores de Embeddings](#-proveedores-de-embeddings)
-   [🏗️ Arquitectura](#️-arquitectura)
-   [🔧 Herramientas MCP Disponibles](#-herramientas-mcp-disponibles)
-   [📊 Recursos MCP Disponibles](#-recursos-mcp-disponibles)
-   [🎯 Prompts MCP Disponibles](#-prompts-mcp-disponibles)

## 🚀 Instalación como MCP (Recomendado)

### 1. Indexa tu proyecto

```bash
# Con modelo local (gratis, privado)
npx pampa index --provider transformers

# O con OpenAI (mejor calidad, requiere API key)
export OPENAI_API_KEY="tu-api-key"
npx pampa index --provider openai

# O auto-detectar el mejor disponible
npx pampa index
```

### 2. Configura tu cliente MCP

#### Claude Desktop

Agrega a tu configuración de Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` en macOS):

```json
{
	"mcpServers": {
		"pampa": {
			"command": "npx",
			"args": ["-y", "pampa", "mcp"],
			"env": {
				"OPENAI_API_KEY": "tu-api-key-aqui"
			}
		}
	}
}
```

**Modo Debug:** Para habilitar logging detallado, usa `["-y", "pampa", "mcp", "--debug"]` en el array de args.

**Nota:** La `OPENAI_API_KEY` es opcional. Sin ella, PAMPA usará modelos locales automáticamente.

#### Cursor

Configura Cursor creando o editando el archivo `mcp.json` en tu directorio de configuración:

```json
{
	"mcpServers": {
		"pampa": {
			"command": "npx",
			"args": ["-y", "pampa", "mcp"]
		}
	}
}
```

La configuración es idéntica a Claude Desktop. Cursor utiliza el mismo sistema de archivos de configuración MCP.

### 3. Instala la regla para tu agente

**Además, instala esta regla en tu aplicación para que use PAMPA efectivamente:**

Copia el contenido de [RULE_FOR_PAMPA_MCP.md](RULE_FOR_PAMPA_MCP.md) (en inglés para mejor compatibilidad) en las instrucciones de tu agente o sistema de IA.

### 4. ¡Listo! Tu agente ahora puede buscar código

Una vez configurado, tu agente de IA puede:

```
🔍 Buscar: "función de autenticación"
📄 Obtener código: Usar el SHA de los resultados de búsqueda
📊 Estadísticas: Obtener resumen del proyecto
🔄 Actualizar: Mantener la memoria sincronizada
```

## 💻 Uso Directo con CLI

Para uso directo desde terminal sin MCP:

### Comandos Disponibles

| Comando                                  | Propósito                                                 |
| ---------------------------------------- | --------------------------------------------------------- |
| `npx pampa index [path] [--provider X]`  | Escanear proyecto, actualizar SQLite y pampa.codemap.json |
| `npx pampa update [path] [--provider X]` | Actualizar índice después de cambios (recomendado)        |
| `npx pampa mcp`                          | Iniciar servidor MCP (stdio)                              |
| `npx pampa search <query> [-k N] [-p X]` | Búsqueda vectorial local rápida (debug)                   |
| `npx pampa info`                         | Mostrar estadísticas del proyecto indexado                |

### Ejemplo de Uso

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

## 🏗️ Arquitectura

```
┌──────────── Repo (git) ─────────-──┐
│ app/… src/… package.json etc.      │
│ pampa.codemap.json                 │
│ .pampa/chunks/*.gz                 │
│ .pampa/pampa.db (SQLite)           │
└────────────────────────────────────┘
          ▲       ▲
          │ write │ read
┌─────────┴─────────┐   │
│ indexer.js        │   │
│ (pampa index)     │   │
└─────────▲─────────┘   │
          │ store       │ vector query
┌─────────┴──────────┐  │ gz fetch
│ SQLite (local)     │  │
└─────────▲──────────┘  │
          │ read        │
┌─────────┴──────────┐  │
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

## 🔧 Herramientas MCP Disponibles

El servidor MCP expone las siguientes herramientas que los agentes pueden usar:

### `search_code`

Busca código semánticamente en el proyecto indexado.

-   **Parámetros**:
    -   `query` (string) - Consulta de búsqueda semántica (ej: "función de autenticación", "manejo de errores")
    -   `limit` (number, opcional) - Número máximo de resultados (default: 10)
    -   `provider` (string, opcional) - Proveedor de embedding (default: "auto")
    -   `path` (string, opcional) - **DIRECTORIO RAÍZ** del proyecto donde está la base de datos PAMPA
-   **Ubicación DB**: `{path}/.pampa/pampa.db`
-   **Retorna**: Lista de chunks de código coincidentes con scores de similitud y SHAs

### `get_code_chunk`

Obtiene el código completo de un chunk específico.

-   **Parámetros**:
    -   `sha` (string) - SHA del chunk de código a obtener (obtenido de search_code)
    -   `path` (string, opcional) - **DIRECTORIO RAÍZ** del proyecto (mismo que en search_code)
-   **Ubicación Chunk**: `{path}/.pampa/chunks/{sha}.gz`
-   **Retorna**: Código fuente completo

### `index_project`

Indexa un proyecto desde el agente.

-   **Parámetros**:
    -   `path` (string, opcional) - **DIRECTORIO RAÍZ** del proyecto a indexar (creará subdirectorio .pampa/)
    -   `provider` (string, opcional) - Proveedor de embedding (default: "auto")
-   **Crea**:
    -   `{path}/.pampa/pampa.db` (base de datos SQLite con embeddings)
    -   `{path}/.pampa/chunks/` (chunks de código comprimidos)
    -   `{path}/pampa.codemap.json` (índice ligero para control de versiones)
-   **Efecto**: Actualiza base de datos y codemap

### `update_project`

**🔄 CRÍTICO: ¡Usa esta herramienta frecuentemente para mantener tu memoria de IA actualizada!**

Actualiza el índice del proyecto después de cambios de código (herramienta recomendada de flujo de trabajo).

-   **Parámetros**:
    -   `path` (string, opcional) - **DIRECTORIO RAÍZ** del proyecto a actualizar (mismo que en index_project)
    -   `provider` (string, opcional) - Proveedor de embedding (default: "auto")
-   **Actualiza**:
    -   Re-escanea todos los archivos en busca de cambios
    -   Actualiza embeddings para funciones modificadas
    -   Elimina funciones borradas de la base de datos
    -   Agrega nuevas funciones a la base de datos
-   **Cuándo usar**:
    -   ✅ Al inicio de sesiones de desarrollo
    -   ✅ Después de crear nuevas funciones
    -   ✅ Después de modificar funciones existentes
    -   ✅ Después de eliminar funciones
    -   ✅ Antes de tareas importantes de análisis de código
    -   ✅ Después de refactorizar código
-   **Efecto**: Mantiene la memoria de código de tu agente sincronizada con el estado actual

### `get_project_stats`

Obtiene estadísticas del proyecto indexado.

-   **Parámetros**:
    -   `path` (string, opcional) - **DIRECTORIO RAÍZ** del proyecto donde está la base de datos PAMPA
-   **Ubicación DB**: `{path}/.pampa/pampa.db`
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

-   **Búsqueda vectorial** – Similitud coseno con embeddings avanzados de alta dimensionalidad
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

## 🤝 Contribuyendo

1. **Fork** → crear rama de feature (`feat/...`)
2. **Ejecutar** `npm test` (próximamente) & `npx pampa index` antes del PR
3. **Abrir PR** con contexto: por qué + screenshots/logs

Todas las discusiones en GitHub Issues.

## 📜 Licencia

MIT – haz lo que quieras, solo mantén el copyright.

¡Feliz hacking! 💙

---

🇦🇷 **Hecho con ❤️ en Argentina** | 🇦🇷 **Made with ❤️ in Argentina**
