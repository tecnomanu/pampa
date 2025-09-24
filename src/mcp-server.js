#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import * as service from './service.js';
import { resolveScopeWithPack } from './context/packs.js';
import { registerUseContextPackTool } from './mcp/tools/useContextPack.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// Global debug mode and working directory
let debugMode = process.argv.includes('--debug');
let currentWorkingPath = '.';
let sessionContextPack = null;

// ============================================================================
// ERROR LOGGING SYSTEM
// ============================================================================

class ErrorLogger {
    constructor(workingPath = '.') {
        this.workingPath = workingPath;
        this.debugLogPath = path.join(workingPath, 'pampa_debug.log');
        this.errorLogPath = path.join(workingPath, 'pampa_error.log');
        this.ensureLogDirectory();

        if (debugMode) {
            this.debugLog('PAMPA MCP Server initialized', {
                version: packageJson.version,
                workingPath: path.resolve(workingPath),
                serverCwd: process.cwd(),
                debugMode: true
            });
        }
    }

    updateWorkingPath(newPath) {
        this.workingPath = newPath;
        this.debugLogPath = path.join(newPath, 'pampa_debug.log');
        this.errorLogPath = path.join(newPath, 'pampa_error.log');
        this.ensureLogDirectory();

        if (debugMode) {
            this.debugLog('Working path updated', {
                oldPath: currentWorkingPath,
                newPath: path.resolve(newPath)
            });
        }

        currentWorkingPath = newPath;
    }

    ensureLogDirectory() {
        const debugDir = path.dirname(this.debugLogPath);
        const errorDir = path.dirname(this.errorLogPath);

        if (debugDir !== '.' && !fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        if (errorDir !== '.' && !fs.existsSync(errorDir)) {
            fs.mkdirSync(errorDir, { recursive: true });
        }
    }

    debugLog(message, context = {}) {
        if (!debugMode) return;

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] DEBUG: ${message}\n` +
            `Context: ${JSON.stringify(context, null, 2)}\n` +
            `${'='.repeat(50)}\n\n`;

        try {
            fs.appendFileSync(this.debugLogPath, logEntry);
            console.log(`🐛 DEBUG [${timestamp}]: ${message}`);
        } catch (logError) {
            console.error('Failed to write to debug log:', logError.message);
        }
    }

    log(error, context = {}) {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            message: error.message,
            stack: error.stack,
            context,
            type: error.constructor.name,
            workingPath: this.workingPath
        };

        const logEntry = `[${timestamp}] ERROR: ${error.message}\n` +
            `Working Path: ${path.resolve(this.workingPath)}\n` +
            `Context: ${JSON.stringify(context, null, 2)}\n` +
            `Stack: ${error.stack}\n` +
            `${'='.repeat(80)}\n\n`;

        try {
            fs.appendFileSync(this.errorLogPath, logEntry);
            console.error(`❌ Error logged to ${this.errorLogPath}:`, error.message);

            if (debugMode) {
                this.debugLog('Error occurred', { error: error.message, context });
            }
        } catch (logError) {
            console.error('Failed to write to error log:', logError.message);
            console.error('Original error:', error.message);
        }
    }

    async logAsync(error, context = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ASYNC ERROR: ${error.message}\n` +
            `Working Path: ${path.resolve(this.workingPath)}\n` +
            `Context: ${JSON.stringify(context, null, 2)}\n` +
            `Stack: ${error.stack}\n` +
            `${'='.repeat(80)}\n\n`;

        try {
            await fs.promises.appendFile(this.errorLogPath, logEntry);
            console.error(`❌ Async error logged to ${this.errorLogPath}:`, error.message);

            if (debugMode) {
                this.debugLog('Async error occurred', { error: error.message, context });
            }
        } catch (logError) {
            console.error('Failed to write async error to log:', logError.message);
            console.error('Original async error:', error.message);
        }
    }
}

// Global logger instance
let errorLogger = new ErrorLogger();

// ============================================================================
// VALIDATION UTILITY FUNCTIONS
// ============================================================================

function validateEnvironment(workingPath = '.') {
    const errors = [];

    const pampaDir = path.join(workingPath, '.pampa');
    const dbPath = path.join(workingPath, '.pampa', 'pampa.db');

    // Check if .pampa directory exists
    if (!fs.existsSync(pampaDir)) {
        errors.push(`.pampa directory not found in ${workingPath}. Run index_project first.`);
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
        errors.push(`Database .pampa/pampa.db not found in ${workingPath}. Run index_project first.`);
    }

    return errors;
}

