import { resolveScopeWithPack } from '../../context/packs.js';

export function buildScopeFiltersFromOptions(options = {}, projectPath = '.', sessionPack = null) {
    return resolveScopeWithPack({
        path_glob: options.path_glob,
        tags: options.tags,
        lang: options.lang,
        reranker: options.reranker,
        hybrid: options.hybrid,
        bm25: options.bm25,
        symbol_boost: options.symbol_boost
    }, { basePath: projectPath, sessionPack });
}
