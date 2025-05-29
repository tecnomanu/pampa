#!/usr/bin/env node

/**
 * Test para verificar que la extracción de símbolos funciona correctamente
 * especialmente para métodos PHP que anteriormente aparecían como method_declaration_xxx
 */

import Parser from 'tree-sitter';
import LangPHP from 'tree-sitter-php';

console.log('🧪 Testing symbol extraction...\n');

// Test PHP code similar to what we have in the Laravel project
const phpCode = `<?php
class PurchaseSessionService
{
    public function validatePurchaseSessionData(array $data): bool
    {
        // Some validation logic
        return true;
    }

    public function updateSessionWithoutStrictValidation(string $sessionId, array $data): PurchaseSession
    {
        // Some update logic
        return $session;
    }

    private function helperMethod()
    {
        // Helper logic
    }
}`;

// Create parser
const parser = new Parser();
parser.setLanguage(LangPHP);

// Parse the code
const tree = parser.parse(phpCode);

// Function to extract symbol name (same logic as in service.js)
function extractSymbolName(node, source) {
    // Try different ways to get the name according to node type
    if (node.type === 'function_declaration' || node.type === 'function_definition') {
        // Look for first identifier after 'function'
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child.type === 'identifier') {
                return source.slice(child.startIndex, child.endIndex);
            }
        }
    }

    if (node.type === 'method_declaration' || node.type === 'method_definition') {
        // PHP method_declaration structure: [visibility] function name(params) { ... }
        // Need to search deeper for the function name
        function findMethodName(n) {
            // Look for 'name' field in method_declaration
            if (n.type === 'name' || n.type === 'identifier' || n.type === 'property_identifier') {
                const text = source.slice(n.startIndex, n.endIndex);
                // Skip keywords like 'public', 'private', 'function', etc.
                if (!['public', 'private', 'protected', 'static', 'function', 'abstract', 'final'].includes(text)) {
                    return text;
                }
            }

            // Recursively search children
            for (let i = 0; i < n.childCount; i++) {
                const result = findMethodName(n.child(i));
                if (result) return result;
            }
            return null;
        }

        const methodName = findMethodName(node);
        if (methodName) return methodName;
    }

    if (node.type === 'class_declaration') {
        // Look for class name
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child.type === 'identifier' || child.type === 'type_identifier' || child.type === 'name') {
                const text = source.slice(child.startIndex, child.endIndex);
                // Skip keyword 'class'
                if (text !== 'class') {
                    return text;
                }
            }
        }
    }

    // Enhanced fallback: look for any meaningful identifier
    function findAnyIdentifier(n) {
        if (n.type === 'identifier' || n.type === 'name' || n.type === 'property_identifier') {
            const text = source.slice(n.startIndex, n.endIndex);
            // Skip common keywords
            if (!['public', 'private', 'protected', 'static', 'function', 'class', 'abstract', 'final', 'const', 'var', 'let'].includes(text)) {
                return text;
            }
        }

        for (let i = 0; i < n.childCount; i++) {
            const result = findAnyIdentifier(n.child(i));
            if (result) return result;
        }
        return null;
    }

    const anyIdentifier = findAnyIdentifier(node);
    if (anyIdentifier) return anyIdentifier;

    // Last resort: try to extract from the code itself using regex
    const code = source.slice(node.startIndex, node.endIndex);

    // For PHP methods: public function methodName(
    const phpMethodMatch = code.match(/(?:public|private|protected)?\s*(?:static)?\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (phpMethodMatch) return phpMethodMatch[1];

    // For JS/TS functions: function functionName(
    const jsFunctionMatch = code.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (jsFunctionMatch) return jsFunctionMatch[1];

    // For JS/TS methods: methodName(args) {
    const jsMethodMatch = code.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/);
    if (jsMethodMatch) return jsMethodMatch[1];

    // For class declarations: class ClassName
    const classMatch = code.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (classMatch) return classMatch[1];

    // If we find nothing, use type + position
    return `${node.type}_${node.startIndex}`;
}

// Function to walk the tree and find methods
function walkTree(node, source, depth = 0) {
    const indent = '  '.repeat(depth);

    if (node.type === 'method_declaration' || node.type === 'class_declaration') {
        const symbolName = extractSymbolName(node, source);
        console.log(`${indent}📋 Found ${node.type}: "${symbolName}"`);

        // Show a preview of the code
        const code = source.slice(node.startIndex, node.endIndex);
        const firstLine = code.split('\n')[0];
        console.log(`${indent}   Code preview: ${firstLine.trim()}`);
        console.log('');
    }

    // Recursively walk children
    for (let i = 0; i < node.childCount; i++) {
        walkTree(node.child(i), phpCode, depth + 1);
    }
}

console.log('🔍 Parsing PHP code and extracting symbols...\n');
walkTree(tree.rootNode, phpCode);

console.log('✅ Symbol extraction test completed!');
console.log('\n📝 Expected results:');
console.log('   - Class: "PurchaseSessionService"');
console.log('   - Method: "validatePurchaseSessionData"');
console.log('   - Method: "updateSessionWithoutStrictValidation"');
console.log('   - Method: "helperMethod"');

process.exit(0); 