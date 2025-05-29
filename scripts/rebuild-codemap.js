#!/usr/bin/env node

import fs from 'fs';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

/**
 * Script to rebuild pampa.codemap.json from the database
 */

async function rebuildCodemap() {
    console.log('🔄 Rebuilding pampa.codemap.json from database...');

    try {
        // Verify that the database exists
        if (!fs.existsSync('.pampa/pampa.db')) {
            console.error('❌ Error: .pampa/pampa.db not found');
            process.exit(1);
        }

        const db = new sqlite3.Database('.pampa/pampa.db');
        const all = promisify(db.all.bind(db));

        // Get all chunks from database
        console.log('📊 Getting chunks from database...');
        const chunks = await all(`
            SELECT 
                id, 
                file_path, 
                symbol, 
                sha, 
                lang, 
                embedding_provider, 
                embedding_dimensions 
            FROM code_chunks 
            ORDER BY file_path, symbol
        `);

        console.log(`✅ Found ${chunks.length} chunks in database`);

        // Build the codemap object
        const codemap = {};
        for (const chunk of chunks) {
            codemap[chunk.id] = {
                file: chunk.file_path,
                symbol: chunk.symbol,
                sha: chunk.sha,
                lang: chunk.lang,
                provider: chunk.embedding_provider,
                dimensions: chunk.embedding_dimensions
            };
        }

        db.close();

        // Save the codemap
        const codemapPath = 'pampa.codemap.json';
        console.log(`💾 Saving codemap to ${codemapPath}...`);

        fs.writeFileSync(codemapPath, JSON.stringify(codemap, null, 2));

        console.log('✅ Codemap rebuilt successfully!');
        console.log(`📈 Total chunks: ${chunks.length}`);

        // Statistics by language
        const langStats = chunks.reduce((acc, chunk) => {
            acc[chunk.lang] = (acc[chunk.lang] || 0) + 1;
            return acc;
        }, {});

        console.log('📊 Statistics by language:');
        Object.entries(langStats).forEach(([lang, count]) => {
            console.log(`   ${lang}: ${count} chunks`);
        });

        // Statistics by file
        const fileStats = chunks.reduce((acc, chunk) => {
            acc[chunk.file_path] = (acc[chunk.file_path] || 0) + 1;
            return acc;
        }, {});

        const topFiles = Object.entries(fileStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        console.log('📁 Top 5 files with most chunks:');
        topFiles.forEach(([file, count]) => {
            console.log(`   ${file}: ${count} chunks`);
        });

        console.log('\n🎉 Codemap rebuilt successfully. You can now use search_code.');

    } catch (error) {
        console.error('❌ Error rebuilding codemap:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('rebuild-codemap.js')) {
    rebuildCodemap();
} 