import { z } from 'zod';
import { RERANKER_OPTIONS } from './search.js';

const stringOrStringArray = z.union([z.string(), z.array(z.string())]);
const booleanLike = z.union([z.boolean(), z.string()]);

export const ContextPackScopeSchema = z.object({
    path_glob: stringOrStringArray.optional(),
    tags: stringOrStringArray.optional(),
    lang: stringOrStringArray.optional(),
    provider: z.string().optional(),
    reranker: z.enum(RERANKER_OPTIONS).optional(),
    hybrid: booleanLike.optional(),
    bm25: booleanLike.optional(),
    symbol_boost: booleanLike.optional()
}).strict();

export const ContextPackSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    scope: ContextPackScopeSchema.optional(),
    path_glob: stringOrStringArray.optional(),
    tags: stringOrStringArray.optional(),
    lang: stringOrStringArray.optional(),
    provider: z.string().optional(),
    reranker: z.enum(RERANKER_OPTIONS).optional(),
    hybrid: booleanLike.optional(),
    bm25: booleanLike.optional(),
    symbol_boost: booleanLike.optional()
}).strict();

export function extractScopeFromPackDefinition(definition) {
    if (!definition || typeof definition !== 'object') {
        return {};
    }

    const scopeCandidate = definition.scope && typeof definition.scope === 'object'
        ? { ...definition.scope }
        : {};

    const scope = { ...scopeCandidate };

    for (const key of ['path_glob', 'tags', 'lang', 'provider', 'reranker', 'hybrid', 'bm25', 'symbol_boost']) {
        if (Object.prototype.hasOwnProperty.call(definition, key) && typeof definition[key] !== 'undefined') {
            scope[key] = definition[key];
        }
    }

    return scope;
}
