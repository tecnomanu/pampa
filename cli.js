#!/usr/bin/env node
import { spawn } from 'child_process';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { indexProject, searchCode } from './indexer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const program = new Command();
program
    .name('pampa')
    .description('PAMPA - Protocol for Augmented Memory of Project Artifacts (MCP)')
    .version(packageJson.version);

program
    .command('index [path]')
    .description('Index project and build/update pampa.codemap.json')
    .option('-p, --provider <provider>', 'embedding provider (auto|openai|transformers|ollama|cohere)', 'auto')
    .action(async (projectPath = '.', options) => {
        console.log('🚀 Starting project indexing...');
        console.log(`🧠 Provider: ${options.provider}`);
        try {
            await indexProject({ repoPath: projectPath, provider: options.provider });
            console.log('✅ Indexing completed successfully');
        } catch (error) {
            console.error('❌ Error during indexing:', error.message);
            process.exit(1);
        }
    });

program
    .command('search <query>')
    .option('-k, --limit <num>', 'maximum number of results', '10')
    .option('-p, --provider <provider>', 'embedding provider (auto|openai|transformers|ollama|cohere)', 'auto')
    .description('Search code semantically in the indexed project')
    .action(async (query, options) => {
        try {
            const limit = parseInt(options.limit);
            const results = await searchCode(query, limit, options.provider);

            if (results.length === 0) {
                console.log(`❌ No results found for: "${query}"`);
                console.log('💡 Suggestions:');
                console.log('  - Verify that the project is indexed (pampa index)');
                console.log('  - Try with more general terms');
                console.log(`  - Verify you use the same provider: --provider ${options.provider}`);
                return;
            }

            console.log(`🔍 Found ${results.length} results for: "${query}"\n`);

            results.forEach((result, index) => {
                console.log(`${index + 1}. 📁 ${result.path}`);
                console.log(`   🔧 ${result.meta.symbol} (${result.lang})`);
                console.log(`   📊 Similarity: ${result.meta.score}`);
                console.log(`   🔑 SHA: ${result.sha}`);
                console.log('');
            });

            console.log('💡 Use "pampa mcp" to start the MCP server and get the complete code');
        } catch (error) {
            console.error('❌ Search error:', error.message);
            process.exit(1);
        }
    });

program
    .command('mcp')
    .description('Start MCP server for AI agent integration')
    .action(() => {
        console.log('🚀 Starting PAMPA MCP server...');
        console.log('📡 Server will be available for MCP connections via stdio');
        console.log('🔗 Configure your MCP client to connect to this process');
        console.log('');

        // Execute MCP server
        const serverPath = path.join(__dirname, 'mcp-server.js');
        const mcpServer = spawn('node', [serverPath], {
            stdio: 'inherit'
        });

        mcpServer.on('error', (error) => {
            console.error('❌ Error starting MCP server:', error.message);
            process.exit(1);
        });

        mcpServer.on('exit', (code) => {
            if (code !== 0) {
                console.error(`❌ MCP server terminated with code: ${code}`);
                process.exit(code);
            }
        });

        // Handle signals to close cleanly
        process.on('SIGINT', () => {
            console.log('\n🛑 Closing MCP server...');
            mcpServer.kill('SIGINT');
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Closing MCP server...');
            mcpServer.kill('SIGTERM');
        });
    });

program
    .command('info')
    .description('Show information about the indexed project')
    .action(async () => {
        try {
            const fs = await import('fs');
            const path = await import('path');

            const codemapPath = 'pampa.codemap.json';

            if (!fs.existsSync(codemapPath)) {
                console.log('📊 Project not indexed');
                console.log('💡 Run "pampa index" to index the project');
                return;
            }

            const codemap = JSON.parse(fs.readFileSync(codemapPath, 'utf8'));
            const chunks = Object.values(codemap);

            // Statistics by language
            const langStats = chunks.reduce((acc, chunk) => {
                acc[chunk.lang] = (acc[chunk.lang] || 0) + 1;
                return acc;
            }, {});

            // Statistics by file
            const fileStats = chunks.reduce((acc, chunk) => {
                acc[chunk.file] = (acc[chunk.file] || 0) + 1;
                return acc;
            }, {});

            const topFiles = Object.entries(fileStats)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10);

            console.log('📊 PAMPA project information\n');
            console.log(`📈 Total indexed functions: ${chunks.length}`);
            console.log('');

            console.log('🔧 By language:');
            Object.entries(langStats).forEach(([lang, count]) => {
                console.log(`  ${lang}: ${count} functions`);
            });
            console.log('');

            console.log('📁 Files with most functions:');
            topFiles.forEach(([file, count]) => {
                console.log(`  ${file}: ${count} functions`);
            });

        } catch (error) {
            console.error('❌ Error getting information:', error.message);
            process.exit(1);
        }
    });

// Show help if no command is provided
if (process.argv.length <= 2) {
    program.help();
}

program.parse(process.argv);
