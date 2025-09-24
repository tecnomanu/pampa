import { z } from 'zod';
import { loadContextPack } from '../../context/packs.js';

export const useContextPackInputSchema = z.object({
    name: z.string().min(1, 'Context pack name is required'),
    path: z.string().optional()
});

export const useContextPackResultSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    pack: z.object({
        key: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        scope: z.record(z.any())
    }).optional()
});

export function createUseContextPackHandler(options) {
    const { getWorkingPath, setSessionPack, clearSessionPack, errorLogger } = options;

    return async ({ name, path: explicitPath }) => {
        const basePath = explicitPath && explicitPath.trim().length > 0
            ? explicitPath.trim()
            : (typeof getWorkingPath === 'function' ? getWorkingPath() : '.');

        if (name === 'default' || name === 'none' || name === 'clear') {
            if (typeof clearSessionPack === 'function') {
                clearSessionPack();
            }
            if (errorLogger && typeof errorLogger.debugLog === 'function') {
                errorLogger.debugLog('Cleared MCP session context pack', { basePath, name });
            }
            return {
                success: true,
                message: 'Cleared active context pack for this session'
            };
        }

        try {
            const pack = loadContextPack(name, basePath);
            const sessionPack = {
                ...pack,
                basePath
            };

            if (typeof setSessionPack === 'function') {
                setSessionPack(sessionPack);
            }

            if (errorLogger && typeof errorLogger.debugLog === 'function') {
                errorLogger.debugLog('Activated MCP session context pack', {
                    pack: pack.key,
                    basePath
                });
            }

            return {
                success: true,
                message: `Context pack "${pack.key}" activated for session`,
                pack: {
                    key: pack.key,
                    name: pack.name,
                    description: pack.description || null,
                    scope: pack.scope
                }
            };
        } catch (error) {
            if (errorLogger && typeof errorLogger.log === 'function') {
                errorLogger.log(error, {
                    operation: 'use_context_pack',
                    name,
                    basePath
                });
            }
            throw error;
        }
    };
}

export function registerUseContextPackTool(server, options) {
    const handler = createUseContextPackHandler(options);

    server.tool(
        'use_context_pack',
        useContextPackInputSchema,
        async (params) => {
            const result = await handler(params);
            return {
                content: [
                    {
                        type: 'text',
                        text: result.message
                    }
                ]
            };
        }
    );

    return handler;
}
