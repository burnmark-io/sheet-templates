# @burnmark-io/sheet-templates — Implementation Plan

> A JSON registry of sticker sheet specifications (Avery, Herma, Zweckform,
> and dozens of other brands) indexed by product code. Used by
> `@burnmark-io/designer-core` to tile label designs onto standard sticker
> sheets for PDF export to any inkjet or laser printer.
>
> The primary data source is the glabels-qt template database — hundreds of
> XML templates maintained by the gLabels project since 2001, licensed under
> MIT by Jaye Evins. A build-time converter script parses the XML and produces
> the JSON registry. This means updates from upstream are a `git pull` + rebuild
> away, not a manual data entry exercise.

---

## 1. Source: glabels-qt Template Database

**Repository:** `github.com/j-evins/glabels-qt`, `templates/` directory

**License:** MIT (separate from the GPL app)
```
Copyright (C) 2001-2026  Jaye Evins

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software...
```

**What it contains:** ~60 XML files covering brands including Avery, Herma,
Zweckform, APLI, Agipa, Dataline, Demco, Great Little Trading Company,
Herlitz, Maco, Megastar, Mundoetiqueta, Neato, Online, Planet, Riklabel,
Southworth, Uline, Worldlabel, and many more. Each file contains multiple
`<Template>` elements, totalling hundreds of individual sheet definitions.

**XML format:**

```xml
<Template brand="Avery" part="8160" size="US-Letter"
          description="Mailing Labels">
  <Meta category="label"/>
  <Meta category="mail"/>
  <Label-rectangle id="0" width="189pt" height="72pt" round="5pt">
    <Markup-margin size="5pt"/>
    <Layout nx="3" ny="10" x0="11.25pt" y0="36pt"
            dx="200pt" dy="72pt"/>
  </Label-rectangle>
</Template>
```

**Key XML elements:**
- `Template` — one per product. Attributes: `brand`, `part`, `size`, `description`, `width`/`height` (for non-standard paper)
- `Label-rectangle` — rectangular labels. Attributes: `width`, `height`, `round` (corner radius)
- `Label-round` — circular labels. Attribute: `radius`
- `Label-ellipse` — elliptical labels. Attributes: `width`, `height`
- `Label-cd` — CD/DVD labels (out of scope — skip)
- `Layout` — grid positioning. Attributes: `nx`, `ny`, `x0`, `y0`, `dx`, `dy`
- `Markup-margin` — non-printing margin guide. Attribute: `size`
- `Meta` — categories (label, mail, card, etc.)

**Unit system:** values are a number followed by `pt`, `in`, `mm`, `cm`, or `pc`.
No unit = points (1pt = 1/72in = 0.352778mm). The converter normalises
everything to millimetres.

**`equiv` attribute:** some templates are clones of others (same brand,
different part number, same physical dimensions). The converter resolves
these by copying the referenced template's properties.

---

## 2. Our JSON Output Format

Must conform to the `SheetTemplate` type already defined in
`@burnmark-io/designer-core`:

```typescript
export interface SheetTemplate {
  code: string;           // e.g. 'avery-8160' (brand-part, lowercase, hyphenated)
  name: string;           // e.g. 'Avery 8160 — Mailing Labels'
  brand: string;          // e.g. 'Avery'
  part: string;           // e.g. '8160'
  paperSize: string;      // 'A4', 'Letter', or custom dimensions
  paperWidthMm: number;   // 210 for A4, 215.9 for Letter
  paperHeightMm: number;  // 297 for A4, 279.4 for Letter
  labelWidthMm: number;
  labelHeightMm: number;
  labelShape: 'rectangle' | 'round' | 'ellipse';
  cornerRadiusMm?: number;
  layouts: SheetLayout[]; // one or more grid layouts (staggered sheets have two)
  marginMm?: number;      // non-printing margin from Markup-margin
  categories?: string[];  // from Meta elements
}

export interface SheetLayout {
  columns: number;        // nx
  rows: number;           // ny
  originXMm: number;      // x0
  originYMm: number;      // y0
  pitchXMm: number;       // dx
  pitchYMm: number;       // dy
}
```

**Multi-layout templates:** some sheets (staggered business cards, offset
grids, certain Avery layouts) have two `<Layout>` elements in the XML.
The `layouts[]` array captures all of them. For single-layout sheets
(the common case), `layouts` has one entry.

`exportSheet` in designer-core uses `layouts[0]` by default. The full
grid for multi-layout rendering needs all entries. The `SheetTemplate`
type in designer-core must be updated to match this schema.

**Code generation rule:** `${brand}-${part}`, lowercased, spaces replaced
with hyphens. e.g. `avery-l7160`, `herma-4226`, `uline-s-5765`.

