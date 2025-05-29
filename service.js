/**
 * PAMPA Core Service
 * 
 * This module contains the core business logic for PAMPA
 * separated from presentation concerns (logging, console output).
 * Functions are agnostic and return structured data.
 */

import crypto from 'crypto';
import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import Parser from 'tree-sitter';
import LangGo from 'tree-sitter-go';
import LangJava from 'tree-sitter-java';
import LangJS from 'tree-sitter-javascript';
import LangPHP from 'tree-sitter-php';
import LangTSX from 'tree-sitter-typescript/bindings/node/tsx.js';
import LangTS from 'tree-sitter-typescript/bindings/node/typescript.js';
import { promisify } from 'util';
import zlib from 'zlib';
import { createEmbeddingProvider } from './providers.js';

const LANG_RULES = {
    '.php': {
        lang: 'php',
        ts: LangPHP,
        nodeTypes: ['function_definition', 'method_declaration'],
        variableTypes: ['const_declaration', 'assignment_expression'],
        commentPattern: /\/\*\*[\s\S]*?\*\//g
    },
    '.js': {
        lang: 'javascript',
        ts: LangJS,
        nodeTypes: ['function_declaration', 'method_definition', 'class_declaration'],
        variableTypes: ['const_declaration', 'let_declaration', 'variable_declaration'],
        commentPattern: /\/\*\*[\s\S]*?\*\//g
    },
    '.jsx': {
        lang: 'tsx',
        ts: LangTSX,
        nodeTypes: ['function_declaration', 'class_declaration'],
        variableTypes: ['const_declaration', 'let_declaration', 'variable_declaration'],
        commentPattern: /\/\*\*[\s\S]*?\*\//g
    },
    '.ts': {
        lang: 'typescript',
        ts: LangTS,
        nodeTypes: ['function_declaration', 'method_definition', 'class_declaration'],
        variableTypes: ['const_declaration', 'let_declaration', 'variable_declaration'],
        commentPattern: /\/\*\*[\s\S]*?\*\//g
    },
    '.tsx': {
        lang: 'tsx',
        ts: LangTSX,
        nodeTypes: ['function_declaration', 'class_declaration'],
        variableTypes: ['const_declaration', 'let_declaration', 'variable_declaration'],
        commentPattern: /\/\*\*[\s\S]*?\*\//g
    },
    '.go': {
        lang: 'go',
        ts: LangGo,
        nodeTypes: ['function_declaration', 'method_declaration'],
        variableTypes: ['const_declaration', 'var_declaration'],
        commentPattern: /\/\*[\s\S]*?\*\//g
    },
    '.java': {
        lang: 'java',
        ts: LangJava,
        nodeTypes: ['method_declaration', 'class_declaration'],
        variableTypes: ['variable_declaration', 'field_declaration'],
        commentPattern: /\/\*\*[\s\S]*?\*\//g
    }
};

// Global context for paths - gets set by setBasePath()
let globalContext = {
    basePath: null,
    chunkDir: null,
    codemap: null,
    dbPath: null
};

// Function to set the base path for all operations
export function setBasePath(basePath = '.') {
    const resolvedPath = path.resolve(basePath);
    globalContext.basePath = resolvedPath;
    globalContext.chunkDir = path.join(resolvedPath, '.pampa/chunks');
    globalContext.codemap = path.join(resolvedPath, 'pampa.codemap.json');
    globalContext.dbPath = path.join(resolvedPath, '.pampa/pampa.db');
}

// Function to get current paths (with fallback to relative paths if not set)
function getPaths() {
    if (!globalContext.basePath) {
        // Fallback to relative paths if setBasePath() was not called
        return {
            chunkDir: '.pampa/chunks',
            codemap: 'pampa.codemap.json',
            dbPath: '.pampa/pampa.db'
        };
    }

    return {
        chunkDir: globalContext.chunkDir,
        codemap: globalContext.codemap,
        dbPath: globalContext.dbPath
    };
}

// Function to clear the global context (useful for testing or cleanup)
export function clearBasePath() {
    globalContext = {
        basePath: null,
        chunkDir: null,
        codemap: null,
        dbPath: null
    };
}

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

