#!/usr/bin/env node
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import { buildScopeFiltersFromOptions } from '../src/cli/commands/search.js';
import { applyScope, normalizeScopeFilters } from '../src/search/applyScope.js';
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

test('buildScopeFiltersFromOptions normalizes CLI inputs', () => {
    const { scope } = buildScopeFiltersFromOptions({
        path_glob: ['app/Services/**', 'web/**'],
        tags: ['Stripe', 'Checkout'],
        lang: ['PHP', 'TS'],
        reranker: 'transformers',
        hybrid: 'on',
        bm25: 'off'
    });

    assert.deepEqual(scope.path_glob, ['app/Services/**', 'web/**']);
    assert.deepEqual(scope.tags, ['stripe', 'checkout']);
    assert.deepEqual(scope.lang, ['php', 'ts']);
    assert.equal(scope.reranker, 'transformers');
    assert.equal(scope.hybrid, true);
    assert.equal(scope.bm25, false);

    const { scope: defaultScope } = buildScopeFiltersFromOptions({});
    assert.equal(defaultScope.reranker, 'off');
    assert.equal(defaultScope.hybrid, true);
    assert.equal(defaultScope.bm25, true);

    const { scope: stringScope } = buildScopeFiltersFromOptions({
        path_glob: 'app/**/*.ts',
        tags: 'cart',
        lang: 'ts',
        reranker: 'invalid-value',
        hybrid: 'off',
        bm25: 'off'
    });
    assert.deepEqual(stringScope.path_glob, ['app/**/*.ts']);
    assert.deepEqual(stringScope.tags, ['cart']);
    assert.deepEqual(stringScope.lang, ['ts']);
    assert.equal(stringScope.reranker, 'off');
    assert.equal(stringScope.hybrid, false);
    assert.equal(stringScope.bm25, false);
});

const sampleChunks = [
    {
        file_path: 'app/Services/Payment/StripeService.php',
        pampa_tags: JSON.stringify(['stripe']),
        lang: 'php'
    },
    {
        file_path: 'app/Http/Controllers/CheckoutController.php',
        pampa_tags: JSON.stringify(['stripe', 'checkout']),
        lang: 'php'
    },
    {
        file_path: 'web/src/hooks/useCart.ts',
        pampa_tags: JSON.stringify(['cart']),
        lang: 'ts'
    }
];

test('applyScope filters chunks by path, tags and language', () => {
    const normalizedScope = normalizeScopeFilters({
        path_glob: 'app/Services/**',
        tags: ['stripe'],
        lang: ['php']
    });
    const filtered = applyScope(sampleChunks, normalizedScope);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].file_path, 'app/Services/Payment/StripeService.php');
});

if (!sqliteAvailable) {
    test('searchCode respects scope filters (skipped)', { skip: 'sqlite3 bindings not available in this environment' }, () => {});
} else {
    const sqlite3 = sqlite3Module.default || sqlite3Module;

    test('searchCode respects scoped filters', async (t) => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-scope-'));
        const dbDir = path.join(tmpDir, '.pampa');
        await fs.mkdir(dbDir, { recursive: true });
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

        const chunks = [
            {
                id: 'chunk-1',
                file_path: 'app/Services/Payment/StripeService.php',
                symbol: 'StripeService::createCheckoutSession',
                sha: 'sha-service',
                lang: 'php',
                chunk_type: 'function',
                embedding: Buffer.from(JSON.stringify([0.95, 0.05, 0])),
                embedding_provider: 'TestProvider',
                embedding_dimensions: 3,
                pampa_tags: JSON.stringify(['stripe']),
                pampa_intent: 'create checkout session',
                pampa_description: 'Creates Stripe checkout session'
            },
            {
                id: 'chunk-2',
                file_path: 'app/Http/Controllers/CheckoutController.php',
                symbol: 'CheckoutController::store',
                sha: 'sha-controller',
                lang: 'php',
                chunk_type: 'function',
                embedding: Buffer.from(JSON.stringify([0.9, 0.1, 0])),
                embedding_provider: 'TestProvider',
                embedding_dimensions: 3,
                pampa_tags: JSON.stringify(['stripe', 'checkout']),
                pampa_intent: 'checkout flow',
                pampa_description: 'Handles checkout requests'
            },
            {
                id: 'chunk-3',
                file_path: 'web/src/hooks/useCart.ts',
                symbol: 'useCart',
                sha: 'sha-hook',
                lang: 'ts',
                chunk_type: 'function',
                embedding: Buffer.from(JSON.stringify([0.1, 0.9, 0.1])),
                embedding_provider: 'TestProvider',
                embedding_dimensions: 3,
                pampa_tags: JSON.stringify(['cart']),
                pampa_intent: 'cart hook',
                pampa_description: 'React hook for cart state'
            }
        ];

        for (const chunk of chunks) {
            await run(
                `INSERT INTO code_chunks (id, file_path, symbol, sha, lang, chunk_type, embedding, embedding_provider, embedding_dimensions, pampa_tags, pampa_intent, pampa_description)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    chunk.id,
                    chunk.file_path,
                    chunk.symbol,
                    chunk.sha,
                    chunk.lang,
                    chunk.chunk_type,
                    chunk.embedding,
                    chunk.embedding_provider,
                    chunk.embedding_dimensions,
                    chunk.pampa_tags,
                    chunk.pampa_intent,
                    chunk.pampa_description
                ]
            );
        }

        await promisify(db.close.bind(db))();

        const providerStub = {
            generateEmbedding: mock.fn(async () => [1, 0, 0]),
            getDimensions: () => 3,
            getName: () => 'TestProvider'
        };
        __setTestProviderFactory(() => providerStub);

        try {
            const baseResult = await searchCode('create checkout session', 5, 'auto', tmpDir, { reranker: 'off' });
            assert.equal(baseResult.success, true);
            assert.equal(baseResult.results.length, 3);

            const pathScoped = await searchCode('create checkout session', 5, 'auto', tmpDir, {
                path_glob: 'app/Services/**',
                reranker: 'off'
            });
            assert.equal(pathScoped.success, true);
            assert.equal(pathScoped.results.length, 1);
            assert.equal(pathScoped.results[0].path, 'app/Services/Payment/StripeService.php');
            assert.deepEqual(pathScoped.scope.path_glob, ['app/Services/**']);

            const tagScoped = await searchCode('create checkout session', 5, 'auto', tmpDir, {
                tags: ['stripe'],
                reranker: 'off'
            });
            assert.equal(tagScoped.results.length, 2);
            assert.deepEqual(tagScoped.results.map(result => result.path).sort(), [
                'app/Http/Controllers/CheckoutController.php',
                'app/Services/Payment/StripeService.php'
            ]);

            const langScoped = await searchCode('create checkout session', 5, 'auto', tmpDir, {
                lang: ['ts'],
                reranker: 'off'
            });
            assert.equal(langScoped.results.length, 1);
            assert.equal(langScoped.results[0].path, 'web/src/hooks/useCart.ts');
            assert.equal(langScoped.scope.lang[0], 'ts');
            assert.equal(langScoped.reranker, 'off');
        } finally {
            __resetTestProviderFactory();
            clearBasePath();
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });
}
