export const RERANKER_OPTIONS = ['off', 'transformers'];
export const DEFAULT_RERANKER = 'off';

export function hasScopeFilters(scope = {}) {
    if (!scope) {
        return false;
    }

    return Boolean(
        (Array.isArray(scope.path_glob) && scope.path_glob.length > 0) ||
        (Array.isArray(scope.tags) && scope.tags.length > 0) ||
        (Array.isArray(scope.lang) && scope.lang.length > 0)
    );
}
