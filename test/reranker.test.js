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

try {
    sqlite3Module = await import('sqlite3');
} catch (error) {
    sqliteAvailable = false;
}

test('cross-encoder reranker mock mode sorts by score hints', async () => {
    process.env.PAMPA_MOCK_RERANKER_TESTS = '1';
    const rerankerModule = await import('../src/ranking/crossEncoderReranker.js');
    const { rerankCrossEncoder, __resetForTests } = rerankerModule;
    __resetForTests();

    const candidates = [
        { id: 'a', mockScore: 0.2 },
        { id: 'b', mockScore: 0.9 },
        { id: 'c', mockScore: 0.5 },
        { id: 'd', mockScore: 0.7 }
    ];

    const reranked = await rerankCrossEncoder('sample query', candidates, {
        max: 4,
        getScoreHint: candidate => candidate.mockScore
    });

    assert.deepEqual(
        reranked.map(candidate => candidate.id),
        ['b', 'd', 'c', 'a']
    );
    assert.equal(reranked[0].rerankerRank, 1);
    assert.equal(reranked[0].rerankerScore, 0.9);

    __resetForTests();
    delete process.env.PAMPA_MOCK_RERANKER_TESTS;
});

if (!sqliteAvailable) {
    test('cross-encoder reranker integration (skipped)', { skip: 'sqlite3 bindings not available in this environment' }, () => {});
} else {
    const sqlite3 = sqlite3Module.default || sqlite3Module;

    test('searchCode applies reranker when transformers flag is enabled', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-rerank-'));
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
                id: 'chunk-top',
                file_path: 'services/highScore.ts',
                symbol: 'HighScore.process',
                sha: 'sha-top',
                lang: 'ts',
                embedding: [0.95, 0.05, 0, 0],
                description: 'handles important logic mockScore:0.1',
                content: 'export const highScore = () => "high";'
            },
            {
                id: 'chunk-middle',
                file_path: 'services/middleScore.ts',
                symbol: 'MiddleScore.process',
                sha: 'sha-middle',
                lang: 'ts',
                embedding: [0.9, 0.1, 0, 0],
                description: 'handles alternative logic mockScore:0.9',
                content: 'export const middleScore = () => "middle";'
            },
            {
                id: 'chunk-low',
                file_path: 'services/lowScore.ts',
                symbol: 'LowScore.process',
                sha: 'sha-low',
                lang: 'ts',
                embedding: [0.85, 0.15, 0, 0],
                description: 'handles fallback logic mockScore:0.5',
                content: 'export const lowScore = () => "low";'
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
                    JSON.stringify(['rerank']),
                    fixture.symbol,
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

        const rerankerModule = await import('../src/ranking/crossEncoderReranker.js');
        rerankerModule.__resetForTests();
        const rerankCalls = [];
        rerankerModule.__setTestRerankOverride(async (query, candidates) => {
            rerankCalls.push({ query, count: candidates.length });
            const reversed = candidates.slice().reverse();
            reversed.forEach((candidate, index) => {
                candidate.rerankerRank = index + 1;
                candidate.rerankerScore = candidates.length - index;
            });
            return reversed;
        });

        const serviceModule = await import('../src/service.js');
        const { searchCode, clearBasePath } = serviceModule;
        clearBasePath();

        try {
            const baseline = await searchCode('important logic handler', 3, 'auto', tmpDir, { reranker: 'off' });
            const reranked = await searchCode('important logic handler', 3, 'auto', tmpDir, { reranker: 'transformers' });

            assert.deepEqual(
                baseline.results.slice(0, 3).map(result => result.sha),
                ['sha-top', 'sha-middle', 'sha-low'],
                'Baseline vector ordering should be deterministic'
            );

            assert.deepEqual(
                reranked.results.slice(0, 3).map(result => result.sha),
                ['sha-low', 'sha-middle', 'sha-top'],
                'Reranked order should be reversed by stub implementation'
            );

            assert.equal(rerankCalls.length, 1, 'Reranker should be invoked once when enabled');
        } finally {
            rerankerModule.__resetForTests();
            __resetTestProviderFactory();
            clearBasePath();
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });
}

test('cross-encoder reranker falls back when model loading fails', async () => {
    const rerankerModule = await import('../src/ranking/crossEncoderReranker.js');
    const { rerankCrossEncoder, __resetForTests, __setTestForceLoadFailure } = rerankerModule;
    __resetForTests();
    __setTestForceLoadFailure(true);

    const candidates = [
        { id: 'one', score: 0.6 },
        { id: 'two', score: 0.4 }
    ];

    const reranked = await rerankCrossEncoder('query', candidates);
    assert.deepEqual(
        reranked.map(candidate => candidate.id),
        ['one', 'two'],
        'Fallback should preserve original ordering'
    );

    __resetForTests();
});
