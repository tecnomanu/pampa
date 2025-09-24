import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const KEY_ENV_VAR = 'PAMPA_ENCRYPTION_KEY';
const MAGIC_HEADER = Buffer.from('PAMPAE1', 'utf8');
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HKDF_INFO = Buffer.from('pampa-chunk-v1', 'utf8');

let cachedNormalizedKey = null;
let cachedKeyBuffer = null;
let cachedKeyError = null;

function decodeKey(raw) {
    if (typeof raw !== 'string') {
        return null;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return null;
    }

    try {
        const base64 = Buffer.from(trimmed, 'base64');
        if (base64.length === 32) {
            return base64;
        }
    } catch (error) {
        // Ignore decoding errors for base64 attempt
    }

    try {
        const hex = Buffer.from(trimmed, 'hex');
        if (hex.length === 32) {
            return hex;
        }
    } catch (error) {
        // Ignore decoding errors for hex attempt
    }

    return null;
}

export function resetEncryptionCacheForTests() {
    cachedNormalizedKey = null;
    cachedKeyBuffer = null;
    cachedKeyError = null;
}

export function getActiveEncryptionKey() {
    const raw = process.env[KEY_ENV_VAR];
    const normalized = typeof raw === 'string' ? raw.trim() : '';

    if (normalized === cachedNormalizedKey) {
        return cachedKeyBuffer;
    }

    cachedNormalizedKey = normalized;
    cachedKeyError = null;

    if (!normalized) {
        cachedKeyBuffer = null;
        return null;
    }

    const decoded = decodeKey(normalized);
    if (!decoded) {
        cachedKeyBuffer = null;
        cachedKeyError = new Error(`${KEY_ENV_VAR} must be a 32-byte key encoded as base64 or hex.`);
        return null;
    }

    cachedKeyBuffer = decoded;
    return cachedKeyBuffer;
}

export function getEncryptionKeyError() {
    return cachedKeyError;
}

const warnedInvalidMode = new Set();
let warnedInvalidKey = false;

function normalizeMode(mode) {
    if (typeof mode !== 'string') {
        return undefined;
    }
    return mode.trim().toLowerCase();
}

export function resolveEncryptionPreference({ mode, logger = console } = {}) {
    const normalizedMode = normalizeMode(mode);

    if (normalizedMode && normalizedMode !== 'on' && normalizedMode !== 'off' && !warnedInvalidMode.has(normalizedMode)) {
        if (logger && typeof logger.warn === 'function') {
            logger.warn(`Unknown --encrypt mode "${mode}". Expected "on" or "off". Falling back to environment configuration.`);
        }
        warnedInvalidMode.add(normalizedMode);
    }

    if (normalizedMode === 'off') {
        return { enabled: false, key: null, reason: 'flag_off' };
    }

    const key = getActiveEncryptionKey();
    if (!key) {
        const keyError = getEncryptionKeyError();
        if (normalizedMode === 'on') {
            throw keyError || new Error('PAMPA_ENCRYPTION_KEY is not configured but encryption was requested (--encrypt on).');
        }
        if (keyError && !warnedInvalidKey && logger && typeof logger.warn === 'function') {
            logger.warn(`${keyError.message} Encryption disabled.`);
            warnedInvalidKey = true;
        }
        return { enabled: false, key: null, reason: keyError ? 'invalid_key' : 'missing_key' };
    }

    return { enabled: true, key, reason: 'enabled' };
}

function deriveChunkKey(masterKey, salt) {
    return crypto.hkdfSync('sha256', masterKey, salt, HKDF_INFO, 32);
}

function encryptBuffer(plaintext, masterKey) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const derivedKey = deriveChunkKey(masterKey, salt);

    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = Buffer.concat([MAGIC_HEADER, salt, iv, encrypted, tag]);
    return { payload, salt, iv, tag };
}

