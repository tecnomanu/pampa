import { z } from 'zod';

import { CodemapChunkSchema, CodemapSchema } from './types.js';

export { DEFAULT_PATH_WEIGHT, DEFAULT_SUCCESS_RATE, CodemapChunkSchema, CodemapSchema, normalizeChunkMetadata, normalizeCodemapRecord, ensureCodemapDefaults } from './types.js';

export type CodemapChunk = z.infer<typeof CodemapChunkSchema>;
export type Codemap = z.infer<typeof CodemapSchema>;
