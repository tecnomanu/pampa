# PAMPA – Protocol for Augmented Memory of Project Artifacts

**Version 1.3.5** · **MCP Compatible** · **Node.js**

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
2. **Embedding** – Chunks are vectorized with `text-embedding-3-large`
3. **Indexing** – Vectors + metadata live in local SQLite
4. **Codemap** – A lightweight `pampa.codemap.json` commits to git so context follows the repo
5. **Serving** – An MCP server exposes tools to search and retrieve code

Any MCP-compatible agent (Cursor, Claude, etc.) can now search, retrieve and stay synchronized – without scanning the entire tree.

## 🏗️ Architecture

```
┌──────────── Repo (git) ───────────┐
│ app/… src/… package.json etc.     │
│ pampa.codemap.json                │
│ .pampa/chunks/*.gz                │
│ .pampa/pampa.db (SQLite)          │
│ pampa_debug.log (if --debug)      │
│ pampa_error.log (errors only)     │
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

### Key Components

| Layer          | Role                                                              | Technology                      |
| -------------- | ----------------------------------------------------------------- | ------------------------------- |
| **Indexer**    | Cuts code into semantic chunks, embeds, writes codemap and SQLite | tree-sitter, openai@v4, sqlite3 |
| **Codemap**    | Git-friendly JSON with {file, symbol, sha, lang} per chunk        | Plain JSON                      |
| **Chunks dir** | .gz code bodies (lazy loading)                                    | gzip                            |
| **SQLite**     | Stores vectors and metadata                                       | sqlite3                         |
| **MCP Server** | Exposes tools and resources over standard MCP protocol            | @modelcontextprotocol/sdk       |
| **Logging**    | Debug and error logging in project directory                      | File-based logs                 |

## 🚀 MCP Installation & Setup

### 1. Index your current repo

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
			"args": ["pampa", "mcp"],
			"env": {
				"OPENAI_API_KEY": "your-api-key-here"
			}
		}
	}
}
```

**Debug Mode:** To enable detailed logging, use `["pampa", "mcp", "--debug"]` in the args array.

**Note:** The `OPENAI_API_KEY` is optional. Without it, PAMPA will use local models automatically.

#### Cursor

Configure Cursor to use PAMPA as an MCP server in your workspace settings.

### 3. Start using semantic search

Once configured, your AI agent can:

```
🔍 Search: "authentication function"
📄 Get code: Use the SHA from search results
📊 Stats: Get project overview and statistics
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

## 📋 CLI Usage

| Command                                  | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `npx pampa index [path] [--provider X]`  | Scan project, update SQLite and pampa.codemap.json |
| `npx pampa mcp`                          | Start MCP server (stdio)                           |
| `npx pampa search <query> [-k N] [-p X]` | Fast local vector search (debug)                   |
| `npx pampa info`                         | Show indexed project statistics                    |

**Available providers:** `auto` (default), `transformers`, `openai`, `ollama`, `cohere`

### Quick CLI Example

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

### `get_project_stats`

Get indexed project statistics.

-   **Parameters**:
    -   `path` (string, optional) - **PROJECT ROOT** directory path where PAMPA database is located
-   **Database Location**: `{path}/.pampa/pampa.db`
-   **Returns**: Statistics by language and file

## 🐛 Debug Mode

PAMPA supports detailed debug logging for troubleshooting MCP operations:

### Enabling Debug Mode

```bash
# For MCP server
npx pampa mcp --debug

# In Claude Desktop config
{
    "mcpServers": {
        "pampa": {
            "command": "npx",
            "args": ["pampa", "mcp", "--debug"]
        }
    }
}
```

### Debug Files Created

When debug mode is enabled, PAMPA creates log files in the project directory specified by the `path` parameter:

-   `{path}/pampa_debug.log` - Detailed operation logs
-   `{path}/pampa_error.log` - Error logs only

### What Gets Logged

-   Tool calls and parameters
-   Working directory changes
-   Database operations
-   Search results and performance
-   Error details with context

## 📊 Available MCP Resources

### `pampa://codemap`

Access to the complete project code map.

### `pampa://overview`

Summary of the project's main functions.

## 🎯 Available MCP Prompts

### `analyze_code`

Template to analyze found code with specific focus.

### `find_similar_functions`

Template to find existing similar functions.

## 🔍 How Retrieval Works

-   **Vector search** – Cosine similarity on `text-embedding-3-large` (3,072-D)
-   **Summary fallback** – If an agent sends an empty query, PAMPA returns top-level summaries so the agent understands the territory
-   **Chunk granularity** – Default = function/method/class. Adjustable by language

## 📝 Design Decisions

-   **Node only** → Devs run everything via `npx`, no Python, no Docker
-   **SQLite over HelixDB** → One local database for vectors and relations, no external dependencies
-   **Committed codemap** → Context travels with the repo → cloning works offline
-   **Chunk granularity** → Default = function/method/class. Adjustable by language
-   **Read-only by default** → Server only exposes read methods. Writing is done via CLI

## 🧩 Extending PAMPA

| Idea                  | Hint                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------- |
| **More languages**    | Install tree-sitter grammar and add to `LANG_RULES`                                         |
| **Custom embeddings** | Export `OPENAI_API_KEY` or replace OpenAI with any provider that returns `vector: number[]` |
| **Security**          | Run behind a reverse proxy with authentication                                              |
| **VS Code Plugin**    | Point an MCP WebView client to your local server                                            |

## 🤝 Contributing

For guidelines on contributing to this project, please see [CONTRIBUTING.md](docs/CONTRIBUTING.md).

## 📜 Code of Conduct

Please read our [Code of Conduct](docs/CODE_OF_CONDUCT.md) before participating in our project.

## 📄 License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

---

## 🇦🇷 About PAMPA

**PAMPA** is an Argentine word referring to the vast, fertile plains of South America. Just as the Pampas connect different regions and provide rich, accessible resources, PAMPA connects your codebase to AI agents, providing rich, accessible code memory across your entire project.

Made with ❤️ in Argentina 🇦🇷
