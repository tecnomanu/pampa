import fs from 'fs';
import path from 'path';
import xxhashFactory from 'xxhash-wasm';

const MERKLE_DIR = '.pampa';
const MERKLE_FILENAME = 'merkle.json';

let hasherPromise = null;

async function getHasher() {
    if (!hasherPromise) {
        hasherPromise = xxhashFactory().then(factory => factory.h64);
    }
    return hasherPromise;
}

function ensureObject(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }
    return value;
}

export async function computeFastHash(input) {
    const hasher = await getHasher();
    let normalized;
    if (typeof input === 'string') {
        normalized = input;
    } else if (Buffer.isBuffer(input)) {
        normalized = input.toString('utf8');
    } else {
        normalized = String(input ?? '');
    }

    const result = hasher(normalized);
    return typeof result === 'bigint' ? result.toString() : String(result);
}

export function loadMerkle(basePath = '.') {
    const absolute = path.resolve(basePath);
    const merklePath = path.join(absolute, MERKLE_DIR, MERKLE_FILENAME);

    if (!fs.existsSync(merklePath)) {
        return {};
    }

    try {
        const data = fs.readFileSync(merklePath, 'utf8');
        return ensureObject(JSON.parse(data));
    } catch (error) {
        return {};
    }
}

export function saveMerkle(basePath = '.', merkle = {}) {
    const absolute = path.resolve(basePath);
    const dirPath = path.join(absolute, MERKLE_DIR);
    const merklePath = path.join(dirPath, MERKLE_FILENAME);

    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(merklePath, JSON.stringify(merkle, null, 2));
}

export function toPosixPath(relativePath) {
    if (typeof relativePath !== 'string') {
        return null;
    }
    return relativePath.split(path.sep).join('/');
}

export function normalizeToProjectPath(basePath = '.', filePath) {
    if (typeof filePath !== 'string' || filePath.length === 0) {
        return null;
    }

    const absoluteBase = path.resolve(basePath);
    const absoluteFile = path.isAbsolute(filePath) ? filePath : path.join(absoluteBase, filePath);
    const relative = path.relative(absoluteBase, absoluteFile);

    if (!relative || relative.startsWith('..')) {
        return null;
    }

    return toPosixPath(relative);
}

export function removeMerkleEntry(merkle, relativePath) {
    if (!merkle || typeof merkle !== 'object') {
        return false;
    }

    if (Object.prototype.hasOwnProperty.call(merkle, relativePath)) {
        delete merkle[relativePath];
        return true;
    }

    return false;
}

export function cloneMerkle(merkle) {
    return JSON.parse(JSON.stringify(ensureObject(merkle)));
}

