#!/usr/bin/env node

import { spawn } from 'child_process';

/**
 * Script para probar específicamente las herramientas MCP con diferentes casos
 */

const searchTestCases = [
    {
        name: "Búsqueda válida",
        tool: "search_code",
        args: { query: "función de chat" },
        shouldPass: true
    },
    {
        name: "Query vacío",
        tool: "search_code",
        args: { query: "" },
        shouldPass: false
    },
    {
        name: "Query con solo espacios",
        tool: "search_code",
        args: { query: "   " },
        shouldPass: false
    },
    {
        name: "Query undefined",
        tool: "search_code",
        args: {},
        shouldPass: false
    },
    {
        name: "SHA válido (simulado)",
        tool: "get_code_chunk",
        args: { sha: "a1b2c3d4e5f6789" },
        shouldPass: true // Aunque fallará porque no existe, debe pasar validación
    },
    {
        name: "SHA vacío",
        tool: "get_code_chunk",
        args: { sha: "" },
        shouldPass: false
    },
    {
        name: "SHA undefined",
        tool: "get_code_chunk",
        args: {},
        shouldPass: false
    },
    {
        name: "SHA con espacios",
        tool: "get_code_chunk",
        args: { sha: "   " },
        shouldPass: false
    }
];

async function testMcpTools() {
    console.log('🧪 Testing herramientas MCP con diferentes casos...\n');

    for (let i = 0; i < searchTestCases.length; i++) {
        const testCase = searchTestCases[i];
        console.log(`📋 Test ${i + 1}: ${testCase.name} (${testCase.tool})`);

        const server = spawn('node', ['mcp-server.js'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        server.stdout.on('data', (data) => {
            output += data.toString();
        });

        server.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        // Inicialización
        const initMessage = {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                clientInfo: { name: "test-client", version: "1.0.0" }
            }
        };

        server.stdin.write(JSON.stringify(initMessage) + '\n');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test de la herramienta
        const toolMessage = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: testCase.tool,
                arguments: testCase.args
            }
        };

        server.stdin.write(JSON.stringify(toolMessage) + '\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        server.kill();

        // Analizar resultado
        const hasJsonError = errorOutput.includes('SyntaxError') && errorOutput.includes('JSON');
        const hasInvalidArguments = output.includes('Invalid arguments');
        const hasValidResponse = output.includes('"result":');
        const hasEmojiError = errorOutput.includes('Unexpected token') &&
            (errorOutput.includes('✅') || errorOutput.includes('❌') ||
                errorOutput.includes('🔍') || errorOutput.includes('📊'));

        if (testCase.shouldPass) {
            if (hasValidResponse && !hasJsonError && !hasInvalidArguments && !hasEmojiError) {
                console.log(`  ✅ PASÓ - Respuesta válida sin emojis`);
            } else {
                console.log(`  ❌ FALLÓ - Expected válido pero got:`);
                if (hasJsonError) console.log(`    - Error JSON detectado`);
                if (hasInvalidArguments) console.log(`    - Argumentos inválidos`);
                if (hasEmojiError) console.log(`    - Error de emoji en JSON`);
                if (!hasValidResponse) console.log(`    - No hay respuesta válida`);
            }
        } else {
            if (hasInvalidArguments || (hasValidResponse && output.includes('ERROR:'))) {
                if (!hasEmojiError && !hasJsonError) {
                    console.log(`  ✅ PASÓ - Error manejado correctamente sin emojis`);
                } else {
                    console.log(`  ⚠️  PASÓ CON ADVERTENCIAS - Error manejado pero:`);
                    if (hasEmojiError) console.log(`    - Emojis detectados en stream`);
                    if (hasJsonError) console.log(`    - Errores JSON detectados`);
                }
            } else {
                console.log(`  ❌ FALLÓ - Expected error pero got respuesta válida`);
            }
        }

        console.log(`    Args: ${JSON.stringify(testCase.args)}`);

        // Verificar que no hay emojis en la respuesta
        if (output.includes('✅') || output.includes('❌') || output.includes('🔍') ||
            output.includes('📊') || output.includes('💡') || output.includes('🔧')) {
            console.log(`    ⚠️  ADVERTENCIA: Emojis detectados en respuesta JSON`);
        }

        console.log('');
    }

    console.log('🎯 Test completado!');
}

// Ejecutar test si se llama directamente
if (process.argv[1] && process.argv[1].endsWith('test-search-code.js')) {
    testMcpTools().catch(error => {
        console.error('❌ Error en test:', error);
        process.exit(1);
    });
} 