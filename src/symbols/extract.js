const KEYWORD_BLACKLIST = new Set([
    'if',
    'for',
    'while',
    'switch',
    'catch',
    'return',
    'function',
    'class',
    'new',
    'await',
    'yield',
    'isset',
    'empty',
    'echo',
    'print',
    'require',
    'include'
]);

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sliceSignatureSnippet(source, node) {
    const start = node.startIndex;
    const end = Math.min(node.endIndex, start + 400);
    return source.slice(start, end);
}

function findClosingParen(text, startIndex) {
    let depth = 0;
    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];
        if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function extractParameterSection(snippet) {
    const openIndex = snippet.indexOf('(');
    if (openIndex === -1) {
        return { paramsText: '', closeIndex: -1 };
    }

    const closeIndex = findClosingParen(snippet, openIndex);
    if (closeIndex === -1) {
        return { paramsText: '', closeIndex: -1 };
    }

    const paramsText = snippet.slice(openIndex + 1, closeIndex).trim();
    return { paramsText, closeIndex };
}

function normalizeParameter(param) {
    if (!param) {
        return '';
    }

    const withoutDefaults = param.split('=' )[0].trim();
    const cleaned = withoutDefaults.replace(/^[*&]+/, '').trim();
    return cleaned;
}

function extractParameters(snippet) {
    const { paramsText, closeIndex } = extractParameterSection(snippet);
    if (closeIndex === -1 || paramsText.length === 0) {
        return { parameters: [], closeIndex };
    }

    const rawParams = paramsText.split(',');
    const parameters = rawParams
        .map(param => normalizeParameter(param))
        .filter(param => param.length > 0)
        .slice(0, 12);

    return { parameters, closeIndex };
}

function extractReturnType(snippet, closeIndex) {
    if (closeIndex === -1) {
        return null;
    }

    const after = snippet.slice(closeIndex + 1, closeIndex + 80);
    const colonMatch = after.match(/:\s*([A-Za-z0-9_\\\[\]<>|?]+)/);
    if (colonMatch) {
        return colonMatch[1];
    }

    const arrowMatch = after.match(/->\s*([A-Za-z0-9_\\\[\]<>|?]+)/);
    if (arrowMatch) {
        return arrowMatch[1];
    }

    return null;
}

function buildSignature(symbol, snippet, node) {
    const normalizedSymbol = typeof symbol === 'string' ? symbol.trim() : '';
    const isClassNode = node.type && node.type.includes('class');

    if (isClassNode && normalizedSymbol) {
        return { signature: `class ${normalizedSymbol}`, parameters: [], returnType: null };
    }

    if (!normalizedSymbol) {
        return { signature: '', parameters: [], returnType: null };
    }

    const { parameters, closeIndex } = extractParameters(snippet);
    const returnType = extractReturnType(snippet, closeIndex);
    const paramText = parameters.length > 0 ? parameters.join(', ') : '';
    const signature = returnType
        ? `${normalizedSymbol}(${paramText}) : ${returnType}`
        : `${normalizedSymbol}(${paramText})`;

    return { signature, parameters, returnType };
}

function extractCallNameFromSnippet(snippet) {
    const trimmed = snippet.trim();
    if (!trimmed.includes('(')) {
        return null;
    }

    const callMatch = trimmed.match(/(?:\$?[A-Za-z_][\w]*->|[A-Za-z_][\w]*::|[A-Za-z_][\w]*\.)*([A-Za-z_][\w]*)\s*\(/);
    if (!callMatch) {
        return null;
    }

    const candidate = callMatch[1];
    if (!candidate || KEYWORD_BLACKLIST.has(candidate)) {
        return null;
    }

    return candidate;
}

function collectCalls(node, source, calls) {
    const nodeType = node.type || '';
    const isCallNode = nodeType.includes('call') || nodeType.includes('invocation');

    if (isCallNode) {
        const snippet = source.slice(node.startIndex, Math.min(node.endIndex, node.startIndex + 120));
        const name = extractCallNameFromSnippet(snippet);
        if (name) {
            calls.add(name);
        }
    }

    for (let i = 0; i < node.childCount; i++) {
        collectCalls(node.child(i), source, calls);
    }
}

function splitSymbolWords(symbol) {
    if (!symbol) {
        return [];
    }

    const cleaned = symbol.replace(/[^A-Za-z0-9_]/g, ' ');
    const words = cleaned
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(/[\s_]+/)
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0);

    return words;
}

export function extractSymbolMetadata({ node, source, symbol }) {
    const snippet = sliceSignatureSnippet(source, node);
    const { signature, parameters, returnType } = buildSignature(symbol, snippet, node);

    const calls = new Set();
    collectCalls(node, source, calls);

    const symbolWords = splitSymbolWords(symbol);

    return {
        signature,
        parameters,
        returnType,
        calls: Array.from(calls),
        keywords: symbolWords
    };
}

export function queryMatchesSignature(query, metadata) {
    if (!metadata) {
        return false;
    }

    const queryLower = query.toLowerCase();
    const signature = typeof metadata.signature === 'string' ? metadata.signature.toLowerCase() : '';
    const symbol = typeof metadata.symbol === 'string' ? metadata.symbol.toLowerCase() : '';

    if (symbol && queryLower.includes(symbol)) {
        return true;
    }

    if (signature && queryLower.includes(signature)) {
        return true;
    }

    if (Array.isArray(metadata.symbol_parameters)) {
        for (const param of metadata.symbol_parameters) {
            if (typeof param === 'string' && param.length > 2) {
                const needle = param.toLowerCase();
                if (queryLower.includes(needle)) {
                    return true;
                }
            }
        }
    }

    if (Array.isArray(metadata.keywords) && metadata.keywords.length > 0) {
        for (const word of metadata.keywords) {
            if (!word || word.length < 3) {
                continue;
            }
            const pattern = new RegExp(`\\b${escapeRegex(word)}[a-z0-9_]*\\b`, 'i');
            if (pattern.test(query)) {
                return true;
            }
        }
    }

    return false;
}
