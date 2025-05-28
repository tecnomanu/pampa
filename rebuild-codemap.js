#!/usr/bin/env node

import fs from 'fs';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

/**
 * Script para reconstruir pampa.codemap.json desde la base de datos
 */

async function rebuildCodemap() {
    console.log('🔄 Reconstruyendo pampa.codemap.json desde la base de datos...');

    try {
        // Verificar que existe la base de datos
        if (!fs.existsSync('.pampa/pampa.db')) {
            console.error('❌ Error: No se encontró .pampa/pampa.db');
            process.exit(1);
        }

        const db = new sqlite3.Database('.pampa/pampa.db');
        const all = promisify(db.all.bind(db));

        // Obtener todos los chunks de la base de datos
        console.log('📊 Obteniendo chunks de la base de datos...');
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

        console.log(`✅ Encontrados ${chunks.length} chunks en la base de datos`);

        // Construir el objeto codemap
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

        // Guardar el codemap
        const codemapPath = 'pampa.codemap.json';
        console.log(`💾 Guardando codemap en ${codemapPath}...`);

        fs.writeFileSync(codemapPath, JSON.stringify(codemap, null, 2));

        console.log('✅ ¡Codemap reconstruido exitosamente!');
        console.log(`📈 Total de chunks: ${chunks.length}`);

        // Estadísticas por lenguaje
        const langStats = chunks.reduce((acc, chunk) => {
            acc[chunk.lang] = (acc[chunk.lang] || 0) + 1;
            return acc;
        }, {});

        console.log('📊 Estadísticas por lenguaje:');
        Object.entries(langStats).forEach(([lang, count]) => {
            console.log(`   ${lang}: ${count} chunks`);
        });

        // Estadísticas por archivo
        const fileStats = chunks.reduce((acc, chunk) => {
            acc[chunk.file_path] = (acc[chunk.file_path] || 0) + 1;
            return acc;
        }, {});

        const topFiles = Object.entries(fileStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        console.log('📁 Top 5 archivos con más chunks:');
        topFiles.forEach(([file, count]) => {
            console.log(`   ${file}: ${count} chunks`);
        });

        console.log('\n🎉 Codemap reconstruido exitosamente. Ya puedes usar search_code.');

    } catch (error) {
        console.error('❌ Error reconstruyendo codemap:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (process.argv[1] && process.argv[1].endsWith('rebuild-codemap.js')) {
    rebuildCodemap();
} 