export async function initDatabase(dimensions, basePath = '.') {
    // Set base path
    setBasePath(basePath);

    const { dbPath } = getPaths();
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new sqlite3.Database(dbPath);
    const run = promisify(db.run.bind(db));

    // Create table for code chunks with enhanced metadata
    await run(`
        CREATE TABLE IF NOT EXISTS code_chunks (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            symbol TEXT NOT NULL,
            sha TEXT NOT NULL,
            lang TEXT NOT NULL,
            chunk_type TEXT DEFAULT 'function',
            embedding BLOB,
            embedding_provider TEXT,
            embedding_dimensions INTEGER,
            
            -- Enhanced semantic metadata
            pampa_tags TEXT,           -- JSON array of semantic tags
            pampa_intent TEXT,         -- Natural language intent description
            pampa_description TEXT,    -- Human-readable description
            doc_comments TEXT,         -- JSDoc/PHPDoc comments
            variables_used TEXT,       -- JSON array of important variables
            context_info TEXT,         -- Additional context metadata
            
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create semantic search table for intention mapping
    await run(`
        CREATE TABLE IF NOT EXISTS intention_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_normalized TEXT NOT NULL,
            original_query TEXT NOT NULL,
            target_sha TEXT NOT NULL,
            confidence REAL DEFAULT 1.0,
            usage_count INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create table for frequent patterns
    await run(`
        CREATE TABLE IF NOT EXISTS query_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern TEXT NOT NULL UNIQUE,
            frequency INTEGER DEFAULT 1,
            typical_results TEXT, -- JSON array of common results
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create indexes for enhanced searches
    await run(`CREATE INDEX IF NOT EXISTS idx_file_path ON code_chunks(file_path)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_symbol ON code_chunks(symbol)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_lang ON code_chunks(lang)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_provider ON code_chunks(embedding_provider)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_chunk_type ON code_chunks(chunk_type)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_pampa_tags ON code_chunks(pampa_tags)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_pampa_intent ON code_chunks(pampa_intent)`);

    await run(`
        CREATE INDEX IF NOT EXISTS idx_lang_provider 
        ON code_chunks(lang, embedding_provider, embedding_dimensions)
    `);

    // Indexes for intention system
    await run(`CREATE INDEX IF NOT EXISTS idx_query_normalized ON intention_cache(query_normalized)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_target_sha ON intention_cache(target_sha)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_usage_count ON intention_cache(usage_count DESC)`);

    // Indexes for pattern analysis
    await run(`CREATE INDEX IF NOT EXISTS idx_pattern_frequency ON query_patterns(frequency DESC)`);

    db.close();
}

// Function to calculate cosine similarity
export function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// SEMANTIC METADATA EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract pampa-specific metadata from JSDoc-style comments
 */
function extractPampaMetadata(commentText) {
    const metadata = {
        tags: [],
        intent: null,
        description: null
    };

    if (!commentText) return metadata;

    // Extract @pampa-tags
    const tagsMatch = commentText.match(/@pampa-tags:\s*([^\n]+)/);
    if (tagsMatch) {
        metadata.tags = tagsMatch[1].split(',').map(tag => tag.trim());
    }

    // Extract @pampa-intent
    const intentMatch = commentText.match(/@pampa-intent:\s*([^\n]+)/);
    if (intentMatch) {
        metadata.intent = intentMatch[1].trim();
    }

    // Extract @pampa-description
    const descMatch = commentText.match(/@pampa-description:\s*([^\n]+)/);
    if (descMatch) {
        metadata.description = descMatch[1].trim();
    }

    return metadata;
}

/**
 * Extract semantic tags automatically from code context
 */
function extractSemanticTags(filePath, symbolName, code) {
    const tags = new Set();

    // Extract from file path
    const pathParts = filePath.split('/').map(part => part.replace(/\.(php|js|ts|tsx)$/, ''));
    pathParts.forEach(part => {
        // Split camelCase and PascalCase
        const words = part.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_-]+/);
        words.forEach(word => {
            if (word.length > 2) { // Skip short words
                tags.add(word);
            }
        });
    });

    // Extract from symbol name
    if (symbolName) {
        const symbolWords = symbolName
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .toLowerCase()
            .split(/[\s_-]+/);

        symbolWords.forEach(word => {
            if (word.length > 2) {
                tags.add(word);
            }
        });
    }

    // Extract technical keywords from code
    const technicalKeywords = [
        'stripe', 'payment', 'session', 'checkout', 'purchase',
        'auth', 'authentication', 'login', 'register', 'middleware',
        'database', 'connection', 'pool', 'config', 'service',
        'controller', 'model', 'repository', 'test', 'api',
        'customer', 'user', 'admin', 'notification', 'email',
        'validation', 'request', 'response', 'http', 'route'
    ];

    const codeText = code.toLowerCase();
    technicalKeywords.forEach(keyword => {
        if (codeText.includes(keyword)) {
            tags.add(keyword);
        }
    });

    // Look for class/function patterns
    const patterns = [
        /class\s+(\w+)/gi,
        /function\s+(\w+)/gi,
        /const\s+(\w+)/gi,
        /interface\s+(\w+)/gi,
        /trait\s+(\w+)/gi
    ];

    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            const name = match[1];
            const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_-]+/);
            words.forEach(word => {
                if (word.length > 2) {
                    tags.add(word);
                }
            });
        }
    });

    return Array.from(tags).slice(0, 10); // Limit to 10 most relevant tags
}

/**
 * Extract important variables from a code node
 */
function extractImportantVariables(node, source, rule) {
    const variables = [];

    function walkForVariables(n) {
        // Only extract variables that seem "important" (const, config, etc.)
        if (rule.variableTypes && rule.variableTypes.includes(n.type)) {
            const varText = source.slice(n.startIndex, n.endIndex);

            // Filter for important-looking variables
            if (isImportantVariable(varText, n.type)) {
                variables.push({
                    type: n.type,
                    name: extractVariableName(n, source),
                    value: varText.length > 100 ? varText.substring(0, 100) + '...' : varText
                });
            }
        }

        for (let i = 0; i < n.childCount; i++) {
            walkForVariables(n.child(i));
        }
    }

    walkForVariables(node);
    return variables;
}

/**
 * Determine if a variable is "important" enough to index
 */
function isImportantVariable(varText, nodeType) {
    // Look for indicators of important variables
    const importantPatterns = [
        /const\s+\w*(config|setting|option|endpoint|url|key|secret|token)\w*/i,
        /const\s+\w*(api|service|client|provider)\w*/i,
        /const\s+[A-Z_]{3,}/,  // ALL_CAPS constants
        /export\s+const/,      // Exported constants
        /static\s+(final\s+)?[A-Z_]+/,  // Static final constants (Java)
    ];

    return importantPatterns.some(pattern => pattern.test(varText));
}

/**
 * Extract variable name from tree-sitter node
 */
function extractVariableName(node, source) {
    // Walk the node to find the identifier
    function findIdentifier(n) {
        if (n.type === 'identifier' || n.type === 'type_identifier') {
            return source.slice(n.startIndex, n.endIndex);
        }

        for (let i = 0; i < n.childCount; i++) {
            const result = findIdentifier(n.child(i));
            if (result) return result;
        }

        return null;
    }

    return findIdentifier(node) || 'unknown';
}

/**
 * Extract documentation comments preceding a code node
 */
function extractDocComments(source, node, rule) {
    const commentPattern = rule.commentPattern;
    if (!commentPattern) return null;

    // Look for comments in the 500 characters before the node
    const beforeNode = source.slice(Math.max(0, node.startIndex - 500), node.startIndex);
    const comments = beforeNode.match(commentPattern);

    if (comments && comments.length > 0) {
        // Return the last (closest) comment
        return comments[comments.length - 1];
    }

    return null;
}

/**
 * Generate enhanced embedding text by combining code with metadata
 */
function generateEnhancedEmbeddingText(code, metadata, variables, docComments) {
    let enhancedText = code;

    // Add documentation comments
    if (docComments) {
        enhancedText = docComments + '\n\n' + enhancedText;
    }

    // Add pampa metadata as natural language
    if (metadata.intent) {
        enhancedText += `\n\n// Intent: ${metadata.intent}`;
    }

    if (metadata.description) {
        enhancedText += `\n\n// Description: ${metadata.description}`;
    }

    if (metadata.tags.length > 0) {
        enhancedText += `\n\n// Tags: ${metadata.tags.join(', ')}`;
    }

    // Add important variables context
    if (variables.length > 0) {
        const varNames = variables.map(v => v.name).join(', ');
        enhancedText += `\n\n// Uses variables: ${varNames}`;
    }

    return enhancedText;
}

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

export async function indexProject({ repoPath = '.', provider = 'auto', onProgress = null }) {
    const repo = path.resolve(repoPath);

    // Ensure we're working in a valid directory and add more restrictive patterns
    if (!fs.existsSync(repo)) {
        throw new Error(`Directory ${repo} does not exist`);
    }

    // More restrictive patterns to avoid system directories
    const pattern = Object.keys(LANG_RULES).map(ext => `**/*${ext}`);
    const files = await fg(pattern, {
        cwd: repo,
        absolute: false, // Use relative paths only
        followSymbolicLinks: false, // Don't follow symlinks to avoid system dirs
        ignore: [
            '**/vendor/**',
            '**/node_modules/**',
            '**/.git/**',
            '**/storage/**',
            '**/dist/**',
            '**/build/**',
            '**/tmp/**',
            '**/temp/**',
            '**/.npm/**',
            '**/.yarn/**',
            '**/Library/**', // Explicitly ignore Library directories
            '**/System/**', // Explicitly ignore System directories
            '**/.Trash/**'
        ],
        onlyFiles: true, // Only return files, not directories
        dot: false // Don't include hidden files
    });

    // Create embedding provider ONCE ONLY
    const embeddingProvider = createEmbeddingProvider(provider);

    // Initialize provider ONCE ONLY
    if (embeddingProvider.init) {
        await embeddingProvider.init();
    }

    // Initialize database with the correct base path
    await initDatabase(embeddingProvider.getDimensions(), repo);

    const { codemap: codemapPath, chunkDir, dbPath } = getPaths();
    const codemap = fs.existsSync(codemapPath) ?
        JSON.parse(fs.readFileSync(codemapPath)) : {};

    const parser = new Parser();
    let processedChunks = 0;
    const errors = [];

    for (const rel of files) {
        const abs = path.join(repo, rel);
        const ext = path.extname(rel).toLowerCase();
        const rule = LANG_RULES[ext];

        if (!rule) continue;

        try {
            parser.setLanguage(rule.ts);
            const source = fs.readFileSync(abs, 'utf8');
            const tree = parser.parse(source);

            async function walk(node) {
                if (rule.nodeTypes.includes(node.type)) {
                    await yieldChunk(node);
                }
                for (let i = 0; i < node.childCount; i++) {
                    await walk(node.child(i));
                }
            }

            async function yieldChunk(node) {
                // More robust function to extract symbol name
                function extractSymbolName(node, source) {
                    // Try different ways to get the name according to node type
                    if (node.type === 'function_declaration' || node.type === 'function_definition') {
                        // Look for first identifier after 'function'
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'identifier') {
                                return source.slice(child.startIndex, child.endIndex);
                            }
                        }
                    }

                    if (node.type === 'method_declaration' || node.type === 'method_definition') {
                        // PHP method_declaration structure: [visibility] function name(params) { ... }
                        // Need to search deeper for the function name
                        function findMethodName(n) {
                            // Look for 'name' field in method_declaration
                            if (n.type === 'name' || n.type === 'identifier' || n.type === 'property_identifier') {
                                const text = source.slice(n.startIndex, n.endIndex);
                                // Skip keywords like 'public', 'private', 'function', etc.
                                if (!['public', 'private', 'protected', 'static', 'function', 'abstract', 'final'].includes(text)) {
                                    return text;
                                }
                            }

                            // Recursively search children
                            for (let i = 0; i < n.childCount; i++) {
                                const result = findMethodName(n.child(i));
                                if (result) return result;
                            }
                            return null;
                        }

                        const methodName = findMethodName(node);
                        if (methodName) return methodName;
                    }

                    if (node.type === 'class_declaration') {
                        // Look for class name
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'identifier' || child.type === 'type_identifier' || child.type === 'name') {
                                const text = source.slice(child.startIndex, child.endIndex);
                                // Skip keyword 'class'
                                if (text !== 'class') {
                                    return text;
                                }
                            }
                        }
                    }

                    // Enhanced fallback: look for any meaningful identifier
                    function findAnyIdentifier(n) {
                        if (n.type === 'identifier' || n.type === 'name' || n.type === 'property_identifier') {
                            const text = source.slice(n.startIndex, n.endIndex);
                            // Skip common keywords
                            if (!['public', 'private', 'protected', 'static', 'function', 'class', 'abstract', 'final', 'const', 'var', 'let'].includes(text)) {
                                return text;
                            }
                        }

                        for (let i = 0; i < n.childCount; i++) {
                            const result = findAnyIdentifier(n.child(i));
                            if (result) return result;
                        }
                        return null;
                    }

                    const anyIdentifier = findAnyIdentifier(node);
                    if (anyIdentifier) return anyIdentifier;

                    // Last resort: try to extract from the code itself using regex
                    const code = source.slice(node.startIndex, node.endIndex);

                    // For PHP methods: public function methodName(
                    const phpMethodMatch = code.match(/(?:public|private|protected)?\s*(?:static)?\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                    if (phpMethodMatch) return phpMethodMatch[1];

                    // For JS/TS functions: function functionName(
                    const jsFunctionMatch = code.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                    if (jsFunctionMatch) return jsFunctionMatch[1];

                    // For JS/TS methods: methodName(args) {
                    const jsMethodMatch = code.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/);
                    if (jsMethodMatch) return jsMethodMatch[1];

                    // For class declarations: class ClassName
                    const classMatch = code.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                    if (classMatch) return classMatch[1];

                    // If we find nothing, use type + position
                    return `${node.type}_${node.startIndex}`;
                }

                const symbol = extractSymbolName(node, source);
                if (!symbol) return;

                const code = source.slice(node.startIndex, node.endIndex);

                // ===== ENHANCED METADATA EXTRACTION =====

                // Extract documentation comments
                const docComments = extractDocComments(source, node, rule);

                // Extract pampa-specific metadata from comments
                const pampaMetadata = extractPampaMetadata(docComments);

                // Extract semantic tags automatically from code context
                const automaticTags = extractSemanticTags(rel, symbol, code);

                // Combine manual tags with automatic tags
                const allTags = [...new Set([...pampaMetadata.tags, ...automaticTags])];
                pampaMetadata.tags = allTags;

                // Extract important variables used in this code
                const importantVariables = extractImportantVariables(node, source, rule);

                // Generate enhanced embedding text
                const enhancedEmbeddingText = generateEnhancedEmbeddingText(
                    code,
                    pampaMetadata,
                    importantVariables,
                    docComments
                );

                // Determine chunk type
                const chunkType = node.type.includes('class') ? 'class' :
                    node.type.includes('method') ? 'method' : 'function';

                // Create context information
                const contextInfo = {
                    nodeType: node.type,
                    startLine: source.slice(0, node.startIndex).split('\n').length,
                    endLine: source.slice(0, node.endIndex).split('\n').length,
                    codeLength: code.length,
                    hasDocumentation: !!docComments,
                    variableCount: importantVariables.length
                };

                const sha = crypto.createHash('sha1').update(code).digest('hex');
                const chunkId = `${rel}:${symbol}:${sha.substring(0, 8)}`;

                // Check if chunk already exists and hasn't changed
                if (codemap[chunkId]?.sha === sha) {
                    return; // No changes
                }

                await embedAndStore({
                    code,
                    enhancedEmbeddingText,
                    chunkId,
                    sha,
                    lang: rule.lang,
                    rel,
                    symbol,
                    chunkType,
                    pampaMetadata,
                    importantVariables,
                    docComments,
                    contextInfo
                });
                processedChunks++;

                // Progress callback
                if (onProgress) {
                    onProgress({ type: 'chunk_processed', file: rel, symbol, chunkId });
                }
            }

            async function embedAndStore({
                code,
                enhancedEmbeddingText,
                chunkId,
                sha,
                lang,
                rel,
                symbol,
                chunkType,
                pampaMetadata,
                importantVariables,
                docComments,
                contextInfo
            }) {
                try {
                    // Generate embedding using enhanced text for better semantic understanding
                    const embedding = await embeddingProvider.generateEmbedding(enhancedEmbeddingText);

                    // Save to database with enhanced metadata
                    const db = new sqlite3.Database(dbPath);
                    const run = promisify(db.run.bind(db));

                    await run(`
                        INSERT OR REPLACE INTO code_chunks 
                        (id, file_path, symbol, sha, lang, chunk_type, embedding, embedding_provider, embedding_dimensions,
                         pampa_tags, pampa_intent, pampa_description, doc_comments, variables_used, context_info, updated_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `, [
                        chunkId,
                        rel,
                        symbol,
                        sha,
                        lang,
                        chunkType,
                        Buffer.from(JSON.stringify(embedding)),
                        embeddingProvider.getName(),
                        embeddingProvider.getDimensions(),
                        JSON.stringify(pampaMetadata.tags),
                        pampaMetadata.intent,
                        pampaMetadata.description,
                        docComments,
                        JSON.stringify(importantVariables),
                        JSON.stringify(contextInfo)
                    ]);

                    db.close();

                    // Save compressed chunk (original code, not enhanced text)
                    fs.mkdirSync(chunkDir, { recursive: true });
                    fs.writeFileSync(path.join(chunkDir, `${sha}.gz`), zlib.gzipSync(code));

                    // Update codemap with enhanced metadata
                    codemap[chunkId] = {
                        file: rel,
                        symbol,
                        sha,
                        lang,
                        chunkType,
                        provider: embeddingProvider.getName(),
                        dimensions: embeddingProvider.getDimensions(),
                        hasPampaTags: pampaMetadata.tags.length > 0,
                        hasIntent: !!pampaMetadata.intent,
                        hasDocumentation: !!docComments,
                        variableCount: importantVariables.length
                    };

                } catch (error) {
                    errors.push({ type: 'indexing_error', chunkId, error: error.message });
                    throw error;
                }
            }

            await walk(tree.rootNode);
        } catch (error) {
            errors.push({ type: 'processing_error', file: rel, error: error.message });
        }
    }

    // Save updated codemap
    fs.writeFileSync(codemapPath, JSON.stringify(codemap, null, 2));

    // Return structured result
    return {
        success: true,
        processedChunks,
        totalChunks: Object.keys(codemap).length,
        provider: embeddingProvider.getName(),
        errors
    };
}

