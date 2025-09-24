import bm25Factory from 'wink-bm25-text-search';

const DEFAULT_FIELD = 'body';

function defaultPrep(text) {
    if (!text) {
        return [];
    }

    return String(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(/\s+/u)
        .filter(Boolean);
}

export class BM25Index {
    constructor() {
        this.engine = bm25Factory();
        this.engine.defineConfig({ fldWeights: { [DEFAULT_FIELD]: 1 } });
        this.engine.definePrepTasks([defaultPrep]);
        this.documents = new Set();
        this.consolidated = false;
    }

    addDocument(id, text) {
        if (!id || typeof text !== 'string' || text.trim().length === 0) {
            return;
        }

        if (this.documents.has(id)) {
            return;
        }

        this.engine.addDoc({ [DEFAULT_FIELD]: text }, id);
        this.documents.add(id);
        this.consolidated = false;
    }

    addDocuments(entries = []) {
        for (const entry of entries) {
            if (!entry) continue;
            const { id, text } = entry;
            this.addDocument(id, text);
        }
    }

    consolidate() {
        if (!this.consolidated) {
            this.engine.consolidate();
            this.consolidated = true;
        }
    }

    search(query, limit = 60) {
        if (!query || !query.trim()) {
            return [];
        }

        this.consolidate();
        const results = this.engine.search(query, limit);
        return results.map(([id, score]) => ({ id, score }));
    }
}
