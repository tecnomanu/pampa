/**
 * Embedding Providers for PAMPA
 * 
 * This module contains all embedding provider implementations
 * for generating vector embeddings from code chunks.
 */

// ============================================================================
// BASE PROVIDER CLASS
// ============================================================================

export class EmbeddingProvider {
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

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

export class OpenAIProvider extends EmbeddingProvider {
    constructor() {
        super();
        // Dynamic import to avoid error if not installed
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

// ============================================================================
// TRANSFORMERS.JS PROVIDER (LOCAL)
// ============================================================================

export class TransformersProvider extends EmbeddingProvider {
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
                this.pipeline = await pipeline('feature-extraction', this.model);
                this.initialized = true;
            } catch (error) {
                throw new Error('Transformers.js is not installed. Run: npm install @xenova/transformers');
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

// ============================================================================
// OLLAMA PROVIDER
// ============================================================================

export class OllamaProvider extends EmbeddingProvider {
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
                throw new Error('Ollama is not installed. Run: npm install ollama');
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
        return 768; // nomic-embed-text (may vary by model)
    }

    getName() {
        return `Ollama (${this.model})`;
    }
}

// ============================================================================
// COHERE PROVIDER
// ============================================================================

export class CohereProvider extends EmbeddingProvider {
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
                throw new Error('Cohere is not installed. Run: npm install cohere-ai');
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
// FACTORY FUNCTION
// ============================================================================

export function createEmbeddingProvider(providerName = 'auto') {
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
            // Auto-detect best available provider
            if (process.env.OPENAI_API_KEY) {
                return new OpenAIProvider();
            } else if (process.env.COHERE_API_KEY) {
                return new CohereProvider();
            } else {
                return new TransformersProvider();
            }
    }
} 