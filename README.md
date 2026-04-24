# @burnmark-io/sheet-templates

[![npm](https://img.shields.io/npm/v/@burnmark-io/sheet-templates.svg)](https://www.npmjs.com/package/@burnmark-io/sheet-templates)
[![license](https://img.shields.io/npm/l/@burnmark-io/sheet-templates.svg)](./LICENSE)
[![templates](https://img.shields.io/badge/templates-1599-blue)](./src/templates.json)
[![brands](https://img.shields.io/badge/brands-56-blue)](#supported-brands)

A zero-runtime-dependency JSON registry of sticker sheet specifications — **1599 templates across 56 brands** including Avery, Herma, Zweckform, APLI, Dymo, Online Labels, Worldlabel, Rayfilm, SheetLabels, Uline, and many more.

Built for `@burnmark-io/designer-core` so label designs can be tiled onto any standard A4, US-Letter, or custom-size sticker sheet for PDF export — but usable from any TypeScript / JavaScript project that needs sheet dimensions.

## Install

```bash
pnpm add @burnmark-io/sheet-templates
# or: npm install @burnmark-io/sheet-templates
```

## Usage

```ts
import {
  SHEETS,
  findSheet,
  findByBrand,
  findBySize,
  findByPaper,
  listBrands,
  primaryLayout,
  type SheetTemplate,
  type SheetLayout,
} from '@burnmark-io/sheet-templates';

// Look up a known product code
const sheet = findSheet('avery-l7160');
//  → { code, name, brand: 'Avery', part: 'L7160', paperSize: 'A4',
//      paperWidthMm: 210, paperHeightMm: 297,
//      labelWidthMm: 63.5, labelHeightMm: 38.1, labelShape: 'rectangle',
//      cornerRadiusMm, layouts: [{ columns: 3, rows: 7, ... }], ... }

// All Avery sheets (case-insensitive)
findByBrand('Avery');

// Find by approximate label dimensions (default tolerance: 1 mm)
findBySize(63.5, 38.1);            // tight
findBySize(63.5, 38.1, 2);         // within 2 mm

// Filter by paper size
findByPaper('A4');
findByPaper('US-Letter');

// Enumerate the catalog
listBrands();
// → ['Agipa', 'APLI', 'Apli', 'Ascom', 'Avery', ...]

// Full registry, sorted by brand then part
SHEETS.length;                     // 1599

// Primary grid layout (shortcut for sheet.layouts[0])
primaryLayout(sheet).columns;      // 3
```

## Data shape

```ts
interface SheetTemplate {
  code: string;            // e.g. 'avery-l7160' (brand-part, normalised)
  name: string;            // e.g. 'Avery L7160 — Address labels'
  brand: string;           // e.g. 'Avery'
  part: string;            // e.g. 'L7160'
  paperSize: string;       // 'A4', 'US-Letter', 'Other', ...
  paperWidthMm: number;
  paperHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  labelShape: 'rectangle' | 'round' | 'ellipse';
  cornerRadiusMm?: number;
  layouts: SheetLayout[];  // one entry per <Layout>; multi-layout sheets have two or more
  marginMm?: number;       // non-printing bleed margin, when the source XML specifies one
  categories?: string[];   // e.g. ['label', 'mail']
}

interface SheetLayout {
  columns: number;         // nx
  rows: number;            // ny
  originXMm: number;       // x0 — top-left of the first label
  originYMm: number;       // y0
  pitchXMm: number;        // dx — centre-to-centre horizontal spacing
  pitchYMm: number;        // dy
}
```

`layouts` is an array because some real-world sheets (staggered business cards, offset grids) use two or three `<Layout>` elements to describe non-uniform cell placement. For the common single-grid case, `layouts.length === 1` and `primaryLayout(sheet)` returns it directly.

## Supported brands

Agipa, Apli, APLI, Ascom, Avery, Begalabel, Best Office, Biltem, Bruna, Cable Label Co, Celcast, Connect, DataBecker, Dataline, DECAdry, Dymo, Ednet, Encre.com, Endisch, Epson, Felga, Geha, Hama, Hema, Herma, Hisago, Igepa, Impact, JAC, Kingdom, Kores, Maco, Meritline, Micro Application, Neato, Netc, OfficeMax, Online Labels, PEARL, Poundland, Q-CONNECT, Rayfilm, Russian, Ryman, Sattleford, SheetLabels, Sigel, Southworth, Staples, Stomper, Tough-Tags, Uline, Viking, Worldlabel, Your Design, Zweckform.

## How the data is built

Template data is sourced from the [glabels-qt](https://github.com/j-evins/glabels-qt) template database by Jaye Evins — hundreds of hand-curated XML definitions maintained since 2001 under the MIT license.

A build-time script (`scripts/convert.ts`) walks `upstream/templates/*.xml`, normalises every distance to millimetres, resolves `equiv` clone references, captures all `<Layout>` elements, skips CD/DVD media and continuous-roll templates, dedupes, and writes `src/templates.json`. Updating from upstream is a submodule pull and a `pnpm run convert` away — no manual data entry.

The published npm package ships only the generated JSON and a thin TypeScript wrapper. **Zero runtime dependencies.** `fast-xml-parser` and `tsx` are devDependencies used only during the build.

## Attribution

Template data is sourced from the **glabels-qt** template database by **Jaye Evins**, licensed under the MIT License (see [LICENSE-GLABELS](./LICENSE-GLABELS)). The gLabels project has been maintaining this catalog since 2001. Please credit upstream when redistributing.

## License

MIT © 2026 Mannes Brak. See [LICENSE](./LICENSE) for this package's code, and [LICENSE-GLABELS](./LICENSE-GLABELS) for the template data.
