#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getChunk, indexProject, searchCode } from './indexer.js';

// ============================================================================
// SISTEMA DE LOGGING DE ERRORES
// ============================================================================

class ErrorLogger {
    constructor(logFile = 'pampa_error.log') {
        this.logFile = logFile;
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (logDir !== '.' && !fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(error, context = {}) {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            message: error.message,
            stack: error.stack,
            context,
            type: error.constructor.name
        };

        const logEntry = `[${timestamp}] ERROR: ${error.message}\n` +
            `Context: ${JSON.stringify(context, null, 2)}\n` +
            `Stack: ${error.stack}\n` +
            `${'='.repeat(80)}\n\n`;

        try {
            fs.appendFileSync(this.logFile, logEntry);
            console.error(`❌ Error logged to ${this.logFile}:`, error.message);
        } catch (logError) {
            console.error('❌ Failed to write to error log:', logError.message);
            console.error('❌ Original error:', error.message);
        }
    }

    async logAsync(error, context = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ASYNC ERROR: ${error.message}\n` +
            `Context: ${JSON.stringify(context, null, 2)}\n` +
            `Stack: ${error.stack}\n` +
            `${'='.repeat(80)}\n\n`;

        try {
            await fs.promises.appendFile(this.logFile, logEntry);
            console.error(`❌ Async error logged to ${this.logFile}:`, error.message);
        } catch (logError) {
            console.error('❌ Failed to write async error to log:', logError.message);
            console.error('❌ Original async error:', error.message);
        }
    }
}

// Instancia global del logger
const errorLogger = new ErrorLogger();

// ============================================================================
// FUNCIONES DE UTILIDAD PARA VALIDACIÓN
// ============================================================================

function validateEnvironment() {
    const errors = [];

    // Verificar si el directorio .pampa existe
    if (!fs.existsSync('.pampa')) {
        errors.push('Directorio .pampa no encontrado. Ejecuta index_project primero.');
    }

    // Verificar si existe la base de datos
    if (!fs.existsSync('.pampa/pampa.db')) {
        errors.push('Base de datos .pampa/pampa.db no encontrada. Ejecuta index_project primero.');
    }

    return errors;
}

async function safeAsyncCall(asyncFn, context = {}) {
    try {
        return await asyncFn();
    } catch (error) {
        await errorLogger.logAsync(error, context);
        throw error;
    }
}

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
    version: "0.4.1"
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
        query: z.string().min(2, "La consulta no puede estar vacía").describe("Consulta de búsqueda semántica (ej: 'función de autenticación', 'manejo de errores')"),
        limit: z.number().optional().default(10).describe("Número máximo de resultados a devolver"),
        provider: z.string().optional().default("auto").describe("Proveedor de embeddings (auto|openai|transformers|ollama|cohere)")
    },
    async ({ query, limit, provider }) => {
        const context = { query, limit, provider, timestamp: new Date().toISOString() };

        try {
            // Validación y limpieza de parámetros
            if (!query || typeof query !== 'string') {
                await errorLogger.logAsync(new Error('Query undefined o tipo inválido'), {
                    ...context,
                    receivedQuery: query,
                    queryType: typeof query
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: La consulta es requerida y debe ser un string válido.\n\n` +
                            `Ejemplos de uso correcto:\n` +
                            `- "función de autenticación"\n` +
                            `- "manejo de errores"\n` +
                            `- "listar usuarios"\n\n` +
                            `Error registrado en pampa_error.log`
                    }],
                    isError: true
                };
            }

            const cleanQuery = query.trim();
            const cleanProvider = provider ? provider.trim() : 'auto';

            if (cleanQuery.length === 0) {
                await errorLogger.logAsync(new Error('Query vacío después de trim'), {
                    ...context,
                    originalQuery: query,
                    cleanQuery: cleanQuery
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: La consulta no puede estar vacía.\n\n` +
                            `Proporciona una consulta válida como:\n` +
                            `- "función de login"\n` +
                            `- "validar datos"\n` +
                            `- "conectar base de datos"\n\n` +
                            `Error registrado en pampa_error.log`
                    }],
                    isError: true
                };
            }

            // Validaciones del entorno
            const envErrors = validateEnvironment();
            if (envErrors.length > 0) {
                const errorMsg = `ERRORES DE ENTORNO:\n${envErrors.map(e => `- ${e}`).join('\n')}`;
                await errorLogger.logAsync(new Error('Environment validation failed'), {
                    ...context,
                    query: cleanQuery,
                    envErrors
                });

                return {
                    content: [{
                        type: "text",
                        text: errorMsg + '\n\nSolucion: Ejecuta index_project primero para preparar el entorno.'
                    }],
                    isError: true
                };
            }

            const results = await safeAsyncCall(
                () => searchCode(cleanQuery, limit, cleanProvider),
                { ...context, query: cleanQuery, provider: cleanProvider, step: 'searchCode_call' }
            );

            if (results.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No se encontraron resultados para: "${cleanQuery}"\n\n` +
                            `Estado del sistema:\n` +
                            `- Proveedor usado: ${cleanProvider}\n` +
                            `- Base de datos: ${fs.existsSync('.pampa/pampa.db') ? 'Disponible' : 'No encontrada'}\n` +
                            `- Codemap: ${fs.existsSync('pampa.codemap.json') ? 'Disponible' : 'No encontrado'}\n\n` +
                            `Sugerencias:\n` +
                            `- Verifica que el proyecto esté indexado (usa index_project)\n` +
                            `- Intenta con términos más generales\n` +
                            `- Revisa que existan archivos de código en el proyecto`
                    }]
                };
            }

            const resultText = results.map(result =>
                `Archivo: ${result.path}\nFuncion: ${result.meta.symbol} (${result.lang})\nSimilitud: ${result.meta.score}\nSHA: ${result.sha}\n`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Encontrados ${results.length} resultados para: "${cleanQuery}"\n\n${resultText}\nUsa get_code_chunk con el SHA para ver el código completo.`
                }]
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'search_code_tool' });

            return {
                content: [{
                    type: "text",
                    text: `ERROR en la búsqueda: ${error.message}\n\n` +
                        `Detalles técnicos:\n` +
                        `- Error: ${error.constructor.name}\n` +
                        `- Timestamp: ${context.timestamp}\n` +
                        `- Proveedor: ${provider}\n\n` +
                        `Error registrado en pampa_error.log\n\n` +
                        `Posibles soluciones:\n` +
                        `- Ejecuta index_project para reindexar\n` +
                        `- Verifica que las dependencias estén instaladas\n` +
                        `- Prueba con provider='transformers' para usar modelo local`
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
        sha: z.string().min(1, "SHA no puede estar vacío").describe("SHA del chunk de código a obtener")
    },
    async ({ sha }) => {
        const context = { sha, timestamp: new Date().toISOString() };

        try {
            // Validación robusta del SHA
            if (!sha || typeof sha !== 'string') {
                await errorLogger.logAsync(new Error('SHA undefined o tipo inválido'), {
                    ...context,
                    receivedSha: sha,
                    shaType: typeof sha
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: El SHA es requerido y debe ser un string válido.\n\n` +
                            `El SHA debe ser una cadena de texto obtenida de search_code.\n` +
                            `Ejemplo: "a1b2c3d4e5f6789"\n\n` +
                            `Error registrado en pampa_error.log`
                    }],
                    isError: true
                };
            }

            const cleanSha = sha.trim();

            if (cleanSha.length === 0) {
                await errorLogger.logAsync(new Error('SHA vacío después de trim'), {
                    ...context,
                    originalSha: sha,
                    cleanSha: cleanSha
                });

                return {
                    content: [{
                        type: "text",
                        text: `ERROR: El SHA no puede estar vacío.\n\n` +
                            `Proporciona un SHA válido obtenido de search_code.\n\n` +
                            `Error registrado en pampa_error.log`
                    }],
                    isError: true
                };
            }

            const code = await safeAsyncCall(
                () => getChunk(cleanSha),
                { ...context, sha: cleanSha, step: 'getChunk_call' }
            );

            return {
                content: [{
                    type: "text",
                    text: `\`\`\`\n${code}\n\`\`\``
                }]
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'get_code_chunk_tool' });

            return {
                content: [{
                    type: "text",
                    text: `ERROR obteniendo chunk: ${error.message}\n\n` +
                        `Detalles:\n` +
                        `- SHA solicitado: ${sha}\n` +
                        `- Timestamp: ${context.timestamp}\n` +
                        `- Directorio chunks: ${fs.existsSync('.pampa/chunks') ? 'Existe' : 'No encontrado'}\n\n` +
                        `Error registrado en pampa_error.log`
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
        const context = { projectPath, provider, timestamp: new Date().toISOString() };

        try {
            // Limpiar y validar parámetros
            const cleanPath = projectPath ? projectPath.trim() : '.';
            const cleanProvider = provider ? provider.trim() : 'auto';

            // Verificar que el directorio existe
            if (!fs.existsSync(cleanPath)) {
                throw new Error(`El directorio ${cleanPath} no existe`);
            }

            await safeAsyncCall(
                () => indexProject({ repoPath: cleanPath, provider: cleanProvider }),
                { ...context, projectPath: cleanPath, provider: cleanProvider, step: 'indexProject_call' }
            );

            return {
                content: [{
                    type: "text",
                    text: `Proyecto indexado exitosamente en: ${cleanPath}\n` +
                        `Proveedor: ${cleanProvider}\n\n` +
                        `Archivos creados:\n` +
                        `- ${fs.existsSync(path.join(cleanPath, 'pampa.codemap.json')) ? 'OK' : 'ERROR'} pampa.codemap.json\n` +
                        `- ${fs.existsSync(path.join(cleanPath, '.pampa/pampa.db')) ? 'OK' : 'ERROR'} .pampa/pampa.db\n` +
                        `- ${fs.existsSync(path.join(cleanPath, '.pampa/chunks')) ? 'OK' : 'ERROR'} .pampa/chunks/\n\n` +
                        `Ahora puedes usar search_code para buscar funciones y clases.`
                }]
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'index_project_tool' });

            return {
                content: [{
                    type: "text",
                    text: `ERROR indexando proyecto: ${error.message}\n\n` +
                        `Detalles técnicos:\n` +
                        `- Directorio: ${projectPath}\n` +
                        `- Proveedor: ${provider}\n` +
                        `- Timestamp: ${context.timestamp}\n\n` +
                        `Error registrado en pampa_error.log\n\n` +
                        `Posibles soluciones:\n` +
                        `- Verifica que el directorio existe y es accesible\n` +
                        `- Instala las dependencias necesarias (npm install)\n` +
                        `- Prueba con un proveedor diferente\n` +
                        `- Verifica permisos de escritura en el directorio`
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
        const context = { projectPath, timestamp: new Date().toISOString() };

        try {
            // Limpiar parámetro
            const cleanPath = projectPath ? projectPath.trim() : '.';
            const codemapPath = path.join(cleanPath, 'pampa.codemap.json');

            if (!fs.existsSync(codemapPath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Proyecto no indexado en: ${cleanPath}\n\n` +
                            `Usa index_project para indexar el proyecto primero.\n\n` +
                            `Estado del directorio:\n` +
                            `- Directorio existe: ${fs.existsSync(cleanPath) ? 'SI' : 'NO'}\n` +
                            `- pampa.codemap.json: NO encontrado\n` +
                            `- .pampa/: ${fs.existsSync(path.join(cleanPath, '.pampa')) ? 'SI' : 'NO'}`
                    }]
                };
            }

            const codemap = await safeAsyncCall(
                () => JSON.parse(fs.readFileSync(codemapPath, 'utf8')),
                { ...context, cleanPath, step: 'read_codemap' }
            );

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
                .map(([file, count]) => `  ${file}: ${count} funciones`)
                .join('\n');

            const langStatsText = Object.entries(langStats)
                .map(([lang, count]) => `  ${lang}: ${count} funciones`)
                .join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Estadisticas del proyecto: ${cleanPath}\n\n` +
                        `Total de funciones indexadas: ${chunks.length}\n\n` +
                        `Por lenguaje:\n${langStatsText}\n\n` +
                        `Archivos con mas funciones:\n${topFiles}`
                }]
            };
        } catch (error) {
            await errorLogger.logAsync(error, { ...context, step: 'get_project_stats_tool' });

            return {
                content: [{
                    type: "text",
                    text: `ERROR obteniendo estadísticas: ${error.message}\n\n` +
                        `Detalles:\n` +
                        `- Proyecto: ${projectPath}\n` +
                        `- Timestamp: ${context.timestamp}\n\n` +
                        `Error registrado en pampa_error.log\n\n` +
                        `Verifica que el proyecto esté indexado correctamente`
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
            await errorLogger.logAsync(error, { step: 'codemap_resource', uri: uri.href });
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error cargando mapa de código: ${error.message}\n\nError registrado en pampa_error.log`
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
            await errorLogger.logAsync(error, { step: 'overview_resource', uri: uri.href });
            return {
                contents: [{
                    uri: uri.href,
                    text: `Error generando resumen: ${error.message}\n\nError registrado en pampa_error.log`
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
    // Solo logging a stderr para diagnóstico, no a stdout
    if (process.env.PAMPA_DEBUG === 'true') {
        console.error("🚀 Servidor MCP PAMPA iniciado y listo para conexiones");
        console.error("📝 Sistema de logging de errores activado: pampa_error.log");
    }
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
    errorLogger.log(error, { type: 'uncaughtException' });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    errorLogger.log(new Error(reason), { type: 'unhandledRejection', promise: promise.toString() });
    process.exit(1);
});

// Ejecutar el servidor
main().catch(error => {
    console.error('❌ Error iniciando servidor MCP:', error);
    errorLogger.log(error, { type: 'main_startup_error' });
    process.exit(1);
});