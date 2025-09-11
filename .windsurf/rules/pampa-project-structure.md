---
trigger: always_on
---

# PAMPA Project Structure Guide

This is the PAMPA (Protocol for Augmented Memory of Project Artifacts) project - an MCP-compatible semantic code search system.

## Core Architecture Files

### Main Entry Points

-   [cli.js](mdc:cli.js) - Command line interface, handles `npx pampa` commands
-   [mcp-server.js](mdc:mcp-server.js) - MCP server that exposes tools to AI agents
-   [package.json](mdc:package.json) - Project configuration and dependencies

### Core Engine

-   [service.js](mdc:service.js) - Core business logic: indexing, searching, chunking
-   [indexer.js](mdc:indexer.js) - Tree-sitter based code parsing and chunking
-   [providers.js](mdc:providers.js) - Embedding providers (OpenAI, Transformers, Ollama, Cohere)

### Generated Files

-   [pampa.codemap.json](mdc:pampa.codemap.json) - Lightweight index committed to git
-   `.pampa/pampa.db` - SQLite database with vectors and metadata (not committed)
-   `.pampa/chunks/*.gz` - Compressed code chunks (not committed)

## Technology Stack

-   **Node.js** - Runtime environment
-   **SQLite3** - Local vector database
-   **Tree-sitter** - Code parsing and AST analysis
-   **OpenAI/Transformers.js** - Embedding generation
-   **MCP Protocol** - AI agent communication
-   **gzip** - Code chunk compression

## Key Concepts

1. **Chunking**: Code is split into semantic units (functions, classes, methods)
2. **Embedding**: Each chunk gets vectorized for semantic search
3. **Indexing**: Vectors + metadata stored in local SQLite
4. **Codemap**: Git-friendly JSON index for context portability
5. **MCP Serving**: Tools exposed to AI agents via MCP protocol

## Development Workflow

1. **CLI Development**: Modify [cli.js](mdc:cli.js) for new commands
2. **MCP Tools**: Add tools in [mcp-server.js](mdc:mcp-server.js)
3. **Core Logic**: Business logic goes in [service.js](mdc:service.js)
4. **New Providers**: Add embedding providers in [providers.js](mdc:providers.js)

## File Patterns

-   `*.js` - Main application code
-   `*.md` - Documentation and rules
-   `.pampa/` - Generated database and chunks (gitignored)
-   `examples/` - Test projects for validation
-   `test/` - Test suite