async function safeAsyncCall(asyncFn, context = {}) {
    try {
        return await asyncFn();
    } catch (error) {
        await errorLogger.logAsync(error, context);
        throw error;
    }
}

/**
 * MCP Server for PAMPA - Protocol for Augmented Memory of Project Artifacts
 * 
 * This server exposes tools and resources for AI agents to:
 * - Search code semantically in the project
 * - Get specific content of functions/classes
 * - Index new projects
 * - Get project summaries
 */

// Create MCP server
const server = new McpServer({
    name: "pampa-code-memory",
    version: packageJson.version
});

registerUseContextPackTool(server, {
    getWorkingPath: () => currentWorkingPath,
    setSessionPack: (pack) => {
        sessionContextPack = pack;
    },
    clearSessionPack: () => {
        sessionContextPack = null;
    },
    errorLogger
});

// ============================================================================
// TOOLS - Allow LLMs to perform actions
// ============================================================================

/**
 * Tool for semantic code search
 * 
 * IMPORTANT: This tool searches in the database located at `{path}/.pampa/pampa.db`
 * The path parameter specifies the project directory where PAMPA has been indexed.
 * Make sure to run index_project on that directory first.
 */
server.tool(
    "search_code",
    {
        query: z.string().min(2, "Query cannot be empty").describe("Semantic search query (e.g. 'authentication function', 'error handling')"),
        limit: z.number().optional().default(10).describe("Maximum number of results to return"),
        provider: z.string().optional().default("auto").describe("Embedding provider (auto|openai|transformers|ollama|cohere)"),
        path: z.string().optional().default(".").describe("PROJECT ROOT directory path where PAMPA database is located (the directory containing .pampa/ folder)"),
        path_glob: z.union([z.string(), z.array(z.string())]).optional().describe("Optional glob pattern(s) to limit search scope"),
        tags: z.union([z.array(z.string()), z.string()]).optional().describe("Optional list of tags to filter results"),
        lang: z.union([z.array(z.string()), z.string()]).optional().describe("Optional list of languages to filter results"),
        reranker: z.enum(['off', 'transformers']).optional().default('off').describe("Optional reranker strategy flag"),
        hybrid: z.enum(['on', 'off']).optional().default('on').describe("Enable hybrid semantic + keyword fusion"),
        bm25: z.enum(['on', 'off']).optional().default('on').describe("Enable BM25 keyword retrieval stage"),
        symbol_boost: z.enum(['on', 'off']).optional().default('on').describe("Enable symbol-aware ranking boost")
    },
    async ({ query, limit, provider, path: workingPath, path_glob, tags, lang, reranker, hybrid, bm25, symbol_boost }) => {
        const timestamp = new Date().toISOString();
        const rawProvider = typeof provider === 'string' ? provider : 'auto';
        const cleanProvider = rawProvider && rawProvider.trim().length > 0 ? rawProvider.trim() : 'auto';
        const rawPath = typeof workingPath === 'string' ? workingPath : '.';
        const cleanPath = rawPath && rawPath.trim().length > 0 ? rawPath.trim() : '.';

        const { scope: scopeFilters, pack: activePack } = resolveScopeWithPack(
            { path_glob, tags, lang, reranker, hybrid, bm25, symbol_boost },
            { basePath: cleanPath, sessionPack: sessionContextPack }
        );

        const hasActiveScope = Boolean(
            (scopeFilters.path_glob && scopeFilters.path_glob.length > 0) ||
            (scopeFilters.tags && scopeFilters.tags.length > 0) ||
            (scopeFilters.lang && scopeFilters.lang.length > 0)
        );

        const context = {
            query,
            limit,
            provider: cleanProvider,
            workingPath: cleanPath,
            scope: scopeFilters,
            timestamp,
            contextPack: activePack
        };

        // Update logger working path
        errorLogger.updateWorkingPath(cleanPath || '.');

        if (debugMode) {
            errorLogger.debugLog('search_code tool called', context);
        }

        try {
            // Parameter validation and cleaning
            if (!query || typeof query !== 'string') {
                await errorLogger.logAsync(new Error('Query undefined or invalid type'), {
                    ...context,
                    receivedQuery: query,
                    queryType: typeof query
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: Query is required and must be a valid string.\n\n` +
                            `Correct usage examples:\n` +
                            `- "authentication function"\n` +
                            `- "error handling"\n` +
                            `- "list users"\n\n` +
                            `Error logged to ${errorLogger.errorLogPath}`
                    }],
                    isError: true
                };
            }

            const cleanQuery = query.trim();

            if (cleanQuery.length === 0) {
                await errorLogger.logAsync(new Error('Query empty after trim'), {
                    ...context,
                    originalQuery: query,
                    cleanQuery
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: Query cannot be empty.\n\n` +
                            `Provide a valid query like:\n` +
                            `- "login function"\n` +
                            `- "validate data"\n` +
                            `- "connect database"\n\n` +
                            `Error logged to ${errorLogger.errorLogPath}`
                    }],
                    isError: true
                };
            }

            // Environment validations with working directory
            const envErrors = validateEnvironment(cleanPath);
            if (envErrors.length > 0) {
                const errorMsg = `ENVIRONMENT ERRORS in ${cleanPath}:\n${envErrors.map(e => `- ${e}`).join('\n')}`;
                await errorLogger.logAsync(new Error('Environment validation failed'), {
                    ...context,
                    query: cleanQuery,
                    workingPath: cleanPath,
                    envErrors
                });

                return {
                    content: [{
                        type: "text",
                        text: errorMsg + `\n\nSolution: Run index_project on the project root directory: ${cleanPath}\n` +
                            `The project root should contain your source code and will have a .pampa/ folder after indexing.`
                    }],
                    isError: true
                };
            }

            const results = await safeAsyncCall(
                () => service.searchCode(cleanQuery, limit, cleanProvider, cleanPath, scopeFilters),
                { ...context, query: cleanQuery, provider: cleanProvider, workingPath: cleanPath, scope: scopeFilters, step: 'searchCode_call' }
            );

            if (!results.success) {
                // Handle database not found error specifically
                if (results.error === 'database_not_found') {
                    return {
                        content: [{
                            type: "text",
                            text: `📋 Project not indexed yet!\n\n` +
                                `🔍 Database not found: ${cleanPath}/.pampa/pampa.db\n\n` +
                                `💡 To search code, you need to index the project first:\n` +
                                `   • Use index_project tool on directory: ${cleanPath}\n` +
                                `   • This will create the database and index your code\n` +
                                `   • Then you can search with queries like: "${cleanQuery}"`
                        }]
                    };
                }

                if (results.error === 'no_chunks_found') {
                    return {
                        content: [{
                            type: "text",
                            text: `No results found.\n\n` +
                                `Message: ${results.message}\n` +
                                `Suggestion: ${results.suggestion}\n\n` +
                                `Note: Database should be at ${cleanPath}/.pampa/pampa.db` +
                                (hasActiveScope ? `\n\nFilters applied: ${JSON.stringify({
                                    path_glob: scopeFilters.path_glob || [],
                                    tags: scopeFilters.tags || [],
                                    lang: scopeFilters.lang || []
                                })}\nTry relaxing scope filters to broaden the search.` : '')
                        }],
                        isError: false
                    };
                } else if (results.error === 'no_relevant_matches') {
                    return {
                        content: [{
                            type: "text",
                            text: `No relevant matches found.\n\n` +
                                `Message: ${results.message}\n` +
                                `Suggestion: ${results.suggestion}` +
                                (hasActiveScope ? `\n\nCurrent scope filters:\n  • path_glob: ${(scopeFilters.path_glob || []).join(', ') || 'none'}\n  • tags: ${(scopeFilters.tags || []).join(', ') || 'none'}\n  • lang: ${(scopeFilters.lang || []).join(', ') || 'none'}\nConsider removing filters to expand results.` : '')
                        }],
                        isError: false
                    };
                } else {
                    return {
                        content: [{
                            type: "text",
                            text: `Search error: ${results.message}`
                        }],
                        isError: true
                    };
                }
            }

            const resultText = results.results.map((result, index) => {
                return `${index + 1}. ${result.path}\n` +
                    `   Symbol: ${result.meta.symbol} (${result.lang})\n` +
                    `   Similarity: ${result.meta.score}\n` +
                    `   SHA: ${result.sha}`;
            }).join('\n\n');

            if (debugMode) {
                errorLogger.debugLog('search_code completed successfully', {
                    resultsCount: results.results.length,
                    provider: results.provider,
                    query: cleanQuery,
                    scope: scopeFilters,
                    contextPack: activePack
                });
            }

            const packLine = activePack
                ? `Context pack: ${activePack.name || activePack.key}${activePack.description ? ` – ${activePack.description}` : ''}\n`
                : '';

            return {
                content: [{
                    type: "text",
                    text: `Found ${results.results.length} results for: "${cleanQuery}"\n` +
                        packLine +
                        `Provider: ${results.provider}\n` +
                        `Database: ${cleanPath}/.pampa/pampa.db\n\n` +
                        resultText
                }],
                isError: false
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'search_code_tool' });

            return {
                content: [{
                    type: "text",
                    text: `ERROR in search: ${error.message}\n\n` +
                        `Technical details:\n` +
                        `- Error: ${error.constructor.name}\n` +
                        `- Timestamp: ${context.timestamp}\n` +
                        `- Provider: ${provider}\n` +
                        `- Expected database: ${workingPath}/.pampa/pampa.db\n\n` +
                        `Error logged to ${errorLogger.errorLogPath}\n\n` +
                        `Possible solutions:\n` +
                        `- Run index_project on the project root directory\n` +
                        `- Verify dependencies are installed\n` +
                        `- Try with provider='transformers' for local model`
                }],
                isError: true
            };
        }
    }
);

