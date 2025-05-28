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
// PROVEEDORES DE EMBEDDINGS
// ============================================================================

class EmbeddingProvider {
    async generateEmbedding(text) {
        throw new Error('generateEmbedding must be implemented by subclass');
    }

    getDimensions() {
        throw new Error('getDimensions must be implemented by subclass');
    }

    getName() {
        throw new Error('getName must be implemented by subclass');
    }
}

class OpenAIProvider extends EmbeddingProvider {
    constructor() {
        super();
        // Importación dinámica para evitar error si no está instalado
        this.openai = null;
        this.model = 'text-embedding-3-large';
    }

    async init() {
        if (!this.openai) {
            const { OpenAI } = await import('openai');
            this.openai = new OpenAI();
        }
    }

    async generateEmbedding(text) {
        await this.init();
        const { data } = await this.openai.embeddings.create({
            model: this.model,
            input: text.slice(0, 8192)
        });
        return data[0].embedding;
    }

    getDimensions() {
        return 3072; // text-embedding-3-large
    }

    getName() {
        return 'OpenAI';
    }
}

class TransformersProvider extends EmbeddingProvider {
    constructor() {
        super();
        this.pipeline = null;
        this.model = 'Xenova/all-MiniLM-L6-v2';
        this.initialized = false;
    }

    async init() {
        if (!this.initialized && !this.pipeline) {
            try {
                const { pipeline } = await import('@xenova/transformers');
                console.log('🔄 Cargando modelo local de embeddings...');
                this.pipeline = await pipeline('feature-extraction', this.model);
                console.log('✅ Modelo local cargado');
                this.initialized = true;
            } catch (error) {
                throw new Error('Transformers.js no está instalado. Ejecuta: npm install @xenova/transformers');
            }
        }
    }

    async generateEmbedding(text) {
        if (!this.initialized) {
            await this.init();
        }
        const result = await this.pipeline(text.slice(0, 512), {
            pooling: 'mean',
            normalize: true
        });
        return Array.from(result.data);
    }

    getDimensions() {
        return 384; // all-MiniLM-L6-v2
    }

    getName() {
        return 'Transformers.js (Local)';
    }
}

class OllamaProvider extends EmbeddingProvider {
    constructor(model = 'nomic-embed-text') {
        super();
        this.model = model;
        this.ollama = null;
    }

    async init() {
        if (!this.ollama) {
            try {
                const ollama = await import('ollama');
                this.ollama = ollama.default;
            } catch (error) {
                throw new Error('Ollama no está instalado. Ejecuta: npm install ollama');
            }
        }
    }

    async generateEmbedding(text) {
        await this.init();
        const response = await this.ollama.embeddings({
            model: this.model,
            prompt: text.slice(0, 2048)
        });
        return response.embedding;
    }

    getDimensions() {
        return 768; // nomic-embed-text (puede variar según modelo)
    }

    getName() {
        return `Ollama (${this.model})`;
    }
}

class CohereProvider extends EmbeddingProvider {
    constructor() {
        super();
        this.cohere = null;
        this.model = 'embed-english-v3.0';
    }

    async init() {
        if (!this.cohere) {
            try {
                const { CohereClient } = await import('cohere-ai');
                this.cohere = new CohereClient({
                    token: process.env.COHERE_API_KEY
                });
            } catch (error) {
                throw new Error('Cohere no está instalado. Ejecuta: npm install cohere-ai');
            }
        }
    }

    async generateEmbedding(text) {
        await this.init();
        const response = await this.cohere.embed({
            texts: [text.slice(0, 4096)],
            model: this.model,
            inputType: 'search_document'
        });
        return response.embeddings[0];
    }

    getDimensions() {
        return 1024; // embed-english-v3.0
    }

    getName() {
        return 'Cohere';
    }
}

// ============================================================================
// FACTORY PARA CREAR PROVEEDORES
// ============================================================================