**Convenience getters for single-layout access:**

```typescript
// For consumers that just need the basic grid
export function primaryLayout(sheet: SheetTemplate): SheetLayout {
  return sheet.layouts[0];
}

// Backwards-compatible flat accessors
export function columns(sheet: SheetTemplate): number { return sheet.layouts[0].columns; }
export function rows(sheet: SheetTemplate): number { return sheet.layouts[0].rows; }
```

---

## 3. Repository

`github.com/burnmark-io/sheet-templates`

```
sheet-templates/
├── .github/
│   ├── FUNDING.yml
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── upstream/                  # git submodule → j-evins/glabels-qt
├── scripts/
│   └── convert.ts            # XML → JSON converter
├── src/
│   ├── index.ts              # exports registry + lookup functions
│   ├── types.ts              # SheetTemplate type (re-exported from designer-core or duplicated)
│   ├── templates.json        # generated — DO NOT EDIT MANUALLY
│   └── __tests__/
│       ├── convert.test.ts
│       └── registry.test.ts
├── LICENSE                   # MIT (burnmark)
├── LICENSE-GLABELS           # MIT (Jaye Evins, glabels template database)
├── README.md
├── package.json
├── tsconfig.json
└── eslint.config.js
```

### 3.1 Upstream as Git Submodule

```bash
git submodule add https://github.com/j-evins/glabels-qt.git upstream
```

The submodule pins a specific commit. To update from upstream:
```bash
cd upstream && git pull origin master && cd ..
pnpm run convert
pnpm test
git add upstream src/templates.json
git commit -m "chore: update templates from upstream glabels-qt"
```

Only the `templates/` directory is used from the submodule. The rest of
glabels-qt (C++ source, build files) is ignored.

---

## 4. Converter Script (`scripts/convert.ts`)

A Node.js script (run with `tsx`) that:

1. Reads all `*.xml` files from `upstream/templates/`
2. Parses each XML file
3. Extracts all `<Template>` elements
4. Resolves `equiv` references (template cloning)
5. Converts units to millimetres
6. Computes derived fields (gutterH, gutterV, paperSize)
7. Generates `code` from brand + part
8. Deduplicates (same brand + part → keep first occurrence)
9. Sorts by brand then part (alphabetical)
10. Writes `src/templates.json`
11. Reports statistics: total templates, brands, skipped (CD labels, malformed)

### 4.1 Dependencies

```json
{
  "devDependencies": {
    "fast-xml-parser": "^4.0.0",
    "tsx": "^4.0.0"
  }
}
```

`fast-xml-parser` for XML parsing — fast, zero native deps, well-maintained.

### 4.2 Unit Conversion

```typescript
function parseDistance(value: string): number {
  // Returns millimetres
  const match = value.match(/^([\d.]+)\s*(pt|in|mm|cm|pc)?$/);
  if (!match) throw new Error(`Invalid distance: ${value}`);
  const num = parseFloat(match[1]);
  const unit = match[2] ?? 'pt';
  switch (unit) {
    case 'pt': return num * 0.352778;
    case 'in': return num * 25.4;
    case 'mm': return num;
    case 'cm': return num * 10;
    case 'pc': return num * 4.23333;
    default:   throw new Error(`Unknown unit: ${unit}`);
  }
}
```

### 4.3 Paper Size Resolution

Known paper sizes (from glabels `paper-sizes.xml`):

| ID | Width (mm) | Height (mm) |
|---|---|---|
| `A4` | 210 | 297 |
| `A5` | 148 | 210 |
| `A6` | 105 | 148 |
| `US-Letter` | 215.9 | 279.4 |
| `US-Legal` | 215.9 | 355.6 |
| `US-Executive` | 184.15 | 266.7 |

Templates with `size="Other"` use explicit `width` and `height` attributes.
Templates with `size="roll"` are continuous media — skip (not sticker sheets).

### 4.4 Layout Conversion

Each `<Layout>` element becomes a `SheetLayout` entry:

```typescript
const layout: SheetLayout = {
  columns: parseInt(attrs.nx),
  rows: parseInt(attrs.ny),
  originXMm: parseDistance(attrs.x0),
  originYMm: parseDistance(attrs.y0),
  pitchXMm: parseDistance(attrs.dx),
  pitchYMm: parseDistance(attrs.dy),
};
```

Templates with multiple `<Layout>` elements produce multiple entries in
the `layouts[]` array. The converter preserves all layouts — it does not
pick one and drop the others.

### 4.5 Skipped Templates

- `Label-cd` — CD/DVD media, not relevant for label printing
- `size="roll"` — continuous rolls, not sticker sheets
- Templates with missing required fields (warn, skip)

### 4.6 Script Entry Point

