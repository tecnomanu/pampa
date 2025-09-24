#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { __setTestProviderFactory, __resetTestProviderFactory } from '../src/providers.js';

let sqliteAvailable = true;
let serviceModule;

try {
    await import('sqlite3');
    serviceModule = await import('../src/service.js');
} catch (error) {
    if (error.message.includes('sqlite3') || error.message.includes('bindings')) {
        sqliteAvailable = false;
    } else {
        throw error;
    }
}

if (!sqliteAvailable) {
    test('watch and merkle incremental indexing (skipped)', { skip: 'sqlite3 bindings not available in this environment' }, () => {});
} else {
    const { indexProject, clearBasePath } = serviceModule;
    const watchModule = await import('../src/indexer/watch.js');
    const { startWatch } = watchModule;

    function createProviderStub(counterRef) {
        return {
            init: async () => {},
            generateEmbedding: async () => {
                counterRef.count += 1;
                return [counterRef.count, 0, 0];
            },
            getDimensions: () => 3,
            getName: () => 'TestProvider'
        };
    }

    test('merkle store skips unchanged files and watcher batches updates', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pampa-watch-'));
        const srcDir = path.join(tmpDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const fileA = path.join(srcDir, 'alpha.js');
        const fileB = path.join(srcDir, 'beta.js');
        const fileC = path.join(srcDir, 'gamma.js');

        await fs.writeFile(fileA, 'export function alpha() {\n  return 1;\n}\n');
        await fs.writeFile(fileB, 'export function beta() {\n  return 2;\n}\n');
        await fs.writeFile(fileC, 'export function gamma() {\n  return 3;\n}\n');

        const counter = { count: 0 };
        const providerStub = createProviderStub(counter);
        __setTestProviderFactory(() => providerStub);

        try {
            await indexProject({ repoPath: tmpDir, provider: 'auto' });
            const initialCount = counter.count;
            assert.equal(initialCount, 3, 'expected three embeddings during initial index');

            const merklePath = path.join(tmpDir, '.pampa', 'merkle.json');
            const merkleRaw = await fs.readFile(merklePath, 'utf8');
            const merkle = JSON.parse(merkleRaw);
            assert.ok(merkle['src/alpha.js'], 'alpha entry should exist in merkle');

            counter.count = 0;
            await indexProject({ repoPath: tmpDir, provider: 'auto', changedFiles: ['src/alpha.js'] });
            assert.equal(counter.count, 0, 'unchanged file should not trigger re-embedding');

            const merkleBefore = JSON.parse(await fs.readFile(merklePath, 'utf8'));
            const previousBetaHash = merkleBefore['src/beta.js'].shaFile;

            counter.count = 0;
            await fs.writeFile(fileB, 'export function beta() {\n  return 4;\n}\n');
            await indexProject({ repoPath: tmpDir, provider: 'auto', changedFiles: ['src/beta.js'] });
            assert.equal(counter.count, 1, 'only changed file should be re-embedded once');

            const merkleAfter = JSON.parse(await fs.readFile(merklePath, 'utf8'));
            assert.notEqual(merkleAfter['src/beta.js'].shaFile, previousBetaHash, 'beta hash should update');

            await fs.unlink(fileC);
            await indexProject({ repoPath: tmpDir, provider: 'auto', deletedFiles: ['src/gamma.js'] });
            const merklePostDelete = JSON.parse(await fs.readFile(merklePath, 'utf8'));
            assert.ok(!merklePostDelete['src/gamma.js'], 'deleted file should be removed from merkle');

            const codemap = JSON.parse(await fs.readFile(path.join(tmpDir, 'pampa.codemap.json'), 'utf8'));
            const hasGammaChunk = Object.values(codemap).some(entry => entry.file === 'src/gamma.js');
            assert.equal(hasGammaChunk, false, 'deleted file chunks should be removed from codemap');

            counter.count = 0;
            const batches = [];
            const controller = startWatch({
                repoPath: tmpDir,
                provider: 'auto',
                debounceMs: 100,
                onBatch: batch => batches.push(batch)
            });

            await controller.ready;
            await fs.writeFile(fileA, 'export function alpha() {\n  return 42;\n}\n');
            await controller.flush();
            await new Promise(resolve => setTimeout(resolve, 150));

            assert.ok(counter.count > 0, 'watcher should trigger embedding for changed file');
            assert.ok(
                batches.some(batch => batch.changed.includes('src/alpha.js')),
                'watcher batch should include the changed file'
            );

            await controller.close();
        } finally {
            __resetTestProviderFactory();
            clearBasePath();
        }
    });
}