function createEmbeddingProvider(providerName = 'auto') {
    switch (providerName.toLowerCase()) {
        case 'openai':
            return new OpenAIProvider();
        case 'transformers':
        case 'local':
            return new TransformersProvider();
        case 'ollama':
            return new OllamaProvider();
        case 'cohere':
            return new CohereProvider();
        case 'auto':
        default:
            // Auto-detectar el mejor proveedor disponible
            if (process.env.OPENAI_API_KEY) {
                console.log('🔑 Usando OpenAI (API key detectada)');
                return new OpenAIProvider();
            } else if (process.env.COHERE_API_KEY) {
                console.log('🔑 Usando Cohere (API key detectada)');
                return new CohereProvider();
            } else {
                console.log('🏠 Usando modelo local (sin API keys detectadas)');
                return new TransformersProvider();
            }
    }
}

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

// Inicializar base de datos SQLite
async function initDatabase(dimensions) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new sqlite3.Database(DB_PATH);
    const run = promisify(db.run.bind(db));

    // Crear tabla para chunks de código
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

    // Crear índice para búsquedas
    await run(`CREATE INDEX IF NOT EXISTS idx_file_path ON code_chunks(file_path)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_symbol ON code_chunks(symbol)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_lang ON code_chunks(lang)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_provider ON code_chunks(embedding_provider)`);

    db.close();
    console.log('✅ Base de datos SQLite inicializada');
}

// Función para calcular similitud coseno
function cosineSimilarity(a, b) {
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

export async function indexProject({ repoPath = '.', provider = 'auto' }) {
    const repo = path.resolve(repoPath);
    const pattern = Object.keys(LANG_RULES).map(ext => `**/*${ext}`);
    const files = await fg(pattern, {
        cwd: repo,
        ignore: ['**/vendor/**', '**/node_modules/**', '**/.git/**', '**/storage/**', '**/dist/**', '**/build/**']
    });

    console.log(`🔍 Encontrados ${files.length} archivos para indexar`);

    // Crear proveedor de embeddings UNA SOLA VEZ
    const embeddingProvider = createEmbeddingProvider(provider);
    console.log(`🧠 Usando proveedor: ${embeddingProvider.getName()}`);

    // Inicializar el proveedor UNA SOLA VEZ
    if (embeddingProvider.init) {
        await embeddingProvider.init();
    }

    // Inicializar base de datos
    await initDatabase(embeddingProvider.getDimensions());

    const codemap = fs.existsSync(path.join(repo, CODEMAP)) ?
        JSON.parse(fs.readFileSync(path.join(repo, CODEMAP))) : {};

    const parser = new Parser();
    let processedChunks = 0;

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
                // Función más robusta para extraer el nombre del símbolo
                function extractSymbolName(node, source) {
                    // Intentar diferentes formas de obtener el nombre según el tipo de nodo
                    if (node.type === 'function_declaration' || node.type === 'function_definition') {
                        // Buscar el primer identificador después de 'function'
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'identifier') {
                                return source.slice(child.startIndex, child.endIndex);
                            }
                        }
                    }

                    if (node.type === 'method_declaration' || node.type === 'method_definition') {
                        // Buscar el identificador del método
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'identifier' || child.type === 'property_identifier') {
                                return source.slice(child.startIndex, child.endIndex);
                            }
                        }
                    }

                    if (node.type === 'class_declaration') {
                        // Buscar el nombre de la clase
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'identifier' || child.type === 'type_identifier') {
                                return source.slice(child.startIndex, child.endIndex);
                            }
                        }
                    }

                    // Fallback: usar el primer identificador encontrado
                    for (let i = 0; i < node.childCount; i++) {
                        const child = node.child(i);
                        if (child.type === 'identifier') {
                            return source.slice(child.startIndex, child.endIndex);
                        }
                    }

                    // Si no encontramos nada, usar el tipo + posición
                    return `${node.type}_${node.startIndex}`;
                }

                const symbol = extractSymbolName(node, source);
                if (!symbol) return;

                const code = source.slice(node.startIndex, node.endIndex);
                const sha = crypto.createHash('sha1').update(code).digest('hex');
                const chunkId = `${rel}:${symbol}:${sha.substring(0, 8)}`;

                // Verificar si el chunk ya existe y no ha cambiado
                if (codemap[chunkId]?.sha === sha) {
                    return; // Sin cambios
                }

                await embedAndStore({ code, chunkId, sha, lang: rule.lang, rel, symbol });
                processedChunks++;
            }

            async function embedAndStore({ code, chunkId, sha, lang, rel, symbol }) {
                try {
                    // Generar embedding usando la instancia ya inicializada
                    const embedding = await embeddingProvider.generateEmbedding(code);

                    // Guardar en base de datos
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

                    // Guardar chunk comprimido
                    fs.mkdirSync(path.join(repo, CHUNK_DIR), { recursive: true });
                    fs.writeFileSync(path.join(repo, CHUNK_DIR, `${sha}.gz`), zlib.gzipSync(code));

                    // Actualizar codemap
                    codemap[chunkId] = {
                        file: rel,
                        symbol,
                        sha,
                        lang,
                        provider: embeddingProvider.getName(),
                        dimensions: embeddingProvider.getDimensions()
                    };

                    console.log(`✅ Indexado: ${chunkId}`);
                } catch (error) {
                    console.error(`❌ Error indexando ${chunkId}:`, error.message);
                }
            }

            await walk(tree.rootNode);
        } catch (error) {
            console.error(`❌ Error procesando ${rel}:`, error.message);
        }
    }

    // Guardar codemap actualizado
    fs.writeFileSync(path.join(repo, CODEMAP), JSON.stringify(codemap, null, 2));
    console.log(`\n✨ Indexación completada: ${processedChunks} chunks procesados`);
    console.log(`📄 pampa.codemap.json actualizado con ${Object.keys(codemap).length} chunks totales`);
    console.log(`🧠 Proveedor usado: ${embeddingProvider.getName()}`);
}

