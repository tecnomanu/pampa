# 🆓 Ejemplo: PAMPA sin OpenAI (100% Gratis)

Este ejemplo muestra cómo usar PAMPA completamente **gratis y privado** usando modelos locales.

## 🚀 Configuración Inicial

### 1. Instalar dependencias locales

```bash
# Instalar el modelo local de embeddings
npm install @xenova/transformers

# Verificar instalación
npx pampa --version
```

### 2. Indexar proyecto con modelo local

```bash
# Indexar usando Transformers.js (modelo local)
npx pampa index --provider transformers

# Salida esperada:
# 🔍 Encontrados X archivos para indexar
# 🧠 Usando proveedor: Transformers.js (Local)
# 🔄 Cargando modelo local de embeddings...
# ✅ Modelo local cargado
# ✅ Indexado: archivo.js:miFuncion:abc12345
# ...
# ✨ Indexación completada: X chunks procesados
# 🧠 Proveedor usado: Transformers.js (Local)
```

### 3. Verificar que funciona

```bash
# Ver estadísticas del proyecto
npx pampa info

# Buscar código
npx pampa search "función de validación" --provider transformers
```

## 📊 Comparación: Local vs OpenAI

### Indexando el mismo proyecto

```bash
# Proyecto de ejemplo con 50 funciones JavaScript

# ===== CON MODELO LOCAL =====
npx pampa index --provider transformers
# ✅ Costo: $0.00 (gratis)
# ✅ Privacidad: Total (código no sale de tu máquina)
# ⏱️ Tiempo: ~30 segundos (primera vez, luego ~10s)
# 📊 Calidad: Buena para la mayoría de casos

# ===== CON OPENAI =====
export OPENAI_API_KEY="sk-..."
npx pampa index --provider openai
# 💰 Costo: ~$0.005 (50 funciones × $0.0001)
# ❌ Privacidad: Código enviado a OpenAI
# ⏱️ Tiempo: ~15 segundos
# 📊 Calidad: Excelente
```

## 🔍 Ejemplo de Búsqueda

### Proyecto de ejemplo: E-commerce

```javascript
// src/auth/login.js
export function validateUser(email, password) {
	if (!email || !password) return false;
	return checkCredentials(email, password);
}

// src/auth/register.js
export function createUser(userData) {
	const user = new User(userData);
	return user.save();
}

// src/products/search.js
export function findProducts(query, filters) {
	return Product.search(query).filter(filters);
}
```

### Búsquedas con modelo local

```bash
# Buscar funciones de autenticación
npx pampa search "autenticación usuario" --provider transformers

# Resultado:
# 🔍 Encontrados 2 resultados para: "autenticación usuario"
#
# 1. 📁 src/auth/login.js
#    🔧 validateUser (javascript)
#    📊 Similitud: 0.8234
#    🔑 SHA: abc12345
#
# 2. 📁 src/auth/register.js
#    🔧 createUser (javascript)
#    📊 Similitud: 0.7891
#    🔑 SHA: def67890

# Buscar funciones de búsqueda
npx pampa search "buscar productos" --provider transformers

# Resultado:
# 1. 📁 src/products/search.js
#    🔧 findProducts (javascript)
#    📊 Similitud: 0.9123
#    🔑 SHA: ghi11121
```

## 🤖 Integración con Claude Desktop (Sin API Keys)

### Configuración mínima

```json
{
	"mcpServers": {
		"pampa": {
			"command": "npx",
			"args": ["pampa", "mcp"]
		}
	}
}
```

**Sin `OPENAI_API_KEY`** - PAMPA automáticamente usará el modelo local.

### Conversación de ejemplo con Claude

````
Usuario: "Busca funciones de validación en el proyecto"

Claude: Voy a buscar funciones de validación usando PAMPA.

[Usa search_code con query "validación"]

Encontré 3 funciones de validación:
1. validateUser en src/auth/login.js
2. validateEmail en src/utils/validation.js
3. validateProduct en src/products/validator.js

¿Te gustaría ver el código de alguna específica?

Usuario: "Muéstrame validateUser"

Claude: [Usa get_code_chunk con SHA de validateUser]

Aquí está la función validateUser:

```javascript
export function validateUser(email, password) {
    if (!email || !password) return false;
    return checkCredentials(email, password);
}
````

Esta función valida que tanto email como password estén presentes antes de verificar las credenciales.

````

## 💡 Ventajas del Modelo Local

### ✅ Beneficios

1. **Costo cero** - Sin límites de uso
2. **Privacidad total** - El código nunca sale de tu máquina
3. **Sin dependencias externas** - Funciona offline
4. **Instalación simple** - Solo `npm install @xenova/transformers`
5. **Buena calidad** - Suficiente para la mayoría de proyectos

### ⚠️ Limitaciones

1. **Primera ejecución lenta** - Descarga modelo (~50MB)
2. **Menor precisión** - Comparado con modelos grandes como GPT
3. **Menos dimensiones** - 384 vs 3072 de OpenAI
4. **Uso de RAM** - El modelo se carga en memoria

## 🔄 Migración entre Proveedores

### De local a OpenAI (cuando tengas presupuesto)

```bash
# Limpiar índice anterior
rm -rf .pampa/

# Re-indexar con OpenAI
export OPENAI_API_KEY="tu-key"
npx pampa index --provider openai

# Los embeddings anteriores se reemplazan automáticamente
````

### De OpenAI a local (para ahorrar costos)

```bash
# Limpiar índice anterior
rm -rf .pampa/

# Re-indexar con modelo local
npx pampa index --provider transformers

# Funciona igual, solo cambian los vectores internos
```

## 🎯 Casos de Uso Ideales para Modelo Local

-   **Proyectos personales** - Sin presupuesto para APIs
-   **Código sensible** - Proyectos privados/corporativos
-   **Desarrollo offline** - Sin conexión a internet confiable
-   **Prototipado rápido** - Probar PAMPA sin configurar APIs
-   **Proyectos open source** - Que cualquiera pueda usar sin keys

## 🚀 Próximos Pasos

1. **Prueba el modelo local** con tu proyecto actual
2. **Compara resultados** con OpenAI si tienes acceso
3. **Configura Claude Desktop** para usar PAMPA
4. **Commitea el codemap** para que tu equipo lo use

¡PAMPA funciona perfectamente sin OpenAI! 🎉
