#!/usr/bin/env node
import { spawn } from 'child_process';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerContextCommands } from './cli/commands/context.js';
import { buildScopeFiltersFromOptions } from './cli/commands/search.js';
import { readCodemap } from './codemap/io.js';
import { indexProject } from './indexer.js';
import { startWatch } from './indexer/watch.js';
import { searchCode } from './service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();
program
    .name('pampa')
    .description('PAMPA - Protocol for Augmented Memory of Project Artifacts (MCP)')
    .version(packageJson.version);

program
    .command('index [path]')
    .description('Index project and build/update pampa.codemap.json')
    .option('-p, --provider <provider>', 'embedding provider (auto|openai|transformers|ollama|cohere)', 'auto')
    .option('--project <path>', 'alias for project path (same as [path] argument)')
    .option('--directory <path>', 'alias for project directory (same as [path] argument)')
    .option('--encrypt <mode>', 'encrypt chunk payloads when PAMPA_ENCRYPTION_KEY is configured (on|off)')
    .action(async (projectPath = '.', options) => {
        const resolvedPath = options.project || options.directory || projectPath || '.';
        console.log('Starting project indexing...');
        console.log(`Provider: ${options.provider}`);
        try {
            await indexProject({ repoPath: resolvedPath, provider: options.provider, encrypt: options.encrypt });
            console.log('Indexing completed successfully');
        } catch (error) {
            console.error('ERROR during indexing:', error.message);
            process.exit(1);
        }
    });

program
    .command('update [path]')
    .description('Update index by re-scanning all files (recommended after code changes)')
    .option('-p, --provider <provider>', 'embedding provider (auto|openai|transformers|ollama|cohere)', 'auto')
    .option('--project <path>', 'alias for project path (same as [path] argument)')
    .option('--directory <path>', 'alias for project directory (same as [path] argument)')
    .option('--encrypt <mode>', 'encrypt chunk payloads when PAMPA_ENCRYPTION_KEY is configured (on|off)')
    .action(async (projectPath = '.', options) => {
        const resolvedPath = options.project || options.directory || projectPath || '.';
        console.log('🔄 Updating project index...');
        console.log(`Provider: ${options.provider}`);
        console.log('ℹ️  This will re-scan all files and update the database');
        try {
            await indexProject({ repoPath: resolvedPath, provider: options.provider, encrypt: options.encrypt });
            console.log('✅ Index updated successfully');
            console.log('💡 Your AI agents now have access to the latest code changes');
        } catch (error) {
            console.error('❌ ERROR during update:', error.message);
            process.exit(1);
        }
    });

program
    .command('watch [path]')
    .description('Watch project files and incrementally update the index as changes occur')
    .option('-p, --provider <provider>', 'embedding provider (auto|openai|transformers|ollama|cohere)', 'auto')
    .option('--project <path>', 'alias for project path (same as [path] argument)')
    .option('--directory <path>', 'alias for project directory (same as [path] argument)')
    .option('-d, --debounce <ms>', 'debounce interval in milliseconds (default 500)', '500')
    .option('--encrypt <mode>', 'encrypt chunk payloads when PAMPA_ENCRYPTION_KEY is configured (on|off)')
    .action(async (projectPath = '.', options) => {
        const resolvedPath = options.project || options.directory || projectPath || '.';
        const parsedDebounce = Number.parseInt(options.debounce, 10);
        const debounceMs = Number.isFinite(parsedDebounce) ? Math.max(parsedDebounce, 50) : undefined;

        console.log(`👀 Watching ${resolvedPath} for changes...`);
        console.log(`Provider: ${options.provider}`);
        console.log(`Debounce window: ${debounceMs ?? 500}ms`);
        if (typeof options.encrypt === 'string') {
            console.log(`Encryption: ${options.encrypt}`);
        }

        try {
            const controller = startWatch({
                repoPath: resolvedPath,
                provider: options.provider,
                debounceMs,
                encrypt: options.encrypt,
                onBatch: ({ changed, deleted }) => {
                    console.log(
                        `🔁 Indexed ${changed.length} changed / ${deleted.length} deleted files`
                    );
                }
            });

            await controller.ready;
            console.log('✅ Watcher active. Press Ctrl+C to stop.');

            await new Promise(resolve => {
                const shutdown = async () => {
                    console.log('\nStopping watcher...');
                    await controller.close();
                    process.off('SIGINT', shutdown);
                    process.off('SIGTERM', shutdown);
                    resolve();
                };

                process.on('SIGINT', shutdown);
                process.on('SIGTERM', shutdown);
            });
        } catch (error) {
            console.error('❌ Failed to start watcher:', error.message);
            process.exit(1);
        }
    });

