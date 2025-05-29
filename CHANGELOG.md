# [1.5.0](https://github.com/tecnomanu/pampa/compare/v1.4.0...v1.5.0) (2025-05-29)


### Features

* add update_project tool and AI agent workflow documentation - Add update_project MCP tool for keeping code memory current - Add update command to CLI for manual updates - Create comprehensive AI agent workflow guide - Document when and how to use update_project - Add suggested prompts and strategies for AI agents - Emphasize continuous use of PAMPA for code memory ([5ce04bf](https://github.com/tecnomanu/pampa/commit/5ce04bf78a56985d28cee15005b6904abe063102))

# [1.4.0](https://github.com/tecnomanu/pampa/compare/v1.3.4...v1.4.0) (2025-05-29)


### Bug Fixes

* implement global base path context for MCP tools - Add setBasePath() function to manage working directory context - Update all service functions to use dynamic paths instead of hardcoded constants - Fix MCP tools to work correctly with path parameter - Resolve issue where database and chunks were created in wrong directory - All MCP operations now respect the specified working path ([0981eb0](https://github.com/tecnomanu/pampa/commit/0981eb0b183e69cca0652c735fdb7b129f812241))


### Features

* improve MCP logging and tool documentation - Add debug mode support with --debug flag - Create logs in working directory instead of server directory - Update tool descriptions to clarify path parameter usage - Improve error messages with database location info - Add debug logging for all MCP tool operations - Enhanced user feedback with emojis and clearer formatting ([18ec399](https://github.com/tecnomanu/pampa/commit/18ec39938562e7727508b965a183a6856d3e3390))

## [1.3.4](https://github.com/tecnomanu/pampa/compare/v1.3.3...v1.3.4) (2025-05-29)


### Bug Fixes

* add path parameter to MCP tools for working directory support ([9226cb7](https://github.com/tecnomanu/pampa/commit/9226cb73947d1b9a79ed62cca30e5a46f1e2f976))

## [1.3.3](https://github.com/tecnomanu/pampa/compare/v1.3.2...v1.3.3) (2025-05-29)


### Bug Fixes

* :fire: debugin and fix directory ([9fd80bb](https://github.com/tecnomanu/pampa/commit/9fd80bb975f1433b3a79898315d8943755523bc8))

## [1.3.2](https://github.com/tecnomanu/pampa/compare/v1.3.1...v1.3.2) (2025-05-29)


### Bug Fixes

* :bug: using version from package-json ([97c4726](https://github.com/tecnomanu/pampa/commit/97c4726b4c9abdbf6876760e16b1cc032480e9c3))

## [1.3.1](https://github.com/tecnomanu/pampa/compare/v1.3.0...v1.3.1) (2025-05-29)


### Bug Fixes

* :bug: search only relevants or similary by 0.3 threshold query ([7b344e5](https://github.com/tecnomanu/pampa/commit/7b344e597e45703837e88ea105b48989cf079f8b))

# [1.3.0](https://github.com/tecnomanu/pampa/compare/v1.2.1...v1.3.0) (2025-05-29)


### Bug Fixes

* include service.js and providers.js in npm package files ([98a8c10](https://github.com/tecnomanu/pampa/commit/98a8c105e00803ed0a640d5b4be6fb679d7146f4))


### Features

* fix npm package distribution by including missing service and provider files ([a058389](https://github.com/tecnomanu/pampa/commit/a058389544518235eb126539513d4ed9ba598a9a))

## [1.2.1](https://github.com/tecnomanu/pampa/compare/v1.2.0...v1.2.1) (2025-05-29)


### Bug Fixes

* 🔧 make CLI version read from package.json dynamically ([9fd4d1d](https://github.com/tecnomanu/pampa/commit/9fd4d1d188e5c7dd191426678b30e8a893a917a4))

# [1.2.0](https://github.com/tecnomanu/pampa/compare/v1.1.0...v1.2.0) (2025-05-29)


### Features

* 🌍 convert project to english with bilingual README ([5c92d7d](https://github.com/tecnomanu/pampa/commit/5c92d7d13e91c29af800f765e90ebfd548c3f137))
* 🎉 complete project reorganization and internationalization - Reorganize project structure with docs/, examples/, scripts/ folders - Extract providers to dedicated providers.js module - Separate business logic (service.js) from presentation (indexer.js) - Update MCP server to use structured responses - All tests passing with clean modular architecture ([da2ea35](https://github.com/tecnomanu/pampa/commit/da2ea352e024a8c09550e304bdc38b3f9e0c80f9))