/**
 * Tool to get complete code of a specific chunk
 * 
 * IMPORTANT: This tool retrieves code chunks from `{path}/.pampa/chunks/{sha}.gz` (or `{sha}.gz.enc` when encryption is enabled)
 * The path parameter must point to the same project directory used in search_code.
 * The SHA is obtained from search_code results.
 */
server.tool(
    "get_code_chunk",
    {
        sha: z.string().min(1, "SHA cannot be empty").describe("SHA of the code chunk to retrieve (obtained from search_code results)"),
        path: z.string().optional().default(".").describe("PROJECT ROOT directory path where PAMPA chunks are stored (same path used in search_code)")
    },
    async ({ sha, path: workingPath }) => {
        const context = { sha, workingPath, timestamp: new Date().toISOString() };

        // Update logger working path
        errorLogger.updateWorkingPath(workingPath || '.');

        if (debugMode) {
            errorLogger.debugLog('get_code_chunk tool called', context);
        }

        try {
            // Robust SHA validation
            if (!sha || typeof sha !== 'string') {
                await errorLogger.logAsync(new Error('SHA undefined or invalid type'), {
                    ...context,
                    receivedSha: sha,
                    shaType: typeof sha
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: SHA is required and must be a valid string.\n\n` +
                            `SHA must be a text string obtained from search_code.\n` +
                            `Example: "a1b2c3d4e5f6789"\n\n` +
                            `Error logged to ${errorLogger.errorLogPath}`
                    }],
                    isError: true
                };
            }

            const cleanSha = sha.trim();
            const cleanPath = workingPath ? workingPath.trim() : '.';

            if (cleanSha.length === 0) {
                await errorLogger.logAsync(new Error('SHA empty after trim'), {
                    ...context,
                    originalSha: sha,
                    cleanSha: cleanSha
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: SHA cannot be empty.\n\n` +
                            `Provide a valid SHA obtained from search_code.\n\n` +
                            `Error logged to ${errorLogger.errorLogPath}`
                    }],
                    isError: true
                };
            }

            const result = await safeAsyncCall(
                () => service.getChunk(cleanSha, cleanPath),
                { ...context, sha: cleanSha, workingPath: cleanPath, step: 'getChunk_call' }
            );

            if (!result.success) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: ${result.message}\n\n` +
                            `Expected chunk file: ${cleanPath}/.pampa/chunks/${cleanSha}.gz(.enc)\n` +
                            `Tip: Make sure the SHA is correct and the path points to the same project directory used in search_code.`
                    }],
                    isError: true
                };
            }

            if (debugMode) {
                errorLogger.debugLog('get_code_chunk completed successfully', {
                    sha: cleanSha,
                    chunkPath: `${cleanPath}/.pampa/chunks/${cleanSha}.gz(.enc)`,
                    contentLength: result.code.length
                });
            }

            return {
                content: [{
                    type: "text",
                    text: result.code
                }],
                isError: false
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'get_code_chunk_tool' });

            return {
                content: [{
                    type: "text",
                    text: `ERROR getting chunk: ${error.message}\n\n` +
                        `Details:\n` +
                        `- Requested SHA: ${sha}\n` +
                        `- Project path: ${workingPath}\n` +
                        `- Expected chunk file: ${workingPath}/.pampa/chunks/${sha}.gz(.enc)\n` +
                        `- Timestamp: ${context.timestamp}\n\n` +
                        `Error logged to ${errorLogger.errorLogPath}\n\n` +
                        `Troubleshooting:\n` +
                        `- Verify the SHA is correct (from search_code results)\n` +
                        `- Ensure path points to the project root directory\n` +
                        `- Check that the project was properly indexed`
                }],
                isError: true
            };
        }
    }
);

/**
 * Tool to index a project
 * 
 * IMPORTANT: This tool creates a PAMPA database at `{path}/.pampa/pampa.db`
 * It scans all source code files in the specified directory and creates:
 * - .pampa/pampa.db (SQLite database with embeddings)
 * - .pampa/chunks/ (compressed code chunks)
 * - pampa.codemap.json (lightweight index for version control)
 * 
 * The path should be the PROJECT ROOT containing your source code.
 */
server.tool(
    "index_project",
    {
        path: z.string().optional().default(".").describe("PROJECT ROOT directory path to index (will create .pampa/ subdirectory here)"),
        provider: z.string().optional().default("auto").describe("Embedding provider (auto|openai|transformers|ollama|cohere)")
    },
    async ({ path: projectPath, provider }) => {
        const context = { projectPath, provider, timestamp: new Date().toISOString() };

        // Update logger working path
        errorLogger.updateWorkingPath(projectPath || '.');

        if (debugMode) {
            errorLogger.debugLog('index_project tool called', context);
        }

        try {
            // Clean and validate parameters
            const cleanPath = projectPath ? projectPath.trim() : '.';
            const cleanProvider = provider ? provider.trim() : 'auto';

            // Verify directory exists
            if (!fs.existsSync(cleanPath)) {
                throw new Error(`Directory ${cleanPath} does not exist`);
            }

            if (debugMode) {
                errorLogger.debugLog('Starting project indexing', {
                    projectPath: path.resolve(cleanPath),
                    provider: cleanProvider,
                    willCreateDatabase: `${cleanPath}/.pampa/pampa.db`
                });
            }

            const result = await safeAsyncCall(
                () => service.indexProject({ repoPath: cleanPath, provider: cleanProvider }),
                { ...context, projectPath: cleanPath, provider: cleanProvider, step: 'indexProject_call' }
            );

            if (!result.success) {
                return {
                    content: [{
                        type: "text",
                        text: `Indexing failed: ${result.message || 'Unknown error'}\n\n` +
                            `Expected to create: ${cleanPath}/.pampa/pampa.db\n` +
                            `Error logged to ${errorLogger.errorLogPath}`
                    }],
                    isError: true
                };
            }

            let responseText = `✅ Project indexed successfully!\n\n` +
                `📊 Statistics:\n` +
                `- Processed chunks: ${result.processedChunks}\n` +
                `- Total chunks: ${result.totalChunks}\n` +
                `- Provider: ${result.provider}\n\n` +
                `📁 Files created:\n` +
                `- Database: ${cleanPath}/.pampa/pampa.db\n` +
                `- Chunks: ${cleanPath}/.pampa/chunks/\n` +
                `- Codemap: ${cleanPath}/pampa.codemap.json\n\n` +
                `🔍 You can now use search_code with path="${cleanPath}"`;

            if (result.errors && result.errors.length > 0) {
                responseText += `\n\n⚠️ Warnings (${result.errors.length} errors occurred):\n`;
                result.errors.slice(0, 5).forEach(error => {
                    responseText += `- ${error.type}: ${error.error}\n`;
                });
                if (result.errors.length > 5) {
                    responseText += `... and ${result.errors.length - 5} more errors\n`;
                }
            }

            if (debugMode) {
                errorLogger.debugLog('index_project completed successfully', {
                    processedChunks: result.processedChunks,
                    totalChunks: result.totalChunks,
                    provider: result.provider,
                    errorsCount: result.errors?.length || 0
                });
            }

            return {
                content: [{
                    type: "text",
                    text: responseText
                }],
                isError: false
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'index_project_tool' });

            return {
                content: [{
                    type: "text",
                    text: `❌ ERROR indexing project: ${error.message}\n\n` +
                        `Technical details:\n` +
                        `- Directory: ${projectPath}\n` +
                        `- Provider: ${provider}\n` +
                        `- Expected database location: ${projectPath}/.pampa/pampa.db\n` +
                        `- Timestamp: ${context.timestamp}\n\n` +
                        `Error logged to ${errorLogger.errorLogPath}\n\n` +
                        `Possible solutions:\n` +
                        `- Verify directory exists and is accessible\n` +
                        `- Install necessary dependencies (npm install)\n` +
                        `- Try with a different provider\n` +
                        `- Check write permissions in the directory\n` +
                        `- Ensure the path points to a project root (not a subdirectory)`
                }],
                isError: true
            };
        }
    }
);

/**
 * Tool to get indexed project statistics
 * 
 * IMPORTANT: This tool reads statistics from the database at `{path}/.pampa/pampa.db`
 * Use the same path where you ran index_project to get project overview and stats.
 */
server.tool(
    "get_project_stats",
    {
        path: z.string().optional().default(".").describe("PROJECT ROOT directory path where PAMPA database is located (same path used in index_project)")
    },
    async ({ path: projectPath }) => {
        const context = { projectPath, timestamp: new Date().toISOString() };

        // Update logger working path
        errorLogger.updateWorkingPath(projectPath || '.');

        if (debugMode) {
            errorLogger.debugLog('get_project_stats tool called', context);
        }

        try {
            const cleanPath = projectPath ? projectPath.trim() : '.';
            const overviewResult = await service.getOverview(20, cleanPath);

            if (!overviewResult.success) {
                // Check if this is specifically a database not found error
                if (overviewResult.error === 'database_not_found') {
                    return {
                        content: [{
                            type: "text",
                            text: `📋 Project not indexed yet!\n\n` +
                                `🔍 Database not found: ${cleanPath}/.pampa/pampa.db\n\n` +
                                `💡 To get started, run the indexing tool first:\n` +
                                `   • Use index_project tool on directory: ${cleanPath}\n` +
                                `   • This will create the database and index your code\n` +
                                `   • Then you can use get_project_stats to see the overview`
                        }]
                    };
                }

                // Handle other errors
                return {
                    content: [{
                        type: "text",
                        text: `Error getting overview: ${overviewResult.message}\n\n` +
                            `Expected database: ${cleanPath}/.pampa/pampa.db\n` +
                            `Tip: Run index_project on this directory first.`
                    }],
                    isError: true
                };
            }

            const results = overviewResult.results;

            if (results.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `📋 Project not indexed or empty.\n\n` +
                            `Expected database: ${cleanPath}/.pampa/pampa.db\n` +
                            `Solution: Use index_project tool first on directory: ${cleanPath}`
                    }]
                };
            }

            const overview = results.map(result =>
                `- ${result.path} :: ${result.meta.symbol} (${result.lang})`
            ).join('\n');

            if (debugMode) {
                errorLogger.debugLog('get_project_stats completed successfully', {
                    resultsCount: results.length,
                    databasePath: `${cleanPath}/.pampa/pampa.db`
                });
            }

            return {
                content: [{
                    type: "text",
                    text: `📊 Project overview (${results.length} main functions):\n` +
                        `📁 Database: ${cleanPath}/.pampa/pampa.db\n\n${overview}`
                }]
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'get_project_stats_tool' });

            return {
                content: [{
                    type: "text",
                    text: `❌ ERROR getting statistics: ${error.message}\n\n` +
                        `Details:\n` +
                        `- Project: ${projectPath}\n` +
                        `- Expected database: ${projectPath}/.pampa/pampa.db\n` +
                        `- Timestamp: ${context.timestamp}\n\n` +
                        `Error logged to ${errorLogger.errorLogPath}\n\n` +
                        `Verify the project is indexed correctly with index_project tool.`
                }],
                isError: true
            };
        }
    }
);

/**
 * Tool to update a project index
 * 
 * IMPORTANT: This tool updates the PAMPA database at `{path}/.pampa/pampa.db`
 * Run this after making code changes to keep your AI agent's memory current.
 * It re-scans all files and updates embeddings for changed functions.
 * 
 * WHEN TO USE:
 * - After creating new functions
 * - After modifying existing functions
 * - After deleting functions
 * - At the start of development sessions
 * - Before major code analysis tasks
 */
server.tool(
    "update_project",
    {
        path: z.string().optional().default(".").describe("PROJECT ROOT directory path to update (same directory where you ran index_project)"),
        provider: z.string().optional().default("auto").describe("Embedding provider (auto|openai|transformers|ollama|cohere)")
    },
    async ({ path: projectPath, provider }) => {
        const context = { projectPath, provider, timestamp: new Date().toISOString(), operation: 'update' };

        // Update logger working path
        errorLogger.updateWorkingPath(projectPath || '.');

        if (debugMode) {
            errorLogger.debugLog('update_project tool called', context);
        }

        try {
            // Clean and validate parameters
            const cleanPath = projectPath ? projectPath.trim() : '.';
            const cleanProvider = provider ? provider.trim() : 'auto';

            // Verify directory exists
            if (!fs.existsSync(cleanPath)) {
                throw new Error(`Directory ${cleanPath} does not exist`);
            }

            // Check if already indexed
            const dbPath = path.join(cleanPath, '.pampa', 'pampa.db');
            const isFirstTime = !fs.existsSync(dbPath);

            if (debugMode) {
                errorLogger.debugLog('Starting project update', {
                    projectPath: path.resolve(cleanPath),
                    provider: cleanProvider,
                    databaseExists: !isFirstTime,
                    databasePath: dbPath
                });
            }

            const result = await safeAsyncCall(
                () => service.indexProject({ repoPath: cleanPath, provider: cleanProvider }),
                { ...context, projectPath: cleanPath, provider: cleanProvider, step: 'updateProject_call' }
            );

            if (!result.success) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Update failed: ${result.message || 'Unknown error'}\n\n` +
                            `Expected database: ${cleanPath}/.pampa/pampa.db\n` +
                            `Error logged to ${errorLogger.errorLogPath}`
                    }],
                    isError: true
                };
            }

            const operationText = isFirstTime ? 'indexed' : 'updated';
            let responseText;

            if (result.processedChunks === 0) {
                responseText = `✅ Project update completed successfully - no changes found or no new functions detected.\n\n` +
                    `📁 Database: ${cleanPath}/.pampa/pampa.db`;
            } else {
                responseText = `🔄 Project ${operationText} successfully!\n\n` +
                    `📊 Statistics:\n` +
                    `- Processed chunks: ${result.processedChunks}\n` +
                    `- Total chunks: ${result.totalChunks}\n` +
                    `- Provider: ${result.provider}\n\n` +
                    `📁 Database: ${cleanPath}/.pampa/pampa.db`;
            }

            if (result.errors && result.errors.length > 0) {
                responseText += `\n\n⚠️ Warnings (${result.errors.length} errors occurred):\n`;
                result.errors.slice(0, 3).forEach(error => {
                    responseText += `- ${error.type}: ${error.error}\n`;
                });
                if (result.errors.length > 3) {
                    responseText += `... and ${result.errors.length - 3} more errors\n`;
                }
            }

            if (debugMode) {
                errorLogger.debugLog('update_project completed successfully', {
                    processedChunks: result.processedChunks,
                    totalChunks: result.totalChunks,
                    provider: result.provider,
                    errorsCount: result.errors?.length || 0,
                    operation: operationText
                });
            }

            return {
                content: [{
                    type: "text",
                    text: responseText
                }],
                isError: false
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'update_project_tool' });

            return {
                content: [{
                    type: "text",
                    text: `❌ ERROR updating project: ${error.message}\n\n` +
                        `Technical details:\n` +
                        `- Directory: ${projectPath}\n` +
                        `- Provider: ${provider}\n` +
                        `- Expected database location: ${projectPath}/.pampa/pampa.db\n` +
                        `- Timestamp: ${context.timestamp}\n\n` +
                        `Error logged to ${errorLogger.errorLogPath}\n\n` +
                        `Possible solutions:\n` +
                        `- Verify directory exists and is accessible\n` +
                        `- Run index_project first if this is a new project\n` +
                        `- Install necessary dependencies (npm install)\n` +
                        `- Try with a different provider\n` +
                        `- Check write permissions in the directory`
                }],
                isError: true
            };
        }
    }
);

