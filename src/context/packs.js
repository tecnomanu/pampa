import fs from 'fs';
import path from 'path';
import { ContextPackSchema, extractScopeFromPackDefinition } from '../types/contextPack.js';
import { normalizeScopeFilters } from '../search/applyScope.js';

const CONTEXT_PACK_DIR = '.pampa/contextpacks';
const ACTIVE_STATE_FILENAME = 'active-pack.json';
const PACK_SCOPE_KEYS = ['path_glob', 'tags', 'lang', 'provider', 'reranker', 'hybrid', 'bm25', 'symbol_boost'];

const packCache = new Map();

function resolveBasePath(basePath = '.') {
    return path.resolve(basePath || '.');
}

function getPackDir(basePath = '.') {
    return path.join(resolveBasePath(basePath), CONTEXT_PACK_DIR);
}

function getStatePath(basePath = '.') {
    return path.join(getPackDir(basePath), ACTIVE_STATE_FILENAME);
}

function ensurePackDir(basePath = '.') {
    const dir = getPackDir(basePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function buildCacheKey(filePath) {
    return path.resolve(filePath);
}

function readJsonFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    try {
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Invalid JSON in context pack ${path.basename(filePath)}: ${error.message}`);
    }
}

function toContextPackObject(key, filePath, data) {
    const parsed = ContextPackSchema.parse(data);
    const scope = extractScopeFromPackDefinition(parsed);
    const packName = typeof parsed.name === 'string' && parsed.name.trim().length > 0
        ? parsed.name.trim()
        : key;

    const description = typeof parsed.description === 'string' && parsed.description.trim().length > 0
        ? parsed.description.trim()
        : undefined;

    const scopeDefinition = {};
    for (const scopeKey of PACK_SCOPE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(scope, scopeKey) && typeof scope[scopeKey] !== 'undefined') {
            scopeDefinition[scopeKey] = scope[scopeKey];
        }
    }

    return {
        key,
        name: packName,
        description,
        scope: scopeDefinition,
        path: filePath
    };
}

export function getContextPackDirectory(basePath = '.') {
    return getPackDir(basePath);
}

export function loadContextPack(name, basePath = '.') {
    if (!name || typeof name !== 'string') {
        throw new Error('Context pack name must be a non-empty string');
    }

    const packDir = getPackDir(basePath);
    const fileName = `${name}.json`;
    const filePath = path.join(packDir, fileName);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Context pack "${name}" not found in ${packDir}`);
    }

    const stats = fs.statSync(filePath);
    const cacheKey = buildCacheKey(filePath);
    const cached = packCache.get(cacheKey);

    if (cached && cached.mtimeMs === stats.mtimeMs) {
        return cached.pack;
    }

    const rawData = readJsonFile(filePath);
    const pack = toContextPackObject(name, filePath, rawData);

    packCache.set(cacheKey, { pack, mtimeMs: stats.mtimeMs });
    return pack;
}

export function listContextPacks(basePath = '.') {
    const packDir = getPackDir(basePath);
    if (!fs.existsSync(packDir)) {
        return [];
    }

    const files = fs.readdirSync(packDir).filter(file => file.endsWith('.json'));
    const packs = [];

    for (const file of files) {
        const key = path.basename(file, '.json');
        try {
            const pack = loadContextPack(key, basePath);
            packs.push(pack);
        } catch (error) {
            // Skip invalid packs but surface a placeholder entry for visibility
            packs.push({
                key,
                name: key,
                description: `Invalid pack: ${error.message}`,
                scope: {},
                path: path.join(packDir, file),
                invalid: true
            });
        }
    }

    return packs;
}

export function getActiveContextPack(basePath = '.') {
    const statePath = getStatePath(basePath);
    if (!fs.existsSync(statePath)) {
        return null;
    }

    try {
        const rawState = readJsonFile(statePath);
        if (!rawState || typeof rawState !== 'object') {
            return null;
        }

        const key = typeof rawState.key === 'string' ? rawState.key : null;
        if (!key) {
            return null;
        }

        const pack = loadContextPack(key, basePath);
        return {
            ...pack,
            appliedAt: rawState.appliedAt || null
        };
    } catch (error) {
        return null;
    }
}

export function setActiveContextPack(name, basePath = '.') {
    const pack = loadContextPack(name, basePath);
    const dir = ensurePackDir(basePath);
    const statePath = path.join(dir, ACTIVE_STATE_FILENAME);
    const state = {
        key: pack.key,
        appliedAt: new Date().toISOString()
    };

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    return pack;
}

export function resolveScopeWithPack(overrides = {}, options = {}) {
    const basePath = options.basePath || '.';
    const sessionPack = options.sessionPack || null;

    let basePack = null;
    const resolvedBasePath = resolveBasePath(basePath);

    if (sessionPack && sessionPack.scope) {
        if (!sessionPack.basePath || resolveBasePath(sessionPack.basePath) === resolvedBasePath) {
            basePack = sessionPack;
        }
    }

    if (!basePack) {
        basePack = getActiveContextPack(basePath);
    }

    const combined = {};

    if (basePack && basePack.scope) {
        for (const key of PACK_SCOPE_KEYS) {
            if (Object.prototype.hasOwnProperty.call(basePack.scope, key)) {
                combined[key] = basePack.scope[key];
            }
        }
    }

    for (const key of PACK_SCOPE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(overrides, key) && typeof overrides[key] !== 'undefined') {
            combined[key] = overrides[key];
        }
    }

    const scope = normalizeScopeFilters(combined);
    const packInfo = basePack
        ? { key: basePack.key, name: basePack.name, description: basePack.description || null }
        : null;

    return { scope, pack: packInfo };
}

export function clearContextPackCache() {
    packCache.clear();
}
