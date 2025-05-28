# 1.0.0 (2025-05-28)

### Bug Fixes

-   :fire: add lost dependencies for semantic release ([188b17b](https://github.com/tecnomanu/pampa/commit/188b17b0c638e54e04df066a8a28cb2f01d5b7d2))
-   :fire: ci cd branches on ([c40e785](https://github.com/tecnomanu/pampa/commit/c40e785619f47dca354ca7a191a6111c39b976d8))

### Features

-   :fire: improve and fixes on mcp server js ([fbdb01c](https://github.com/tecnomanu/pampa/commit/fbdb01ccdc85b218934088df9c99ec38272d317c))
-   :fire: update and prepare to ci cd ([57bc3b9](https://github.com/tecnomanu/pampa/commit/57bc3b9da2f3d134d2fb21c372e1db4306b869e8))
-   :memo: update documentations ([6c9e68b](https://github.com/tecnomanu/pampa/commit/6c9e68b75ecee8d9ba578871d08c60b78e6cd9a9))
-   :rocket: first commit version 0.3 ([91c4e58](https://github.com/tecnomanu/pampa/commit/91c4e58cac24740ee6acbe5c60ec903259619e0b))
-   :zap: implement multiples providers ([f30d5e4](https://github.com/tecnomanu/pampa/commit/f30d5e41c06f399c54a5d34685959e8422aa9746))
-   :zap: update version to 0.4.1 ([d70c37a](https://github.com/tecnomanu/pampa/commit/d70c37a7614fd2bef8f867d2ba5238fc0ad5f76c))

# Changelog - PAMPA

## v0.4.1 - Compatibilidad MCP Mejorada (2024-12-XX)

### 🔧 Correcciones Críticas

#### Protocolo MCP

-   ✅ **SOLUCIONADO**: Error "Invalid arguments" cuando parámetros son `undefined`
-   ✅ **SOLUCIONADO**: Emojis en JSON causando "SyntaxError: Unexpected token"
-   ✅ **SOLUCIONADO**: Stream JSON contaminado con logs de debug

#### Validación de Parámetros

-   ✅ **Agregado**: Validación robusta para `undefined` en `search_code`
-   ✅ **Agregado**: Validación robusta para `undefined` en `get_code_chunk`
-   ✅ **Agregado**: `.trim()` aplicado a todos los parámetros string
-   ✅ **Mejorado**: Mensajes de error más claros sin emojis

#### Sistema de Logging

-   ✅ **Corregido**: Eliminados todos los emojis de respuestas JSON
-   ✅ **Mejorado**: Logs silenciosos para evitar contaminar stream MCP
-   ✅ **Agregado**: Variable `PAMPA_DEBUG` para debug opcional

### 📋 Cambios en Herramientas MCP

#### `search_code`

-   **Antes**: Fallaba con parámetros undefined
-   **Ahora**: Maneja graciosamente parámetros undefined/vacíos
-   **Validación**: Query mínimo 2 caracteres después de trim
-   **Respuesta**: Sin emojis, compatible con parsing JSON

#### `get_code_chunk`

-   **Antes**: Fallaba con SHA undefined
-   **Ahora**: Validación robusta de SHA undefined/vacío/espacios
-   **Respuesta**: Errores claros sin emojis

#### `index_project` y `get_project_stats`

-   **Mejorado**: `.trim()` aplicado a parámetros de path
-   **Respuesta**: Mensajes limpios sin emojis

### 🧪 Testing

-   ✅ **Agregado**: `test-search-code.js` - Suite completa de tests
-   ✅ **Casos probados**:
    -   Parámetros undefined
    -   Strings vacíos
    -   Strings con solo espacios
    -   Valores válidos
-   ✅ **Verificación**: Sin emojis en stream JSON

### 🔧 Scripts de Utilidad

-   ✅ **Mantenido**: `pampa-diagnostics.js` - Diagnóstico del sistema
-   ✅ **Mantenido**: `test-mcp.js` - Test básico del servidor
-   ✅ **Mantenido**: `rebuild-codemap.js` - Recuperación de codemap

### 📊 Compatibilidad

-   ✅ **Clientes MCP**: Claude Desktop, Cursor, otros
-   ✅ **Proveedores**: OpenAI, Transformers.js, Ollama, Cohere
-   ✅ **Plataformas**: macOS, Linux, Windows (Node.js)

### 🚀 Uso Mejorado

```bash
# El servidor ahora es completamente compatible con MCP
npx pampa mcp

# Tests automáticos
node test-search-code.js

# Diagnóstico si hay problemas
node pampa-diagnostics.js
```

### 💡 Notas de Migración

Si tienes una instalación anterior:

1. **No se requiere reinstalación** - Los cambios son compatibles
2. **Stream MCP limpio** - Sin más errores de parsing JSON
3. **Mejor experiencia** - Manejo robusto de casos edge

---

### Problemas Resueltos

| Problema                              | Estado      | Descripción                       |
| ------------------------------------- | ----------- | --------------------------------- |
| `MCP error -32602: Invalid arguments` | ✅ RESUELTO | Validación robusta para undefined |
| `SyntaxError: Unexpected token ✨`    | ✅ RESUELTO | Eliminados emojis de JSON         |
| Stream JSON contaminado               | ✅ RESUELTO | Logs silenciosos por defecto      |
| Parámetros con espacios               | ✅ RESUELTO | `.trim()` automático              |

### 📈 Próximas Mejoras

-   [ ] CLI standalone (`npx pampa search`, `npx pampa info`)
-   [ ] Modo batch para indexación masiva
-   [ ] Soporte para más lenguajes (Python, Rust, C++)
-   [ ] Plugin VS Code/Cursor nativo
