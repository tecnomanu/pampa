#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Script de diagnóstico para PAMPA
 * Ayuda a identificar problemas comunes y configuración
 */

class PampaDiagnostics {
    constructor() {
        this.issues = [];
        this.warnings = [];
        this.info = [];
    }

    addIssue(message) {
        this.issues.push(message);
        console.error(`❌ PROBLEMA: ${message}`);
    }

    addWarning(message) {
        this.warnings.push(message);
        console.warn(`⚠️  ADVERTENCIA: ${message}`);
    }

    addInfo(message) {
        this.info.push(message);
        console.log(`ℹ️  INFO: ${message}`);
    }

    async checkFileSystem() {
        console.log('\n🔍 Verificando sistema de archivos...');

        // Verificar directorio .pampa
        if (!fs.existsSync('.pampa')) {
            this.addIssue('Directorio .pampa no encontrado. Ejecuta index_project primero.');
        } else {
            this.addInfo('Directorio .pampa encontrado ✅');

            // Verificar base de datos
            if (!fs.existsSync('.pampa/pampa.db')) {
                this.addIssue('Base de datos .pampa/pampa.db no encontrada');
            } else {
                const stats = fs.statSync('.pampa/pampa.db');
                this.addInfo(`Base de datos encontrada (${(stats.size / 1024).toFixed(1)} KB) ✅`);
            }

            // Verificar directorio chunks
            if (!fs.existsSync('.pampa/chunks')) {
                this.addIssue('Directorio .pampa/chunks no encontrado');
            } else {
                const chunks = fs.readdirSync('.pampa/chunks');
                this.addInfo(`Directorio chunks encontrado con ${chunks.length} archivos ✅`);
            }
        }

        // Verificar codemap
        if (!fs.existsSync('pampa.codemap.json')) {
            this.addIssue('Archivo pampa.codemap.json no encontrado');
        } else {
            try {
                const codemap = JSON.parse(fs.readFileSync('pampa.codemap.json', 'utf8'));
                const chunkCount = Object.keys(codemap).length;
                this.addInfo(`Codemap encontrado con ${chunkCount} chunks ✅`);
            } catch (error) {
                this.addIssue(`Error leyendo pampa.codemap.json: ${error.message}`);
            }
        }

        // Verificar log de errores
        if (fs.existsSync('pampa_error.log')) {
            const stats = fs.statSync('pampa_error.log');
            this.addWarning(`Log de errores existe (${(stats.size / 1024).toFixed(1)} KB). Revisa errores recientes.`);
        }
    }

    async checkDependencies() {
        console.log('\n📦 Verificando dependencias...');

        if (!fs.existsSync('package.json')) {
            this.addWarning('package.json no encontrado en el directorio actual');
            return;
        }

        try {
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            // Dependencias críticas
            const criticalDeps = [
                '@modelcontextprotocol/sdk',
                'sqlite3',
                'tree-sitter',
                'tree-sitter-javascript',
                'zod'
            ];

            const optionalDeps = [
                'openai',
                '@xenova/transformers',
                'ollama',
                'cohere-ai'
            ];

            for (const dep of criticalDeps) {
                if (deps[dep]) {
                    this.addInfo(`${dep} instalado (${deps[dep]}) ✅`);
                } else {
                    this.addIssue(`Dependencia crítica faltante: ${dep}`);
                }
            }

            let providersAvailable = 0;
            for (const dep of optionalDeps) {
                if (deps[dep]) {
                    this.addInfo(`Proveedor de embeddings disponible: ${dep} (${deps[dep]}) ✅`);
                    providersAvailable++;
                } else {
                    this.addWarning(`Proveedor opcional no instalado: ${dep}`);
                }
            }

            if (providersAvailable === 0) {
                this.addIssue('No hay proveedores de embeddings instalados');
            }

        } catch (error) {
            this.addIssue(`Error leyendo package.json: ${error.message}`);
        }
    }

    async checkEnvironment() {
        console.log('\n🌍 Verificando variables de entorno...');

        // Variables de entorno opcionales pero útiles
        const envVars = {
            'OPENAI_API_KEY': 'OpenAI API',
            'COHERE_API_KEY': 'Cohere API'
        };

        for (const [envVar, description] of Object.entries(envVars)) {
            if (process.env[envVar]) {
                this.addInfo(`${description} configurada ✅`);
            } else {
                this.addWarning(`${description} no configurada (${envVar})`);
            }
        }
    }