function decryptBuffer(payload, masterKey) {
    const minimumLength = MAGIC_HEADER.length + SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;
    if (!payload || payload.length < minimumLength) {
        const error = new Error('Encrypted chunk payload is truncated.');
        error.code = 'ENCRYPTION_PAYLOAD_INVALID';
        throw error;
    }

    const header = payload.subarray(0, MAGIC_HEADER.length);
    if (!header.equals(MAGIC_HEADER)) {
        const error = new Error('Encrypted chunk payload has an unknown header.');
        error.code = 'ENCRYPTION_FORMAT_UNRECOGNIZED';
        throw error;
    }

    const saltStart = MAGIC_HEADER.length;
    const ivStart = saltStart + SALT_LENGTH;
    const cipherStart = ivStart + IV_LENGTH;
    const cipherEnd = payload.length - TAG_LENGTH;

    const salt = payload.subarray(saltStart, saltStart + SALT_LENGTH);
    const iv = payload.subarray(ivStart, ivStart + IV_LENGTH);
    const ciphertext = payload.subarray(cipherStart, cipherEnd);
    const tag = payload.subarray(cipherEnd);

    const derivedKey = deriveChunkKey(masterKey, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(tag);

    try {
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (error) {
        const authError = new Error('authentication failed');
        authError.code = 'ENCRYPTION_AUTH_FAILED';
        authError.cause = error;
        throw authError;
    }
}

function getChunkPaths(chunkDir, sha) {
    const plainPath = path.join(chunkDir, `${sha}.gz`);
    const encryptedPath = path.join(chunkDir, `${sha}.gz.enc`);
    return { plainPath, encryptedPath };
}

export function writeChunkToDisk({ chunkDir, sha, code, encryption }) {
    const { plainPath, encryptedPath } = getChunkPaths(chunkDir, sha);
    const buffer = Buffer.isBuffer(code) ? code : Buffer.from(code, 'utf8');
    const compressed = zlib.gzipSync(buffer);

    if (encryption && encryption.enabled && encryption.key) {
        const { payload } = encryptBuffer(compressed, encryption.key);
        fs.writeFileSync(encryptedPath, payload);
        if (fs.existsSync(plainPath)) {
            fs.rmSync(plainPath, { force: true });
        }
        return { encrypted: true, path: encryptedPath };
    }

    fs.writeFileSync(plainPath, compressed);
    if (fs.existsSync(encryptedPath)) {
        fs.rmSync(encryptedPath, { force: true });
    }
    return { encrypted: false, path: plainPath };
}

export function readChunkFromDisk({ chunkDir, sha, key = getActiveEncryptionKey() }) {
    const { plainPath, encryptedPath } = getChunkPaths(chunkDir, sha);

    if (fs.existsSync(encryptedPath)) {
        if (!key) {
            const error = new Error(`Chunk ${sha} is encrypted and no PAMPA_ENCRYPTION_KEY is configured.`);
            error.code = 'ENCRYPTION_KEY_REQUIRED';
            throw error;
        }

        const payload = fs.readFileSync(encryptedPath);
        let decrypted;
        try {
            decrypted = decryptBuffer(payload, key);
        } catch (error) {
            if (error.code === 'ENCRYPTION_AUTH_FAILED') {
                const authError = new Error(`Failed to decrypt chunk ${sha}: authentication failed.`);
                authError.code = 'ENCRYPTION_AUTH_FAILED';
                authError.cause = error;
                throw authError;
            }
            error.message = `Failed to decrypt chunk ${sha}: ${error.message}`;
            throw error;
        }

        try {
            const code = zlib.gunzipSync(decrypted).toString('utf8');
            return { code, encrypted: true };
        } catch (error) {
            const decompressionError = new Error(`Failed to decompress chunk ${sha}: ${error.message}`);
            decompressionError.code = 'CHUNK_DECOMPRESSION_FAILED';
            decompressionError.cause = error;
            throw decompressionError;
        }
    }

    if (fs.existsSync(plainPath)) {
        try {
            const compressed = fs.readFileSync(plainPath);
            const code = zlib.gunzipSync(compressed).toString('utf8');
            return { code, encrypted: false };
        } catch (error) {
            const readError = new Error(`Failed to read chunk ${sha}: ${error.message}`);
            readError.code = 'CHUNK_READ_FAILED';
            readError.cause = error;
            throw readError;
        }
    }

    return null;
}

export function removeChunkArtifacts(chunkDir, sha) {
    const { plainPath, encryptedPath } = getChunkPaths(chunkDir, sha);
    if (fs.existsSync(plainPath)) {
        fs.rmSync(plainPath, { force: true });
    }
    if (fs.existsSync(encryptedPath)) {
        fs.rmSync(encryptedPath, { force: true });
    }
}

export function isChunkEncryptedOnDisk(chunkDir, sha) {
    const { encryptedPath } = getChunkPaths(chunkDir, sha);
    return fs.existsSync(encryptedPath);
}
