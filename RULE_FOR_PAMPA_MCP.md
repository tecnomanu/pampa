# Regla para Uso de PAMPA MCP

Tienes acceso a PAMPA, un sistema de memoria de código que indexa y permite buscar semánticamente en proyectos.

## Instrucciones Básicas

1. **SIEMPRE al iniciar una sesión:**

    - Ejecuta `get_project_stats` para verificar si el proyecto está indexado
    - Si no hay base de datos, ejecuta `index_project`
    - Ejecuta `update_project` para sincronizar con cambios recientes

2. **ANTES de crear cualquier función:**

    - Usa `search_code` con consultas semánticas como "autenticación usuario", "validar email", "manejar errores"
    - Revisa el código existente con `get_code_chunk` antes de escribir código nuevo

3. **DESPUÉS de modificar código:**
    - Ejecuta `update_project` para actualizar la base de conocimiento
    - Esto mantiene la memoria del proyecto sincronizada

## Herramientas Disponibles

-   `search_code(query, limit)` - Busca código semánticamente
-   `get_code_chunk(sha)` - Obtiene código completo de un chunk
-   `index_project(path)` - Indexa proyecto por primera vez
-   `update_project(path)` - Actualiza índice después de cambios
-   `get_project_stats(path)` - Estadísticas del proyecto

## Estrategia

Usa PAMPA como tu memoria de proyecto. Busca antes de crear, mantén actualizado después de cambios, y aprovecha el conocimiento existente para evitar duplicación de código.
