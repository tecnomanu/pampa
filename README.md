# PAMPA – Protocol for Augmented Memory of Project Artifacts

**Version 1.5.x** · **MCP Compatible** · **Node.js**

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

Give your AI agents an always-updated, queryable memory of any codebase – in one `npx` command.

> 🇪🇸 **[Versión en Español](README_es.md)** | 🇺🇸 **English Version**

## 🌟 Why PAMPA?

Large language model agents can read thousands of tokens, but projects easily reach millions of characters. Without an intelligent retrieval layer, agents:

-   **Recreate functions** that already exist
-   **Misname APIs** (newUser vs. createUser)
-   **Waste tokens** loading repetitive code (`vendor/`, `node_modules/`...)
-   **Fail** when the repository grows

PAMPA solves this by turning your repository into a **code memory graph**:

1. **Chunking** – Each function/class becomes an atomic chunk
2. **Embedding** – Chunks are vectorized with advanced embedding models
3. **Indexing** – Vectors + metadata live in local SQLite
4. **Codemap** – A lightweight `pampa.codemap.json` commits to git so context follows the repo
5. **Serving** – An MCP server exposes tools to search and retrieve code

Any MCP-compatible agent (Cursor, Claude, etc.) can now search, retrieve and stay synchronized – without scanning the entire tree.

## 📑 Table of Contents

