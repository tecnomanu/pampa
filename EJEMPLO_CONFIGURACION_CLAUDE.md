# 🎯 Configuración Claude Desktop para PAMPA

## 📍 **Tu Configuración Específica**

Basado en tu entorno macOS, aquí están las configuraciones recomendadas:

### **Archivo de Configuración**

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

## 🚀 **Opción 1: Instalación Global (Recomendada)**

### **1. Instalar PAMPA globalmente**

```bash
# Desde cualquier directorio
npm install -g pampa @xenova/transformers
```

### **2. Configurar Claude Desktop**

```json
{
	"mcpServers": {
		"pampa": {
			"command": "pampa",
			"args": ["mcp"]
		}
	}
}
```

### **3. Usar en cualquier proyecto**

```bash
# Ir a tu proyecto
cd /ruta/a/tu/proyecto

# Indexar con modelo local (gratis)
pampa index --provider transformers

# Ahora usar desde Claude Desktop
```

## 🏠 **Opción 2: Servidor Dedicado (Múltiples Proyectos)**

### **1. Instalar globalmente**

```bash
npm install -g pampa @xenova/transformers
```

### **2. Configurar Claude Desktop**

```json
{
	"mcpServers": {
		"pampa-dedicated": {
			"command": "pampa-server"
		}
	}
}
```

### **3. Cambiar proyectos dinámicamente**

En Claude Desktop:

```
Usuario: "Cambia al proyecto /ruta/a/mi-proyecto"
Claude: [Usa set_project_path automáticamente]
```

## 📁 **Opción 3: Por Proyecto Específico**

### **1. En tu proyecto actual**

```bash
cd "/ruta/a/tu/proyecto"
npm install pampa @xenova/transformers
```

### **2. Configurar Claude Desktop**

```json
{
	"mcpServers": {
		"mi-proyecto": {
			"command": "npx",
			"args": ["pampa", "mcp"],
			"cwd": "/ruta/a/tu/proyecto"
		}
	}
}
```

## 🔧 **Configuración Completa Recomendada**

```json
{
	"mcpServers": {
		"pampa": {
			"command": "pampa",
			"args": ["mcp"]
		},
		"pampa-dedicated": {
			"command": "pampa-server"
		}
	}
}
```

Esto te da:

-   **pampa**: Servidor estándar (usa directorio actual)
-   **pampa-dedicated**: Servidor con cambio dinámico de proyectos

## 🎮 **Flujo de Trabajo Práctico**

### **Paso 1: Instalar**

```bash
npm install -g pampa @xenova/transformers
```

### **Paso 2: Configurar Claude**

Editar: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
	"mcpServers": {
		"pampa": {
			"command": "pampa",
			"args": ["mcp"]
		}
	}
}
```

### **Paso 3: Reiniciar Claude Desktop**

### **Paso 4: Indexar tu proyecto**

```bash
cd "/ruta/a/tu/proyecto"
pampa index --provider transformers
```

### **Paso 5: Usar desde Claude**

En Claude Desktop:

```
Usuario: "Busca funciones relacionadas con autenticación"
Claude: [Usa search_code automáticamente]
```

## 🧪 **Probar la Configuración**

### **1. Verificar instalación**

```bash
pampa --version
which pampa
```

### **2. Probar servidor MCP**

```bash
# Esto debería mostrar las herramientas disponibles
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | pampa mcp
```

### **3. Verificar en Claude**

En Claude Desktop, deberías ver herramientas como:

-   `search_code`
-   `get_code_chunk`
-   `index_project`

## 🐛 **Solución de Problemas**

### **Si Claude no ve las herramientas:**

1. **Verificar ruta del archivo de configuración:**

    ```bash
    ls -la ~/Library/Application\ Support/Claude/
    ```

2. **Verificar sintaxis JSON:**

    ```bash
    cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python -m json.tool
    ```

3. **Reiniciar Claude Desktop completamente**

4. **Verificar logs de Claude** (si están disponibles)

### **Si pampa no se encuentra:**

```bash
# Verificar instalación global
npm list -g pampa

# Reinstalar si es necesario
npm install -g pampa @xenova/transformers
```

## 💡 **Consejos para tu Entorno**

1. **Usa rutas absolutas** para evitar problemas con espacios en nombres
2. **Instala globalmente** para usar en múltiples proyectos
3. **Indexa regularmente** después de cambios importantes
4. **Usa modelo local** para privacidad total (sin enviar código a APIs)

## 🎯 **Configuración Mínima para Empezar**

```bash
# 1. Instalar
npm install -g pampa @xenova/transformers

# 2. Configurar Claude (archivo JSON arriba)

# 3. Indexar proyecto
cd /ruta/a/tu/proyecto
pampa index --provider transformers

# 4. ¡Usar desde Claude!
```

¡Con esta configuración tendrás PAMPA funcionando perfectamente en tu entorno! 🚀
