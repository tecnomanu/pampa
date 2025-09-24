# PAMPA – Protocol for Augmented Memory of Project Artifacts

**Version 1.11.x** · **Semantic Search** · **MCP Compatible** · **Node.js**

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

Give your AI agents an always-updated, queryable memory of any codebase – with **intelligent semantic search** and **automatic learning** – in one `npx` command.

> 🇪🇸 **[Versión en Español](README_es.md)** | 🇺🇸 **English Version** | 🤖 **[Agent Version](README_FOR_AGENTS.md)**

## 🌟 What's New in v1.11 - Enhanced Language Support

🐍 **Python Integration** - Full support for Python code indexing and semantic search with proper function/class detection

🧠 **Improved Semantic Tags** - Enhanced automatic tag extraction across all supported languages: `StripeService.php` → `["stripe", "service", "payment"]`

🎯 **Better Intention-Based Search** - Refined natural language query mapping: `"how to create stripe session"` → instant result

📈 **Enhanced Adaptive Learning** - Improved learning from successful searches (>80% similarity) with better pattern recognition

🏷️ **@pampa-comments** - Optional JSDoc-style comments for enhanced semantic understanding (complementary, not required)

💡 **Robust Hybrid Search System** - Combines intention cache + vector search + semantic boosting for maximum precision

🔧 **MCP Server Stability** - Fixed package.json path resolution issues for better MCP server reliability

**Performance improvements:**

-   **+32% to +85%** better search precision
-   Instant responses for learned patterns
-   Perfect scores (1.0) when intent matches exactly

## 🌟 Why PAMPA?

Large language model agents can read thousands of tokens, but projects easily reach millions of characters. Without an intelligent retrieval layer, agents:

-   **Recreate functions** that already exist
-   **Misname APIs** (newUser vs. createUser)
-   **Waste tokens** loading repetitive code (`vendor/`, `node_modules/`...)
-   **Fail** when the repository grows

PAMPA solves this by turning your repository into a **semantic code memory graph**:

1. **Chunking** – Each function/class becomes an atomic chunk
2. **Semantic Tagging** – Automatic extraction of semantic tags from code context
3. **Embedding** – Enhanced chunks are vectorized with advanced embedding models
4. **Learning** – System learns from successful searches and caches intentions
5. **Indexing** – Vectors + semantic metadata live in local SQLite
6. **Codemap** – A lightweight `pampa.codemap.json` commits to git so context follows the repo
7. **Serving** – An MCP server exposes intelligent search and retrieval tools

Any MCP-compatible agent (Cursor, Claude, etc.) can now search with natural language, get instant responses for learned patterns, and stay synchronized – without scanning the entire tree.

## 🤖 For AI Agents & Humans

> **🤖 If you're an AI agent:** Read the [complete setup guide for agents →](README_FOR_AGENTS.md)
> or
> **👤 If you're human:** Share the [agent setup guide](README_FOR_AGENTS.md) with your AI assistant to automatically configure PAMPA!

## 📚 Table of Contents