export async function searchCode(query, limit = 10, provider = 'auto', workingPath = '.') {
    // Set the base path for all operations
    setBasePath(workingPath);

    if (!query || !query.trim()) {
        return await getOverview(limit, workingPath);
    }

    try {
        // ===== PHASE 1: INTENTION-BASED SEARCH =====
        // First, try to find direct intention matches for instant results
        const intentionResult = await searchByIntention(query, workingPath);

        if (intentionResult.success && intentionResult.directMatch) {
            // Found a direct intention match! Get the chunk and return immediately
            const chunk = await getChunk(intentionResult.sha, workingPath);

            if (chunk.success) {
                return {
                    success: true,
                    query,
                    searchType: 'intention_direct',
                    confidence: intentionResult.confidence,
                    usageCount: intentionResult.usageCount,
                    originalQuery: intentionResult.originalQuery,
                    results: [{
                        type: 'code',
                        lang: 'detected', // We'd need to get this from DB
                        path: 'unknown', // We'd need to get this from DB  
                        sha: intentionResult.sha,
                        data: chunk.code,
                        meta: {
                            symbol: 'direct_match',
                            score: intentionResult.confidence,
                            searchType: 'intention'
                        }
                    }]
                };
            }
        }

        // ===== PHASE 2: RECORD QUERY PATTERN =====
        // Record this query pattern for future learning
        await recordQueryPattern(query, workingPath);

        // ===== PHASE 3: TRADITIONAL VECTOR SEARCH =====
        // Create provider for query
        const embeddingProvider = createEmbeddingProvider(provider);
        const queryEmbedding = await embeddingProvider.generateEmbedding(query);

        const { dbPath } = getPaths();

        // Check if database exists before trying to open it
        if (!fs.existsSync(dbPath)) {
            return {
                success: false,
                error: 'database_not_found',
                message: `Database not found at ${dbPath}. Project needs to be indexed first.`,
                suggestion: `Run index_project on directory: ${workingPath}`,
                results: []
            };
        }

        const db = new sqlite3.Database(dbPath);
        const all = promisify(db.all.bind(db));

        // Enhanced search query to include semantic metadata
        const chunks = await all(`
            SELECT id, file_path, symbol, sha, lang, chunk_type, embedding, 
                   pampa_tags, pampa_intent, pampa_description, 
                   embedding_provider, embedding_dimensions
            FROM code_chunks 
            WHERE embedding_provider = ? AND embedding_dimensions = ?
            ORDER BY created_at DESC
        `, [embeddingProvider.getName(), embeddingProvider.getDimensions()]);

        db.close();

        if (chunks.length === 0) {
            return {
                success: false,
                error: 'no_chunks_found',
                message: `No indexed chunks found with ${embeddingProvider.getName()} in ${path.resolve(workingPath)}`,
                suggestion: `Run: npx pampa index --provider ${provider} from ${path.resolve(workingPath)}`,
                results: []
            };
        }

        // ===== PHASE 4: ENHANCED SIMILARITY CALCULATION =====
        const results = chunks.map(chunk => {
            const embedding = JSON.parse(chunk.embedding.toString());
            const vectorSimilarity = cosineSimilarity(queryEmbedding, embedding);

            // Boost score based on semantic metadata
            let boostScore = 0;

            // Boost if query matches pampa intent
            if (chunk.pampa_intent && query.toLowerCase().includes(chunk.pampa_intent.toLowerCase())) {
                boostScore += 0.2;
            }

            // Boost if query matches pampa tags
            if (chunk.pampa_tags) {
                const tags = JSON.parse(chunk.pampa_tags || '[]');
                const queryLower = query.toLowerCase();
                tags.forEach(tag => {
                    if (queryLower.includes(tag.toLowerCase())) {
                        boostScore += 0.1;
                    }
                });
            }

            // Final score combines vector similarity with semantic boosts
            const finalScore = Math.min(vectorSimilarity + boostScore, 1.0);

            return {
                id: chunk.id,
                file_path: chunk.file_path,
                symbol: chunk.symbol,
                sha: chunk.sha,
                lang: chunk.lang,
                chunk_type: chunk.chunk_type,
                pampa_intent: chunk.pampa_intent,
                pampa_description: chunk.pampa_description,
                score: finalScore,
                vectorScore: vectorSimilarity,
                boostScore: boostScore
            };
        });

        // Define minimum similarity threshold to avoid false positives
        const MIN_SIMILARITY_THRESHOLD = 0.3;

        // Filter by minimum threshold, sort by similarity and limit results
        const finalResults = results
            .filter(result => result.score >= MIN_SIMILARITY_THRESHOLD)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(result => ({
                type: 'code',
                lang: result.lang,
                path: result.file_path,
                sha: result.sha,
                data: null, // Loaded on demand
                meta: {
                    id: result.id,
                    symbol: result.symbol,
                    score: result.score.toFixed(4),
                    vectorScore: result.vectorScore.toFixed(4),
                    boostScore: result.boostScore.toFixed(4),
                    chunkType: result.chunk_type,
                    pampaIntent: result.pampa_intent,
                    pampaDescription: result.pampa_description,
                    searchType: 'vector_enhanced'
                }
            }));

        // ===== PHASE 5: LEARNING SYSTEM =====
        // If we have good results, record the best match as a potential intention
        if (finalResults.length > 0 && finalResults[0].meta.score > 0.8) {
            const bestMatch = finalResults[0];
            await recordIntention(query, bestMatch.sha, parseFloat(bestMatch.meta.score), workingPath);
        }

        // If no results meet the threshold, return specific message
        if (finalResults.length === 0) {
            return {
                success: false,
                error: 'no_relevant_matches',
                message: `No relevant matches found for "${query}". All results had similarity below ${MIN_SIMILARITY_THRESHOLD}`,
                suggestion: 'Try with more specific or different terms related to your codebase',
                results: []
            };
        }

        return {
            success: true,
            query,
            searchType: 'vector_enhanced',
            provider: embeddingProvider.getName(),
            results: finalResults
        };
    } catch (error) {
        return {
            success: false,
            error: 'search_error',
            message: error.message,
            results: []
        };
    }
}

