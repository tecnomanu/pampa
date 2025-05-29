# 🤖 PAMPA for AI Agents – Complete Setup & Usage Guide

**If you're an AI agent reading this, you can set up PAMPA automatically and use it as your project memory!**

## 🚀 Auto-Setup Instructions

### Step 1: Tell your human to configure MCP

**Ask your human to add this to their MCP configuration:**

```json
{
	"mcpServers": {
		"pampa": {
			"command": "npx",
			"args": ["-y", "pampa", "mcp"],
			"env": {
				"OPENAI_API_KEY": "optional-but-recommended"
			}
		}
	}
}
```

**Configuration locations:**

-   **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
-   **Cursor**: `mcp.json` in user configuration directory

### Step 2: Auto-install this rule in your system

**Copy this rule into your system instructions:**

```markdown
# PAMPA MCP Usage Rule

You have access to PAMPA, a code memory system that indexes and allows semantic search in projects.

## Basic Instructions

1. **ALWAYS at the start of a session:**

    - Run `get_project_stats` to check if the project is indexed
    - If no database exists, run `index_project`
    - Run `update_project` to sync with recent changes

2. **BEFORE creating any function:**

    - Use `search_code` with semantic queries like "user authentication", "validate email", "error handling"
    - Review existing code with `get_code_chunk` before writing new code

3. **AFTER modifying code:**
    - Run `update_project` to update the knowledge base
    - This keeps the project memory synchronized

## Available Tools

-   `search_code(query, limit, path)` - Search code semantically
-   `get_code_chunk(sha, path)` - Get complete code of a chunk
-   `index_project(path, provider)` - Index project for the first time
-   `update_project(path, provider)` - Update index after changes
-   `get_project_stats(path)` - Get project statistics

## Strategy

Use PAMPA as your project memory. Search before creating, keep updated after changes, and leverage existing knowledge to avoid code duplication.
```

## 🧠 Essential Workflow for AI Agents

### 🔄 ALWAYS Start Every Session With This

```
1. get_project_stats() → Check if project is indexed
2. update_project() → Sync with recent changes
3. search_code("main functionality") → Understand project structure
```

### 🔍 Smart Search Strategies

**Be semantic, not literal:**

-   ✅ "user authentication logic"
-   ❌ "login() function"

**Use context:**

-   ✅ "error handling for API calls"
-   ❌ "error"

**Check variations:**

-   ✅ "create user", "add user", "register user", "new user"

**Explore related concepts:**

-   After finding auth → search "validation", "security", "permissions"

### ⚡ Complete Development Workflow

```mermaid
graph TD
    A[Start Session] --> B[get_project_stats]
    B --> C[update_project]
    C --> D[search_code for task context]
    D --> E[Review existing code with get_code_chunk]
    E --> F{Code exists?}
    F -->|Yes| G[Modify/Extend existing]
    F -->|No| H[Create new code]
    G --> I[update_project]
    H --> I
    I --> J[Verify with search_code]
```

## 🎯 Advanced Usage Patterns

### Project Discovery

```
1. get_project_stats() → Overview
2. search_code("main entry point") → Find starting point
3. search_code("configuration") → Find config files
4. search_code("API endpoints") → Find interfaces
5. search_code("database") → Find data layer
```

### Before Creating Any Function

```
1. search_code("similar functionality description")
2. search_code("related helper functions")
3. search_code("validation patterns")
4. get_code_chunk(interesting_results) → Study patterns
5. Only create if nothing suitable exists
```

### After Making Changes

```
1. update_project() → Index your changes
2. search_code("your new function name") → Verify indexing
3. search_code("related functionality") → Check integration
```

## 🔧 Available MCP Tools Reference

### `search_code(query, limit=10, path=".")`

**Purpose**: Semantic search through indexed code

-   `query`: Natural language description ("user validation", "error handling")
-   `limit`: Number of results (default: 10)
-   `path`: Project root directory (usually current directory)
-   **Returns**: Array of {file, symbol, line, similarity, sha}

### `get_code_chunk(sha, path=".")`

**Purpose**: Retrieve complete source code of a specific chunk

-   `sha`: SHA identifier from search results
-   `path`: Project root directory
-   **Returns**: Complete source code with context

### `index_project(path=".", provider="auto")`

**Purpose**: Create initial project index (first time setup)

