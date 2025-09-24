import path from 'path';
import { indexProject } from '../service.js';
import { normalizeToProjectPath } from './merkle.js';

function normalizeList(basePath, values = []) {
    const normalized = new Set();

    if (!Array.isArray(values)) {
        return [];
    }

    for (const value of values) {
        const relative = normalizeToProjectPath(basePath, value);
        if (relative) {
            normalized.add(relative);
        }
    }

    return Array.from(normalized);
}

export async function updateIndex({
    repoPath = '.',
    provider = 'auto',
    changedFiles = [],
    deletedFiles = [],
    onProgress = null,
    embeddingProvider = null,
    encrypt = undefined
} = {}) {
    const root = path.resolve(repoPath);
    const normalizedChanged = normalizeList(root, changedFiles);
    const normalizedDeleted = normalizeList(root, deletedFiles);

    if (normalizedChanged.length === 0 && normalizedDeleted.length === 0) {
        return {
            success: true,
            processedChunks: 0,
            totalChunks: 0,
            provider,
            errors: []
        };
    }

    return indexProject({
        repoPath: root,
        provider,
        onProgress,
        changedFiles: normalizedChanged,
        deletedFiles: normalizedDeleted,
        embeddingProviderOverride: embeddingProvider,
        encryptMode: encrypt
    });
}
