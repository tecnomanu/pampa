#!/usr/bin/env node

import { spawn } from 'child_process';

/**
 * Simple script to test the MCP server
 */

async function testMcpServer() {
    console.log('🔄 Starting MCP server test...\n');

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

    // Enviar mensaje de inicialización
    const initMessage = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: {}
            },
            clientInfo: {
                name: "test-client",
                version: "1.0.0"
            }
        }
    };

    console.log('📤 Sending initialization message...');
    server.stdin.write(JSON.stringify(initMessage) + '\n');

    // Esperar respuesta de inicialización
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enviar comando de test con get_project_stats
    const testMessage = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
            name: "get_project_stats",
            arguments: {
                path: "."
            }
        }
    };

    console.log('📤 Sending get_project_stats test...');
    server.stdin.write(JSON.stringify(testMessage) + '\n');

    // Esperar respuesta
    await new Promise(resolve => setTimeout(resolve, 3000));

    server.kill();

    console.log('\n📊 Test results:\n');
    console.log('📤 STDOUT:');
    console.log(output);

    console.log('\n🔧 STDERR:');
    console.log(errorOutput);

    // Analizar si hay errores JSON
    const jsonErrors = errorOutput.match(/SyntaxError.*JSON/g);
    if (jsonErrors) {
        console.log('\n❌ JSON errors detected:');
        jsonErrors.forEach(error => console.log(`  - ${error}`));
        console.log('\n💡 The server is sending non-JSON text to the stream.');
    } else {
        console.log('\n✅ No JSON errors detected in the stream.');
    }

    // Verificar si hay output JSON válido
    const lines = output.split('\n').filter(line => line.trim());
    let validJsonCount = 0;
    let invalidJsonCount = 0;

    lines.forEach(line => {
        try {
            JSON.parse(line);
            validJsonCount++;
        } catch (e) {
            invalidJsonCount++;
            if (line.includes('✅') || line.includes('❌') || line.includes('🔄')) {
                console.log(`⚠️  Non-JSON line detected: ${line.substring(0, 100)}...`);
            }
        }
    });

    console.log(`\n📈 Stream statistics:`);
    console.log(`  ✅ Valid JSON lines: ${validJsonCount}`);
    console.log(`  ❌ Non-JSON lines: ${invalidJsonCount}`);

    if (invalidJsonCount === 0) {
        console.log('\n🎉 MCP Server working correctly!');
    } else {
        console.log('\n⚠️  Problems detected in the stream JSON.');
    }
}

// Ejecutar test si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    testMcpServer().catch(error => {
        console.error('❌ MCP test error:', error);
        process.exit(1);
    });
} 