# 🚀 PAMPA Multi-Project Demo

PAMPA now supports working with multiple projects using explicit aliases for greater clarity.

## 📋 New Options Added

All main commands now support:

-   `--project <path>` - Clear alias to specify the project directory
-   `--directory <path>` - Alternative alias for the project directory

## 🎯 Updated Commands

### 1. **Index Project**

```bash
# Traditional way
pampa index /path/to/project

# New clearer options
pampa index --project /path/to/project
pampa index --directory /path/to/project
```

### 2. **Search Code**

```bash
# Traditional way
pampa search "create policy" /path/to/project

# New clearer options
pampa search "create policy" --project /path/to/project
pampa search "create policy" --directory /path/to/project
```

### 3. **Update Index**

```bash
# Traditional way
pampa update /path/to/project

# New clearer options
pampa update --project /path/to/project
pampa update --directory /path/to/project
```

### 4. **Watch Changes**

```bash
# Traditional way
pampa watch /path/to/project

# New clearer options
pampa watch --project /path/to/project
pampa watch --directory /path/to/project
```

## 🏗️ Practical Examples

### Working with Laravel Project

```bash
# Index the Laravel project
pampa index --project /path/to/laravel-project --provider transformers

# Search for payment-related functions
pampa search "payment processing" --project /path/to/laravel-project --lang php

# Search in specific services
pampa search "create policy" --project /path/to/laravel-project --path_glob "app/Services/**"

# Update after changes
pampa update --project /path/to/laravel-project
```

### Working with React Project

```bash
# Index React project
pampa index --directory /path/to/react-app --provider openai

# Search components
pampa search "user authentication" --directory /path/to/react-app --lang tsx

# Watch changes during development
pampa watch --directory /path/to/react-app --debounce 1000
```

## 🔄 Compatibility

✅ **Fully Compatible**: Traditional ways continue to work
✅ **Priority**: `--project` > `--directory` > positional argument > current directory
✅ **MCP Server**: Already supported the `path` parameter in all tools

## 🎉 Result

Now it's much clearer and more explicit to work with projects in different locations:

```bash
# ❌ Before: Not so clear
pampa search "function" /some/long/path/to/project

# ✅ Now: Much clearer
pampa search "function" --project /some/long/path/to/project
```

This improvement makes PAMPA more intuitive for developers working with multiple projects simultaneously.
