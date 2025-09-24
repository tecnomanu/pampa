import { DEFAULT_PATH_WEIGHT, DEFAULT_SUCCESS_RATE, normalizeChunkMetadata } from './types.js';

function coerceDate(value) {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.valueOf())) {
            return parsed;
        }
    }
    return null;
}

export function touchUsed(chunk, timestamp = new Date()) {
    if (!chunk || typeof chunk !== 'object') {
        return chunk;
    }

    const date = coerceDate(timestamp) || new Date();
    const iso = date.toISOString();

    chunk.last_used_at = iso;
    return chunk;
}

export function bumpSuccess(chunk, ok, alpha = 0.2) {
    if (!chunk || typeof chunk !== 'object') {
        return chunk;
    }

    const smoothing = typeof alpha === 'number' && alpha > 0 && alpha <= 1 ? alpha : 0.2;
    const current = typeof chunk.success_rate === 'number' && Number.isFinite(chunk.success_rate)
        ? Math.min(1, Math.max(0, chunk.success_rate))
        : DEFAULT_SUCCESS_RATE;

    const target = ok ? 1 : 0;
    const next = current + smoothing * (target - current);
    const clamped = Math.min(1, Math.max(0, next));

    chunk.success_rate = clamped;

    if (typeof chunk.path_weight !== 'number' || !Number.isFinite(chunk.path_weight)) {
        chunk.path_weight = DEFAULT_PATH_WEIGHT;
    }

    if (!Array.isArray(chunk.synonyms)) {
        const normalized = normalizeChunkMetadata(chunk);
        chunk.synonyms = normalized.synonyms;
    }

    return chunk;
}
