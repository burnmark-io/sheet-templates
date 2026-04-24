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
- [x] tsconfig.json
- [x] eslint.config.js
- [x] vitest.config.ts
- [x] Git submodule: upstream → j-evins/glabels-qt (shallow, depth=1)
- [x] pnpm install (267 packages, lockfile generated)
- [x] Gate: install succeeds, lockfile generated
- [ ] Commit + push (push blocked — see BLOCKERS.md)

## Step 2 — Converter script

- [ ] scripts/convert.ts (XML → JSON)
- [ ] Unit parsing (pt/in/mm/cm/pc → mm)
- [ ] Paper size resolution (parse upstream paper-sizes.xml)
- [ ] equiv template cloning
- [ ] Layout[] array (preserve multi-layout)
- [ ] Skip Label-cd, size="roll", malformed
- [ ] Dedup (brand+part, first wins)
- [ ] Sort (brand then part)
- [ ] Stats output (--stats flag)
- [ ] Run pnpm run convert → src/templates.json generated
- [ ] Gate: converter runs without errors, output is valid JSON
- [ ] Commit + push

## Step 3 — Package source

- [ ] src/types.ts (SheetTemplate, SheetLayout)
- [ ] src/index.ts (SHEETS, findSheet, findByBrand, findBySize, findByPaper, listBrands, primaryLayout)
- [ ] Gate: typecheck + lint + build
- [ ] Commit + push

## Step 4 — Tests

- [ ] src/__tests__/convert.test.ts
- [ ] src/__tests__/registry.test.ts
- [ ] Gate: typecheck + lint + test + build
- [ ] Commit + push

## Step 5 — README + final

- [ ] README.md
- [ ] pnpm test:coverage (verify thresholds)
- [ ] Verify ci.yml would pass
- [ ] Commit + push