// ============================================================================
// RESOURCES - Expose project data
// ============================================================================

/**
 * Resource to get project code map
 */
server.resource(
    "codemap",
    "pampa://codemap",
    async (uri) => {
        try {
            const codemapPath = 'pampa.codemap.json';

            if (!fs.existsSync(codemapPath)) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: "Project not indexed. Use index_project tool first."
                    }]
                };
            }

            const codemap = fs.readFileSync(codemapPath, 'utf8');
            return {
                contents: [{
                    uri: uri.href,
                    text: `Project code map:\n\n${codemap}`,
                    mimeType: "application/json"
                }]
            };
        } catch (error) {
            await errorLogger.logAsync(error, { step: 'codemap_resource', uri: uri.href });
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error loading code map: ${error.message}\n\nError logged to pampa_error.log`
                }]
            };
        }
    }
);

/**
 * Resource to get project overview
 */
server.resource(
    "overview",
    "pampa://overview",
    async (uri) => {
        try {
            const results = await service.getOverview(20, '.');

            if (!results.success || results.results.length === 0) {
                return "Project not indexed or empty. Use index_project first.";
            }

            const overview = results.results.map(result =>
                `${result.path} :: ${result.meta.symbol} (${result.lang})`
            ).join('\n');

            return `Project overview (${results.results.length} main functions):\n\n${overview}`;
        } catch (error) {
            errorLogger.log(error, { resource: 'pampa://overview' });
            return `Error getting overview: ${error.message}`;
        }
    }
);

// ============================================================================
// PROMPTS - Reusable templates for LLM interactions
// ============================================================================

/**
 * Prompt to analyze found code
 */
server.prompt(
    "analyze_code",
    {
        query: z.string().describe("Search query"),
        focus: z.string().optional().describe("Specific aspect to analyze (e.g. 'security', 'performance', 'bugs')")
    },
    ({ query, focus }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Analyze code related to: "${query}"${focus ? ` with focus on: ${focus}` : ''}\n\n` +
                    `Steps to follow:\n` +
                    `1. Use search_code to find relevant functions\n` +
                    `2. Use get_code_chunk to examine specific code\n` +
                    `3. Provide detailed analysis${focus ? ` focused on ${focus}` : ''}\n` +
                    `4. Suggest improvements if necessary`
            }
        }]
    })
);