```json
{
  "scripts": {
    "convert": "tsx scripts/convert.ts",
    "convert:stats": "tsx scripts/convert.ts --stats"
  }
}
```

---

## 5. Package Setup

```json
{
  "name": "@burnmark-io/sheet-templates",
  "version": "0.0.0",
  "description": "Sticker sheet template registry — Avery, Herma, Zweckform, and hundreds more",
  "keywords": ["labels", "stickers", "avery", "herma", "zweckform", "sheets", "templates", "burnmark"],
  "type": "module",
  "author": "Mannes Brak",
  "license": "MIT",
  "homepage": "https://github.com/burnmark-io/sheet-templates",
  "repository": {
    "type": "git",
    "url": "https://github.com/burnmark-io/sheet-templates.git"
  },
  "bugs": {
    "url": "https://github.com/burnmark-io/sheet-templates/issues"
  },
  "funding": [
    { "type": "github", "url": "https://github.com/sponsors/mannes" },
    { "type": "ko-fi",  "url": "https://ko-fi.com/mannes" }
  ],
  "files": ["dist", "README.md"],
  "engines": { "node": ">=24.0.0" },
  "publishConfig": { "access": "public" },
  "sideEffects": false,
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "convert": "tsx scripts/convert.ts",
    "convert:stats": "tsx scripts/convert.ts --stats",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src scripts",
    "format": "prettier --write src scripts"
  },
  "dependencies": {},
  "devDependencies": {
    "@mbtech-nl/eslint-config": "^1.0.0",
    "@mbtech-nl/prettier-config": "^1.0.0",
    "@mbtech-nl/tsconfig": "^1.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "eslint": "^9.0.0",
    "fast-xml-parser": "^4.0.0",
    "prettier": "^3.0.0",
    "tsx": "^4.0.0",
    "typescript": "~5.5.0",
    "vitest": "^2.0.0"
  }
}
```

**Zero runtime dependencies.** The published package is just a JSON file
wrapped in TypeScript exports. `fast-xml-parser` and `tsx` are devDependencies
used only during conversion.

### 5.1 README Requirements

- Package name + description
- Install snippet
- Quick usage example (`findSheet('avery-l7160')`)
- Full list of supported brands
- Template count badge
- Attribution: "Template data sourced from the glabels-qt template database
  by Jaye Evins, licensed under MIT."
- Link to glabels-qt repo
- License badge

---

## 6. Public API

```typescript
// The full registry — all templates in a flat array
export const SHEETS: SheetTemplate[];

// Lookup by code
export function findSheet(code: string): SheetTemplate | undefined;

// Search by brand
export function findByBrand(brand: string): SheetTemplate[];

// Search by approximate label size (within tolerance)
export function findBySize(
  widthMm: number,
  heightMm: number,
  toleranceMm?: number,  // default 1
): SheetTemplate[];

// Search by paper size
export function findByPaper(paperSize: string): SheetTemplate[];

// List all known brands
export function listBrands(): string[];

// Type re-export
export type { SheetTemplate };
```

### 6.1 Compatibility with designer-core