-   [🚀 MCP Installation (Recommended)](#-mcp-installation-recommended)
-   [💻 Direct CLI Usage](#-direct-cli-usage)
-   [🧠 Embedding Providers](#-embedding-providers)
-   [🏗️ Architecture](#️-architecture)
-   [🔧 Available MCP Tools](#-available-mcp-tools)
-   [📊 Available MCP Resources](#-available-mcp-resources)
-   [🎯 Available MCP Prompts](#-available-mcp-prompts)

## 🚀 MCP Installation (Recommended)

### 1. Index your project

```bash
# With local model (free, private)
npx pampa index --provider transformers

# Or with OpenAI (better quality, requires API key)
export OPENAI_API_KEY="your-api-key"
npx pampa index --provider openai

# Or auto-detect best available
npx pampa index
```

### 2. Configure your MCP client

#### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
	"mcpServers": {
		"pampa": {
			"command": "npx",
			"args": ["-y", "pampa", "mcp"],
			"env": {
				"OPENAI_API_KEY": "your-api-key-here"
			}
		}
	}
}
```

**Debug Mode:** To enable detailed logging, use `["-y", "pampa", "mcp", "--debug"]` in the args array.

**Note:** The `OPENAI_API_KEY` is optional. Without it, PAMPA will use local models automatically.

#### Cursor

Configure Cursor by creating or editing the `mcp.json` file in your configuration directory:

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

The configuration is identical to Claude Desktop. Cursor uses the same MCP configuration file system.

### 3. Install the rule for your agent

**Additionally, install this rule in your application so it uses PAMPA effectively:**

Copy the content from [RULE_FOR_PAMPA_MCP.md](RULE_FOR_PAMPA_MCP.md) into your agent or AI system instructions.

### 4. Ready! Your agent can now search code

Once configured, your AI agent can:

```
🔍 Search: "authentication function"
📄 Get code: Use the SHA from search results
📊 Stats: Get project overview and statistics
🔄 Update: Keep memory synchronized
```

## 💻 Direct CLI Usage

For direct terminal usage without MCP:

### Available Commands

| Command                                  | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `npx pampa index [path] [--provider X]`  | Scan project, update SQLite and pampa.codemap.json |
| `npx pampa update [path] [--provider X]` | Update index after code changes (recommended)      |
| `npx pampa mcp`                          | Start MCP server (stdio)                           |
| `npx pampa search <query> [-k N] [-p X]` | Fast local vector search (debug)                   |
| `npx pampa info`                         | Show indexed project statistics                    |

### Usage Example

```bash
# Index your project
npx pampa index

# View statistics
npx pampa info

# Search functions
npx pampa search "user validation"

# Start MCP server for agents
npx pampa mcp
```

## 🧠 Embedding Providers

PAMPA supports multiple providers for generating code embeddings:

| Provider            | Cost                     | Privacy  | Installation                                               |
| ------------------- | ------------------------ | -------- | ---------------------------------------------------------- |
| **Transformers.js** | 🟢 Free                  | 🟢 Total | `npm install @xenova/transformers`                         |
| **Ollama**          | 🟢 Free                  | 🟢 Total | [Install Ollama](https://ollama.ai) + `npm install ollama` |
| **OpenAI**          | 🔴 ~$0.10/1000 functions | 🔴 None  | Set `OPENAI_API_KEY`                                       |
| **Cohere**          | 🟡 ~$0.05/1000 functions | 🔴 None  | Set `COHERE_API_KEY` + `npm install cohere-ai`             |

**Recommendation:** Use **Transformers.js** for personal development (free and private) or **OpenAI** for maximum quality.

## 🏗️ Architecture

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

### Key Components

| Layer          | Role                                                              | Technology                      |
| -------------- | ----------------------------------------------------------------- | ------------------------------- |
| **Indexer**    | Cuts code into semantic chunks, embeds, writes codemap and SQLite | tree-sitter, openai@v4, sqlite3 |
| **Codemap**    | Git-friendly JSON with {file, symbol, sha, lang} per chunk        | Plain JSON                      |
| **Chunks dir** | .gz code bodies (lazy loading)                                    | gzip                            |
| **SQLite**     | Stores vectors and metadata                                       | sqlite3                         |
| **MCP Server** | Exposes tools and resources over standard MCP protocol            | @modelcontextprotocol/sdk       |
| **Logging**    | Debug and error logging in project directory                      | File-based logs                 |

## 🔧 Available MCP Tools

The MCP server exposes these tools that agents can use:

### `search_code`

Search code semantically in the indexed project.

-   **Parameters**:
    -   `query` (string) - Semantic search query (e.g., "authentication function", "error handling")
    -   `limit` (number, optional) - Maximum number of results to return (default: 10)
    -   `provider` (string, optional) - Embedding provider (default: "auto")
    -   `path` (string, optional) - **PROJECT ROOT** directory path where PAMPA database is located
-   **Database Location**: `{path}/.pampa/pampa.db`
-   **Returns**: List of matching code chunks with similarity scores and SHAs

### `get_code_chunk`

Get complete code of a specific chunk.

-   **Parameters**:
    -   `sha` (string) - SHA of the code chunk to retrieve (obtained from search_code results)
    -   `path` (string, optional) - **PROJECT ROOT** directory path (same as used in search_code)
-   **Chunk Location**: `{path}/.pampa/chunks/{sha}.gz`
-   **Returns**: Complete source code

### `index_project`

Index a project from the agent.

-   **Parameters**:
    -   `path` (string, optional) - **PROJECT ROOT** directory path to index (will create .pampa/ subdirectory here)
    -   `provider` (string, optional) - Embedding provider (default: "auto")
-   **Creates**:
    -   `{path}/.pampa/pampa.db` (SQLite database with embeddings)
    -   `{path}/.pampa/chunks/` (compressed code chunks)
    -   `{path}/pampa.codemap.json` (lightweight index for version control)
-   **Effect**: Updates database and codemap

### `update_project`

**🔄 CRITICAL: Use this tool frequently to keep your AI memory current!**

Update project index after code changes (recommended workflow tool).

-   **Parameters**:
    -   `path` (string, optional) - **PROJECT ROOT** directory path to update (same as used in index_project)
    -   `provider` (string, optional) - Embedding provider (default: "auto")
-   **Updates**:
    -   Re-scans all files for changes
    -   Updates embeddings for modified functions
    -   Removes deleted functions from database
    -   Adds new functions to database
-   **When to use**:
    -   ✅ At the start of development sessions
    -   ✅ After creating new functions
    -   ✅ After modifying existing functions
    -   ✅ After deleting functions
    -   ✅ Before major code analysis tasks
    -   ✅ After refactoring code
-   **Effect**: Keeps your AI agent's code memory synchronized with current state

### `get_project_stats`

Get indexed project statistics.

-   **Parameters**:
    -   `path` (string, optional) - **PROJECT ROOT** directory path where PAMPA database is located
-   **Database Location**: `{path}/.pampa/pampa.db`
-   **Returns**: Statistics by language and file

## 📊 Available MCP Resources

### `pampa://codemap`

Access to the complete project code map.

### `pampa://overview`

Summary of the project's main functions.

## 🎯 Available MCP Prompts

### `analyze_code`

Template for analyzing found code with specific focus.

### `find_similar_functions`

Template for finding existing similar functions.

## 🔍 How Retrieval Works

-   **Vector search** – Cosine similarity with advanced high-dimensional embeddings
-   **Summary fallback** – If an agent sends an empty query, PAMPA returns top-level summaries so the agent understands the territory
-   **Chunk granularity** – Default = function/method/class. Adjustable per language

## 📝 Design Decisions

-   **Node only** → Devs run everything via `npx`, no Python, no Docker
-   **SQLite over HelixDB** → One local database for vectors and relations, no external dependencies
-   **Committed codemap** → Context travels with repo → cloning works offline
-   **Chunk granularity** → Default = function/method/class. Adjustable per language
-   **Read-only by default** → Server only exposes read methods. Writing is done via CLI

## 🧩 Extending PAMPA

| Idea                  | Hint                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **More languages**    | Install tree-sitter grammar and add it to `LANG_RULES`                                    |
| **Custom embeddings** | Export `OPENAI_API_KEY` or switch OpenAI for any provider that returns `vector: number[]` |
| **Security**          | Run behind a reverse proxy with authentication                                            |
| **VS Code Plugin**    | Point an MCP WebView client to your local server                                          |

## 🤝 Contributing

1. **Fork** → create feature branch (`feat/...`)
2. **Run** `npm test` (coming soon) & `npx pampa index` before PR
3. **Open PR** with context: why + screenshots/logs

All discussions on GitHub Issues.

## 📜 License

MIT – do whatever you want, just keep the copyright.

Happy hacking! 💙

---

🇦🇷 **Made with ❤️ in Argentina** | 🇦🇷 **Hecho con ❤️ en Argentina**
