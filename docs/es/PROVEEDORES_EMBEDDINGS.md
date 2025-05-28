# 🧠 Proveedores de Embeddings en PAMPA

PAMPA soporta múltiples proveedores de embeddings para generar vectores de código. Puedes elegir entre opciones locales (gratis, privadas) y APIs externas (más potentes).

## 🏠 Proveedores Locales (Recomendado)

### Transformers.js

**Modelo local que ejecuta en Node.js sin dependencias externas**

```bash
# Instalar dependencia
npm install @xenova/transformers

# Indexar con modelo local
npx pampa index --provider transformers
```

**Características:**

-   ✅ **Completamente gratis**
-   ✅ **Privacidad total** - El código nunca sale de tu máquina
-   ✅ **Sin límites de uso**
-   ✅ **Funciona offline**
-   ⚠️ Menor calidad que modelos grandes
-   ⚠️ Primera ejecución lenta (descarga modelo ~50MB)

**Modelo usado:** `all-MiniLM-L6-v2` (384 dimensiones)

### Ollama

**Modelos locales más potentes via Ollama**

```bash
# Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Instalar modelo de embeddings
ollama pull nomic-embed-text

# Instalar dependencia Node.js
npm install ollama

# Indexar con Ollama
npx pampa index --provider ollama
```

**Características:**

-   ✅ **Gratis y local**
-   ✅ **Modelos más potentes**
-   ✅ **Privacidad total**
-   ⚠️ Requiere instalación de Ollama
-   ⚠️ Usa más recursos (RAM/CPU)

**Modelo usado:** `nomic-embed-text` (768 dimensiones)

## 🌐 Proveedores de API

### OpenAI (Por defecto)

**El más potente y usado por defecto**

```bash
# Configurar API key
export OPENAI_API_KEY="tu-api-key"

# Indexar con OpenAI
npx pampa index --provider openai
```

**Características:**

-   ✅ **Máxima calidad** de embeddings
-   ✅ **Rápido y confiable**
-   ✅ **Bien optimizado para código**
-   ❌ **Costo por uso** (~$0.0001 por función)
-   ❌ **Requiere internet**
-   ❌ **El código se envía a OpenAI**

**Modelo usado:** `text-embedding-3-large` (3072 dimensiones)
**Costo estimado:** $0.10 por 1000 funciones

### Cohere

**Alternativa más económica a OpenAI**

```bash
# Instalar dependencia
npm install cohere-ai

# Configurar API key
export COHERE_API_KEY="tu-api-key"

# Indexar con Cohere
npx pampa index --provider cohere
```

**Características:**

-   ✅ **Más barato que OpenAI**
-   ✅ **Buena calidad**
-   ✅ **API confiable**
-   ❌ **Costo por uso** (menor que OpenAI)
-   ❌ **Requiere internet**

**Modelo usado:** `embed-english-v3.0` (1024 dimensiones)

## 🔄 Auto-detección

Por defecto, PAMPA usa **auto-detección** inteligente:

```bash
# Auto-detecta el mejor proveedor disponible
npx pampa index
```

**Orden de prioridad:**

1. **OpenAI** - Si `OPENAI_API_KEY` está configurado
2. **Cohere** - Si `COHERE_API_KEY` está configurado
3. **Transformers.js** - Como fallback local

## 📊 Comparación de Proveedores

| Proveedor           | Costo            | Calidad      | Privacidad | Velocidad | Dimensiones |
| ------------------- | ---------------- | ------------ | ---------- | --------- | ----------- |
| **Transformers.js** | 🟢 Gratis        | 🟡 Buena     | 🟢 Total   | 🟡 Media  | 384         |
| **Ollama**          | 🟢 Gratis        | 🟢 Muy buena | 🟢 Total   | 🟡 Media  | 768         |
| **OpenAI**          | 🔴 $0.0001/func  | 🟢 Excelente | 🔴 Ninguna | 🟢 Rápida | 3072        |
| **Cohere**          | 🟡 $0.00005/func | 🟢 Muy buena | 🔴 Ninguna | 🟢 Rápida | 1024        |

## 🛠️ Configuración Avanzada

### Cambiar modelo de Ollama

```javascript
// En indexer.js, puedes cambiar el modelo:
new OllamaProvider('mxbai-embed-large'); // Modelo más potente
```

### Usar múltiples proveedores

```bash
# Indexar con diferentes proveedores para comparar
npx pampa index --provider openai
npx pampa index --provider transformers

# Buscar especificando el proveedor
npx pampa search "función auth" --provider openai
npx pampa search "función auth" --provider transformers
```

## 🔍 Compatibilidad de Búsqueda

**Importante:** Solo puedes buscar en chunks indexados con el mismo proveedor y dimensiones.

```bash
# ✅ Funciona - mismo proveedor
npx pampa index --provider openai
npx pampa search "auth" --provider openai

# ❌ No encuentra resultados - diferentes proveedores
npx pampa index --provider openai
npx pampa search "auth" --provider transformers
```

## 💡 Recomendaciones

### Para desarrollo personal/privado:

```bash
npm install @xenova/transformers
npx pampa index --provider transformers
```

### Para equipos con presupuesto:

```bash
export OPENAI_API_KEY="tu-key"
npx pampa index --provider openai
```

### Para máximo rendimiento local:

```bash
# Instalar Ollama primero
ollama pull nomic-embed-text
npm install ollama
npx pampa index --provider ollama
```

### Para proyectos open source:

```bash
# Usar modelo local y commitear el codemap
npx pampa index --provider transformers
git add pampa.codemap.json
git commit -m "Add PAMPA codemap with local embeddings"
```

## 🐛 Solución de Problemas

### Error: "Transformers.js no está instalado"

```bash
npm install @xenova/transformers
```

### Error: "Ollama no está instalado"

```bash
# Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull nomic-embed-text
npm install ollama
```

### Error: "No se encontraron chunks indexados"

```bash
# Re-indexar con el proveedor correcto
npx pampa index --provider transformers
```

### Cambiar de proveedor

```bash
# Limpiar base de datos anterior
rm -rf .pampa/
npx pampa index --provider nuevo-proveedor
```

¡Elige el proveedor que mejor se adapte a tus necesidades! 🚀