`@burnmark-io/designer-core` already defines a `SheetTemplate` interface
and an `exportSheet(doc, sheet, rows?, opts?)` function. The type shapes
must match exactly. If the core's `SheetTemplate` is a subset of what
we generate (e.g. doesn't have `brand` or `categories`), extend it —
the core only reads the fields it needs (`columns`, `rows`, `labelWidthMm`,
etc.). Extra fields are harmless.

The core also has `BUILTIN_SHEETS` (a small inline set of common templates
from D3 in the decisions log). Once this package ships, those can be
replaced with imports from `@burnmark-io/sheet-templates` — or left as
fallbacks for users who don't install the full registry.

---

## 7. Tests

### 7.1 Converter Tests (`convert.test.ts`)

- Parse a known Avery template XML → verify correct JSON output
- Unit conversion: `"189pt"` → `66.675mm`, `"1.0in"` → `25.4mm`, `"10mm"` → `10`
- Paper size resolution: `"A4"` → `210 × 297`, `"US-Letter"` → `215.9 × 279.4`
- Layout conversion: nx/ny/x0/y0/dx/dy mapped correctly to SheetLayout
- Multi-layout: template with two `<Layout>` elements → `layouts.length === 2`
- Single layout: `layouts.length === 1`
- `equiv` resolution: verify clone template inherits properties
- CD labels skipped with warning
- Roll media skipped
- Code generation: `"Avery"` + `"L7160"` → `"avery-l7160"`
- Deduplication: same brand + part appearing in two files → first wins
- Malformed template: missing width → skip with warning, not crash

### 7.2 Registry Tests (`registry.test.ts`)

- `SHEETS` array is non-empty and sorted by brand + part
- `findSheet('avery-l7160')` returns correct template
- `findSheet('nonexistent')` returns undefined
- `findByBrand('Avery')` returns only Avery templates
- `findByBrand('NonExistent')` returns empty array
- `findBySize(63.5, 38.1)` returns templates with matching dimensions
- `findBySize` with tolerance: `findBySize(64, 38, 1)` includes 63.5×38.1
- `findByPaper('A4')` returns only A4 templates
- `listBrands()` returns sorted unique brand list
- Every template has all required fields (code, brand, part, paperSize, etc.)
- Every template has at least one layout in `layouts[]`
- Every code is unique (no duplicates in registry)
- labelWidthMm > 0 and labelHeightMm > 0 for all templates
- Every layout has columns >= 1 and rows >= 1
- `primaryLayout()` returns `layouts[0]` for any template

---

## 8. CI/CD

### `ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          submodules: true

      - uses: pnpm/action-setup@v5
        with:
          version: 9

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Verify templates are up-to-date
        run: |
          pnpm run convert
          git diff --exit-code src/templates.json || \
            (echo "❌ templates.json is out of date — run 'pnpm run convert'" && exit 1)

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm prettier --check "src/**/*.ts" "scripts/**/*.ts"

      - name: Test with coverage
        run: pnpm test:coverage

      - name: Build
        run: pnpm build
```

Note: `submodules: true` in checkout ensures the upstream glabels-qt submodule
is available. The CI verifies that `templates.json` is up-to-date — if someone
updates the submodule without regenerating, CI fails with a clear message.

### `release.yml`

Standard npm trusted publishing workflow — same pattern as all other packages.

---

## 9. Implementation Sequence

```
1. Scaffold
   - LICENSE (MIT, Mannes Brak)
   - LICENSE-GLABELS (MIT, Jaye Evins — copy from upstream/templates/LICENSE)
   - .github/FUNDING.yml
   - package.json, tsconfig.json, eslint.config.js
   - Git submodule: git submodule add https://github.com/j-evins/glabels-qt.git upstream
   - .gitignore (node_modules, dist)
   - GitHub Actions: ci.yml, release.yml
   - PROGRESS.md with all steps and substeps
   - pnpm install
   - Commit + push

2. Converter script
   - scripts/convert.ts — full XML → JSON converter
   - Unit parsing, paper size resolution, equiv handling, gutter calc
   - Skip CD labels and rolls
   - Run: pnpm run convert — generates src/templates.json
   - Verify output: pnpm run convert:stats — report template count, brands
   - Gate: converter runs without errors, output is valid JSON
   - Commit + push (includes generated templates.json)

3. Package source
   - src/types.ts — SheetTemplate type
   - src/index.ts — SHEETS array, findSheet, findByBrand, findBySize,
     findByPaper, listBrands
   - Gate: typecheck + lint + build
   - Commit + push

4. Tests
   - src/__tests__/convert.test.ts — converter unit tests
   - src/__tests__/registry.test.ts — registry lookup tests
   - Gate: typecheck + lint + test + build
   - Commit + push

5. README + final
   - README.md (per section 5.1)
   - Run pnpm test:coverage — verify 90% threshold
   - Verify ci.yml passes locally (including submodule checkout + convert verify)
   - Commit + push
```

---

## 10. Updating from Upstream

When glabels-qt updates their templates:

```bash
cd upstream
git pull origin master
cd ..
pnpm run convert
pnpm run convert:stats    # check new count
pnpm test                 # verify nothing broke
git add upstream src/templates.json
git commit -m "chore: update templates from upstream glabels-qt (N templates)"
git push
```

This is the entire update process. No manual data entry, no hand-editing
JSON. The converter is the single source of truth — upstream XML in, our
JSON out.

---

## 11. Key Constraints

- **Zero runtime dependencies.** Published package is TypeScript + JSON only.
- **XML parsing is build-time only.** `fast-xml-parser` and `tsx` are devDeps.
- **`templates.json` is committed.** Consumers don't need the submodule or
  converter — they install the package and get the JSON. The submodule is
  only for maintainers updating from upstream.
- **SheetTemplate type must match designer-core.** Extra fields are fine
  (brand, categories), missing fields are not. Verify against the actual
  core type before publishing.
- **CD/DVD templates are skipped.** `Label-cd` is not a sticker sheet.
- **Roll templates are skipped.** `size="roll"` is continuous media.
- **Include both LICENSE files.** Ours (MIT, Mannes Brak) and theirs
  (MIT, Jaye Evins). Both must be in the published package `files` array.
- **Attribution in README.** Credit glabels-qt and Jaye Evins prominently.
- **`publishConfig: { access: "public" }`** in package.json.
- **`pnpm prettier --check`** in CI.
