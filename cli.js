#!/usr/bin/env node
import { spawn } from 'child_process';
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { indexProject, searchCode } from './indexer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();
program
    .name('pampa')
    .description('PAMPA - Protocolo para Memoria Aumentada de Artefactos de Proyecto (MCP)')
    .version('0.4.0');

program
    .command('index [path]')
    .description('Indexar proyecto y construir/actualizar pampa.codemap.json')
    .option('-p, --provider <provider>', 'proveedor de embeddings (auto|openai|transformers|ollama|cohere)', 'auto')
    .action(async (projectPath = '.', options) => {
        console.log('🚀 Iniciando indexación del proyecto...');
        console.log(`🧠 Proveedor: ${options.provider}`);
        try {
            await indexProject({ repoPath: projectPath, provider: options.provider });
            console.log('✅ Indexación completada exitosamente');
        } catch (error) {
            console.error('❌ Error durante la indexación:', error.message);
            process.exit(1);
        }
    });

program
    .command('search <query>')
    .option('-k, --limit <num>', 'número máximo de resultados', '10')
    .option('-p, --provider <provider>', 'proveedor de embeddings (auto|openai|transformers|ollama|cohere)', 'auto')
    .description('Buscar código semánticamente en el proyecto indexado')
    .action(async (query, options) => {
        try {
            const limit = parseInt(options.limit);
            const results = await searchCode(query, limit, options.provider);

            if (results.length === 0) {
                console.log(`❌ No se encontraron resultados para: "${query}"`);
                console.log('💡 Sugerencias:');
                console.log('  - Verifica que el proyecto esté indexado (pampa index)');
                console.log('  - Intenta con términos más generales');
                console.log(`  - Verifica que uses el mismo proveedor: --provider ${options.provider}`);
                return;
            }

            console.log(`🔍 Encontrados ${results.length} resultados para: "${query}"\n`);

            results.forEach((result, index) => {
                console.log(`${index + 1}. 📁 ${result.path}`);
                console.log(`   🔧 ${result.meta.symbol} (${result.lang})`);
                console.log(`   📊 Similitud: ${result.meta.score}`);
                console.log(`   🔑 SHA: ${result.sha}`);
                console.log('');
            });

            console.log('💡 Usa "pampa mcp" para iniciar el servidor MCP y obtener el código completo');
        } catch (error) {
            console.error('❌ Error en la búsqueda:', error.message);
            process.exit(1);
        }
    });

program
    .command('mcp')
    .description('Iniciar servidor MCP para integración con agentes de IA')
    .action(() => {
        console.log('🚀 Iniciando servidor MCP PAMPA...');
        console.log('📡 El servidor estará disponible para conexiones MCP via stdio');
        console.log('🔗 Configura tu cliente MCP para conectarse a este proceso');
        console.log('');

        // Ejecutar el servidor MCP
        const serverPath = path.join(__dirname, 'mcp-server.js');
        const mcpServer = spawn('node', [serverPath], {
            stdio: 'inherit'
        });

        mcpServer.on('error', (error) => {
            console.error('❌ Error iniciando servidor MCP:', error.message);
            process.exit(1);
        });

        mcpServer.on('exit', (code) => {
            if (code !== 0) {
                console.error(`❌ Servidor MCP terminó con código: ${code}`);
                process.exit(code);
            }
        });

        // Manejar señales para cerrar limpiamente
        process.on('SIGINT', () => {
            console.log('\n🛑 Cerrando servidor MCP...');
            mcpServer.kill('SIGINT');
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Cerrando servidor MCP...');
            mcpServer.kill('SIGTERM');
        });
    });

program
    .command('info')
    .description('Mostrar información sobre el proyecto indexado')
    .action(async () => {
        try {
            const fs = await import('fs');
            const path = await import('path');

            const codemapPath = 'pampa.codemap.json';

            if (!fs.existsSync(codemapPath)) {
                console.log('📊 Proyecto no indexado');
                console.log('💡 Ejecuta "pampa index" para indexar el proyecto');
                return;
            }

            const codemap = JSON.parse(fs.readFileSync(codemapPath, 'utf8'));
            const chunks = Object.values(codemap);

            // Estadísticas por lenguaje
            const langStats = chunks.reduce((acc, chunk) => {
                acc[chunk.lang] = (acc[chunk.lang] || 0) + 1;
                return acc;
            }, {});

            // Estadísticas por archivo
            const fileStats = chunks.reduce((acc, chunk) => {
                acc[chunk.file] = (acc[chunk.file] || 0) + 1;
                return acc;
            }, {});

            const topFiles = Object.entries(fileStats)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10);

            console.log('📊 Información del proyecto PAMPA\n');
            console.log(`📈 Total de funciones indexadas: ${chunks.length}`);
            console.log('');

            console.log('🔧 Por lenguaje:');
            Object.entries(langStats).forEach(([lang, count]) => {
                console.log(`  ${lang}: ${count} funciones`);
            });
            console.log('');

            console.log('📁 Archivos con más funciones:');
            topFiles.forEach(([file, count]) => {
                console.log(`  ${file}: ${count} funciones`);
            });

        } catch (error) {
            console.error('❌ Error obteniendo información:', error.message);
            process.exit(1);
        }
    });

// Mostrar ayuda si no se proporciona comando
if (process.argv.length <= 2) {
    program.help();
}

program.parse(process.argv);
