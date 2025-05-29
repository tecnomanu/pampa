# [1.8.0](https://github.com/tecnomanu/pampa/compare/v1.7.0...v1.8.0) (2025-05-29)


### Features

* **indexer:** ✨ mejorar extracción de símbolos para mostrar nombres reales de funciones PHP ([c8a3124](https://github.com/tecnomanu/pampa/commit/c8a3124d8d03fd7386ad2cc53f6019a639df5ff5))

# [1.7.0](https://github.com/tecnomanu/pampa/compare/v1.6.1...v1.7.0) (2025-05-29)


### Bug Fixes

* **service:** 🐛 agregar verificación de base de datos en funciones de learning ([c459bef](https://github.com/tecnomanu/pampa/commit/c459befafb707d6281dec96ae4a1f67a1fe159cf))


### Features

* **semantic:** ✨ implement intelligent semantic search system with auto-extraction, intention cache, and optional [@pampa-comments](https://github.com/pampa-comments) for +32% to +85% precision boost ([4e03c06](https://github.com/tecnomanu/pampa/commit/4e03c069bc9a0450820b07310731bbf462a7628c))

## [1.6.1](https://github.com/tecnomanu/pampa/compare/v1.6.0...v1.6.1) (2025-05-29)


### Bug Fixes

* **core:** 🐛 resolve critical SQLITE_CANTOPEN error - Add database existence check before SQLite operations - Improve error messages with clear user guidance - Add comprehensive tests for database error handling - Prevent server crashes when database not found ([ff391e7](https://github.com/tecnomanu/pampa/commit/ff391e7f3fd60c1e8fb8d2e794c7356fdfd5dba7))
* **tests:** 🧪 improve database error test for CI/CD compatibility - Add graceful handling of sqlite3 bindings errors - Skip tests when native dependencies unavailable - Maintain full functionality in development environments - Prevent CI/CD failures due to missing native modules ([7bb64f6](https://github.com/tecnomanu/pampa/commit/7bb64f6e81cc9c70605eaed1814f54057360cce8))

# [1.6.1](https://github.com/tecnomanu/pampa/compare/v1.6.0...v1.6.1) (2025-01-29)

### Bug Fixes

-   **critical:** 🐛 resolve SQLITE_CANTOPEN error when database not found ([ff391e7](https://github.com/tecnomanu/pampa/commit/ff391e7))
    -   Add database existence check before SQLite operations in `getOverview()` and `searchCode()`
    -   Improve error messages with clear user guidance and specific instructions
    -   Add comprehensive test suite for database error handling scenarios
    -   Prevent MCP server crashes when project is not indexed
    -   Return helpful error messages directing users to run `index_project` first
    -   Enhanced UX with emoji-based error formatting and precise database paths

# [1.6.0](https://github.com/tecnomanu/pampa/compare/v1.5.1...v1.6.0) (2025-05-29)

### Features

-   agregar debug mode y troubleshooting para agentes IA - Agrega información opcional sobre --debug en configuración MCP - Incluye sección de troubleshooting en README_FOR_AGENTS.md - Mejora emoji de índice/table of contents (📚) - Facilita resolución de problemas para agentes IA - Guías específicas para problemas de MCP y indexado ([8c00b6e](https://github.com/tecnomanu/pampa/commit/8c00b6ece1b2fd741bc70d155a621e7926b14013))

## [1.5.1](https://github.com/tecnomanu/pampa/compare/v1.5.0...v1.5.1) (2025-05-29)

### Bug Fixes

-   simplify update_project response messages - Show concise message when no changes detected - Remove unnecessary next steps text for updates - Clean and direct feedback for AI agents ([e4bb18b](https://github.com/tecnomanu/pampa/commit/e4bb18bdcb240beec2d9fbc0ebbee62b5d4abc5c))

# [1.5.0](https://github.com/tecnomanu/pampa/compare/v1.4.0...v1.5.0) (2025-05-29)

### Features

-   add update_project tool and AI agent workflow documentation - Add update_project MCP tool for keeping code memory current - Add update command to CLI for manual updates - Create comprehensive AI agent workflow guide - Document when and how to use update_project - Add suggested prompts and strategies for AI agents - Emphasize continuous use of PAMPA for code memory ([5ce04bf](https://github.com/tecnomanu/pampa/commit/5ce04bf78a56985d28cee15005b6904abe063102))

# [1.4.0](https://github.com/tecnomanu/pampa/compare/v1.3.4...v1.4.0) (2025-05-29)

### Bug Fixes

-   implement global base path context for MCP tools - Add setBasePath() function to manage working directory context - Update all service functions to use dynamic paths instead of hardcoded constants - Fix MCP tools to work correctly with path parameter - Resolve issue where database and chunks were created in wrong directory - All MCP operations now respect the specified working path ([0981eb0](https://github.com/tecnomanu/pampa/commit/0981eb0b183e69cca0652c735fdb7b129f812241))

### Features

-   improve MCP logging and tool documentation - Add debug mode support with --debug flag - Create logs in working directory instead of server directory - Update tool descriptions to clarify path parameter usage - Improve error messages with database location info - Add debug logging for all MCP tool operations - Enhanced user feedback with emojis and clearer formatting ([18ec399](https://github.com/tecnomanu/pampa/commit/18ec39938562e7727508b965a183a6856d3e3390))

## [1.3.4](https://github.com/tecnomanu/pampa/compare/v1.3.3...v1.3.4) (2025-05-29)

### Bug Fixes

-   add path parameter to MCP tools for working directory support ([9226cb7](https://github.com/tecnomanu/pampa/commit/9226cb73947d1b9a79ed62cca30e5a46f1e2f976))

## [1.3.3](https://github.com/tecnomanu/pampa/compare/v1.3.2...v1.3.3) (2025-05-29)

### Bug Fixes

-   :fire: debugin and fix directory ([9fd80bb](https://github.com/tecnomanu/pampa/commit/9fd80bb975f1433b3a79898315d8943755523bc8))

## [1.3.2](https://github.com/tecnomanu/pampa/compare/v1.3.1...v1.3.2) (2025-05-29)

### Bug Fixes

-   :bug: using version from package-json ([97c4726](https://github.com/tecnomanu/pampa/commit/97c4726b4c9abdbf6876760e16b1cc032480e9c3))

## [1.3.1](https://github.com/tecnomanu/pampa/compare/v1.3.0...v1.3.1) (2025-05-29)

### Bug Fixes

-   :bug: search only relevants or similary by 0.3 threshold query ([7b344e5](https://github.com/tecnomanu/pampa/commit/7b344e597e45703837e88ea105b48989cf079f8b))

# [1.3.0](https://github.com/tecnomanu/pampa/compare/v1.2.1...v1.3.0) (2025-05-29)

### Bug Fixes

-   include service.js and providers.js in npm package files ([98a8c10](https://github.com/tecnomanu/pampa/commit/98a8c105e00803ed0a640d5b4be6fb679d7146f4))

### Features

-   fix npm package distribution by including missing service and provider files ([a058389](https://github.com/tecnomanu/pampa/commit/a058389544518235eb126539513d4ed9ba598a9a))

## [1.2.1](https://github.com/tecnomanu/pampa/compare/v1.2.0...v1.2.1) (2025-05-29)

### Bug Fixes

-   🔧 make CLI version read from package.json dynamically ([9fd4d1d](https://github.com/tecnomanu/pampa/commit/9fd4d1d188e5c7dd191426678b30e8a893a917a4))

# [1.2.0](https://github.com/tecnomanu/pampa/compare/v1.1.0...v1.2.0) (2025-05-29)

### Features

-   🌍 convert project to english with bilingual README ([5c92d7d](https://github.com/tecnomanu/pampa/commit/5c92d7d13e91c29af800f765e90ebfd548c3f137))
-   🎉 complete project reorganization and internationalization - Reorganize project structure with docs/, examples/, scripts/ folders - Extract providers to dedicated providers.js module - Separate business logic (service.js) from presentation (indexer.js) - Update MCP server to use structured responses - All tests passing with clean modular architecture ([da2ea35](https://github.com/tecnomanu/pampa/commit/da2ea352e024a8c09550e304bdc38b3f9e0c80f9))
