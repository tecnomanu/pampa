#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getChunk, indexProject, searchCode } from './indexer.js';

/**
 * Servidor MCP para PAMPA - Protocolo para Memoria Aumentada de Artefactos de Proyecto
 * 
 * Este servidor expone herramientas y recursos para que los agentes de IA puedan:
 * - Buscar código semánticamente en el proyecto
 * - Obtener contenido específico de funciones/clases
 * - Indexar nuevos proyectos
 * - Obtener resúmenes del proyecto
 */

// Crear el servidor MCP
const server = new McpServer({
    name: "pampa-code-memory",
    version: "0.4.0"
});

// ============================================================================
// HERRAMIENTAS (TOOLS) - Permiten a los LLMs realizar acciones
// ============================================================================

/**
 * Herramienta para buscar código semánticamente
 */
server.tool(
    "search_code",
    {
        query: z.string().describe("Consulta de búsqueda semántica (ej: 'función de autenticación', 'manejo de errores')"),
        limit: z.number().optional().default(10).describe("Número máximo de resultados a devolver"),
        provider: z.string().optional().default("auto").describe("Proveedor de embeddings (auto|openai|transformers|ollama|cohere)")
    },
    async ({ query, limit, provider }) => {
        try {
            const results = await searchCode(query, limit, provider);

            if (results.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No se encontraron resultados para: "${query}"\n\nSugerencias:\n- Verifica que el proyecto esté indexado (usa index_project)\n- Intenta con términos más generales\n- Revisa que existan archivos de código en el proyecto`
                    }]
                };
            }

            const resultText = results.map(result =>
                `📁 ${result.path}\n🔧 ${result.meta.symbol} (${result.lang})\n📊 Similitud: ${result.meta.score}\n🔑 SHA: ${result.sha}\n`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: `🔍 Encontrados ${results.length} resultados para: "${query}"\n\n${resultText}\n💡 Usa get_code_chunk con el SHA para ver el código completo.`
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

/**
 * Herramienta para obtener el código completo de un chunk específico
 */
server.tool(
    "get_code_chunk",
    {
        sha: z.string().describe("SHA del chunk de código a obtener")
    },
    async ({ sha }) => {
        try {
            const code = await getChunk(sha);
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

/**
 * Herramienta para indexar un proyecto
 */
server.tool(
    "index_project",
    {
        path: z.string().optional().default(".").describe("Ruta del proyecto a indexar (por defecto: directorio actual)"),
        provider: z.string().optional().default("auto").describe("Proveedor de embeddings (auto|openai|transformers|ollama|cohere)")
    },
    async ({ path: projectPath, provider }) => {
        try {
            await indexProject({ repoPath: projectPath, provider });
            return {
                content: [{
                    type: "text",
                    text: `✅ Proyecto indexado exitosamente en: ${projectPath}\n🧠 Proveedor: ${provider}\n\n🔍 Ahora puedes usar search_code para buscar funciones y clases.`
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

/**
 * Herramienta para obtener estadísticas del proyecto indexado
 */
server.tool(
    "get_project_stats",
    {
        path: z.string().optional().default(".").describe("Ruta del proyecto")
    },
    async ({ path: projectPath }) => {
        try {
            const codemapPath = path.join(projectPath, 'pampa.codemap.json');

            if (!fs.existsSync(codemapPath)) {
                return {
                    content: [{
                        type: "text",
                        text: `📊 Proyecto no indexado en: ${projectPath}\n\n💡 Usa index_project para indexar el proyecto primero.`
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
                    text: `📊 Estadísticas del proyecto: ${projectPath}\n\n` +
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

// ============================================================================
// RECURSOS (RESOURCES) - Exponen datos del proyecto
// ============================================================================

/**
 * Recurso para obtener el mapa de código del proyecto
 */
server.resource(
    "codemap",
    "pampa://codemap",
    async (uri) => {
        try {
            const codemapPath = 'pampa.codemap.json';

            if (!fs.existsSync(codemapPath)) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: "Proyecto no indexado. Usa la herramienta index_project primero."
                    }]
                };
            }

            const codemap = fs.readFileSync(codemapPath, 'utf8');
            return {
                contents: [{
                    uri: uri.href,
                    text: `Mapa de código del proyecto:\n\n${codemap}`,
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

/**
 * Recurso para obtener resumen del proyecto
 */
server.resource(
    "overview",
    "pampa://overview",
    async (uri) => {
        try {
            const results = await searchCode("", 20); // Obtener resumen

            if (results.length === 0) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: "Proyecto no indexado o vacío. Usa la herramienta index_project primero."
                    }]
                };
            }

            const overview = results.map(result =>
                `- ${result.path} :: ${result.meta.symbol} (${result.lang})`
            ).join('\n');

            return {
                contents: [{
                    uri: uri.href,
                    text: `Resumen del proyecto (${results.length} funciones principales):\n\n${overview}`
                }]
            };
        } catch (error) {
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error generando resumen: ${error.message}`
                }]
            };
        }
    }
);

// ============================================================================
// PROMPTS - Plantillas reutilizables para interacciones con LLMs
// ============================================================================

/**
 * Prompt para analizar código encontrado
 */
server.prompt(
    "analyze_code",
    {
        query: z.string().describe("Consulta de búsqueda"),
        focus: z.string().optional().describe("Aspecto específico a analizar (ej: 'seguridad', 'rendimiento', 'bugs')")
    },
    ({ query, focus }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Analiza el código relacionado con: "${query}"${focus ? ` con enfoque en: ${focus}` : ''}\n\n` +
                    `Pasos a seguir:\n` +
                    `1. Usa search_code para encontrar funciones relevantes\n` +
                    `2. Usa get_code_chunk para examinar el código específico\n` +
                    `3. Proporciona un análisis detallado${focus ? ` enfocado en ${focus}` : ''}\n` +
                    `4. Sugiere mejoras si es necesario`
            }
        }]
    })
);

/**
 * Prompt para encontrar funciones similares
 */
server.prompt(
    "find_similar_functions",
    {
        functionality: z.string().describe("Descripción de la funcionalidad buscada")
    },
    ({ functionality }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Encuentra funciones existentes que implementen: "${functionality}"\n\n` +
                    `Pasos:\n` +
                    `1. Usa search_code con diferentes variaciones de la consulta\n` +
                    `2. Examina los resultados con get_code_chunk\n` +
                    `3. Identifica si ya existe una implementación similar\n` +
                    `4. Si existe, explica cómo reutilizarla\n` +
                    `5. Si no existe, sugiere dónde implementarla basándote en la estructura del proyecto`
            }
        }]
    })
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // El servidor ahora está ejecutándose y esperando conexiones MCP
    console.error("🚀 Servidor MCP PAMPA iniciado y listo para conexiones");
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    process.exit(1);
});

// Ejecutar el servidor
main().catch(error => {
    console.error('❌ Error iniciando servidor MCP:', error);
    process.exit(1);
}); 