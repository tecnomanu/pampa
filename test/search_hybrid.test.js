#!/usr/bin/env node
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { __setTestProviderFactory, __resetTestProviderFactory } from '../src/providers.js';

let sqliteAvailable = true;
let sqlite3Module;
let searchCode;
let clearBasePath;

try {
    sqlite3Module = await import('sqlite3');
    const serviceModule = await import('../src/service.js');
    searchCode = serviceModule.searchCode;
    clearBasePath = serviceModule.clearBasePath;
} catch (error) {
    if (error.message.includes('sqlite3') || error.message.includes('bindings')) {
        sqliteAvailable = false;
    } else {
        throw error;
    }
}

function recallAt(results, relevantSet, k) {
    if (!results || relevantSet.size === 0) {
        return 0;
    }

    const topResults = results.slice(0, k);
    const retrieved = topResults.filter(result => relevantSet.has(result.sha));
    return retrieved.length / relevantSet.size;
}

if (!sqliteAvailable) {
    test('hybrid search fusion (skipped)', { skip: 'sqlite3 bindings not available in this environment' }, () => {});
} else {
    const sqlite3 = sqlite3Module.default || sqlite3Module;

    test('hybrid search combines vector and BM25 rankings', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-hybrid-'));
        const dbDir = path.join(tmpDir, '.pampa');
        const chunksDir = path.join(dbDir, 'chunks');
        await fs.mkdir(chunksDir, { recursive: true });
        const dbPath = path.join(dbDir, 'pampa.db');

        const db = new sqlite3.Database(dbPath);
        const run = promisify(db.run.bind(db));

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
                pampa_tags TEXT,
                pampa_intent TEXT,
                pampa_description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const fixtures = [
            {
                id: 'chunk-semantic-1',
                file_path: 'services/semanticPrimary.ts',
                symbol: 'SemanticPrimary.handle',
                sha: 'sha-semantic-1',
                lang: 'ts',
                embedding: [1, 0, 0, 0],
                description: 'Handles partial payment workflow',
                intent: 'partial payment handler',
                content: `export function handlePartialPayment(order) {\n  return order.amount - order.deposited;\n}`
            },
            {
                id: 'chunk-semantic-2',
                file_path: 'services/semanticSecondary.ts',
                symbol: 'SemanticSecondary.prepare',
                sha: 'sha-semantic-2',
                lang: 'ts',
                embedding: [0.85, 0.15, 0, 0],
                description: 'Prepares adjustments for partial charges',
                intent: 'prepare adjustments',
                content: `export function prepareAdjustments(input) {\n  return input.map(x => x * 0.9);\n}`
            },
            {
                id: 'chunk-lexical-1',
                file_path: 'billing/lexicalLookup.ts',
                symbol: 'lookupPartialPaymentReference',
                sha: 'sha-lexical-1',
                lang: 'ts',
                embedding: [0.02, 0.98, 0, 0],
                description: 'Looks up partial payment reference by order reference',
                intent: 'lookup payment reference',
                content: [
                    'export function lookupPartialPaymentReference(orderReference) {',
                    '  const reference = `${orderReference}-partial-payment-reference`;',
                    '  return reference;',
                    '}',
                    '// partial payment reference search helper'
                ].join('\n')
            },
            {
                id: 'chunk-lexical-2',
                file_path: 'billing/referenceFormatter.ts',
                symbol: 'formatPartialPaymentReference',
                sha: 'sha-lexical-2',
                lang: 'ts',
                embedding: [0.01, 0.99, 0, 0],
                description: 'Formats a partial payment reference string',
                intent: 'format payment reference',
                content: [
                    "const PARTIAL_PAYMENT_REFERENCE_LABEL = 'partial payment reference';",
                    'export function formatPartialPaymentReference(cart) {',
                    '  return `${cart.id}-partial-payment-reference`;',
                    '}'
                ].join('\n')
            },
            {
                id: 'chunk-distractor',
                file_path: 'inventory/distractor.ts',
                symbol: 'buildSkuIndex',
                sha: 'sha-distractor',
                lang: 'ts',
                embedding: [0.6, 0.2, 0.1, 0.1],
                description: 'Builds sku index cache',
                intent: 'inventory index',
                content: `export function buildSkuIndex(items) {\n  return new Map(items.map(item => [item.sku, item]));\n}`
            }
        ];

        for (const fixture of fixtures) {
            await run(
                `INSERT INTO code_chunks (id, file_path, symbol, sha, lang, chunk_type, embedding, embedding_provider, embedding_dimensions, pampa_tags, pampa_intent, pampa_description)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    fixture.id,
                    fixture.file_path,
                    fixture.symbol,
                    fixture.sha,
                    fixture.lang,
                    'function',
                    Buffer.from(JSON.stringify(fixture.embedding)),
                    'TestProvider',
                    4,
                    JSON.stringify(['partial', 'payment']),
                    fixture.intent,
                    fixture.description
                ]
            );

            const gz = zlib.gzipSync(Buffer.from(fixture.content, 'utf8'));
            await fs.writeFile(path.join(chunksDir, `${fixture.sha}.gz`), gz);
        }

        await promisify(db.close.bind(db))();

        const providerStub = {
            generateEmbedding: mock.fn(async () => [1, 0, 0, 0]),
            getDimensions: () => 4,
            getName: () => 'TestProvider'
        };
        __setTestProviderFactory(() => providerStub);

        const relevantShas = new Set(['sha-semantic-1', 'sha-lexical-1', 'sha-lexical-2']);
        const query = 'partial payment reference lookup';

        try {
            const vectorOnly = await searchCode(query, 3, 'auto', tmpDir, { reranker: 'off', hybrid: false });
            const hybridResult = await searchCode(query, 3, 'auto', tmpDir, { reranker: 'off' });
            const bm25Off = await searchCode(query, 3, 'auto', tmpDir, { reranker: 'off', bm25: false });

            assert.equal(vectorOnly.hybrid.enabled, false);
            assert.equal(bm25Off.hybrid.bm25Enabled, false);
            assert.equal(hybridResult.hybrid.enabled, true);
            assert.equal(hybridResult.hybrid.fused, true);
            assert.ok(hybridResult.hybrid.bm25Candidates >= 1);

            const vectorRecall = recallAt(vectorOnly.results, relevantShas, 3);
            const hybridRecall = recallAt(hybridResult.results, relevantShas, 3);

            assert.ok(
                hybridRecall - vectorRecall >= 0.2,
                `Expected hybrid recall improvement >= 0.2 but got vector=${vectorRecall.toFixed(2)} hybrid=${hybridRecall.toFixed(2)}`
            );

            assert.deepEqual(
                bm25Off.results.map(result => result.sha),
                vectorOnly.results.map(result => result.sha),
                'Disabling BM25 should match pure vector ordering'
            );

            const hybridTopShas = hybridResult.results.slice(0, 3).map(result => result.sha);
            const relevantHits = hybridTopShas.filter(sha => relevantShas.has(sha));
            assert.ok(relevantHits.length >= 2, 'Hybrid ranking should surface multiple relevant chunks');
            assert.ok(hybridTopShas.includes('sha-lexical-1'), 'Hybrid ranking should surface lexical chunks');
        } finally {
            __resetTestProviderFactory();
            clearBasePath();
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });
}