-   [🚀 MCP Installation (Recommended)](#-mcp-installation-recommended)
-   [🧠 Semantic Features](#-semantic-features)
-   [📝 Supported Languages](#-supported-languages)
-   [💻 Direct CLI Usage](#-direct-cli-usage)
-   [🧠 Embedding Providers](#-embedding-providers)
-   [🏗️ Architecture](#️-architecture)
-   [🔧 Available MCP Tools](#-available-mcp-tools)
-   [📊 Available MCP Resources](#-available-mcp-resources)
-   [🎯 Available MCP Prompts](#-available-mcp-prompts)

## 🧠 Semantic Features

### 🏷️ Automatic Semantic Tagging

PAMPA automatically extracts semantic tags from your code without any special comments:

```javascript
// File: app/Services/Payment/StripeService.php
function createCheckoutSession() { ... }
```

**Automatic tags:** `["stripe", "service", "payment", "checkout", "session", "create"]`

### 🎯 Intention-Based Direct Search

The system learns from successful searches and provides instant responses:

```bash
# First search (vector search)
"stripe payment session" → 0.9148 similarity

# System automatically learns and caches this pattern
# Next similar searches are instant:
"create stripe session" → instant response (cached)
"stripe checkout session" → instant response (cached)
```

### 📈 Adaptive Learning System

-   **Automatic Learning**: Saves successful searches (>80% similarity) as intentions
-   **Query Normalization**: Understands variations: `"create"` = `"crear"`, `"session"` = `"sesion"`
-   **Pattern Recognition**: Groups similar queries: `"[PROVIDER] payment session"`

### 🏷️ Optional @pampa-comments (Complementary)

Enhance search precision with optional JSDoc-style comments:

```javascript
/**
 * @pampa-tags: stripe-checkout, payment-processing, e-commerce-integration
 * @pampa-intent: create secure stripe checkout session for payments
 * @pampa-description: Main function for handling checkout sessions with validation
 */
async function createStripeCheckoutSession(sessionData) {
	// Your code here...
}
```

**Benefits:**

-   **+21% better precision** when present
-   **Perfect scores (1.0)** when query matches intent exactly
-   **Fully optional**: Code without comments works automatically
-   **Retrocompatible**: Existing codebases work without changes

### 📊 Search Performance Results

| Search Type     | Without @pampa | With @pampa | Improvement |
| --------------- | -------------- | ----------- | ----------- |
| Domain-specific | 0.7331         | 0.8874      | **+21%**    |
| Intent matching | ~0.6           | **1.0000**  | **+67%**    |
| General search  | 0.6-0.8        | 0.8-1.0     | **+32-85%** |

## 📝 Supported Languages

PAMPA can index and search code in several languages out of the box:

-   JavaScript / TypeScript (`.js`, `.ts`, `.tsx`, `.jsx`)
-   PHP (`.php`)
-   Python (`.py`)
-   Go (`.go`)
-   Java (`.java`)

## 🚀 MCP Installation (Recommended)

### 1. Configure your MCP client

#### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

**Optional**: Add `"--debug"` to args for detailed logging: `["-y", "pampa", "mcp", "--debug"]`

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

### 2. Let your AI agent handle the indexing

**Your AI agent should automatically:**

-   Check if the project is indexed with `get_project_stats`
-   Index the project with `index_project` if needed
-   Keep it updated with `update_project` after changes

**Need to index manually?** See [Direct CLI Usage](#-direct-cli-usage) section.

### 3. Install the usage rule for your agent

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

For direct terminal usage or manual project indexing:

### Install the CLI

```bash
# Run without installing
npx pampa --help

# Or install globally (requires Node.js 20+)
npm install -g pampa
```

### Index or update a project

```bash
# Index current repository with the best available provider
npx pampa index

# Force the local CPU embedding model (no API keys required)
npx pampa index --provider transformers

# Re-embed after code changes
npx pampa update

# Inspect indexed stats at any time
npx pampa info
```

> Indexing writes `.pampa/` (SQLite database + chunk store) and `pampa.codemap.json`. Commit the codemap to git so teammates and CI re-use the same metadata.

| Command                                  | Purpose                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `npx pampa index [path] [--provider X]`  | Create or refresh the full index at the provided path      |
| `npx pampa update [path] [--provider X]` | Force a full re-scan (helpful after large refactors)       |
| `npx pampa watch [path] [--provider X]`  | Incrementally update the index as files change             |
| `npx pampa search <query>`               | Hybrid BM25 + vector search with optional scoped filters   |
| `npx pampa context <list|show|use>`      | Manage reusable context packs for search defaults          |
| `npx pampa mcp`                          | Start the MCP stdio server for editor/agent integrations   |

### Search with scoped filters & ranking flags

`pampa search` supports the same filters used by MCP clients. Combine glob patterns, semantic tags, language filters, provider overrides, and ranking controls:

| Flag / option        | Effect                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `--path_glob`        | Limit results to matching files (`"app/Services/**"`)                  |
| `--tags`             | Filter by codemap tags (`stripe`, `checkout`)                          |
| `--lang`             | Filter by language (`php`, `ts`, `py`)                                 |
| `--provider`         | Override embedding provider for the query (`openai`, `transformers`)   |
| `--reranker`         | Reorder top results with the Transformers cross-encoder (`off`|`transformers`) |
| `--hybrid` / `--bm25`| Toggle reciprocal-rank fusion or the BM25 candidate stage (`on`|`off`)  |
| `--symbol_boost`     | Toggle symbol-aware ranking boost that favors signature matches (`on`|`off`) |
| `-k, --limit`        | Cap returned results (defaults to 10)                                  |

```bash
# Narrow to service files tagged stripe in PHP
npx pampa search "create checkout session" --path_glob "app/Services/**" --tags stripe --lang php

# Use OpenAI embeddings but keep hybrid fusion enabled
npx pampa search "payment intent status" --provider openai --hybrid on --bm25 on

# Reorder top candidates locally
npx pampa search "oauth middleware" --reranker transformers --limit 5

# Disable signature boosts for literal keyword hunts
npx pampa search "token validation" --symbol_boost off
```

> PAMPA extracts function signatures and lightweight call graphs with tree-sitter. When symbol boosts are enabled, queries that mention a specific method, class, or a directly connected helper will receive an extra scoring bump.

> When a context pack is active, the CLI prints the pack name before executing the search. Any explicit flag overrides the pack defaults.

### Manage context packs

Store JSON packs in `.pampa/contextpacks/*.json` to capture reusable defaults:

```jsonc
// .pampa/contextpacks/stripe-backend.json
{
  "name": "Stripe Backend",
  "description": "Scopes searches to the Stripe service layer",
  "path_glob": ["app/Services/**"],
  "tags": ["stripe"],
  "lang": ["php"],
  "reranker": "transformers",
  "hybrid": "off"
}
```

```bash
# List packs and highlight the active one
npx pampa context list

# Inspect the full JSON definition
npx pampa context show stripe-backend

# Activate scoped defaults (flags still win if provided explicitly)
npx pampa context use stripe-backend

# Clear the active pack (use "none" or "clear")
npx pampa context use clear
```

**MCP tip:** The MCP tool `use_context_pack` mirrors the CLI. Agents can switch packs mid-session and every subsequent `search_code` call inherits those defaults until cleared.

### Watch and incrementally re-index

```bash
# Watch the repository with a 750 ms debounce and local embeddings
npx pampa watch --provider transformers --debounce 750
```

The watcher batches filesystem events, reuses the Merkle hash store in `.pampa/merkle.json`, and only re-embeds touched files. Press `Ctrl+C` to stop.

### Run the synthetic benchmark harness

```bash
npm run bench
```

The harness seeds a deterministic Laravel + TypeScript corpus and prints a summary table with Precision@1, MRR@5, and nDCG@10 for Base, Hybrid, and Hybrid+Cross-Encoder modes. Customise scenarios via flags or environment variables:

- `npm run bench -- --hybrid=off` – run vector-only evaluation
- `npm run bench -- --reranker=transformers` – force the cross-encoder
- `PAMPA_BENCH_MODES=base,hybrid npm run bench` – limit to specific modes
- `PAMPA_BENCH_BM25=off npm run bench` – disable BM25 candidate generation

Benchmark runs never download external models when `PAMPA_MOCK_RERANKER_TESTS=1` (enabled by default inside the harness).

An end-to-end context pack example lives in [`examples/contextpacks/stripe-backend.json`](examples/contextpacks/stripe-backend.json).

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
│ .pampa/chunks/*.gz(.enc)          │
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
| **Chunks dir** | .gz code bodies (or .gz.enc when encrypted) (lazy loading)        | gzip → AES-256-GCM when enabled |
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
-   **Chunk Location**: `{path}/.pampa/chunks/{sha}.gz` or `{sha}.gz.enc`
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

## 🔐 Encrypting the Chunk Store

PAMPA can encrypt chunk bodies at rest using AES-256-GCM. Configure it like this:

1. Export a 32-byte key in base64 or hex form:

    ```bash
    export PAMPA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
    ```

2. Index with encryption enabled (skips plaintext writes even if stale files exist):

    ```bash
    npx pampa index --encrypt on
    ```

    Without `--encrypt`, PAMPA auto-encrypts when the environment key is present. Use `--encrypt off` to force plaintext (e.g., for debugging).

3. All new chunks are stored as `.gz.enc` and require the same key for CLI or MCP chunk retrieval. Missing or corrupt keys surface clear errors instead of leaking data.

Existing plaintext archives remain readable, so you can enable encryption incrementally or rotate keys by re-indexing.

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
