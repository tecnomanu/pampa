#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { chunkFixtures } from './fixtures/chunks.js';
import { queryFixtures, getQueryVector } from './fixtures/queries.js';
import {
    precisionAt,
    reciprocalRankAt,
    ndcgAt,
    averageMetric
} from '../../src/metrics/ir.js';
import { __setTestProviderFactory, __resetTestProviderFactory } from '../../src/providers.js';

let sqliteAvailable = true;
let sqlite3Module;
let searchCode;
let clearBasePath;

if (!process.env.PAMPA_MOCK_RERANKER_TESTS) {
    process.env.PAMPA_MOCK_RERANKER_TESTS = '1';
}

try {
    sqlite3Module = await import('sqlite3');
    const serviceModule = await import('../../src/service.js');
    searchCode = serviceModule.searchCode;
    clearBasePath = serviceModule.clearBasePath;
} catch (error) {
    if (error.message.includes('sqlite3') || error.message.includes('bindings')) {
        sqliteAvailable = false;
    } else {
        throw error;
    }
}

function parseBoolean(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['on', 'true', '1', 'yes', 'enabled', 'enable'].includes(normalized)) {
        return true;
    }

    if (['off', 'false', '0', 'no', 'disabled', 'disable'].includes(normalized)) {
        return false;
    }

    return undefined;
}

function parseArgs() {
    const argsIndex = process.argv.indexOf('--');
    const args = argsIndex >= 0 ? process.argv.slice(argsIndex + 1) : [];
    const map = new Map();

    for (const arg of args) {
        if (!arg.startsWith('--')) {
            continue;
        }

        const [key, rawValue] = arg.slice(2).split('=');
        map.set(key, rawValue ?? '');
    }

    return map;
}

function resolveScenarios() {
    const DEFAULT_SCENARIOS = [
        {
            key: 'base',
            name: 'Base',
            scope: { hybrid: false, bm25: false, reranker: 'off' }
        },
        {
            key: 'hybrid',
            name: 'Hybrid',
            scope: { reranker: 'off' }
        },
        {
            key: 'hybrid-ce',
            name: 'Hybrid+CE',
            scope: { reranker: 'transformers' }
        }
    ];

    const args = parseArgs();
    const argModes = args.get('modes');
    const envModes = process.env.PAMPA_BENCH_MODES;
    const hybridOverride = parseBoolean(args.get('hybrid') ?? process.env.PAMPA_BENCH_HYBRID);
    const rerankerOverrideRaw = args.get('reranker') ?? process.env.PAMPA_BENCH_RERANKER;
    const bm25Override = parseBoolean(args.get('bm25') ?? process.env.PAMPA_BENCH_BM25);

    const rerankerOverride = rerankerOverrideRaw ? rerankerOverrideRaw.trim().toLowerCase() : undefined;

    if (hybridOverride !== undefined || rerankerOverride || bm25Override !== undefined) {
        const scope = {};
        if (hybridOverride !== undefined) {
            scope.hybrid = hybridOverride;
            if (hybridOverride === false && bm25Override === undefined) {
                scope.bm25 = false;
            }
        }

        if (bm25Override !== undefined) {
            scope.bm25 = bm25Override;
        }

        if (rerankerOverride) {
            scope.reranker = rerankerOverride;
        } else {
            scope.reranker = 'off';
        }

        return [
            {
                key: 'custom',
                name: 'Custom',
                scope
            }
        ];
    }

    const modeSource = argModes || envModes;
    if (modeSource) {
        const requested = modeSource
            .split(',')
            .map(value => value.trim().toLowerCase())
            .filter(Boolean);

        const resolved = [];
        for (const mode of requested) {
            const normalized = mode === 'hybrid+ce' ? 'hybrid-ce' : mode;
            const candidate = DEFAULT_SCENARIOS.find(entry => entry.key === normalized);
            if (candidate) {
                resolved.push(candidate);
            }
        }

        if (resolved.length > 0) {
            return resolved;
        }
    }

    return DEFAULT_SCENARIOS;
}

function buildDescription(chunk) {
    if (!chunk || typeof chunk.description !== 'string') {
        return '';
    }

    if (chunk.description.includes('mockScore:')) {
        return chunk.description;
    }

    if (typeof chunk.mockScore === 'number' && Number.isFinite(chunk.mockScore)) {
        return `${chunk.description} mockScore:${chunk.mockScore}`;
    }

    return chunk.description;
}

