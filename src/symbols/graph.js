const MAX_NEIGHBORS = 16;

function toLower(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildSymbolIndex(codemap) {
    const index = new Map();
    for (const [chunkId, entry] of Object.entries(codemap)) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }
        const symbol = typeof entry.symbol === 'string' ? entry.symbol.trim() : '';
        if (!symbol) {
            continue;
        }
        const key = symbol.toLowerCase();
        if (!index.has(key)) {
            index.set(key, []);
        }
        index.get(key).push({
            chunkId,
            sha: entry.sha,
            file: entry.file,
            symbol
        });
    }
    return index;
}

function selectCandidate(candidates, entry) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return null;
    }

    if (!entry || !entry.file) {
        return candidates[0];
    }

    const sameFile = candidates.find(candidate => candidate.file === entry.file);
    return sameFile || candidates[0];
}

export function attachSymbolGraphToCodemap(codemap) {
    if (!codemap || typeof codemap !== 'object') {
        return codemap;
    }

    const symbolIndex = buildSymbolIndex(codemap);
    const adjacency = new Map();

    for (const [chunkId, entry] of Object.entries(codemap)) {
        if (!entry || typeof entry !== 'object' || typeof entry.sha !== 'string') {
            continue;
        }

        const outgoing = new Set();
        const rawCalls = Array.isArray(entry.symbol_calls) ? entry.symbol_calls : [];

        for (const rawName of rawCalls) {
            const candidateName = toLower(rawName);
            if (!candidateName) {
                continue;
            }

            const candidates = symbolIndex.get(candidateName);
            if (!candidates || candidates.length === 0) {
                continue;
            }

            const target = selectCandidate(candidates, entry);
            if (target && typeof target.sha === 'string' && target.sha.length > 0 && target.sha !== entry.sha) {
                outgoing.add(target.sha);
            }
        }

        adjacency.set(entry.sha, outgoing);
        entry.symbol_call_targets = Array.from(outgoing).slice(0, MAX_NEIGHBORS);
    }

    const incoming = new Map();
    for (const [fromSha, targets] of adjacency.entries()) {
        for (const targetSha of targets) {
            if (!incoming.has(targetSha)) {
                incoming.set(targetSha, new Set());
            }
            incoming.get(targetSha).add(fromSha);
        }
    }

    for (const entry of Object.values(codemap)) {
        if (!entry || typeof entry.sha !== 'string') {
            continue;
        }

        const outgoing = adjacency.get(entry.sha) || new Set();
        const inbound = incoming.get(entry.sha) || new Set();
        const neighbors = new Set([...outgoing, ...inbound]);

        entry.symbol_call_targets = Array.from(outgoing).slice(0, MAX_NEIGHBORS);
        entry.symbol_callers = Array.from(inbound).slice(0, MAX_NEIGHBORS);
        entry.symbol_neighbors = Array.from(neighbors).slice(0, MAX_NEIGHBORS * 2);
    }

    return codemap;
}
