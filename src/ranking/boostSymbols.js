const SIGNATURE_MATCH_BOOST = 0.3;
const NEIGHBOR_MATCH_BOOST = 0.15;

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildQueryTokenRegex(token) {
    if (!token || token.length < 3) {
        return null;
    }

    const escaped = escapeRegex(token.toLowerCase());
    return new RegExp(`\\b${escaped}[a-z0-9_]*\\b`, 'i');
}

function splitSymbolWords(symbol) {
    if (!symbol) {
        return [];
    }

    const cleaned = symbol.replace(/[^A-Za-z0-9_]/g, ' ');
    return cleaned
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(/[\s_]+/)
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0);
}

function computeSignatureMatchStrength(query, entry) {
    if (!entry) {
        return 0;
    }

    const queryLower = query.toLowerCase();
    const rawSymbol = typeof entry.symbol === 'string' ? entry.symbol : '';
    const symbol = rawSymbol.toLowerCase();
    const signature = typeof entry.symbol_signature === 'string' ? entry.symbol_signature.toLowerCase() : '';

    let weight = 0;
    const matchedTokens = new Set();

    if (symbol && queryLower.includes(symbol)) {
        weight += 4;
    }

    if (signature) {
        const normalizedSignature = signature.replace(/\s+/g, ' ');
        if (queryLower.includes(normalizedSignature)) {
            weight = Math.max(weight, 3.5);
        }
    }

    const symbolTokens = splitSymbolWords(rawSymbol).map(token => token.toLowerCase());
    let symbolTokenMatches = 0;
    for (const token of symbolTokens) {
        if (token.length < 3 || matchedTokens.has(token)) {
            continue;
        }

        const regex = buildQueryTokenRegex(token);
        if (regex && regex.test(query)) {
            matchedTokens.add(token);
            symbolTokenMatches += 1;
        }
    }

    if (symbolTokenMatches > 0) {
        weight += 1 + 0.5 * (symbolTokenMatches - 1);
    }

    let parameterMatches = 0;
    if (Array.isArray(entry.symbol_parameters)) {
        for (const param of entry.symbol_parameters) {
            if (typeof param !== 'string') {
                continue;
            }

            const parts = param
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .map(part => part.trim())
                .filter(part => part.length >= 3);

            for (const part of parts) {
                if (matchedTokens.has(part)) {
                    continue;
                }

                const regex = buildQueryTokenRegex(part);
                if (regex && regex.test(query)) {
                    matchedTokens.add(part);
                    parameterMatches += 1;
                    break;
                }
            }
        }
    }

    if (parameterMatches > 0) {
        weight += 0.35 * parameterMatches;
    }

    if (weight <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(weight / 4, 1));
}

function buildShaIndex(codemap) {
    const index = new Map();
    if (!codemap || typeof codemap !== 'object') {
        return index;
    }

    for (const [chunkId, entry] of Object.entries(codemap)) {
        if (!entry || typeof entry.sha !== 'string') {
            continue;
        }
        index.set(entry.sha, { chunkId, entry });
    }

    return index;
}

export function applySymbolBoost(results, { query, codemap }) {
    if (!Array.isArray(results) || results.length === 0) {
        return;
    }

    if (!codemap || typeof codemap !== 'object') {
        return;
    }

    const shaIndex = buildShaIndex(codemap);

    for (const result of results) {
        const metadata = codemap[result.id];
        if (!metadata) {
            continue;
        }

        let boost = 0;
        const sources = [];

        const matchStrength = computeSignatureMatchStrength(query, metadata);
        if (matchStrength > 0) {
            boost += SIGNATURE_MATCH_BOOST * matchStrength;
            sources.push('signature');
            result.symbolMatchStrength = matchStrength;
        }

        const neighborShas = Array.isArray(metadata.symbol_neighbors)
            ? metadata.symbol_neighbors
            : [];

        let bestNeighborStrength = 0;
        if (neighborShas.length > 0) {
            for (const neighborSha of neighborShas) {
                const neighbor = shaIndex.get(neighborSha);
                if (!neighbor) {
                    continue;
                }

                const neighborStrength = computeSignatureMatchStrength(query, neighbor.entry);
                if (neighborStrength > bestNeighborStrength) {
                    bestNeighborStrength = neighborStrength;
                }
            }
        }

        if (bestNeighborStrength > 0) {
            boost += NEIGHBOR_MATCH_BOOST * bestNeighborStrength;
            sources.push('neighbor');
            result.symbolNeighborStrength = bestNeighborStrength;
        }

        if (boost > 0) {
            const cappedBoost = Math.min(boost, 0.45);
            const baseScore = typeof result.score === 'number' ? result.score : 0;
            result.score = baseScore + cappedBoost;
            result.symbolBoost = cappedBoost;
            result.symbolBoostSources = sources;
        }
    }
}
