const DEFAULT_MODEL_ID = process.env.PAMPA_RERANKER_MODEL || 'Xenova/ms-marco-MiniLM-L-6-v2';
const DEFAULT_MAX_CANDIDATES = Number.parseInt(process.env.PAMPA_RERANKER_MAX || '50', 10);

let pipelineFactory = null;
let modelPromise = null;
let loadFailed = false;
let testRerankOverride = null;
let testForceLoadFailure = false;

function shouldMock() {
    return process.env.PAMPA_MOCK_RERANKER_TESTS === '1';
}

function getDefaultMaxCandidates() {
    if (Number.isFinite(DEFAULT_MAX_CANDIDATES) && DEFAULT_MAX_CANDIDATES > 0) {
        return DEFAULT_MAX_CANDIDATES;
    }

    return 50;
}

function extractScoreHint(candidate, options) {
    if (options && typeof options.getScoreHint === 'function') {
        try {
            const hintedScore = options.getScoreHint(candidate);
            if (typeof hintedScore === 'number' && Number.isFinite(hintedScore)) {
                return hintedScore;
            }
        } catch (error) {
            // ignore score hint errors during mock scoring
        }
    }

    if (typeof candidate.mockScore === 'number' && Number.isFinite(candidate.mockScore)) {
        return candidate.mockScore;
    }

    if (typeof candidate.score === 'number' && Number.isFinite(candidate.score)) {
        return candidate.score;
    }

    return 0;
}

function extractScoreFromOutput(output) {
    if (!output) {
        return 0;
    }

    if (Array.isArray(output)) {
        if (output.length === 0) {
            return 0;
        }

        if (typeof output[0] === 'number') {
            return output[0];
        }

        if (output[0] && typeof output[0].score === 'number') {
            return output[0].score;
        }
    }

    if (typeof output === 'object' && typeof output.score === 'number') {
        return output.score;
    }

    if (typeof output === 'number' && Number.isFinite(output)) {
        return output;
    }

    return 0;
}

async function loadPipelineFactory() {
    if (pipelineFactory || shouldMock() || loadFailed || testForceLoadFailure) {
        return pipelineFactory;
    }

    try {
        const module = await import('@xenova/transformers');
        if (typeof module.pipeline === 'function') {
            pipelineFactory = module.pipeline;
        } else if (module.default && typeof module.default.pipeline === 'function') {
            pipelineFactory = module.default.pipeline;
        }
    } catch (error) {
        loadFailed = true;
        return null;
    }

    return pipelineFactory;
}

async function getModel() {
    if (shouldMock()) {
        return null;
    }

    if (loadFailed || testForceLoadFailure) {
        return null;
    }

    const pipeline = await loadPipelineFactory();
    if (!pipeline) {
        loadFailed = true;
        return null;
    }

    if (!modelPromise) {
        modelPromise = pipeline('text-classification', DEFAULT_MODEL_ID, {
            quantized: true
        }).catch(error => {
            loadFailed = true;
            modelPromise = null;
            throw error;
        });
    }

    try {
        return await modelPromise;
    } catch (error) {
        loadFailed = true;
        return null;
    }
}

function coerceMaxCandidates(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }

    return getDefaultMaxCandidates();
}

function buildCandidateText(candidate, options) {
    if (!candidate) {
        return '';
    }

    if (typeof candidate.text === 'string') {
        return candidate.text;
    }

    if (options && typeof options.getText === 'function') {
        try {
            const text = options.getText(candidate);
            return typeof text === 'string' ? text : '';
        } catch (error) {
            return '';
        }
    }

    return '';
}

function setCandidateRanks(sortedCandidates) {
    sortedCandidates.forEach((entry, index) => {
        entry.candidate.rerankerScore = entry.score;
        entry.candidate.rerankerRank = index + 1;
    });
}

export async function rerankCrossEncoder(query, candidates, options = {}) {
    if (!Array.isArray(candidates) || candidates.length <= 1) {
        return candidates;
    }

    if (typeof testRerankOverride === 'function') {
        try {
            const overridden = await testRerankOverride(query, candidates, options);
            if (Array.isArray(overridden)) {
                return overridden;
            }
        } catch (error) {
            return candidates;
        }
    }

    const maxCandidates = Math.min(coerceMaxCandidates(options.max), candidates.length);
    if (maxCandidates <= 1) {
        return candidates;
    }

    const topCandidates = candidates.slice(0, maxCandidates);

    if (shouldMock()) {
        const scored = topCandidates
            .map(candidate => ({
                candidate,
                score: extractScoreHint(candidate, options)
            }))
            .sort((a, b) => b.score - a.score);

        setCandidateRanks(scored);
        const rerankedTop = scored.map(entry => entry.candidate);
        const remainder = candidates.slice(maxCandidates);
        return [...rerankedTop, ...remainder];
    }

    const model = await getModel();
    if (!model) {
        return candidates;
    }

    let texts;
    try {
        const resolvedTexts = await Promise.all(
            topCandidates.map(async candidate => {
                const text = options && typeof options.getTextAsync === 'function'
                    ? await options.getTextAsync(candidate)
                    : buildCandidateText(candidate, options);
                return typeof text === 'string' ? text : '';
            })
        );
        texts = resolvedTexts;
    } catch (error) {
        return candidates;
    }

    try {
        const inputs = texts.map(text => ({ text: query, text_pair: text }));
        const outputs = await model(inputs);

        const scored = topCandidates
            .map((candidate, index) => ({
                candidate,
                score: extractScoreFromOutput(outputs[index])
            }))
            .sort((a, b) => b.score - a.score);

        setCandidateRanks(scored);
        const rerankedTop = scored.map(entry => entry.candidate);
        const remainder = candidates.slice(maxCandidates);
        return [...rerankedTop, ...remainder];
    } catch (error) {
        return candidates;
    }
}

export function __resetForTests() {
    pipelineFactory = null;
    modelPromise = null;
    loadFailed = false;
    testRerankOverride = null;
    testForceLoadFailure = false;
}

export function __setTestRerankOverride(override) {
    testRerankOverride = typeof override === 'function' ? override : null;
}

export function __setTestForceLoadFailure(force) {
    testForceLoadFailure = Boolean(force);
}

