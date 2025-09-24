## Orden y dependencias

1. **Scoped search (path_glob/tags/lang/provider/reranker)** → base para usar filtros en las demás features.
2. **Hybrid BM25 + Vector (RRF)** → mejora recall; independiente del re-ranker.
3. **Cross-encoder Re-ranker (Transformers.js)** → reordena top-N; depende de que exista la búsqueda base.
4. **Watcher + incremental Merkle-like** → independiente de ranking; impacta indexador/DB.
5. **Context Packs** → depende de scoped search para aplicar filtros guardados.
6. **Codemap extension** → usado por ranking/scoring y telemetría.
7. **Benchmark harness** → puede ir primero, pero aquí lo ponemos tras base para ya testear mejoras.
8. **Docs/CLI** → último del pack base (v1.12).
9. **Symbols + call-graph (tree-sitter)** → pack extra (v1.13), potencia ranking semántico.
10. **Chunk encryption (AES-GCM)** → pack extra (v1.13), privacidad.

---

### 1) Scoped Search (MCP + CLI)

```md
# Title

Implement Scoped Semantic Search (path_glob, tags, lang, provider, reranker) for PAMPA MCP + CLI

# Context

You are upgrading an OSS Node.js + TypeScript codebase named "PAMPA". It provides a local semantic code index, a CLI, and an MCP server with tools like `search_code`. We need to extend the search API to support scoping and filtering.

# Goals

1. Add optional scoped filters to search:
    - `path_glob: string | string[]`
    - `tags: string[]`
    - `lang: string[]`
    - `provider?: string` (embedding provider override)
    - `reranker: 'off' | 'transformers'` (flag only; no implementation here)
2. Wire these filters in CLI and MCP tool `search_code`.
3. Ensure backward compatibility (no breaking changes if filters are omitted).

# Constraints

-   Node.js >= 20, TypeScript strict.
-   Keep existing public APIs; only add optional parameters.
-   Validate parameters with Zod.
-   Do not implement reranker here; just accept the flag and pass it along.
-   Keep performance: searching without filters must not regress.

# Implementation Outline

-   Add a Zod schema for `search_code` params (new optional fields).
-   Resolve glob filtering using `micromatch`.
-   Tag and language filtering should rely on existing chunk metadata; add a minimal adapter if missing.
-   CLI flags:
    --path_glob, --tags, --lang, --provider, --reranker
-   Pass filters from CLI → service → MCP tool → search engine.

# Files (suggested)

-   src/mcp/tools/searchCode.ts (extend Zod schema and handler)
-   src/cli/commands/search.ts (parse new flags)
-   src/search/applyScope.ts (new helper to filter candidates by scope)
-   src/types/search.ts (new/updated types)
-   package.json (add "micromatch": "^4")

# Tests (node:test)

Create tests using Node's built-in `node:test` and `assert`.

-   tests/search_scoped.test.ts
    -   seeds a tiny in-memory index with pseudo chunks:
        -   "app/Services/Payment/StripeService.php" (tags: ["stripe"], lang: "php")
        -   "app/Http/Controllers/CheckoutController.php" (tags: ["stripe","checkout"], lang: "php")
        -   "web/src/hooks/useCart.ts" (tags: ["cart"], lang: "ts")
    -   queries like "create checkout session"
    -   assert that:
        -   With `path_glob=app/Services/**` only service chunk is eligible.
        -   With `tags=["stripe"]` both php chunks remain; with `lang=["ts"]` only TS chunk remains.
        -   With no filters, all appear.
    -   ensure CLI flag parsing maps to MCP call.

# Acceptance Criteria

-   Running `npm run test` passes.
-   `pampa search "create checkout session" --path_glob "app/Services/**" --tags stripe --lang php` filters accurately.
-   MCP `search_code` accepts and forwards the new fields.
-   No runtime errors when no filters are provided.

# Deliverables

-   Code + tests + minimal docs snippet in CLI help.
-   Update CHANGELOG with "feat(search): scoped search filters".

# Task Checklist

-   [x] Add micromatch dep and types
-   [x] Extend Zod schema and types
-   [x] Implement applyScope() helper
-   [x] Wire CLI flags → MCP tool → search
-   [x] Add tests for path_glob/tags/lang/provider/reranker flag passthrough
-   [x] Update help and CHANGELOG
```

---

### 2) Hybrid BM25 + Vector with RRF

```md
# Title

Add Hybrid Search (BM25 + Vector) with Reciprocal Rank Fusion (RRF)

# Context

PAMPA currently performs semantic (vector) search. We need to add a BM25 keyword index and fuse results via RRF to improve recall for partial names and symbol-like queries.

# Goals

1. Implement an in-memory BM25 index over chunk texts.
2. Add a hybrid search mode combining Vector top-K and BM25 top-K using RRF (K=60).
3. Expose CLI/MCP flags:
   --hybrid on|off (default on)
   --bm25 on|off (default on)
4. Keep performance acceptable (build index once on load; incremental handled later).

# Constraints

-   Keep vector path untouched if hybrid is disabled.
-   No breaking changes; defaults maintain current behavior but with hybrid ON by default is acceptable if tests pass.
-   Minimal dependencies: use `wink-bm25-text-search`.

# Implementation Outline

-   New module: src/search/bm25Index.ts (build, addDoc, search).
-   New module: src/search/hybrid.ts (RRF fusion returning a ranked list of chunk IDs).
-   Integrate hybrid path in main search pipeline; if hybrid=on, perform both searches and fuse.
-   Respect scoped filters from feature #1 BEFORE scoring or after initial candidate collection (choose the cheaper path).

# Files

-   src/search/bm25Index.ts
-   src/search/hybrid.ts
-   src/search/searchService.ts (integration)
-   src/cli/commands/search.ts (flags)
-   package.json: add "wink-bm25-text-search": "^3"

# Tests (node:test)

-   tests/search_hybrid.test.ts
    -   Index 5 chunks:
        -   two with strong lexical matches (BM25) but weak semantic,
        -   two with strong semantic but weak lexical,
        -   one distractor.
    -   Assert:
        -   pure vector misses lexical-only case.
        -   hybrid improves Recall@3 ≥ +20% over vector-only baseline in this synthetic setup.
    -   Assert flags: --hybrid off disables fusion; --bm25 off reverts to vector-only.

# Acceptance Criteria

-   `npm run test` green with metrics printed in test logs.
-   CLI and MCP accept flags.
-   Hybrid improves recall in synthetic tests.

# Deliverables

-   Code + tests + short README section stub (to be expanded in docs PR).

# Task Checklist

-   [x] Add dependency wink-bm25-text-search
-   [x] Implement BM25Index and RRF fusion
-   [x] Integrate fuse step into search service
-   [x] Add flags and plumb through MCP
-   [x] Tests for lexical vs semantic and flag behavior
```

---

### 3) Cross-Encoder Re-Ranker (Transformers.js)

```md
# Title

Add Cross-Encoder Re-Ranker using Transformers.js (local CPU) for top-N reordering

# Context

After hybrid retrieval, we want a cross-encoder re-ranker to refine the top-N candidates, increasing Precision@1 on ambiguous queries.

# Goals

1. Implement optional re-ranking step using @xenova/transformers with a small cross-encoder (e.g., "Xenova/ms-marco-MiniLM-L-6-v2").
2. Re-rank top 50 by default, configurable.
3. Provide a CI-friendly mock mode to avoid model downloads during tests.

# Constraints

-   If model fails to load, silently fallback to original order.
-   Keep memory footprint reasonable; batch if needed.
-   Respect `--reranker transformers|off` from feature #1.

# Implementation Outline

-   New: src/ranking/crossEncoderReranker.ts with `rerank(query, candidates, max=50)`.
-   Lazy-load model/tokenizer; cache in-memory.
-   Env var `PAMPA_MOCK_RERANKER_TESTS=1` to short-circuit scoring for tests.
-   Hook into search pipeline after hybrid fusion.

# Files

-   src/ranking/crossEncoderReranker.ts
-   src/search/searchService.ts (call reranker if enabled)
-   package.json: add "@xenova/transformers": "^2.x"

# Tests (node:test)

-   tests/reranker.test.ts
    -   With `PAMPA_MOCK_RERANKER_TESTS=1`, simulate scores to ensure the reordering logic works and respects `max`.
    -   Ensure flag `--reranker transformers` triggers rerank; `off` does not.
    -   Ensure fallback path (model load error) returns original order without throwing.

# Acceptance Criteria

-   Tests pass with mock re-ranker.
-   Manual run (developer machine) can load the model and reorder top-50.
-   Precision@1 improves in synthetic test where semantics matter.

# Deliverables

-   Code + tests + CHANGELOG entry.

# Task Checklist

-   [x] Add transformers dependency
-   [x] Implement reranker with lazy-load
-   [x] Integrate flag and pipeline step
-   [x] Mocked tests and fallback path
```

---

### 4) Watcher + Incremental Index (Merkle-like)

```md
# Title

Implement File Watcher and Incremental Indexing with Merkle-like chunk hashing

# Context

Large repos require fast incremental updates. We need a watcher that re-indexes only touched files and a Merkle-like store to skip unchanged chunks.

# Goals

1. `pampa watch [path]` command: chokidar-based watcher with debounce.
2. Maintain `.pampa/merkle.json` mapping: { path, shaFile, chunkShas[] }.
3. Update embeddings only when sha changes.

# Constraints

-   Keep backwards compatibility: if merkle file absent, build incrementally going forward.
-   Use a fast hash (xxhash or blake3).
-   Batch updates; avoid thrashing.

# Implementation Outline

-   src/indexer/watch.ts (startWatch() with debounce 500ms)
-   src/indexer/merkle.ts (compute file sha and chunk shas; read/write merkle.json)
-   Integrate into existing update/index code paths to skip unchanged chunks.

# Files

-   src/indexer/watch.ts
-   src/indexer/merkle.ts
-   src/cli/commands/watch.ts
-   src/indexer/update.ts (extend)
-   package.json: add "chokidar": "^3", "xxhash-wasm": "^1"

# Tests (node:test)

-   tests/watch_merkle.test.ts
    -   Create temp dir with 3 files; initial index writes merkle.json.
    -   Modify one file; run update; assert only that file’s chunks were recomputed.
    -   Ensure `pampa watch` triggers update on change (simulate FS events).

# Acceptance Criteria

-   `pampa watch` runs and logs batched updates.
-   merkle.json persists and prevents recomputation for unchanged files.
-   Tests green.

# Deliverables

-   Code + tests + README snippet (watch usage).

# Task Checklist

-   [x] Add chokidar and xxhash-wasm
-   [x] Implement merkle store and integrate update path
-   [x] CLI command `pampa watch`
-   [x] Tests for incremental behavior
```

---

### 5) Context Packs

```md
# Title

Add Context Packs (.pampa/contextpacks/\*.json) with MCP tool to activate scoped profiles

# Context

We need reusable context profiles to quickly apply path/tags/lang/reranker/hybrid defaults per task (e.g., "stripe-backend").

# Goals

1. Allow storing JSON packs in `.pampa/contextpacks/*.json`.
2. CLI: `pampa context use <name>`, `pampa context list`, `pampa context show <name>`.
3. MCP: new tool `use_context_pack(name)` that sets session-scoped defaults for subsequent `search_code` calls.

# Constraints

-   Packs are additive defaults; explicit filters in a search call override pack settings.
-   Validate packs with Zod.

# Implementation Outline

-   src/context/packs.ts: load/list/show/apply pack; cache on disk.
-   src/mcp/tools/useContextPack.ts: set pack for current session.
-   CLI commands to manage packs.

# Files

-   src/context/packs.ts
-   src/mcp/tools/useContextPack.ts
-   src/cli/commands/context.ts
-   src/types/contextPack.ts (Zod schema)

# Tests (node:test)

-   tests/context_packs.test.ts
    -   Create a sample pack `stripe-backend.json` with path_glob, tags, lang, reranker, hybrid.
    -   Use CLI to select pack; then run search and assert filters are applied.
    -   MCP: call use_context_pack then search; assert same effect.

# Acceptance Criteria

-   Packs listed, shown, and applied.
-   Explicit flags override pack defaults.
-   Tests pass.

# Deliverables

-   Code + tests + example pack file + docs stub.

# Task Checklist

-   [x] Implement Zod schema and loader
-   [x] CLI commands
-   [x] MCP tool and session state
-   [x] Tests and example
```

---

### 6) Codemap Extension

```md
# Title

Extend codemap with synonyms, path_weight, last_used_at, success_rate, lang per chunk

# Context

To improve ranking and telemetry, the codemap needs extra fields. This must be backward compatible.

# Goals

1. Extend `pampa.codemap.json` schema to include:
    - chunk.lang
    - chunk.synonyms[] (optional)
    - chunk.path_weight (number, default 1.0)
    - chunk.last_used_at (ISO string, optional)
    - chunk.success_rate (0..1, default 0)
2. Write adapters so reading older codemaps still works.
3. Provide helpers to update last_used_at and success_rate when a result is selected/applied.

# Constraints

-   Do not break existing readers.
-   Defensive defaults when fields are missing.

# Implementation Outline

-   Define new TS types and validators.
-   Migration-on-read approach: enrich at runtime if fields absent.
-   Provide small utility `bumpSuccess(chunkSha, ok: boolean)` adjusting success_rate (EMA).

# Files

-   src/codemap/types.ts
-   src/codemap/io.ts (read/write with compatibility)
-   src/codemap/telemetry.ts (bumpSuccess, touchUsed)
-   tests/codemap_extension.test.ts

# Tests (node:test)

-   Load old-style codemap (mock JSON without new fields); ensure it reads without error and defaults are injected.
-   Update success_rate with true/false signals; assert EMA converges.

# Acceptance Criteria

-   Backward compatible read passes.
-   New fields persist on write.
-   Tests pass.

# Deliverables

-   Code + tests + CHANGELOG.

# Task Checklist

-   [x] Extend types and IO
-   [x] Implement telemetry helpers
-   [x] Tests for migration/defaults and EMA
```

---

### 7) Benchmark Harness

```md
# Title

Add Benchmark Harness (MRR@k, nDCG@k, Precision@1) for synthetic code search tasks

# Context

We need a reproducible way to measure search quality before/after changes.

# Goals

1. Introduce `npm run bench` that runs synthetic benchmarks with a small corpus (Laravel + TS flavored) and prints metrics.
2. Allow toggling hybrid and reranker via env/flags inside the bench runner.

# Constraints

-   No external downloads required; keep small and deterministic.
-   Use node:test to compute metrics and print a summary table.

# Implementation Outline

-   Create `test/benchmarks/fixtures/` with ~20 chunks (strings) and a mapping (query -> expected sha(s)).
-   Implement metric helpers: MRR@5, nDCG@10, Precision@1.
-   CLI entry `npm run bench` that executes a dedicated test file or a small runner.

# Files

-   test/benchmarks/fixtures/\*
-   test/benchmarks/bench.test.ts (or scripts/bench.ts)
-   src/metrics/ir.ts (helper functions)

# Tests / Output

-   Running `npm run bench` prints a table:
    | setting | P@1 | MRR@5 | nDCG@10 |
    Base, Hybrid, Hybrid+CE

# Acceptance Criteria

-   Bench runs locally fast (<5s).
-   Shows improved metrics when hybrid/reranker enabled (on synthetic data).

# Deliverables

-   Code + fixtures + docs line in README.

# Task Checklist

-   [x] Fixtures and mapping
-   [x] Metric helpers
-   [x] Runner script and npm script
-   [x] Synthetic assertions for improvements
```

---

### 8) Docs/CLI Update

```md
# Title

Update README/CLI help for new search flags, Context Packs, Watcher, and Bench

# Context

After features are merged, documentation must reflect usage and flags.

# Goals

1. Update README sections: Installation, Indexing, Search flags, Context Packs, Watcher, Bench.
2. Update `--help` outputs for search and context commands.
3. Add examples for common workflows.

# Constraints

-   Keep concise; link to advanced docs if any.

# Files

-   README.md
-   src/cli/commands/\* (help texts)
-   CHANGELOG.md

# Acceptance Criteria

-   `pampa --help` and `pampa search --help` show new flags.
-   README includes copy-paste examples that work.

# Deliverables

-   Updated docs only (no code logic change beyond help strings).

# Task Checklist

-   [x] Update README with examples
-   [x] Sync CLI help strings
-   [x] Update CHANGELOG
```

---

### 9) Symbols + Mini Call-Graph (tree-sitter) — (v1.13)

```md
# Title

Symbol-Aware Ranking: extract signatures and mini call-graph with tree-sitter

# Context

Boost relevance when queries mention symbols (Class.method) or when neighbor functions are relevant.

# Goals

1. Parse files with tree-sitter (PHP, TS/JS at minimum) to extract symbol signatures and definitions.
2. Build a tiny call-graph `{fromSha -> toSha}` for intra-repo references (best effort).
3. Ranking boost: if query matches a signature or direct neighbor in graph, add +alpha score.
4. Expose optional flag `--symbol_boost on|off` (default on).

# Constraints

-   Fail-soft if parser not available; do not break indexing.
-   Keep memory low; store symbol data in codemap extension fields.

# Implementation Outline

-   Add parsers via `tree-sitter` and language grammars.
-   During indexing, attach: symbol name, params signature, returns (if inferrable).
-   A simple static analysis for imports/calls (regex-assisted where needed).
-   Integrate boost into scoring stage after hybrid and before reranker.

# Files

-   src/symbols/extract.ts
-   src/symbols/graph.ts
-   src/ranking/boostSymbols.ts
-   package.json: add tree-sitter deps

# Tests (node:test)

-   tests/symbol_boost.test.ts
    -   Provide small PHP/TS samples with clear call relationships.
    -   Query "where is token validated" → expects function `validateToken` ranks top.
    -   Disable `--symbol_boost` → ranking drops accordingly.

# Acceptance Criteria

-   Tests pass; symbol-aware queries improve P@1 on synthetic set.

# Deliverables

-   Code + tests + docs snippet.

# Task Checklist

-   [x] Add tree-sitter parsers
-   [x] Extract signatures
-   [x] Build call graph and integrate boost
-   [x] Tests
```

---

### 10) Chunk Encryption (AES-GCM) — (v1.13)

```md
# Title

Optional chunk encryption at rest using AES-256-GCM for .pampa store

# Context

Some users want at-rest encryption for chunk storage. Provide an opt-in that is transparent to search and retrieval.

# Goals

1. If env `PAMPA_ENCRYPTION_KEY` is set (32 bytes base64/hex), store chunk blobs as `.gz.enc` using AES-GCM with random IV and per-file salt.
2. Reading must be transparent; fallback to plaintext when key absent.
3. Add CLI flag `--encrypt on|off` for new indexing; existing plaintext files should remain readable.

# Constraints

-   Do not leak keys in logs.
-   Use authenticated encryption; verify tag on read.

# Implementation Outline

-   src/storage/encryptedChunks.ts implementing read/write wrappers.
-   Migrate write path to call encrypt if enabled; read path to try decrypt then fallback.
-   Update codemap/chunk metadata to mark encrypted entries.

# Files

-   src/storage/encryptedChunks.ts
-   src/indexer/write.ts (wrap)
-   src/indexer/read.ts (wrap)
-   tests/encryption.test.ts

# Tests (node:test)

-   With a test key, index a sample; verify files on disk are `.enc`.
-   Corrupt tag → read fails gracefully.
-   Without key, plaintext path still works.

# Acceptance Criteria

-   Tests pass; no plaintext written when encryption enabled.
-   Documentation updated in README security section.

# Deliverables

-   Code + tests + docs snippet + CHANGELOG.

# Task Checklist

-   [x] Implement AES-GCM wrappers
-   [x] Integrate write/read paths
-   [x] Tests (success + tamper)
-   [x] Docs and CHANGELOG
```