    async checkMcpServer() {
        console.log('\n🖥️  Verificando servidor MCP...');

        if (!fs.existsSync('mcp-server.js')) {
            this.addIssue('mcp-server.js no encontrado');
            return;
        }

        try {
            const serverContent = fs.readFileSync('mcp-server.js', 'utf8');

            // Verificar importaciones críticas
            const criticalImports = [
                'McpServer',
                'StdioServerTransport',
                'getChunk',
                'indexProject',
                'searchCode'
            ];

            for (const imp of criticalImports) {
                if (serverContent.includes(imp)) {
                    this.addInfo(`Importación encontrada: ${imp} ✅`);
                } else {
                    this.addIssue(`Importación faltante: ${imp}`);
                }
            }

            // Verificar si hay sistema de logging
            if (serverContent.includes('ErrorLogger')) {
                this.addInfo('Sistema de logging de errores encontrado ✅');
            } else {
                this.addWarning('Sistema de logging no encontrado');
            }

        } catch (error) {
            this.addIssue(`Error leyendo mcp-server.js: ${error.message}`);
        }
    }

    async checkIndexer() {
        console.log('\n🔧 Verificando indexer...');

        if (!fs.existsSync('indexer.js')) {
            this.addIssue('indexer.js no encontrado');
            return;
        }

        try {
            const indexerContent = fs.readFileSync('indexer.js', 'utf8');

            // Verificar funciones críticas
            const criticalFunctions = [
                'export async function searchCode',
                'export async function indexProject',
                'export async function getChunk'
            ];

            for (const func of criticalFunctions) {
                if (indexerContent.includes(func)) {
                    this.addInfo(`Función encontrada: ${func.split(' ').pop()} ✅`);
                } else {
                    this.addIssue(`Función faltante: ${func.split(' ').pop()}`);
                }
            }

        } catch (error) {
            this.addIssue(`Error leyendo indexer.js: ${error.message}`);
        }
    }

    generateReport() {
        console.log('\n📊 RESUMEN DEL DIAGNÓSTICO\n');
        console.log('='.repeat(50));

        if (this.issues.length === 0) {
            console.log('🎉 ¡No se encontraron problemas críticos!');
        } else {
            console.log(`❌ PROBLEMAS CRÍTICOS (${this.issues.length}):`);
            this.issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
        }

        if (this.warnings.length > 0) {
            console.log(`\n⚠️  ADVERTENCIAS (${this.warnings.length}):`);
            this.warnings.forEach((warning, i) => console.log(`   ${i + 1}. ${warning}`));
        }

        console.log(`\nℹ️  INFORMACIÓN (${this.info.length}):`);
        this.info.forEach((info, i) => console.log(`   ${i + 1}. ${info}`));

        console.log('\n💡 RECOMENDACIONES:');

        if (this.issues.some(i => i.includes('.pampa'))) {
            console.log('   • Ejecuta: node mcp-server.js y usa index_project');
        }

        if (this.issues.some(i => i.includes('dependencia'))) {
            console.log('   • Ejecuta: npm install');
        }

        if (this.warnings.some(w => w.includes('proveedor'))) {
            console.log('   • Instala al menos un proveedor: npm install @xenova/transformers');
        }

        if (fs.existsSync('pampa_error.log')) {
            console.log('   • Revisa pampa_error.log para errores detallados');
        }

        console.log('\n🔗 Para más ayuda: https://github.com/tu-repo/pampa-ia');
    }

    async run() {
        console.log('🔍 DIAGNÓSTICO DE PAMPA\n');
        console.log('Verificando configuración y estado del sistema...\n');

        await this.checkFileSystem();
        await this.checkDependencies();
        await this.checkEnvironment();
        await this.checkMcpServer();
        await this.checkIndexer();

        this.generateReport();
    }
}

// Ejecutar diagnóstico si se llama directamente
if (process.argv[1] && process.argv[1].endsWith('pampa-diagnostics.js')) {
    const diagnostics = new PampaDiagnostics();
    diagnostics.run().catch(error => {
        console.error('❌ Error ejecutando diagnóstico:', error);
        process.exit(1);
    });
}

export default PampaDiagnostics; 