/**
 * Prompt to find similar functions
 */
server.prompt(
    "find_similar_functions",
    {
        functionality: z.string().describe("Description of the functionality sought")
    },
    ({ functionality }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Find existing functions that implement: "${functionality}"\n\n` +
                    `Steps:\n` +
                    `1. Use search_code with different query variations\n` +
                    `2. Examine results with get_code_chunk\n` +
                    `3. Identify if a similar implementation already exists\n` +
                    `4. If it exists, explain how to reuse it\n` +
                    `5. If it doesn't exist, suggest where to implement it based on project structure`
            }
        }]
    })
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    if (debugMode) {
        errorLogger.debugLog('MCP Server connected and ready', {
            version: packageJson.version,
            transport: 'stdio',
            debugMode: true
        });
        console.log('🐛 DEBUG MODE ENABLED - Detailed logging active');
        console.log(`📝 Debug log: ${errorLogger.debugLogPath}`);
        console.log(`❌ Error log: ${errorLogger.errorLogPath}`);
    }

    console.log({
        "start": "PAMPA MCP Server started and ready for connections",
        "version": packageJson.version,
        "debug_mode": debugMode
    });
    // Only output valid JSON for MCP protocol
    // Debug info is logged to pampa_debug.log instead
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught error:', error);
    errorLogger.log(error, { type: 'uncaughtException' });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection:', reason);
    errorLogger.log(new Error(reason), { type: 'unhandledRejection', promise: promise.toString() });
    process.exit(1);
});

// Run server
main().catch(error => {
    console.error('Error starting MCP server:', error);
    errorLogger.log(error, { type: 'main_startup_error' });
    process.exit(1);
});