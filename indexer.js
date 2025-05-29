/**
 * PAMPA Indexer - Presentation Layer
 * 
 * This module provides the user-facing interface for PAMPA core services.
 * It handles logging, console output, and user feedback while delegating
 * business logic to the service layer.
 */

import * as service from './service.js';

// Re-export service functions with presentation layer
export async function indexProject({ repoPath = '.', provider = 'auto' }) {
    console.log('Starting project indexing...');
    console.log(`Provider: ${provider}`);

    const result = await service.indexProject({
        repoPath,
        provider,
        onProgress: ({ type, file, symbol }) => {
            // Silent progress - could add verbose mode here
        }
    });

    if (result.success) {
        console.log('Indexing completed successfully');

        // Log errors if any
        if (result.errors.length > 0) {
            console.log(`${result.errors.length} errors occurred during indexing:`);
            result.errors.forEach(error => {
                console.error(`ERROR ${error.type}: ${error.error}`);
            });
        }
    } else {
        console.error('Indexing failed');
        throw new Error(result.message || 'Unknown indexing error');
    }

    return result;
}

export async function searchCode(query, limit = 10, provider = 'auto') {
    const result = await service.searchCode(query, limit, provider);

    if (!result.success) {
        if (result.error === 'no_chunks_found') {
            console.log(`WARNING: ${result.message}`);
            console.log(`TIP: ${result.suggestion}`);
        } else if (result.error === 'no_relevant_matches') {
            console.log(`NO MATCHES: ${result.message}`);
            console.log(`TIP: ${result.suggestion}`);
        } else {
            console.error('Search error:', result.message);
        }
        return [];
    }

    // Convert to legacy format for backward compatibility
    return result.results;
}

export async function getChunk(sha) {
    const result = await service.getChunk(sha);

    if (!result.success) {
        throw new Error(result.message);
    }

    return result.content;
}