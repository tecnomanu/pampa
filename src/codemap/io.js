import fs from 'fs';
import path from 'path';
import { normalizeCodemapRecord } from './types.js';

export function resolveCodemapPath(basePath = '.') {
    return path.resolve(basePath, 'pampa.codemap.json');
}

export function readCodemap(filePath) {
    const resolvedPath = filePath ? path.resolve(filePath) : resolveCodemapPath('.');

    if (!fs.existsSync(resolvedPath)) {
        return {};
    }

    try {
        const raw = fs.readFileSync(resolvedPath, 'utf8');
        const parsed = JSON.parse(raw);
        return normalizeCodemapRecord(parsed);
    } catch (error) {
        console.warn(`Failed to read codemap at ${resolvedPath}:`, error.message);
        return {};
    }
}

export function writeCodemap(filePath, codemap) {
    const resolvedPath = filePath ? path.resolve(filePath) : resolveCodemapPath('.');
    const normalized = normalizeCodemapRecord(codemap || {});

    const directory = path.dirname(resolvedPath);
    fs.mkdirSync(directory, { recursive: true });

    fs.writeFileSync(resolvedPath, JSON.stringify(normalized, null, 2));
    return normalized;
}
