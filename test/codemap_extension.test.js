import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import { readCodemap, writeCodemap } from '../src/codemap/io.js';
import { bumpSuccess, touchUsed } from '../src/codemap/telemetry.js';
import { DEFAULT_PATH_WEIGHT, DEFAULT_SUCCESS_RATE, normalizeChunkMetadata } from '../src/codemap/types.js';

test('legacy codemap loads with telemetry defaults', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pampa-codemap-'));
    const codemapPath = path.join(tmpDir, 'pampa.codemap.json');

    const legacyCodemap = {
        'chunk-1': {
            file: 'src/foo.js',
            symbol: 'foo',
            sha: 'abc123',
            lang: 'javascript',
            chunkType: 'function',
            provider: 'transformers',
            dimensions: 768,
            hasPampaTags: false,
            hasIntent: false,
            hasDocumentation: false,
            variableCount: 2
        }
    };

    fs.writeFileSync(codemapPath, JSON.stringify(legacyCodemap, null, 2));

    const codemap = readCodemap(codemapPath);
    const chunk = codemap['chunk-1'];

    assert.equal(chunk.file, 'src/foo.js');
    assert.equal(chunk.symbol, 'foo');
    assert.equal(chunk.lang, 'javascript');
    assert.equal(chunk.path_weight, DEFAULT_PATH_WEIGHT);
    assert.equal(chunk.success_rate, DEFAULT_SUCCESS_RATE);
    assert.deepEqual(chunk.synonyms, []);
    assert.equal(chunk.last_used_at, undefined);
    assert.equal(chunk.encrypted, false);

    const normalized = writeCodemap(codemapPath, codemap);
    const persisted = JSON.parse(fs.readFileSync(codemapPath, 'utf8'));

    assert.deepEqual(normalized, readCodemap(codemapPath));
    assert.deepEqual(persisted['chunk-1'].synonyms, []);
    assert.equal(persisted['chunk-1'].path_weight, DEFAULT_PATH_WEIGHT);
    assert.equal(persisted['chunk-1'].success_rate, DEFAULT_SUCCESS_RATE);
});

test('success telemetry tracks usage and confidence', () => {
    const chunk = normalizeChunkMetadata({
        file: 'src/example.ts',
        sha: 'def456',
        lang: 'typescript'
    });

    assert.equal(chunk.success_rate, DEFAULT_SUCCESS_RATE);
    assert.equal(chunk.path_weight, DEFAULT_PATH_WEIGHT);
    assert.equal(chunk.encrypted, false);

    bumpSuccess(chunk, true, 0.5);
    const afterFirst = chunk.success_rate;
    assert.ok(afterFirst > 0 && afterFirst < 1);

    bumpSuccess(chunk, true, 0.5);
    assert.ok(chunk.success_rate > afterFirst);

    for (let i = 0; i < 5; i += 1) {
        bumpSuccess(chunk, true);
    }
    assert.ok(chunk.success_rate > 0.6, 'EMA should trend upward with repeated success');

    const beforeFailures = chunk.success_rate;
    for (let i = 0; i < 6; i += 1) {
        bumpSuccess(chunk, false);
    }
    assert.ok(chunk.success_rate < beforeFailures, 'EMA should decrease after failures');
    assert.ok(chunk.success_rate >= 0 && chunk.success_rate <= 1);

    touchUsed(chunk, '2024-01-01T00:00:00Z');
    assert.equal(chunk.last_used_at, '2024-01-01T00:00:00.000Z');

    touchUsed(chunk, new Date('2024-02-01T12:34:56Z'));
    assert.equal(chunk.last_used_at, '2024-02-01T12:34:56.000Z');
});
