# Progress

Tracking the implementation sequence from PLAN.md section 9.

## Step 1 — Scaffold ✅

- [x] LICENSE (MIT, Mannes Brak, 2026)
- [x] LICENSE-GLABELS (copied verbatim from upstream)
- [x] .gitignore
- [x] .github/FUNDING.yml
- [x] .github/workflows/ci.yml
- [x] .github/workflows/release.yml
- [x] package.json
- [x] tsconfig.json + tsconfig.build.json (see DECISIONS.md)
- [x] eslint.config.js
- [x] vitest.config.ts
- [x] .prettierignore
- [x] Git submodule: upstream → j-evins/glabels-qt (shallow, depth=1)
- [x] pnpm install (267 packages, lockfile generated; +@types/node)
- [x] Gate: install succeeds, lockfile generated
- [x] Commit (push blocked — see BLOCKERS.md)

## Step 2 — Converter script ✅

- [x] scripts/convert.ts (XML → JSON)
- [x] Unit parsing (pt/in/mm/cm/pc → mm, with rounding)
- [x] Paper size resolution (parses upstream paper-sizes.xml)
- [x] equiv template cloning (two-pass; CD-equiv chains silently skipped)
- [x] Layout[] array (preserves multi-layout: 24 sheets captured)
- [x] Skip Label-cd (145), size="roll" (9), malformed (4)
- [x] Dedup (brand+part, first wins)
- [x] Sort (brand then part)
- [x] Stats output (--stats flag shows brand list + warnings)
- [x] Run pnpm run convert → src/templates.json (1599 templates, 56 brands)
- [x] Gate: converter runs, JSON valid, typecheck/lint/format green
- [x] Commit

## Step 3 — Package source ✅

- [x] src/index.ts (SHEETS, findSheet, findByBrand, findBySize, findByPaper, listBrands, primaryLayout)
- [x] Gate: typecheck + lint + build (dist/ emitted, smoke-tested)
- [x] Commit

## Step 4 — Tests

- [ ] src/__tests__/convert.test.ts
- [ ] src/__tests__/registry.test.ts
- [ ] Gate: typecheck + lint + test + build
- [ ] Commit

## Step 5 — README + final

- [ ] README.md
- [ ] pnpm test:coverage (verify thresholds)
- [ ] Verify ci.yml would pass
- [ ] Commit