function printSummaryTable(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return;
    }

    const header = ['setting', 'P@1', 'MRR@5', 'nDCG@10'];
    const divider = ['---', '---', '---', '---'];

    const format = value => value.toFixed(3);
    const lines = [
        `| ${header.join(' | ')} |`,
        `| ${divider.join(' | ')} |`
    ];

    for (const row of rows) {
        lines.push(
            `| ${row.name} | ${format(row.metrics.pAt1)} | ${format(row.metrics.mrr)} | ${format(row.metrics.ndcg)} |`
        );
    }

    console.log('\nBenchmark results');
    console.log(lines.join('\n'));
    console.log('');
}

async function seedBenchmarkDatabase(sqlite3, dbPath, chunksDir) {
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

    for (const chunk of chunkFixtures) {
        await run(
            `INSERT INTO code_chunks (
                id,
                file_path,
                symbol,
                sha,
                lang,
                chunk_type,
                embedding,
                embedding_provider,
                embedding_dimensions,
                pampa_tags,
                pampa_intent,
                pampa_description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                chunk.id,
                chunk.file_path,
                chunk.symbol,
                chunk.sha,
                chunk.lang,
                'function',
                Buffer.from(JSON.stringify(chunk.embedding)),
                'TestProvider',
                4,
                JSON.stringify(chunk.tags || []),
                chunk.intent || null,
                buildDescription(chunk)
            ]
        );

        const gz = zlib.gzipSync(Buffer.from(chunk.content, 'utf8'));
        await fs.writeFile(path.join(chunksDir, `${chunk.sha}.gz`), gz);
    }

    await promisify(db.close.bind(db))();
}

async function runScenario(tmpDir, scenario) {
    const perQuery = [];

    for (const fixture of queryFixtures) {
        const response = await searchCode(fixture.query, 10, 'auto', tmpDir, {
            ...scenario.scope,
            reranker: scenario.scope.reranker || 'off'
        });

        assert.ok(response && Array.isArray(response.results), 'searchCode should return results');

        const results = response.results;
        const relevance = new Set(fixture.relevant);

        const pAt1 = precisionAt(results, relevance, 1);
        const rr = reciprocalRankAt(results, relevance, 5);
        const ndcg = ndcgAt(results, relevance, 10);

        perQuery.push({
            query: fixture.query,
            pAt1,
            rr,
            ndcg,
            top: results.slice(0, 5).map(result => result.sha)
        });
    }

    return {
        name: scenario.name,
        key: scenario.key,
        perQuery,
        metrics: {
            pAt1: averageMetric(perQuery.map(entry => entry.pAt1)),
            mrr: averageMetric(perQuery.map(entry => entry.rr)),
            ndcg: averageMetric(perQuery.map(entry => entry.ndcg))
        }
    };
}

if (!sqliteAvailable) {
    test('search benchmark harness (skipped)', { skip: 'sqlite3 bindings not available in this environment' }, () => {});
} else {
    const sqlite3 = sqlite3Module.default || sqlite3Module;

    test('synthetic search benchmark metrics', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-bench-'));
        const dbDir = path.join(tmpDir, '.pampa');
        const chunksDir = path.join(dbDir, 'chunks');
        await fs.mkdir(chunksDir, { recursive: true });
        const dbPath = path.join(dbDir, 'pampa.db');

        await seedBenchmarkDatabase(sqlite3, dbPath, chunksDir);

        const providerStub = {
            async generateEmbedding(text) {
                return getQueryVector(text.trim().toLowerCase());
            },
            getDimensions: () => 4,
            getName: () => 'TestProvider'
        };

        __setTestProviderFactory(() => providerStub);

        try {
            const scenarios = resolveScenarios();
            const summaries = [];

            for (const scenario of scenarios) {
                const summary = await runScenario(tmpDir, scenario);
                summaries.push(summary);
            }

            printSummaryTable(summaries);

            const base = summaries.find(entry => entry.key === 'base');
            const hybrid = summaries.find(entry => entry.key === 'hybrid');
            const hybridCe = summaries.find(entry => entry.key === 'hybrid-ce');

            if (base && hybrid) {
                assert.ok(
                    hybrid.metrics.pAt1 > base.metrics.pAt1,
                    'Hybrid search should improve precision@1 over base'
                );
                assert.ok(
                    hybrid.metrics.mrr >= base.metrics.mrr,
                    'Hybrid search should not reduce MRR@5'
                );
            }

            if (hybrid && hybridCe) {
                assert.ok(
                    hybridCe.metrics.pAt1 >= hybrid.metrics.pAt1,
                    'Hybrid+CE should not reduce precision@1'
                );
                assert.ok(
                    hybridCe.metrics.mrr > hybrid.metrics.mrr,
                    'Hybrid+CE should improve MRR@5 by re-ranking top candidates'
                );
            }
        } finally {
            __resetTestProviderFactory();
            clearBasePath();
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });
}
