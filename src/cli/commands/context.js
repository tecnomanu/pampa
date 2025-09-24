import path from 'path';
import { getActiveContextPack, listContextPacks, loadContextPack, setActiveContextPack } from '../../context/packs.js';

function resolveProjectPath(projectPath = '.') {
    return path.resolve(projectPath || '.');
}

function formatPackLine(pack, activeKey) {
    const parts = [];
    const isActive = pack.key === activeKey;
    const marker = isActive ? '•' : '-';
    parts.push(`${marker} ${pack.key}`);

    if (pack.name && pack.name !== pack.key) {
        parts.push(`(${pack.name})`);
    }

    if (pack.description) {
        parts.push(`– ${pack.description}`);
    }

    if (pack.invalid) {
        parts.push('(invalid)');
    }

    return parts.join(' ');
}

function printPackDetails(pack) {
    const output = {
        key: pack.key,
        name: pack.name,
        description: pack.description || null,
        scope: pack.scope
    };
    console.log(JSON.stringify(output, null, 2));
}

export function registerContextCommands(program) {
    const contextCommand = program
        .command('context')
        .description('Manage context packs for scoped search defaults');

    contextCommand
        .command('list [path]')
        .description('List available context packs for a project')
        .action((projectPath = '.') => {
            const resolvedPath = resolveProjectPath(projectPath);
            const packs = listContextPacks(resolvedPath);
            const active = getActiveContextPack(resolvedPath);
            const activeKey = active ? active.key : null;

            if (!packs || packs.length === 0) {
                console.log('No context packs found. Create files in .pampa/contextpacks/*.json');
                return;
            }

            console.log(`Context packs in ${resolvedPath}:`);
            packs
                .sort((a, b) => a.key.localeCompare(b.key))
                .forEach(pack => {
                    console.log(`  ${formatPackLine(pack, activeKey)}`);
                });

            if (active) {
                console.log(`\nActive: ${active.key}${active.name && active.name !== active.key ? ` (${active.name})` : ''}`);
            }
        });

    contextCommand
        .command('show <name> [path]')
        .description('Show the definition of a context pack')
        .action((name, projectPath = '.') => {
            const resolvedPath = resolveProjectPath(projectPath);
            try {
                const pack = loadContextPack(name, resolvedPath);
                printPackDetails(pack);
            } catch (error) {
                console.error(`Failed to load context pack "${name}": ${error.message}`);
                process.exitCode = 1;
            }
        });

    contextCommand
        .command('use <name> [path]')
        .description('Activate a context pack as the default scope for CLI searches')
        .action((name, projectPath = '.') => {
            const resolvedPath = resolveProjectPath(projectPath);
            try {
                const pack = setActiveContextPack(name, resolvedPath);
                console.log(`Activated context pack: ${pack.key}`);
                if (pack.name && pack.name !== pack.key) {
                    console.log(`Display name: ${pack.name}`);
                }
                if (pack.description) {
                    console.log(`Description: ${pack.description}`);
                }
                if (pack.scope && Object.keys(pack.scope).length > 0) {
                    console.log('Default scope:');
                    for (const [key, value] of Object.entries(pack.scope)) {
                        console.log(`  ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
                    }
                }
            } catch (error) {
                console.error(`Failed to activate context pack "${name}": ${error.message}`);
                process.exitCode = 1;
            }
        });

    contextCommand.addHelpText('after', `\nExamples:\n  $ pampa context list\n  $ pampa context show stripe-backend\n  $ pampa context use stripe-backend\n  $ pampa context use clear\n\nContext packs live in .pampa/contextpacks/*.json. Flags passed to \`pampa search\` always override pack defaults.\n`);
}
