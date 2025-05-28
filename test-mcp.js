#!/usr/bin/env node

import { spawn } from 'child_process';

/**
 * Script simple para probar el servidor MCP
 */

async function testMcpServer() {
    console.log('🔄 Iniciando test del servidor MCP...\n');

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

    console.log('📤 Enviando mensaje de inicialización...');
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

    console.log('📤 Enviando test de get_project_stats...');
    server.stdin.write(JSON.stringify(testMessage) + '\n');

    // Esperar respuesta
    await new Promise(resolve => setTimeout(resolve, 3000));

    server.kill();

    console.log('\n📊 Resultados del test:\n');
    console.log('📤 STDOUT:');
    console.log(output);

    console.log('\n🔧 STDERR:');
    console.log(errorOutput);

    // Analizar si hay errores JSON
    const jsonErrors = errorOutput.match(/SyntaxError.*JSON/g);
    if (jsonErrors) {
        console.log('\n❌ Errores JSON detectados:');
        jsonErrors.forEach(error => console.log(`  - ${error}`));
        console.log('\n💡 El servidor está enviando texto no-JSON al stream.');
    } else {
        console.log('\n✅ No se detectaron errores JSON en el stream.');
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
                console.log(`⚠️  Línea no-JSON detectada: ${line.substring(0, 100)}...`);
            }
        }
    });

    console.log(`\n📈 Estadísticas del stream:`);
    console.log(`  ✅ Líneas JSON válidas: ${validJsonCount}`);
    console.log(`  ❌ Líneas no-JSON: ${invalidJsonCount}`);

    if (invalidJsonCount === 0) {
        console.log('\n🎉 ¡Servidor MCP funcionando correctamente!');
    } else {
        console.log('\n⚠️  Se detectaron problemas en el stream JSON.');
    }
}

// Ejecutar test si se llama directamente
if (process.argv[1] && process.argv[1].endsWith('test-mcp.js')) {
    testMcpServer().catch(error => {
        console.error('❌ Error en test MCP:', error);
        process.exit(1);
    });
} 