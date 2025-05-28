# 🔧 Configuración MCP para PAMPA

Esta guía explica cómo configurar PAMPA como servidor MCP en diferentes escenarios.

## 🎯 **Escenarios de Uso**

### **Escenario 1: Proyecto Único (Más Simple)**

**Ideal para:** Trabajar en un solo proyecto con PAMPA

```bash
# En el directorio de tu proyecto
npm install pampa @xenova/transformers

# Indexar el proyecto
npx pampa index --provider transformers
```

**Configuración Claude Desktop:**

```json
{
	"mcpServers": {
		"pampa": {
			"command": "npx",
			"args": ["pampa", "mcp"],
			"cwd": "/ruta/a/tu/proyecto"
		}
	}
}
```

### **Escenario 2: Instalación Global (Recomendado)**

**Ideal para:** Usar PAMPA en múltiples proyectos

```bash
# Instalar globalmente
npm install -g pampa @xenova/transformers

# En cualquier proyecto
pampa index --provider transformers
```

**Configuración Claude Desktop:**

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

### **Escenario 3: Servidor Dedicado (Más Potente)**

**Ideal para:** Múltiples proyectos con cambio dinámico

```bash
# Instalar globalmente
npm install -g pampa @xenova/transformers
```

**Configuración Claude Desktop:**

```json
{
	"mcpServers": {
		"pampa-dedicated": {
			"command": "pampa-server"
		}
	}
}
```

**Herramientas adicionales del servidor dedicado:**

-   `set_project_path`: Cambiar proyecto activo
-   `get_current_project`: Ver proyecto actual
-   Todas las herramientas estándar de PAMPA

## 🛠️ **Configuraciones Específicas**

### **Con OpenAI (Si tienes API key)**

```json
{
	"mcpServers": {
		"pampa": {
			"command": "pampa",
			"args": ["mcp"],
			"env": {
				"OPENAI_API_KEY": "tu-api-key-aqui"
			}
		}
	}
}
```

### **Solo Modelo Local (Gratis)**

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

### **Con Ollama**

```bash
# Instalar Ollama primero
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull nomic-embed-text
npm install -g pampa ollama
```

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

## 📁 **Ubicaciones de Configuración**

### **macOS**

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### **Windows**

```
%APPDATA%\Claude\claude_desktop_config.json
```

### **Linux**

```
~/.config/Claude/claude_desktop_config.json
```

## 🚀 **Flujo de Trabajo Recomendado**

### **1. Instalación Inicial**

```bash
# Opción A: Global (recomendado)
npm install -g pampa @xenova/transformers

# Opción B: Por proyecto
npm install pampa @xenova/transformers
```

### **2. Configurar Claude Desktop**

Edita el archivo de configuración según tu escenario elegido.

### **3. Indexar Proyecto**

```bash
# Desde CLI
pampa index --provider transformers

# O desde Claude Desktop usando la herramienta index_project
```

### **4. Usar con Claude**

Ahora puedes usar estas herramientas en Claude:

-   `search_code`: Buscar funciones
-   `get_code_chunk`: Ver código específico
-   `index_project`: Indexar nuevos proyectos
-   `get_project_stats`: Ver estadísticas

## 🔄 **Cambiar Entre Proyectos**

### **Método 1: Servidor Dedicado**

```
Usuario: "Cambia al proyecto /ruta/a/otro/proyecto"
Claude: [Usa set_project_path]
```

### **Método 2: Múltiples Servidores**

```json
{
	"mcpServers": {
		"pampa-proyecto1": {
			"command": "pampa",
			"args": ["mcp"],
			"cwd": "/ruta/a/proyecto1"
		},
		"pampa-proyecto2": {
			"command": "pampa",
			"args": ["mcp"],
			"cwd": "/ruta/a/proyecto2"
		}
	}
}
```

## 🐛 **Solución de Problemas**

### **Error: "Transformers.js no está instalado"**

```bash
npm install -g @xenova/transformers
# O en el proyecto específico
npm install @xenova/transformers
```

### **Error: "pampa command not found"**

```bash
# Instalar globalmente
npm install -g pampa

# O usar npx
npx pampa mcp
```

### **Error: "No se encontraron chunks"**

```bash
# Indexar el proyecto primero
pampa index --provider transformers
```

### **Claude no ve las herramientas**

1. Verifica la configuración JSON
2. Reinicia Claude Desktop
3. Verifica que el servidor se inicie sin errores

## 📊 **Comparación de Escenarios**

| Escenario             | Pros                                 | Contras                     | Ideal Para                |
| --------------------- | ------------------------------------ | --------------------------- | ------------------------- |
| **Proyecto Único**    | Simple, sin instalación global       | Solo un proyecto            | Proyectos específicos     |
| **Global**            | Funciona en cualquier lugar          | Requiere instalación global | Uso general               |
| **Servidor Dedicado** | Múltiples proyectos, cambio dinámico | Más complejo                | Desarrolladores avanzados |

## 💡 **Consejos**

1. **Usa instalación global** para máxima flexibilidad
2. **Indexa regularmente** después de cambios importantes
3. **Usa modelo local** para privacidad y costo cero
4. **Configura múltiples servidores** para proyectos grandes
5. **Reinicia Claude** después de cambios de configuración

¡Elige la configuración que mejor se adapte a tu flujo de trabajo! 🚀
