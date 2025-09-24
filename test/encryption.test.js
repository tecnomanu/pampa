#!/usr/bin/env node
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { __setTestProviderFactory, __resetTestProviderFactory } from '../src/providers.js';
import { readCodemap } from '../src/codemap/io.js';
import { resetEncryptionCacheForTests } from '../src/storage/encryptedChunks.js';

let sqliteAvailable = true;
let sqlite3Module;
let serviceModule;

try {
    sqlite3Module = await import('sqlite3');
    serviceModule = await import('../src/service.js');
} catch (error) {
    if (error.message && (error.message.includes('sqlite3') || error.message.includes('bindings'))) {
        sqliteAvailable = false;
    } else {
        throw error;
    }
}

if (!sqliteAvailable) {
    test('chunk encryption (skipped)', { skip: 'sqlite3 bindings not available in this environment' }, () => {});
} else {
    const { indexProject, getChunk, clearBasePath } = serviceModule;

    async function createRepoWithFile(contents) {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-encryption-'));
        const repoDir = path.join(tmpDir, 'repo');
        await fs.mkdir(repoDir, { recursive: true });
        const srcDir = path.join(repoDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });
        const filePath = path.join(srcDir, 'token.ts');
        await fs.writeFile(filePath, contents, 'utf8');
        return { repoDir, filePath };
    }

    function createProviderStub() {
        return {
            init: mock.fn(async () => {}),
            generateEmbedding: mock.fn(async () => [0.1, 0.2, 0.3, 0.4]),
            getName: () => 'TestProvider',
            getDimensions: () => 4
        };
    }

    test('writes encrypted chunks when encryption is enabled', async () => {
        const originalKey = process.env.PAMPA_ENCRYPTION_KEY;
        const testKey = Buffer.alloc(32, 7).toString('base64');
        process.env.PAMPA_ENCRYPTION_KEY = testKey;
        resetEncryptionCacheForTests();

        const providerStub = createProviderStub();
        __setTestProviderFactory(() => providerStub);

        const { repoDir } = await createRepoWithFile([
            'export function validateToken(token: string) {',
            "  return token && token.length > 10 ? 'valid' : 'invalid';",
            '}'
        ].join('\n'));

        try {
            await indexProject({ repoPath: repoDir, provider: 'auto', encryptMode: 'on' });

            const codemapPath = path.join(repoDir, 'pampa.codemap.json');
            const codemap = readCodemap(codemapPath);
            const entries = Object.entries(codemap);
            assert.ok(entries.length > 0, 'codemap should contain chunks');
            const [, metadata] = entries[0];
            assert.equal(metadata.encrypted, true, 'chunk metadata should be marked as encrypted');

            const chunkDir = path.join(repoDir, '.pampa', 'chunks');
            const encryptedPath = path.join(chunkDir, `${metadata.sha}.gz.enc`);
            const plainPath = path.join(chunkDir, `${metadata.sha}.gz`);
            assert.equal(fssync.existsSync(encryptedPath), true, 'encrypted chunk should be stored');
            assert.equal(fssync.existsSync(plainPath), false, 'plaintext chunk should be removed when encrypted');

            const chunk = await getChunk(metadata.sha, repoDir);
            assert.equal(chunk.success, true);
            assert.match(chunk.code, /validateToken/);

            delete process.env.PAMPA_ENCRYPTION_KEY;
            resetEncryptionCacheForTests();
            const missingKeyResult = await getChunk(metadata.sha, repoDir);
            assert.equal(missingKeyResult.success, false);
            assert.match(missingKeyResult.error, /encrypted/i);

            process.env.PAMPA_ENCRYPTION_KEY = testKey;
            resetEncryptionCacheForTests();

            const encryptedData = await fs.readFile(encryptedPath);
            const corrupted = Buffer.from(encryptedData);
            corrupted[corrupted.length - 1] ^= 0xff;
            await fs.writeFile(encryptedPath, corrupted);

            const tampered = await getChunk(metadata.sha, repoDir);
            assert.equal(tampered.success, false);
            assert.match(tampered.error, /authentication failed/i);
        } finally {
            if (originalKey === undefined) {
                delete process.env.PAMPA_ENCRYPTION_KEY;
            } else {
                process.env.PAMPA_ENCRYPTION_KEY = originalKey;
            }
            resetEncryptionCacheForTests();
            __resetTestProviderFactory();
            clearBasePath();
        }
    });

    test('plaintext chunks remain readable without encryption key', async () => {
        const originalKey = process.env.PAMPA_ENCRYPTION_KEY;
        delete process.env.PAMPA_ENCRYPTION_KEY;
        resetEncryptionCacheForTests();

        const providerStub = createProviderStub();
        __setTestProviderFactory(() => providerStub);

        const { repoDir } = await createRepoWithFile([
            'export function sum(a: number, b: number) {',
            '  return a + b;',
            '}'
        ].join('\n'));

        try {
            await indexProject({ repoPath: repoDir, provider: 'auto', encryptMode: 'off' });

            const codemapPath = path.join(repoDir, 'pampa.codemap.json');
            const codemap = readCodemap(codemapPath);
            const entries = Object.entries(codemap);
            assert.ok(entries.length > 0, 'codemap should contain chunks');
            const [, metadata] = entries[0];
            assert.equal(metadata.encrypted, false, 'chunk metadata should remain plaintext');

            const chunkDir = path.join(repoDir, '.pampa', 'chunks');
            const plainPath = path.join(chunkDir, `${metadata.sha}.gz`);
            const encryptedPath = path.join(chunkDir, `${metadata.sha}.gz.enc`);
            assert.equal(fssync.existsSync(plainPath), true, 'plaintext chunk should be stored');
            assert.equal(fssync.existsSync(encryptedPath), false, 'no encrypted file should be written');

            const chunk = await getChunk(metadata.sha, repoDir);
            assert.equal(chunk.success, true);
            assert.match(chunk.code, /sum/);
        } finally {
            if (originalKey === undefined) {
                delete process.env.PAMPA_ENCRYPTION_KEY;
            } else {
                process.env.PAMPA_ENCRYPTION_KEY = originalKey;
            }
            resetEncryptionCacheForTests();
            __resetTestProviderFactory();
            clearBasePath();
        }
    });
}
