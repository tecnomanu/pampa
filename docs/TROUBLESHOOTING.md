# 🔧 Guía de Resolución de Problemas - PAMPA

Esta guía te ayudará a diagnosticar y resolver problemas comunes con PAMPA (Protocolo para Memoria Aumentada de Artefactos de Proyecto).

## 🚀 Diagnóstico Rápido

Antes de investigar problemas específicos, ejecuta el script de diagnóstico:

```bash
node pampa-diagnostics.js
```

Este script verificará automáticamente:

-   ✅ Sistema de archivos y estructura de directorios
-   ✅ Dependencias instaladas
-   ✅ Variables de entorno
-   ✅ Configuración del servidor MCP
-   ✅ Estado del indexer

## ❌ Problemas Comunes y Soluciones

### 1. Error: "search_code se desconecta"

**Síntomas:**

-   El comando `search_code` causa desconexión del servidor MCP
-   Error en la consola o log

**Posibles causas y soluciones:**

#### A. Proyecto no indexado

```bash
# Verificar si existe .pampa/
ls -la .pampa/

# Si no existe, indexar el proyecto
# Usa el comando index_project en tu cliente MCP
```

#### B. Base de datos corrupta

```bash
# Borrar y re-indexar
rm -rf .pampa/
rm pampa.codemap.json
# Luego ejecutar index_project nuevamente
```

#### C. Proveedor de embeddings no disponible

```bash
# Instalar Transformers.js (proveedor local)
npm install @xenova/transformers

# O configurar OpenAI
export OPENAI_API_KEY="tu_api_key"
npm install openai
```

#### D. Memoria insuficiente

```bash
# Aumentar memoria para Node.js
node --max-old-space-size=4096 mcp-server.js
```

### 2. Error: "No se encontraron chunks indexados"

**Síntomas:**

-   `search_code` devuelve resultados vacíos
-   Mensaje sobre chunks no encontrados

**Soluciones:**

#### Verificar codemap

```bash
# Comprobar si existe y no está vacío
cat pampa.codemap.json | jq 'length'

# Si está vacío, re-indexar
```

#### Verificar proveedor consistente

```bash
# Usar el mismo proveedor para indexar y buscar
# Si indexaste con 'openai', busca con 'openai'
# Si indexaste con 'transformers', busca con 'transformers'
```

### 3. Error: "Dependencias faltantes"

**Síntomas:**

-   Error al importar módulos
-   Funciones no definidas

**Soluciones:**

#### Instalar dependencias básicas

```bash
npm install @modelcontextprotocol/sdk sqlite3 tree-sitter tree-sitter-javascript zod fast-glob
```

#### Instalar tree-sitter para otros lenguajes

```bash
npm install tree-sitter-typescript tree-sitter-go tree-sitter-java tree-sitter-php
```

#### Instalar al menos un proveedor de embeddings

```bash
# Opción 1: Local (sin API key)
npm install @xenova/transformers

# Opción 2: OpenAI (requiere API key)
npm install openai

# Opción 3: Ollama (requiere Ollama corriendo)
npm install ollama

# Opción 4: Cohere (requiere API key)
npm install cohere-ai
```

### 4. Error: "Cannot read properties of undefined"

**Síntomas:**

-   Errores de JavaScript sobre propiedades undefined
-   Stack trace en el log

**Soluciones:**

#### Verificar versiones de Node.js

```bash
node --version  # Requiere Node.js 18+
```

#### Limpiar cache de npm

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 5. Problemas de rendimiento

**Síntomas:**

-   Búsquedas muy lentas
-   Servidor que no responde

**Soluciones:**

#### Reducir tamaño del proyecto

```bash
# Añadir .gitignore o .pampignore para excluir:
echo "node_modules/" >> .pampignore
echo "dist/" >> .pampignore
echo "build/" >> .pampignore
```

#### Usar proveedor local

```bash
# Transformers.js es más rápido para proyectos pequeños
# OpenAI es mejor para proyectos grandes
```

#### Optimizar base de datos

```bash
# Si la base de datos es muy grande, re-indexar
rm .pampa/pampa.db
# Luego ejecutar index_project
```

## 📝 Sistema de Logging

PAMPA ahora incluye un sistema robusto de logging de errores:

### Revisar logs de errores

```bash
# Ver errores recientes
tail -f pampa_error.log

# Buscar errores específicos
grep "search_code" pampa_error.log

# Ver estadísticas de errores
grep -c "ERROR:" pampa_error.log
```

### Formato del log

```
[2024-01-15T10:30:45.123Z] ERROR: Description
Context: {
  "query": "search term",
  "provider": "openai",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
Stack: Error stack trace
================================================================================
```

## 🔍 Comandos de Diagnóstico

### Verificar estado completo

```bash
node pampa-diagnostics.js
```

### Verificar archivos manualmente

```bash
# Estructura esperada
ls -la .pampa/          # Directorio principal
ls -la .pampa/chunks/   # Chunks de código
ls -la .pampa/pampa.db  # Base de datos SQLite
ls -la pampa.codemap.json  # Mapa de código
```

### Verificar base de datos

```bash
# Si tienes sqlite3 instalado
sqlite3 .pampa/pampa.db "SELECT COUNT(*) FROM code_chunks;"
sqlite3 .pampa/pampa.db "SELECT DISTINCT embedding_provider FROM code_chunks;"
```

### Probar conexión MCP

```bash
# Ejecutar servidor en modo verbose
node mcp-server.js 2>&1 | tee server.log
```

## 🛠️ Soluciones Avanzadas

### Reconstruir completamente

Si nada funciona, reconstruye desde cero:

```bash
# 1. Limpiar todo
rm -rf .pampa/ pampa.codemap.json pampa_error.log

# 2. Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install

# 3. Re-indexar con proveedor local
# Usar index_project con provider='transformers'

# 4. Probar búsqueda simple
# Usar search_code con una consulta simple
```

### Debug del indexer

```bash
# Ejecutar indexer directamente para debug
node -e "
import { indexProject } from './indexer.js';
await indexProject({ repoPath: '.', provider: 'transformers' });
"
```

### Debug del search

```bash
# Probar búsqueda directamente
node -e "
import { searchCode } from './indexer.js';
const results = await searchCode('function', 5, 'transformers');
console.log(results);
"
```

## 📞 Obtener Ayuda

1. **Ejecutar diagnóstico:** `node pampa-diagnostics.js`
2. **Revisar logs:** `cat pampa_error.log`
3. **Verificar issue conocidos:** Buscar en GitHub issues
4. **Crear nuevo issue:** Incluir salida del diagnóstico y logs

## 📋 Checklist de Resolución

-   [ ] Ejecuté `node pampa-diagnostics.js`
-   [ ] Verifiqué que todas las dependencias están instaladas
-   [ ] Confirmé que el proyecto está indexado
-   [ ] Reviséerrores en `pampa_error.log`
-   [ ] Probé con diferentes proveedores de embeddings
-   [ ] Limpié caché y reinstalé dependencias
-   [ ] Verifiqué permisos de archivos y directorios

---

💡 **Consejo:** El diagnóstico automatizado (`node pampa-diagnostics.js`) resolverá el 90% de los problemas comunes.
