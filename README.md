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

## 🤖 For AI Agents: How to Use PAMPA Effectively

**If you are an AI agent with access to PAMPA tools, here's your workflow:**

### 🚀 Essential First Steps (Do This ALWAYS)

```markdown
1. **Check if project is indexed:**
    - Use `get_project_stats` to see if the project has a PAMPA database
    - If no database exists, use `index_project` to create it
2. **Update before starting work:**

    - ALWAYS run `update_project` at the beginning of sessions
    - Run `update_project` after any code changes you make
    - This ensures you have access to the latest functions

3. **Search before creating:**
    - Before writing any function, use `search_code` to check if it already exists
    - Search with semantic queries like "user authentication", "validate email", "calculate total"
    - Use `get_code_chunk` to examine existing implementations
```

### 🔍 Smart Search Strategies

```markdown
-   **Be semantic:** Search "authentication logic" not "login()"
-   **Use context:** "error handling for API calls" not just "error"
-   **Check variations:** "create user", "add user", "register user"
-   **Explore related:** After finding one function, search for related concepts
```

### ⚡ Suggested Workflow

```markdown
AT START OF EVERY CONVERSATION:

1. "Let me check what's already implemented in this project"
2. Use `get_project_stats` to understand the project structure
3. Use `update_project` to ensure the database is current
4. Use `search_code` to find relevant existing functions

BEFORE CREATING ANY FUNCTION:

1. Search for existing implementations
2. Check related functions with semantic queries
3. Only create new functions if none exist or don't fit the requirements

AFTER MAKING CHANGES:

1. Run `update_project` to update the knowledge base
2. This ensures future searches include your new code
```

### 🎯 Sample Prompts for Common Tasks

```markdown
UNDERSTANDING A PROJECT:

-   "Let me explore this codebase structure" → `get_project_stats`
-   "Show me authentication-related functions" → `search_code("authentication")`
-   "Find database connection logic" → `search_code("database connection")`

BEFORE CODING:

-   "Does this project have user validation?" → `search_code("user validation")`
-   "How is error handling implemented?" → `search_code("error handling")`
-   "Are there existing API endpoints?" → `search_code("API endpoint")`

AFTER CODING:

-   "Update the project index with my changes" → `update_project`
-   "Verify my new function was indexed" → `search_code("my new function name")`
```

**Remember:** PAMPA is your project memory. Use it continuously to avoid duplicating work and to understand the existing codebase architecture.

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
| `npx pampa update [path] [--provider X]` | Update index after code changes (recommended)      |
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

When debug mode is enabled, PAMPA creates log files in the project directory specified by the `
