#!/usr/bin/env node
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { __setTestProviderFactory, __resetTestProviderFactory } from '../src/providers.js';

let sqliteAvailable = true;
let sqlite3Module;
let indexProject;
let searchCode;
let clearBasePath;

try {
    sqlite3Module = await import('sqlite3');
    const serviceModule = await import('../src/service.js');
    indexProject = serviceModule.indexProject;
    searchCode = serviceModule.searchCode;
    clearBasePath = serviceModule.clearBasePath;
} catch (error) {
    if (error.message.includes('sqlite3') || error.message.includes('bindings')) {
        sqliteAvailable = false;
    } else {
        throw error;
    }
}

function embeddingForText(text) {
    const lower = String(text || '').toLowerCase();
    if (lower.includes('where is token validated')) {
        return [0.8, 0.2];
    }
    if (lower.includes('sanitizetoken')) {
        return [0.6, 0.4];
    }
    if (lower.includes('validatetoken')) {
        return [0.4, 0.6];
    }
    if (lower.includes('checksignature')) {
        return [0.35, 0.65];
    }
    if (lower.includes('issuetoken')) {
        return [0.45, 0.55];
    }
    return [0.5, 0.5];
}

if (!sqliteAvailable) {
    test('symbol boost ranking (skipped)', { skip: 'sqlite3 bindings not available in this environment' }, () => {});
} else {
    const sqlite3 = sqlite3Module.default || sqlite3Module;

    test('symbol-aware boost promotes direct matches and graph neighbors', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-symbol-'));
        const srcDir = path.join(tmpDir, 'src', 'auth');
        await fs.mkdir(srcDir, { recursive: true });

        const tsFile = [
            'export function sanitizeToken(token: string) {',
            '  return token.trim();',
            '}',
            '',
            'export function checkSignature(token: string) {',
            "  return token.startsWith('valid:');",
            '}',
            '',
            'export function validateToken(token: string) {',
            '  const sanitized = sanitizeToken(token);',
            '  return sanitized.length > 0 && checkSignature(sanitized);',
            '}',
            '',
            'export function issueToken(payload: Record<string, unknown>) {',
            "  return JSON.stringify({ token: `valid:${payload.id}` });",
            '}'
        ].join('\n');

        const phpFile = [
            '<?php',
            'function issueToken($payload) {',
            '    return json_encode($payload);',
            '}',
            '',
            'class TokenMiddleware {',
            '    public function handle($request) {',
            "        $token = $request->header('X-Token');",
            '        return validateToken($token);',
            '    }',
            '}',
            ''
        ].join('\n');

        await fs.writeFile(path.join(srcDir, 'token.ts'), tsFile, 'utf8');
        await fs.writeFile(path.join(srcDir, 'TokenMiddleware.php'), phpFile, 'utf8');

        const providerStub = {
            init: async () => {},
            generateEmbedding: mock.fn(async text => embeddingForText(text)),
            getDimensions: () => 2,
            getName: () => 'TestProvider'
        };

        __setTestProviderFactory(() => providerStub);
        clearBasePath();

        try {
            await indexProject({ repoPath: tmpDir, provider: 'auto' });

            const codemapPath = path.join(tmpDir, 'pampa.codemap.json');
            const codemapRaw = JSON.parse(await fs.readFile(codemapPath, 'utf8'));
            const codemapValues = Object.values(codemapRaw);

            const validateEntry = codemapValues.find(entry => entry && entry.symbol === 'validateToken');
            assert.ok(validateEntry, 'validateToken entry should exist');
            assert.ok(typeof validateEntry.symbol_signature === 'string' && validateEntry.symbol_signature.includes('validateToken'));
            assert.ok(Array.isArray(validateEntry.symbol_call_targets) && validateEntry.symbol_call_targets.length >= 1);

            const checkEntry = codemapValues.find(entry => entry && entry.symbol === 'checkSignature');
            assert.ok(checkEntry, 'checkSignature entry should exist');
            assert.ok(Array.isArray(checkEntry.symbol_callers) && checkEntry.symbol_callers.includes(validateEntry.sha));

            const query = 'where is token validated';
            const boosted = await searchCode(query, 3, 'auto', tmpDir, { reranker: 'off' });
            const disabled = await searchCode(query, 3, 'auto', tmpDir, { reranker: 'off', symbol_boost: false });

            assert.equal(boosted.success, true);
            assert.equal(boosted.results[0].meta.symbol, 'validateToken');
            assert.ok(boosted.symbolBoost && boosted.symbolBoost.enabled);
            assert.ok(boosted.symbolBoost.boosted, 'symbol boost should have triggered');
            assert.ok(boosted.results[0].meta.symbolBoost > 0);
            assert.ok(Array.isArray(boosted.results[0].meta.symbolBoostSources) && boosted.results[0].meta.symbolBoostSources.includes('signature'));

            assert.equal(disabled.success, true);
            assert.equal(disabled.symbolBoost.enabled, false);
            assert.equal(disabled.results[0].meta.symbol, 'sanitizeToken');
        } finally {
            __resetTestProviderFactory();
            clearBasePath();
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });
}
