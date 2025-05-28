#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getChunk, indexProject, searchCode } from './indexer.js';

/**
 * Servidor MCP Dedicado para PAMPA
 * 
 * Este servidor puede manejar múltiples proyectos y mantiene las dependencias
 * de embeddings cargadas en memoria para mejor rendimiento.
 */

class PampaServer {
    constructor() {
        this.server = new McpServer({
            name: "pampa-dedicated-server",
            version: "0.4.0"
        });

        // Cache de proveedores de embeddings por proyecto
        this.embeddingProviders = new Map();
        this.currentProject = process.cwd();

        this.setupTools();
        this.setupResources();
        this.setupPrompts();
    }

    setupTools() {
        // Herramienta para cambiar de proyecto
        this.server.tool(
            "set_project_path",
            {
                path: z.string().describe("Ruta del proyecto a usar")
            },
            async ({ path: projectPath }) => {
                try {
                    const resolvedPath = path.resolve(projectPath);
                    if (!fs.existsSync(resolvedPath)) {
                        throw new Error(`El directorio no existe: ${resolvedPath}`);
                    }

                    this.currentProject = resolvedPath;
                    console.error(`📁 Proyecto cambiado a: ${this.currentProject}`);

                    return {
                        content: [{
                            type: "text",
                            text: `✅ Proyecto cambiado a: ${this.currentProject}`
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Error cambiando proyecto: ${error.message}`
                        }],
                        isError: true
                    };
                }
            }
        );

        // Herramienta para obtener el proyecto actual
        this.server.tool(
            "get_current_project",
            {},
            async () => {
                return {
                    content: [{
                        type: "text",
                        text: `📁 Proyecto actual: ${this.currentProject}`
                    }]
                };
            }
        );

        // Herramienta para buscar código
        this.server.tool(
            "search_code",
            {
                query: z.string().describe("Consulta de búsqueda semántica"),
                limit: z.number().optional().default(10).describe("Número máximo de resultados"),
                provider: z.string().optional().default("auto").describe("Proveedor de embeddings")
            },
            async ({ query, limit, provider }) => {
                try {
                    // Cambiar al directorio del proyecto
                    const originalCwd = process.cwd();
                    process.chdir(this.currentProject);

                    const results = await searchCode(query, limit, provider);

                    // Restaurar directorio original
                    process.chdir(originalCwd);

                    if (results.length === 0) {
                        return {
                            content: [{
                                type: "text",
                                text: `No se encontraron resultados para: "${query}" en ${this.currentProject}\n\nSugerencias:\n- Verifica que el proyecto esté indexado (usa index_project)\n- Intenta con términos más generales`
                            }]
                        };
                    }

                    const resultText = results.map(result =>
                        `📁 ${result.path}\n🔧 ${result.meta.symbol} (${result.lang})\n📊 Similitud: ${result.meta.score}\n🔑 SHA: ${result.sha}\n`
                    ).join('\n');

                    return {
                        content: [{
                            type: "text",
                            text: `🔍 Encontrados ${results.length} resultados para: "${query}"\n📁 Proyecto: ${this.currentProject}\n\n${resultText}\n💡 Usa get_code_chunk con el SHA para ver el código completo.`
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Error en la búsqueda: ${error.message}`
                        }],
                        isError: true
                    };
                }
            }
        );

        // Herramienta para obtener código
        this.server.tool(
            "get_code_chunk",
            {
                sha: z.string().describe("SHA del chunk de código a obtener")
            },
            async ({ sha }) => {
                try {
                    const originalCwd = process.cwd();
                    process.chdir(this.currentProject);

                    const code = await getChunk(sha);

                    process.chdir(originalCwd);

                    return {
                        content: [{
                            type: "text",
                            text: `\`\`\`\n${code}\n\`\`\``
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Error obteniendo chunk: ${error.message}`
                        }],
                        isError: true
                    };
                }
            }
        );

        // Herramienta para indexar proyecto
        this.server.tool(
            "index_project",
            {
                path: z.string().optional().describe("Ruta del proyecto a indexar (opcional, usa proyecto actual)"),
                provider: z.string().optional().default("auto").describe("Proveedor de embeddings")
            },
            async ({ path: projectPath, provider }) => {
                try {
                    const targetPath = projectPath || this.currentProject;
                    const originalCwd = process.cwd();

                    // Cambiar al directorio del proyecto
                    process.chdir(targetPath);

                    await indexProject({ repoPath: '.', provider });

                    // Restaurar directorio original
                    process.chdir(originalCwd);

                    if (projectPath) {
                        this.currentProject = path.resolve(projectPath);
                    }

                    return {
                        content: [{
                            type: "text",
                            text: `✅ Proyecto indexado exitosamente en: ${targetPath}\n🧠 Proveedor: ${provider}\n\n🔍 Ahora puedes usar search_code para buscar funciones y clases.`
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Error indexando proyecto: ${error.message}`
                        }],
                        isError: true
                    };
                }
            }
        );

        // Herramienta para obtener estadísticas
        this.server.tool(
            "get_project_stats",
            {
                path: z.string().optional().describe("Ruta del proyecto (opcional, usa proyecto actual)")
            },
            async ({ path: projectPath }) => {
                try {
                    const targetPath = projectPath || this.currentProject;
                    const codemapPath = path.join(targetPath, 'pampa.codemap.json');

                    if (!fs.existsSync(codemapPath)) {
                        return {
                            content: [{
                                type: "text",
                                text: `📊 Proyecto no indexado en: ${targetPath}\n\n💡 Usa index_project para indexar el proyecto primero.`
                            }]
                        };
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
                        .slice(0, 10)
                        .map(([file, count]) => `  📄 ${file}: ${count} funciones`)
                        .join('\n');

                    const langStatsText = Object.entries(langStats)
                        .map(([lang, count]) => `  🔧 ${lang}: ${count} funciones`)
                        .join('\n');

                    return {
                        content: [{
                            type: "text",
                            text: `📊 Estadísticas del proyecto: ${targetPath}\n\n` +
                                `📈 Total de funciones indexadas: ${chunks.length}\n\n` +
                                `🔧 Por lenguaje:\n${langStatsText}\n\n` +
                                `📁 Archivos con más funciones:\n${topFiles}`
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Error obteniendo estadísticas: ${error.message}`
                        }],
                        isError: true
                    };
                }
            }
        );
    }

    setupResources() {
        // Recurso para obtener el mapa de código del proyecto actual
        this.server.resource(
            "current_project_codemap",
            "pampa://current/codemap",
            async (uri) => {
                try {
                    const codemapPath = path.join(this.currentProject, 'pampa.codemap.json');

                    if (!fs.existsSync(codemapPath)) {
                        return {
                            contents: [{
                                uri: uri.href,
                                text: `Proyecto no indexado en: ${this.currentProject}\nUsa la herramienta index_project primero.`
                            }]
                        };
                    }

                    const codemap = fs.readFileSync(codemapPath, 'utf8');
                    return {
                        contents: [{
                            uri: uri.href,
                            text: `Mapa de código del proyecto: ${this.currentProject}\n\n${codemap}`,
                            mimeType: "application/json"
                        }]
                    };
                } catch (error) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: `Error cargando mapa de código: ${error.message}`
                        }]
                    };
                }
            }
        );
    }

    setupPrompts() {
        // Prompt para análisis de código con contexto de proyecto
        this.server.prompt(
            "analyze_project_code",
            {
                query: z.string().describe("Consulta de búsqueda"),
                focus: z.string().optional().describe("Aspecto específico a analizar")
            },
            ({ query, focus }) => ({
                messages: [{
                    role: "user",
                    content: {
                        type: "text",
                        text: `Analiza el código del proyecto actual relacionado con: "${query}"${focus ? ` con enfoque en: ${focus}` : ''}\n\n` +
                            `Proyecto actual: ${this.currentProject}\n\n` +
                            `Pasos a seguir:\n` +
                            `1. Usa search_code para encontrar funciones relevantes\n` +
                            `2. Usa get_code_chunk para examinar el código específico\n` +
                            `3. Proporciona un análisis detallado${focus ? ` enfocado en ${focus}` : ''}\n` +
                            `4. Sugiere mejoras si es necesario`
                    }
                }]
            })
        );
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);

        console.error("🚀 Servidor MCP PAMPA Dedicado iniciado");
        console.error(`📁 Proyecto inicial: ${this.currentProject}`);
        console.error("🔧 Herramientas disponibles:");
        console.error("  - set_project_path: Cambiar proyecto activo");
        console.error("  - get_current_project: Ver proyecto actual");
        console.error("  - search_code: Buscar código semánticamente");
        console.error("  - get_code_chunk: Obtener código específico");
        console.error("  - index_project: Indexar proyecto");
        console.error("  - get_project_stats: Estadísticas del proyecto");
    }
}

// Manejar errores
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    process.exit(1);
});

// Iniciar servidor
const server = new PampaServer();
server.start().catch(error => {
    console.error('❌ Error iniciando servidor MCP:', error);
    process.exit(1);
}); 