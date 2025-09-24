# 🚀 PAMPA Multi-Project Demo

PAMPA ahora soporta trabajar con múltiples proyectos usando aliases explícitos para mayor claridad.

## 📋 Nuevas Opciones Agregadas

Todos los comandos principales ahora soportan:

-   `--project <path>` - Alias claro para especificar el directorio del proyecto
-   `--directory <path>` - Alias alternativo para el directorio del proyecto

## 🎯 Comandos Actualizados

### 1. **Indexar Proyecto**

```bash
# Forma tradicional
pampa index /path/to/project

# Nuevas opciones más claras
pampa index --project /path/to/project
pampa index --directory /path/to/project
```

### 2. **Buscar Código**

```bash
# Forma tradicional
pampa search "create policy" /path/to/project

# Nuevas opciones más claras
pampa search "create policy" --project /path/to/project
pampa search "create policy" --directory /path/to/project
```

### 3. **Actualizar Índice**

```bash
# Forma tradicional
pampa update /path/to/project

# Nuevas opciones más claras
pampa update --project /path/to/project
pampa update --directory /path/to/project
```

### 4. **Observar Cambios**

```bash
# Forma tradicional
pampa watch /path/to/project

# Nuevas opciones más claras
pampa watch --project /path/to/project
pampa watch --directory /path/to/project
```

## 🏗️ Ejemplos Prácticos

### Trabajar con Proyecto Laravel

```bash
# Indexar el proyecto Laravel
pampa index --project /path/to/laravel-project --provider transformers

# Buscar funciones relacionadas con pagos
pampa search "payment processing" --project /path/to/laravel-project --lang php

# Buscar en servicios específicos
pampa search "create policy" --project /path/to/laravel-project --path_glob "app/Services/**"

# Actualizar después de cambios
pampa update --project /path/to/laravel-project
```

### Trabajar con Proyecto React

```bash
# Indexar proyecto React
pampa index --directory /path/to/react-app --provider openai

# Buscar componentes
pampa search "user authentication" --directory /path/to/react-app --lang tsx

# Observar cambios en desarrollo
pampa watch --directory /path/to/react-app --debounce 1000
```

## 🔄 Compatibilidad

✅ **Totalmente Compatible**: Las formas tradicionales siguen funcionando
✅ **Prioridad**: `--project` > `--directory` > argumento posicional > directorio actual
✅ **MCP Server**: Ya soportaba el parámetro `path` en todos los tools

## 🎉 Resultado

Ahora es mucho más claro y explícito trabajar con proyectos en diferentes ubicaciones:

```bash
# ❌ Antes: No tan claro
pampa search "function" /some/long/path/to/project

# ✅ Ahora: Mucho más claro
pampa search "function" --project /some/long/path/to/project
```

Esta mejora hace que PAMPA sea más intuitivo para desarrolladores que trabajan con múltiples proyectos simultáneamente.
