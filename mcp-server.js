#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import * as service from './service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DEBUG: Log current working directory to error log
const debugLogPath = 'pampa_debug.log';
const debugInfo = `[${new Date().toISOString()}] MCP Server started\nCWD: ${process.cwd()}\n__dirname: ${__dirname}\n${'='.repeat(50)}\n\n`;
try {
    fs.appendFileSync(debugLogPath, debugInfo);
} catch (e) {
    // Silent fail for debug log
}

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// ============================================================================
// ERROR LOGGING SYSTEM
// ============================================================================

class ErrorLogger {
    constructor(logFile = 'pampa_error.log') {
        this.logFile = logFile;
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (logDir !== '.' && !fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(error, context = {}) {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            message: error.message,
            stack: error.stack,
            context,
            type: error.constructor.name
        };

        const logEntry = `[${timestamp}] ERROR: ${error.message}\n` +
            `Context: ${JSON.stringify(context, null, 2)}\n` +
            `Stack: ${error.stack}\n` +
            `${'='.repeat(80)}\n\n`;

        try {
            fs.appendFileSync(this.logFile, logEntry);
            console.error(`Error logged to ${this.logFile}:`, error.message);
        } catch (logError) {
            console.error('Failed to write to error log:', logError.message);
            console.error('Original error:', error.message);
        }
    }

    async logAsync(error, context = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ASYNC ERROR: ${error.message}\n` +
            `Context: ${JSON.stringify(context, null, 2)}\n` +
            `Stack: ${error.stack}\n` +
            `${'='.repeat(80)}\n\n`;

        try {
            await fs.promises.appendFile(this.logFile, logEntry);
            console.error(`Async error logged to ${this.logFile}:`, error.message);
        } catch (logError) {
            console.error('Failed to write async error to log:', logError.message);
            console.error('Original async error:', error.message);
        }
    }
}

// Global logger instance
const errorLogger = new ErrorLogger();

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

// ============================================================================
// TOOLS - Allow LLMs to perform actions
// ============================================================================

/**
 * Tool for semantic code search
 */
server.tool(
    "search_code",
    {
        query: z.string().min(2, "Query cannot be empty").describe("Semantic search query (e.g. 'authentication function', 'error handling')"),
        limit: z.number().optional().default(10).describe("Maximum number of results to return"),
        provider: z.string().optional().default("auto").describe("Embedding provider (auto|openai|transformers|ollama|cohere)"),
        path: z.string().optional().default(".").describe("Working directory path where to search (default: current directory)")
    },
    async ({ query, limit, provider, path: workingPath }) => {
        const context = { query, limit, provider, workingPath, timestamp: new Date().toISOString() };

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
                            `Error logged to pampa_error.log`
                    }],
                    isError: true
                };
            }

            const cleanQuery = query.trim();
            const cleanProvider = provider ? provider.trim() : 'auto';
            const cleanPath = workingPath ? workingPath.trim() : '.';

            if (cleanQuery.length === 0) {
                await errorLogger.logAsync(new Error('Query empty after trim'), {
                    ...context,
                    originalQuery: query,
                    cleanQuery: cleanQuery
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: Query cannot be empty.\n\n` +
                            `Provide a valid query like:\n` +
                            `- "login function"\n` +
                            `- "validate data"\n` +
                            `- "connect database"\n\n` +
                            `Error logged to pampa_error.log`
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
                        text: errorMsg + `\n\nSolution: Run index_project from the correct directory: ${cleanPath}`
                    }],
                    isError: true
                };
            }

            const results = await safeAsyncCall(
                () => service.searchCode(cleanQuery, limit, cleanProvider, cleanPath),
                { ...context, query: cleanQuery, provider: cleanProvider, workingPath: cleanPath, step: 'searchCode_call' }
            );

            if (!results.success) {
                if (results.error === 'no_chunks_found') {
                    return {
                        content: [{
                            type: "text",
                            text: `No results found.\n\n` +
                                `Message: ${results.message}\n` +
                                `Suggestion: ${results.suggestion}`
                        }],
                        isError: false
                    };
                } else if (results.error === 'no_relevant_matches') {
                    return {
                        content: [{
                            type: "text",
                            text: `No relevant matches found.\n\n` +
                                `Message: ${results.message}\n` +
                                `Suggestion: ${results.suggestion}`
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

            return {
                content: [{
                    type: "text",
                    text: `Found ${results.results.length} results for: "${cleanQuery}"\n` +
                        `Provider: ${results.provider}\n\n` +
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
                        `- Provider: ${provider}\n\n` +
                        `Error logged to pampa_error.log\n\n` +
                        `Possible solutions:\n` +
                        `- Run index_project to reindex\n` +
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
 */
server.tool(
    "get_code_chunk",
    {
        sha: z.string().min(1, "SHA cannot be empty").describe("SHA of the code chunk to retrieve"),
        path: z.string().optional().default(".").describe("Working directory path where to search (default: current directory)")
    },
    async ({ sha, path: workingPath }) => {
        const context = { sha, workingPath, timestamp: new Date().toISOString() };

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
                            `Error logged to pampa_error.log`
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
                            `Error logged to pampa_error.log`
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
                        text: `Error: ${result.message}`
                    }],
                    isError: true
                };
            }

            return {
                content: [{
                    type: "text",
                    text: result.content
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
                        `- Timestamp: ${context.timestamp}\n` +
                        `- Chunks directory: ${fs.existsSync('.pampa/chunks') ? 'Exists' : 'Not found'}\n\n` +
                        `Error logged to pampa_error.log`
                }],
                isError: true
            };
        }
    }
);

/**
 * Tool to index a project
 */
server.tool(
    "index_project",
    {
        path: z.string().optional().default(".").describe("Path of the project to index (default: current directory)"),
        provider: z.string().optional().default("auto").describe("Embedding provider (auto|openai|transformers|ollama|cohere)")
    },
    async ({ path: projectPath, provider }) => {
        const context = { projectPath, provider, timestamp: new Date().toISOString() };

        try {
            // Clean and validate parameters
            const cleanPath = projectPath ? projectPath.trim() : '.';
            const cleanProvider = provider ? provider.trim() : 'auto';

            // Verify directory exists
            if (!fs.existsSync(cleanPath)) {
                throw new Error(`Directory ${cleanPath} does not exist`);
            }

            const result = await safeAsyncCall(
                () => service.indexProject({ repoPath: cleanPath, provider: cleanProvider }),
                { ...context, projectPath: cleanPath, provider: cleanProvider, step: 'indexProject_call' }
            );

            if (!result.success) {
                return {
                    content: [{
                        type: "text",
                        text: `Indexing failed: ${result.message || 'Unknown error'}`
                    }],
                    isError: true
                };
            }

            let responseText = `Project indexed successfully!\n\n` +
                `Statistics:\n` +
                `- Processed chunks: ${result.processedChunks}\n` +
                `- Total chunks: ${result.totalChunks}\n` +
                `- Provider: ${result.provider}`;

            if (result.errors && result.errors.length > 0) {
                responseText += `\n\nWarnings (${result.errors.length} errors occurred):\n`;
                result.errors.slice(0, 5).forEach(error => {
                    responseText += `- ${error.type}: ${error.error}\n`;
                });
                if (result.errors.length > 5) {
                    responseText += `... and ${result.errors.length - 5} more errors\n`;
                }
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
                    text: `ERROR indexing project: ${error.message}\n\n` +
                        `Technical details:\n` +
                        `- Directory: ${projectPath}\n` +
                        `- Provider: ${provider}\n` +
                        `- Timestamp: ${context.timestamp}\n\n` +
                        `Error logged to pampa_error.log\n\n` +
                        `Possible solutions:\n` +
                        `- Verify directory exists and is accessible\n` +
                        `- Install necessary dependencies (npm install)\n` +
                        `- Try with a different provider\n` +
                        `- Check write permissions in the directory`
                }],
                isError: true
            };
        }
    }
);

/**
 * Tool to get indexed project statistics
 */
server.tool(
    "get_project_stats",
    {
        path: z.string().optional().default(".").describe("Project path")
    },
    async ({ path: projectPath }) => {
        const context = { projectPath, timestamp: new Date().toISOString() };

        try {
            const overviewResult = await service.getOverview(20);

            if (!overviewResult.success) {
                return {
                    content: [{
                        type: "text",
                        text: `Error getting overview: ${overviewResult.message}`
                    }],
                    isError: true
                };
            }

            const results = overviewResult.results;

            if (results.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: "Project not indexed or empty. Use index_project tool first."
                    }]
                };
            }

            const overview = results.map(result =>
                `- ${result.path} :: ${result.meta.symbol} (${result.lang})`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Project overview (${results.length} main functions):\n\n${overview}`
                }]
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'get_project_stats_tool' });

            return {
                content: [{
                    type: "text",
                    text: `ERROR getting statistics: ${error.message}\n\n` +
                        `Details:\n` +
                        `- Project: ${projectPath}\n` +
                        `- Timestamp: ${context.timestamp}\n\n` +
                        `Error logged to pampa_error.log\n\n` +
                        `Verify the project is indexed correctly`
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
            const results = await service.getOverview(20);

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

    console.log({ "start": "PAMPA MCP Server started and ready for connections" });
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