// Function to get project overview
export async function getOverview(limit = 20, workingPath = '.') {
    // Set the base path for all operations
    setBasePath(workingPath);

    try {
        const { dbPath } = getPaths();

        // Check if database exists before trying to open it
        if (!fs.existsSync(dbPath)) {
            return {
                success: false,
                error: 'database_not_found',
                message: `Database not found at ${dbPath}. Project needs to be indexed first.`,
                suggestion: `Run index_project on directory: ${workingPath}`,
                results: []
            };
        }

        const db = new sqlite3.Database(dbPath);
        const all = promisify(db.all.bind(db));

        const chunks = await all(`
            SELECT id, file_path, symbol, sha, lang 
            FROM code_chunks 
            ORDER BY file_path, symbol 
            LIMIT ?
        `, [limit]);

        db.close();

        const results = chunks.map(chunk => ({
            type: 'code',
            lang: chunk.lang,
            path: chunk.file_path,
            sha: chunk.sha,
            data: null,
            meta: {
                id: chunk.id,
                symbol: chunk.symbol,
                score: 1.0
            }
        }));

        return {
            success: true,
            results
        };
    } catch (error) {
        return {
            success: false,
            error: 'overview_error',
            message: error.message,
            results: []
        };
    }
}

// Function to get chunk content
export async function getChunk(sha, workingPath = '.') {
    setBasePath(workingPath);
    const { chunkDir } = getPaths();
    const chunkPath = path.join(chunkDir, `${sha}.gz`);

    try {
        if (!fs.existsSync(chunkPath)) {
            throw new Error(`Chunk ${sha} not found at ${chunkPath}`);
        }

        const compressed = fs.readFileSync(chunkPath);
        const code = zlib.gunzipSync(compressed).toString('utf8');
        return { success: true, code };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// INTENTION CACHING AND PATTERN LEARNING SYSTEM
// ============================================================================

/**
 * Normalize a query to improve intention matching
 */
function normalizeQuery(query) {
    return query
        .toLowerCase()
        .trim()
        .replace(/[¿?]/g, '') // Remove question marks
        .replace(/\bcómo\b/g, 'como')  // Normalize Spanish
        .replace(/\bcreate\b/g, 'crear')
        .replace(/\bsession\b/g, 'sesion')
        .replace(/\bstripe\b/g, 'stripe')
        .replace(/\bcheckout\b/g, 'checkout')
        .replace(/\s+/g, ' '); // Normalize spaces
}

/**
 * Record a successful query-result mapping for future intention matching
 */
export async function recordIntention(originalQuery, targetSha, confidence = 1.0, workingPath = '.') {
    setBasePath(workingPath);
    const { dbPath } = getPaths();

    try {
        // Check if database exists before trying to open it
        if (!fs.existsSync(dbPath)) {
            return { success: false, error: 'database_not_found' };
        }

        const normalizedQuery = normalizeQuery(originalQuery);

        const db = new sqlite3.Database(dbPath);
        const run = promisify(db.run.bind(db));
        const get = promisify(db.get.bind(db));

        // Check if this intention already exists
        const existing = await get(`
            SELECT id, usage_count FROM intention_cache 
            WHERE query_normalized = ? AND target_sha = ?
        `, [normalizedQuery, targetSha]);

        if (existing) {
            // Update usage count and confidence
            await run(`
                UPDATE intention_cache 
                SET usage_count = usage_count + 1, 
                    confidence = ?, 
                    last_used = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [confidence, existing.id]);
        } else {
            // Create new intention mapping
            await run(`
                INSERT INTO intention_cache 
                (query_normalized, original_query, target_sha, confidence)
                VALUES (?, ?, ?, ?)
            `, [normalizedQuery, originalQuery, targetSha, confidence]);
        }

        db.close();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Search for direct intention matches before doing expensive vector search
 */
export async function searchByIntention(query, workingPath = '.') {
    setBasePath(workingPath);
    const { dbPath } = getPaths();

    try {
        // Check if database exists before trying to open it
        if (!fs.existsSync(dbPath)) {
            return { success: false, directMatch: false, error: 'database_not_found' };
        }

        const normalizedQuery = normalizeQuery(query);

        const db = new sqlite3.Database(dbPath);
        const get = promisify(db.get.bind(db));

        // Look for direct intention match
        const intention = await get(`
            SELECT target_sha, confidence, usage_count, original_query
            FROM intention_cache 
            WHERE query_normalized = ?
            ORDER BY usage_count DESC, confidence DESC
            LIMIT 1
        `, [normalizedQuery]);

        db.close();

        if (intention && intention.confidence > 0.7) {
            // Record usage
            await recordIntention(query, intention.target_sha, intention.confidence, workingPath);

            return {
                success: true,
                directMatch: true,
                sha: intention.target_sha,
                confidence: intention.confidence,
                usageCount: intention.usage_count,
                originalQuery: intention.original_query
            };
        }

        return { success: false, directMatch: false };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update query pattern frequency for analytics
 */
export async function recordQueryPattern(query, workingPath = '.') {
    setBasePath(workingPath);
    const { dbPath } = getPaths();

    try {
        // Check if database exists before trying to open it
        if (!fs.existsSync(dbPath)) {
            return { success: false, error: 'database_not_found' };
        }

        // Extract pattern from query (remove specific names/values)
        const pattern = query
            .toLowerCase()
            .replace(/\b[\w-]+Session\b/gi, '[SESSION]')
            .replace(/\bstripe\b/gi, '[PAYMENT_PROVIDER]')
            .replace(/\b\w+Service\b/gi, '[SERVICE]')
            .replace(/\b\w+Controller\b/gi, '[CONTROLLER]')
            .trim();

        const db = new sqlite3.Database(dbPath);
        const run = promisify(db.run.bind(db));
        const get = promisify(db.get.bind(db));

        const existing = await get(`
            SELECT id, frequency FROM query_patterns WHERE pattern = ?
        `, [pattern]);

        if (existing) {
            await run(`
                UPDATE query_patterns 
                SET frequency = frequency + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [existing.id]);
        } else {
            await run(`
                INSERT INTO query_patterns (pattern) VALUES (?)
            `, [pattern]);
        }

        db.close();
        return { success: true, pattern };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get analytics about frequent query patterns
 */
export async function getQueryAnalytics(workingPath = '.') {
    setBasePath(workingPath);
    const { dbPath } = getPaths();

    try {
        // Check if database exists before trying to open it
        if (!fs.existsSync(dbPath)) {
            return {
                success: false,
                error: 'database_not_found',
                message: `Database not found at ${dbPath}. Project needs to be indexed first.`
            };
        }

        const db = new sqlite3.Database(dbPath);
        const all = promisify(db.all.bind(db));

        const patterns = await all(`
            SELECT pattern, frequency, updated_at
            FROM query_patterns 
            ORDER BY frequency DESC 
            LIMIT 10
        `);

        const intentions = await all(`
            SELECT query_normalized, COUNT(*) as count, AVG(confidence) as avg_confidence
            FROM intention_cache 
            GROUP BY query_normalized
            ORDER BY count DESC 
            LIMIT 10
        `);

        db.close();

        return {
            success: true,
            frequentPatterns: patterns,
            topIntentions: intentions
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
} 