program
    .command('search <query> [path]')
    .description('Search indexed code with optional path/tag/lang filters, provider overrides, reranker, and symbol-aware boosts')
    .option('-k, --limit <num>', 'maximum number of results', '10')
    .option('-p, --provider <provider>', 'embedding provider (auto|openai|transformers|ollama|cohere)', 'auto')
    .option('--project <path>', 'alias for project path (same as [path] argument)')
    .option('--directory <path>', 'alias for project directory (same as [path] argument)')
    .option('--path_glob <pattern...>', 'limit results to files matching the provided glob pattern(s)')
    .option('--tags <tag...>', 'filter results to chunks tagged with the provided values')
    .option('--lang <language...>', 'filter results to the specified languages (e.g. php, ts)')
    .option('--reranker <mode>', 'reranker strategy (off|transformers)', 'off')
    .option('--hybrid <mode>', 'toggle reciprocal-rank-fused hybrid search (on|off)', 'on')
    .option('--bm25 <mode>', 'toggle BM25 keyword candidate generation (on|off)', 'on')
    .option('--symbol_boost <mode>', 'toggle symbol-aware ranking boost (on|off)', 'on')
    .addHelpText('after', `\nExamples:\n  $ pampa search "create checkout session" --path_glob "app/Services/**" --tags stripe --lang php\n  $ pampa search "payment intent status" --provider openai --reranker transformers\n  $ pampa search "token validation" --symbol_boost off\n  $ pampa search "user authentication" --project /path/to/project\n  $ pampa search "database connection" --directory ~/my-laravel-app\n`)
    .action(async (query, projectPath = '.', options) => {
        try {
            // Resolve project path from various options
            const resolvedPath = options.project || options.directory || projectPath || '.';

            const limit = parseInt(options.limit);
            const { scope: scopeFilters, pack } = buildScopeFiltersFromOptions(options, resolvedPath);
            if (pack) {
                console.log(
                    `Using context pack: ${pack.name || pack.key}` +
                    (pack.description ? ` – ${pack.description}` : '')
                );
            }
            const results = await searchCode(query, limit, options.provider, resolvedPath, scopeFilters);

            if (!results.success) {
                console.log(`No results found for: "${query}"`);
                if (results.error === 'database_not_found') {
                    console.log(`Database not found: ${results.message}`);
                    console.log('Suggestions:');
                    console.log(`  - Run: node cli.js index ${resolvedPath}`);
                } else {
                    console.log('Suggestions:');
                    console.log('  - Verify that the project is indexed (pampa index)');
                    console.log('  - Try with more general terms');
                    console.log(`  - Verify you use the same provider: --provider ${options.provider}`);
                    if (scopeFilters.path_glob || scopeFilters.tags || scopeFilters.lang) {
                        console.log('  - Try removing or adjusting scope filters');
                    }
                }
                return;
            }

            if (results.results.length === 0) {
                console.log(`No results found for: "${query}"`);
                console.log('Suggestions:');
                console.log('  - Verify that the project is indexed (pampa index)');
                console.log('  - Try with more general terms');
                console.log(`  - Verify you use the same provider: --provider ${options.provider}`);
                if (scopeFilters.path_glob || scopeFilters.tags || scopeFilters.lang) {
                    console.log('  - Try removing or adjusting scope filters');
                }
                return;
            }

            console.log(`Found ${results.results.length} results for: "${query}"\n`);

            results.results.forEach((result, index) => {
                console.log(`${index + 1}. FILE: ${result.path}`);
                console.log(`   SYMBOL: ${result.meta.symbol} (${result.lang})`);
                console.log(`   SIMILARITY: ${result.meta.score}`);
                console.log(`   SHA: ${result.sha}`);
                console.log('');
            });

            console.log('TIP: Use "pampa mcp" to start the MCP server and get the complete code');
        } catch (error) {
            console.error('Search error:', error.message);
            process.exit(1);
        }
    });

registerContextCommands(program);

program
    .command('mcp')
    .description('Start MCP server for AI agent integration')
    .action(() => {
        // Execute MCP server directly without console output that interferes with MCP protocol
        const serverPath = path.join(__dirname, 'mcp-server.js');
        const mcpServer = spawn('node', [serverPath], {
            stdio: 'inherit'
        });

        mcpServer.on('error', (error) => {
            // Log to stderr instead of stdout to avoid MCP protocol interference
            process.stderr.write(`ERROR starting MCP server: ${error.message}\n`);
            process.exit(1);
        });

        mcpServer.on('exit', (code) => {
            if (code !== 0) {
                process.stderr.write(`MCP server terminated with code: ${code}\n`);
                process.exit(code);
            }
        });

        // Handle signals to close cleanly
        process.on('SIGINT', () => {
            mcpServer.kill('SIGINT');
        });

        process.on('SIGTERM', () => {
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
                console.log('Project not indexed');
                console.log('TIP: Run "pampa index" to index the project');
                return;
            }

            const codemap = readCodemap(codemapPath);
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

            console.log('PAMPA project information\n');
            console.log(`Total indexed functions: ${chunks.length}`);
            console.log('');

            console.log('By language:');
            Object.entries(langStats).forEach(([lang, count]) => {
                console.log(`  ${lang}: ${count} functions`);
            });
            console.log('');

            console.log('Files with most functions:');
            topFiles.forEach(([file, count]) => {
                console.log(`  ${file}: ${count} functions`);
            });

        } catch (error) {
            console.error('ERROR getting information:', error.message);
            process.exit(1);
        }
    });

// Show help if no command is provided
if (process.argv.length <= 2) {
    program.help();
}

program.parse(process.argv);