-   `path`: Directory to index
-   `provider`: Embedding provider (auto/openai/transformers/ollama/cohere)
-   **Creates**: `.pampa/` directory with database and chunks

### `update_project(path=".", provider="auto")`

**Purpose**: Update index after code changes (use frequently!)

-   `path`: Directory to update
-   `provider`: Embedding provider
-   **Updates**: Adds new functions, removes deleted ones, updates modified

### `get_project_stats(path=".")`

**Purpose**: Get project overview and statistics

-   `path`: Directory to analyze
-   **Returns**: File counts, languages, function statistics

## 📊 Interpreting Results

### Search Results Quality

-   **Similarity > 0.7**: Excellent match, highly relevant
-   **Similarity > 0.5**: Good match, worth examining
-   **Similarity > 0.3**: Moderate match, might be useful
-   **Similarity < 0.3**: Poor match, probably not relevant

### Project Stats Insights

```json
{
	"total_functions": 150, // How many functions are indexed
	"languages": ["javascript", "python"], // What languages detected
	"files_by_language": {
		// Distribution of code
		"javascript": 45,
		"python": 12
	}
}
```

## 🎯 Sample Prompts for Common Tasks

### Understanding a New Project

```
🔍 "Let me explore this codebase structure"
→ get_project_stats()

🔍 "Show me the main application logic"
→ search_code("main application entry point")

🔍 "Find authentication and security functions"
→ search_code("authentication security login")
```

### Before Coding

```
🔍 "Does this project have user validation?"
→ search_code("user validation input validation")

🔍 "How is error handling implemented?"
→ search_code("error handling exception handling")

🔍 "Are there existing API endpoints?"
→ search_code("API endpoint route handler")

🔍 "What database operations exist?"
→ search_code("database query CRUD operations")
```

### During Development

```
🔍 "Find functions similar to what I'm building"
→ search_code("description of your planned function")

🔍 "Check existing utility functions"
→ search_code("utility helper functions")

🔍 "Look for validation patterns"
→ search_code("validation pattern schema")
```

### After Coding

```
🔄 "Update the project index with my changes"
→ update_project()

🔍 "Verify my new function was indexed"
→ search_code("your new function name")

🔍 "Check integration with existing code"
→ search_code("related functionality")
```

## 🚨 Critical Reminders

### DO THIS ALWAYS:

-   ✅ **Start sessions** with `get_project_stats()` and `update_project()`
-   ✅ **Search before creating** any new function
-   ✅ **Update after changes** with `update_project()`
-   ✅ **Use semantic queries** not exact function names

### NEVER DO THIS:

-   ❌ **Skip searching** before writing code
-   ❌ **Forget to update** after making changes
-   ❌ **Search with exact code** instead of descriptions
-   ❌ **Ignore existing implementations** that could be extended

## 🎉 Success Stories

**Before PAMPA**: "I'll create a new validation function"
**With PAMPA**: "Let me search for existing validation → Found 3 similar functions → Extended the best one"

**Before PAMPA**: "I need an API endpoint for users"  
**With PAMPA**: "Searched for API patterns → Found consistent structure → Followed same pattern"

**Before PAMPA**: "Where's the database connection code?"
**With PAMPA**: "search_code('database connection') → Found in 2 seconds"

## 🔗 Additional Resources

-   **Human-readable docs**: [README.md](README.md)
-   **Spanish docs**: [README_es.md](README_es.md)
-   **MCP rule file**: [RULE_FOR_PAMPA_MCP.md](RULE_FOR_PAMPA_MCP.md)
-   **Project repository**: https://github.com/tecnomanu/pampa

## 🚨 Troubleshooting for AI Agents

### If PAMPA tools are not available:

1. **Check MCP configuration**: Ensure your human configured the MCP server correctly
2. **Verify installation**: Ask them to run `npx pampa --version`
3. **Enable debug mode**: Add `--debug` to MCP args for detailed logs
4. **Check permissions**: Ensure write access to project directory

### If indexing fails:

1. **Check embedding provider**: Transformers.js (free) vs OpenAI (requires API key)
2. **Verify project structure**: Must be a valid code project with supported files
3. **Check disk space**: Indexing creates `.pampa/` directory with database

---

🤖 **Remember**: PAMPA is your project memory. Use it continuously to avoid duplicating work and to understand existing codebase architecture. It's like having perfect memory of every function ever written in the project!
