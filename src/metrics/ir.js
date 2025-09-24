export function normalizeRelevance(relevance) {
    if (!relevance) {
        return new Map();
    }

    if (relevance instanceof Map) {
        return relevance;
    }

    if (relevance instanceof Set) {
        const map = new Map();
        for (const value of relevance) {
            map.set(value, 1);
        }
        return map;
    }

    if (Array.isArray(relevance)) {
        const map = new Map();
        for (const value of relevance) {
            if (value && typeof value === 'object' && 'sha' in value) {
                const sha = value.sha;
                const gain = typeof value.gain === 'number' ? value.gain : 1;
                map.set(sha, gain);
            } else if (typeof value === 'string') {
                map.set(value, 1);
            }
        }
        return map;
    }

    if (typeof relevance === 'object') {
        const map = new Map();
        for (const [key, value] of Object.entries(relevance)) {
            if (typeof value === 'number') {
                map.set(key, value);
            } else if (value) {
                map.set(key, 1);
            }
        }
        return map;
    }

    return new Map();
}

export function precisionAt(results, relevance, k = 1) {
    if (!Array.isArray(results) || results.length === 0 || k <= 0) {
        return 0;
    }

    const relevanceMap = normalizeRelevance(relevance);
    if (relevanceMap.size === 0) {
        return 0;
    }

    const topK = results.slice(0, k);
    const relevantHits = topK.filter(result => relevanceMap.has(result.sha)).length;
    return relevantHits / k;
}

export function reciprocalRankAt(results, relevance, k = 10) {
    if (!Array.isArray(results) || results.length === 0 || k <= 0) {
        return 0;
    }

    const relevanceMap = normalizeRelevance(relevance);
    if (relevanceMap.size === 0) {
        return 0;
    }

    const topK = results.slice(0, k);
    for (let index = 0; index < topK.length; index++) {
        const candidate = topK[index];
        if (relevanceMap.has(candidate.sha)) {
            return 1 / (index + 1);
        }
    }

    return 0;
}

function computeDcg(results, relevanceMap, k) {
    let dcg = 0;

    for (let index = 0; index < Math.min(k, results.length); index++) {
        const candidate = results[index];
        const gain = relevanceMap.get(candidate.sha) || 0;
        if (gain <= 0) {
            continue;
        }

        const denominator = Math.log2(index + 2);
        dcg += (Math.pow(2, gain) - 1) / denominator;
    }

    return dcg;
}

export function ndcgAt(results, relevance, k = 10) {
    if (!Array.isArray(results) || results.length === 0 || k <= 0) {
        return 0;
    }

    const relevanceMap = normalizeRelevance(relevance);
    if (relevanceMap.size === 0) {
        return 0;
    }

    const dcg = computeDcg(results, relevanceMap, k);
    if (dcg === 0) {
        return 0;
    }

    const idealGains = Array.from(relevanceMap.values())
        .filter(value => value > 0)
        .sort((a, b) => b - a);

    const idealResults = idealGains.map((gain, index) => ({ sha: `ideal-${index}`, gain }));
    const idealMap = new Map(idealResults.map(item => [item.sha, item.gain]));
    const idealDcg = computeDcg(
        idealResults,
        idealMap,
        Math.min(k, idealResults.length)
    );

    if (idealDcg === 0) {
        return 0;
    }

    return dcg / idealDcg;
}

export function averageMetric(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return 0;
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
}
