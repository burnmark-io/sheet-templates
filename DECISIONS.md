# Decisions Log

Judgment calls made during autonomous implementation. Entries appended chronologically.

## 2026-04-24

### Upstream URL verified
My earlier concern that the canonical glabels-qt repo was at `jimevins/glabels-qt` was wrong. `https://github.com/j-evins/glabels-qt` returns HTTP 200 — it's the live repo. Using it as specified in the plan.

### Attribution name
Per operator instruction: use **Jaye Evins** as the attribution name. `LICENSE-GLABELS` will be a verbatim copy of the upstream license file, so whatever name appears there is what ships.

### License year
Using `2026` as the copyright year for our own `LICENSE` (MIT, Mannes Brak). Current date is 2026-04-24.

### Two tsconfigs (deviation from plan)
Plan specifies `"build": "tsc -p tsconfig.json"`, but `@mbtech-nl/eslint-config` uses `projectService: true` which requires every lintable .ts file to be in the project. That means `tsconfig.json` must include `src/`, `scripts/`, and test files — but we only want `tsc -b` to emit the `src/` files. Solution: `tsconfig.json` is the wide-scope config (noEmit, for typecheck + eslint), and `tsconfig.build.json` is the narrow emit config. `build` now uses `tsconfig.build.json`.

### Rounding units to 4 decimal places
`8.5 * 25.4` in IEEE 754 is `215.89999999999998`, not `215.9`. All `parseDistance` results are rounded to 4 decimal places (0.0001 mm ≈ 100 nm — far finer than label-printing needs).

### Distance regex accepts scientific + trailing-dot
Upstream XML has a few outliers like `11.in`, `1.in`, and `3.93386e-16pt`. Tightening the regex to the plan's example form drops ~10 templates and cascades to ~30 unresolved equivs. Accepting them via a looser regex (leading/trailing dot, scientific notation) with a final `Number.isFinite` check.

### CD-equiv chains skipped silently
When an `equiv` points to a CD/DVD template (which we correctly skip as `Label-cd`), the equiv itself is a CD alias and should also be skipped — not reported as "unresolved". Tracking skipped CD codes and treating chained equivs the same way removes ~100 spurious warnings.