// Función para buscar código similar
export async function searchCode(query, limit = 10, provider = 'auto') {
    if (!query.trim()) {
        return await getOverview(limit);
    }

    try {
        // Crear proveedor para la consulta
        const embeddingProvider = createEmbeddingProvider(provider);
        const queryEmbedding = await embeddingProvider.generateEmbedding(query);

        const db = new sqlite3.Database(DB_PATH);
        const all = promisify(db.all.bind(db));

        // Buscar chunks del mismo proveedor y dimensiones
        const chunks = await all(`
            SELECT id, file_path, symbol, sha, lang, embedding, embedding_provider, embedding_dimensions
            FROM code_chunks 
            WHERE embedding_provider = ? AND embedding_dimensions = ?
            ORDER BY created_at DESC
        `, [embeddingProvider.getName(), embeddingProvider.getDimensions()]);

        db.close();

        if (chunks.length === 0) {
            console.log(`⚠️  No se encontraron chunks indexados con ${embeddingProvider.getName()}`);
            console.log(`💡 Ejecuta: npx pampa index --provider ${provider}`);
            return [];
        }

        // Calcular similitudes
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

        // Ordenar por similitud y limitar resultados
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(result => ({
                type: 'code',
                lang: result.lang,
                path: result.file_path,
                sha: result.sha,
                data: null, // Se carga bajo demanda
                meta: {
                    id: result.id,
                    symbol: result.symbol,
                    score: result.score.toFixed(4)
                }
            }));
    } catch (error) {
        console.error('Error en búsqueda:', error);
        return [];
    }
}

// Función para obtener resumen del proyecto
async function getOverview(limit = 20) {
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

        return chunks.map(chunk => ({
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
    } catch (error) {
        console.error('Error obteniendo resumen:', error);
        return [];
    }
}

// Función para obtener el contenido de un chunk
export async function getChunk(sha) {
    const gzPath = path.join(CHUNK_DIR, `${sha}.gz`);
    if (!fs.existsSync(gzPath)) {
        throw new Error(`Chunk no encontrado: ${sha}`);
    }
    return zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8');
}