#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { buildScopeFiltersFromOptions } from '../src/cli/commands/search.js';
import { getActiveContextPack, resolveScopeWithPack, clearContextPackCache } from '../src/context/packs.js';
import { createUseContextPackHandler } from '../src/mcp/tools/useContextPack.js';
import { __setTestProviderFactory, __resetTestProviderFactory } from '../src/providers.js';

let searchCode;
let clearBasePath;
let sqliteAvailable = true;
let sqlite3Module;

try {
    const serviceModule = await import('../src/service.js');
    searchCode = serviceModule.searchCode;
    clearBasePath = serviceModule.clearBasePath;
    sqlite3Module = await import('sqlite3');
} catch (error) {
    if (error.message && error.message.includes('sqlite3')) {
        sqliteAvailable = false;
    } else {
        throw error;
    }
}

async function runCliCommand(args, cwd, env = {}) {
    const cliPath = path.join(process.cwd(), 'src/cli.js');
    const child = spawn(process.execPath, [cliPath, ...args], {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
        stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
        stderr += chunk.toString();
    });

    const [code] = await once(child, 'exit');
    return { code, stdout, stderr };
}

async function seedDatabase(tmpDir, sqlite3) {
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
            embedding: Buffer.from(JSON.stringify([0.95, 0.05, 0])),
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
            embedding: Buffer.from(JSON.stringify([0.9, 0.1, 0])),
            pampa_tags: JSON.stringify(['stripe', 'checkout']),
            pampa_intent: 'checkout flow',
            pampa_description: 'Handles checkout requests'
        },
        {
            id: 'chunk-3',
            file_path: 'web/src/hooks/useCart.ts',
            symbol: 'useCart',
            sha: 'sha-cart',
            lang: 'ts',
            embedding: Buffer.from(JSON.stringify([0.1, 0.9, 0])),
            pampa_tags: JSON.stringify(['cart']),
            pampa_intent: 'cart hook',
            pampa_description: 'Client-side cart hook'
        }
    ];

    for (const chunk of chunks) {
        await run(
            `INSERT INTO code_chunks (id, file_path, symbol, sha, lang, chunk_type, embedding, embedding_provider, embedding_dimensions, pampa_tags, pampa_intent, pampa_description)
             VALUES (?, ?, ?, ?, ?, 'function', ?, 'TestProvider', 3, ?, ?, ?)`,
            [
                chunk.id,
                chunk.file_path,
                chunk.symbol,
                chunk.sha,
                chunk.lang,
                chunk.embedding,
                chunk.pampa_tags,
                chunk.pampa_intent,
                chunk.pampa_description
            ]
        );
    }

    await new Promise((resolve, reject) => {
        db.close(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function writeContextPack(tmpDir) {
    const packDir = path.join(tmpDir, '.pampa', 'contextpacks');
    await fs.mkdir(packDir, { recursive: true });
    const packPath = path.join(packDir, 'stripe-backend.json');
    const packDefinition = {
        name: 'Stripe Backend',
        description: 'Stripe backend services scope',
        path_glob: ['app/Services/**'],
        tags: ['stripe'],
        lang: ['php'],
        reranker: 'transformers',
        hybrid: 'off'
    };
    await fs.writeFile(packPath, JSON.stringify(packDefinition, null, 2));
}

if (!sqliteAvailable) {
    test('context pack CLI integration (skipped)', { skip: 'sqlite3 bindings not available' }, () => {});
    test('context pack MCP integration (skipped)', { skip: 'sqlite3 bindings not available' }, () => {});
} else {
    const sqlite3 = sqlite3Module.default || sqlite3Module;

    test('CLI context pack applies defaults to search scope', async (t) => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-context-cli-'));
        const originalMockEnv = process.env.PAMPA_MOCK_RERANKER_TESTS;

        try {
            await seedDatabase(tmpDir, sqlite3);
            await writeContextPack(tmpDir);

            const cliResult = await runCliCommand(['context', 'use', 'stripe-backend', tmpDir], tmpDir, {
                PAMPA_MOCK_RERANKER_TESTS: '1'
            });
            assert.equal(cliResult.code, 0, cliResult.stderr);

            const activePack = getActiveContextPack(tmpDir);
            assert.ok(activePack, 'context pack should be active');
            assert.equal(activePack.key, 'stripe-backend');
            assert.equal(activePack.scope.path_glob[0], 'app/Services/**');

            process.env.PAMPA_MOCK_RERANKER_TESTS = '1';

            const providerStub = {
                async generateEmbedding() {
                    return [0.9, 0.1, 0];
                },
                getDimensions() {
                    return 3;
                },
                getName() {
                    return 'TestProvider';
                }
            };
            __setTestProviderFactory(() => providerStub);

            const { scope: defaultScope } = buildScopeFiltersFromOptions({}, tmpDir);
            assert.deepEqual(defaultScope.path_glob, ['app/Services/**']);
            assert.deepEqual(defaultScope.tags, ['stripe']);
            assert.deepEqual(defaultScope.lang, ['php']);
            assert.equal(defaultScope.reranker, 'transformers');
            assert.equal(defaultScope.hybrid, false);

            const baseResult = await searchCode('create checkout session', 5, 'auto', tmpDir, defaultScope);
            assert.equal(baseResult.success, true);
            assert.equal(baseResult.results.length, 1);
            assert.equal(baseResult.results[0].path, 'app/Services/Payment/StripeService.php');

            const { scope: overriddenScope } = buildScopeFiltersFromOptions({ path_glob: ['app/Http/**'] }, tmpDir);
            assert.deepEqual(overriddenScope.path_glob, ['app/Http/**']);
            assert.deepEqual(overriddenScope.tags, ['stripe']);

            const overriddenResult = await searchCode('create checkout session', 5, 'auto', tmpDir, overriddenScope);
            assert.equal(overriddenResult.success, true);
            assert.equal(overriddenResult.results.length, 1);
            assert.equal(overriddenResult.results[0].path, 'app/Http/Controllers/CheckoutController.php');
        } finally {
            __resetTestProviderFactory();
            clearBasePath();
            clearContextPackCache();
            if (typeof originalMockEnv === 'undefined') {
                delete process.env.PAMPA_MOCK_RERANKER_TESTS;
            } else {
                process.env.PAMPA_MOCK_RERANKER_TESTS = originalMockEnv;
            }
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    test('MCP use_context_pack applies session defaults', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-context-mcp-'));
        const originalMockEnv = process.env.PAMPA_MOCK_RERANKER_TESTS;

        try {
            await seedDatabase(tmpDir, sqlite3);
            await writeContextPack(tmpDir);

            let sessionPack = null;
            const handler = createUseContextPackHandler({
                getWorkingPath: () => tmpDir,
                setSessionPack: (pack) => {
                    sessionPack = pack;
                },
                clearSessionPack: () => {
                    sessionPack = null;
                },
                errorLogger: {
                    debugLog: () => {},
                    log: () => {},
                    logAsync: async () => {}
                }
            });

            const result = await handler({ name: 'stripe-backend', path: tmpDir });
            assert.equal(result.success, true);
            assert.ok(sessionPack, 'session pack should be stored');
            assert.equal(sessionPack.key, 'stripe-backend');

            process.env.PAMPA_MOCK_RERANKER_TESTS = '1';
            const providerStub = {
                async generateEmbedding() {
                    return [0.9, 0.1, 0];
                },
                getDimensions() {
                    return 3;
                },
                getName() {
                    return 'TestProvider';
                }
            };
            __setTestProviderFactory(() => providerStub);

            const { scope: sessionScope } = resolveScopeWithPack({}, { basePath: tmpDir, sessionPack });
            assert.deepEqual(sessionScope.path_glob, ['app/Services/**']);
            assert.deepEqual(sessionScope.tags, ['stripe']);
            assert.equal(sessionScope.reranker, 'transformers');

            const sessionResult = await searchCode('create checkout session', 5, 'auto', tmpDir, sessionScope);
            assert.equal(sessionResult.success, true);
            assert.equal(sessionResult.results.length, 1);
            assert.equal(sessionResult.results[0].path, 'app/Services/Payment/StripeService.php');

            const { scope: mergedScope } = resolveScopeWithPack({ path_glob: ['web/**'], tags: ['cart'], lang: ['ts'] }, { basePath: tmpDir, sessionPack });
            assert.deepEqual(mergedScope.path_glob, ['web/**']);
            assert.deepEqual(mergedScope.tags, ['cart']);
            assert.deepEqual(mergedScope.lang, ['ts']);

            const mergedResult = await searchCode('cart hook', 5, 'auto', tmpDir, mergedScope);
            assert.equal(mergedResult.success, true);
            assert.equal(mergedResult.results.length, 1);
            assert.equal(mergedResult.results[0].path, 'web/src/hooks/useCart.ts');

            await handler({ name: 'clear' });
            assert.equal(sessionPack, null);
            const { scope: clearedScope } = resolveScopeWithPack({}, { basePath: tmpDir, sessionPack });
            assert.ok(!clearedScope.path_glob);
            assert.ok(!clearedScope.tags);
        } finally {
            __resetTestProviderFactory();
            clearBasePath();
            clearContextPackCache();
            if (typeof originalMockEnv === 'undefined') {
                delete process.env.PAMPA_MOCK_RERANKER_TESTS;
            } else {
                process.env.PAMPA_MOCK_RERANKER_TESTS = originalMockEnv;
            }
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });
}
