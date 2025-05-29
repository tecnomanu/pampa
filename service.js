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
    '.php': { lang: 'php', ts: LangPHP, nodeTypes: ['function_definition', 'method_declaration'] },
    '.js': { lang: 'javascript', ts: LangJS, nodeTypes: ['function_declaration', 'method_definition', 'class_declaration'] },
    '.jsx': { lang: 'tsx', ts: LangTSX, nodeTypes: ['function_declaration', 'class_declaration'] },
    '.ts': { lang: 'typescript', ts: LangTS, nodeTypes: ['function_declaration', 'method_definition', 'class_declaration'] },
    '.tsx': { lang: 'tsx', ts: LangTSX, nodeTypes: ['function_declaration', 'class_declaration'] },
    '.go': { lang: 'go', ts: LangGo, nodeTypes: ['function_declaration', 'method_declaration'] },
    '.java': { lang: 'java', ts: LangJava, nodeTypes: ['method_declaration', 'class_declaration'] }
};

const CHUNK_DIR = '.pampa/chunks';
const CODEMAP = 'pampa.codemap.json';
const DB_PATH = '.pampa/pampa.db';

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

export async function initDatabase(dimensions) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new sqlite3.Database(DB_PATH);
    const run = promisify(db.run.bind(db));

    // Create table for code chunks
    await run(`
        CREATE TABLE IF NOT EXISTS code_chunks (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            symbol TEXT NOT NULL,
            sha TEXT NOT NULL,
            lang TEXT NOT NULL,
            embedding BLOB,
            embedding_provider TEXT,
            embedding_dimensions INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create indexes for searches
    await run(`CREATE INDEX IF NOT EXISTS idx_file_path ON code_chunks(file_path)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_symbol ON code_chunks(symbol)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_lang ON code_chunks(lang)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_provider ON code_chunks(embedding_provider)`);

    // Create index for searches
    await run(`
        CREATE INDEX IF NOT EXISTS idx_lang_provider 
        ON code_chunks(lang, embedding_provider, embedding_dimensions)
    `);

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
// MAIN SERVICE FUNCTIONS
// ============================================================================

export async function indexProject({ repoPath = '.', provider = 'auto', onProgress = null }) {
    const repo = path.resolve(repoPath);
    const pattern = Object.keys(LANG_RULES).map(ext => `**/*${ext}`);
    const files = await fg(pattern, {
        cwd: repo,
        ignore: ['**/vendor/**', '**/node_modules/**', '**/.git/**', '**/storage/**', '**/dist/**', '**/build/**']
    });

    // Create embedding provider ONCE ONLY
    const embeddingProvider = createEmbeddingProvider(provider);

    // Initialize provider ONCE ONLY
    if (embeddingProvider.init) {
        await embeddingProvider.init();
    }

    // Initialize database
    await initDatabase(embeddingProvider.getDimensions());

    const codemap = fs.existsSync(path.join(repo, CODEMAP)) ?
        JSON.parse(fs.readFileSync(path.join(repo, CODEMAP))) : {};

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
                        // Look for method identifier
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'identifier' || child.type === 'property_identifier') {
                                return source.slice(child.startIndex, child.endIndex);
                            }
                        }
                    }

                    if (node.type === 'class_declaration') {
                        // Look for class name
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'identifier' || child.type === 'type_identifier') {
                                return source.slice(child.startIndex, child.endIndex);
                            }
                        }
                    }

                    // Fallback: use first identifier found
                    for (let i = 0; i < node.childCount; i++) {
                        const child = node.child(i);
                        if (child.type === 'identifier') {
                            return source.slice(child.startIndex, child.endIndex);
                        }
                    }

                    // If we find nothing, use type + position
                    return `${node.type}_${node.startIndex}`;
                }

                const symbol = extractSymbolName(node, source);
                if (!symbol) return;

                const code = source.slice(node.startIndex, node.endIndex);
                const sha = crypto.createHash('sha1').update(code).digest('hex');
                const chunkId = `${rel}:${symbol}:${sha.substring(0, 8)}`;

                // Check if chunk already exists and hasn't changed
                if (codemap[chunkId]?.sha === sha) {
                    return; // No changes
                }

                await embedAndStore({ code, chunkId, sha, lang: rule.lang, rel, symbol });
                processedChunks++;

                // Progress callback
                if (onProgress) {
                    onProgress({ type: 'chunk_processed', file: rel, symbol, chunkId });
                }
            }

            async function embedAndStore({ code, chunkId, sha, lang, rel, symbol }) {
                try {
                    // Generate embedding using already initialized instance
                    const embedding = await embeddingProvider.generateEmbedding(code);

                    // Save to database
                    const db = new sqlite3.Database(DB_PATH);
                    const run = promisify(db.run.bind(db));

                    await run(`
                        INSERT OR REPLACE INTO code_chunks 
                        (id, file_path, symbol, sha, lang, embedding, embedding_provider, embedding_dimensions, updated_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `, [
                        chunkId,
                        rel,
                        symbol,
                        sha,
                        lang,
                        Buffer.from(JSON.stringify(embedding)),
                        embeddingProvider.getName(),
                        embeddingProvider.getDimensions()
                    ]);

                    db.close();

                    // Save compressed chunk
                    fs.mkdirSync(path.join(repo, CHUNK_DIR), { recursive: true });
                    fs.writeFileSync(path.join(repo, CHUNK_DIR, `${sha}.gz`), zlib.gzipSync(code));

                    // Update codemap
                    codemap[chunkId] = {
                        file: rel,
                        symbol,
                        sha,
                        lang,
                        provider: embeddingProvider.getName(),
                        dimensions: embeddingProvider.getDimensions()
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
    fs.writeFileSync(path.join(repo, CODEMAP), JSON.stringify(codemap, null, 2));

    // Return structured result
    return {
        success: true,
        processedChunks,
        totalChunks: Object.keys(codemap).length,
        provider: embeddingProvider.getName(),
        errors
    };
}

export async function searchCode(query, limit = 10, provider = 'auto') {
    if (!query || !query.trim()) {
        return await getOverview(limit);
    }

    try {
        // Create provider for query
        const embeddingProvider = createEmbeddingProvider(provider);
        const queryEmbedding = await embeddingProvider.generateEmbedding(query);

        const db = new sqlite3.Database(DB_PATH);
        const all = promisify(db.all.bind(db));

        // Search chunks from same provider and dimensions
        const chunks = await all(`
            SELECT id, file_path, symbol, sha, lang, embedding, embedding_provider, embedding_dimensions
            FROM code_chunks 
            WHERE embedding_provider = ? AND embedding_dimensions = ?
            ORDER BY created_at DESC
        `, [embeddingProvider.getName(), embeddingProvider.getDimensions()]);

        db.close();

        if (chunks.length === 0) {
            return {
                success: false,
                error: 'no_chunks_found',
                message: `No indexed chunks found with ${embeddingProvider.getName()}`,
                suggestion: `Run: npx pampa index --provider ${provider}`,
                results: []
            };
        }

        // Calculate similarities
        const results = chunks.map(chunk => {
            const embedding = JSON.parse(chunk.embedding.toString());
            const similarity = cosineSimilarity(queryEmbedding, embedding);

            return {
                id: chunk.id,
                file_path: chunk.file_path,
                symbol: chunk.symbol,
                sha: chunk.sha,
                lang: chunk.lang,
                score: similarity
            };
        });

        // Sort by similarity and limit results
        const finalResults = results
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
                    score: result.score.toFixed(4)
                }
            }));

        return {
            success: true,
            query,
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
export async function getOverview(limit = 20) {
    try {
        const db = new sqlite3.Database(DB_PATH);
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
export async function getChunk(sha) {
    try {
        const gzPath = path.join(CHUNK_DIR, `${sha}.gz`);
        if (!fs.existsSync(gzPath)) {
            throw new Error(`Chunk not found: ${sha}`);
        }
        return {
            success: true,
            content: zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8')
        };
    } catch (error) {
        return {
            success: false,
            error: 'chunk_not_found',
            message: error.message
        };
    }
} 