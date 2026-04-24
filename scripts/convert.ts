import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line import-x/consistent-type-specifier-style -- prefer top-level `import type` when all imports are types; pairs with @typescript-eslint/no-import-type-side-effects
import type { SheetLayout, SheetTemplate } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'upstream', 'templates');
const OUTPUT_FILE = path.join(ROOT, 'src', 'templates.json');

const MM_PER_PT = 25.4 / 72;
const MM_PER_PC = 25.4 / 6;

function roundMm(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function parseDistance(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') {
    throw new Error('Missing distance value');
  }
  const s = typeof value === 'number' ? value.toString() : value.trim();
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(pt|in|mm|cm|pc)?$/.exec(s);
  if (!match) throw new Error(`Invalid distance: ${s}`);
  const numPart = match[1];
  if (numPart === undefined) throw new Error(`Invalid distance: ${s}`);
  const num = parseFloat(numPart);
  if (!Number.isFinite(num)) throw new Error(`Invalid distance: ${s}`);
  const unit = (match[2] ?? 'pt').toLowerCase();
  switch (unit) {
    case 'pt':
      return roundMm(num * MM_PER_PT);
    case 'in':
      return roundMm(num * 25.4);
    case 'mm':
      return roundMm(num);
    case 'cm':
      return roundMm(num * 10);
    case 'pc':
      return roundMm(num * MM_PER_PC);
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }
}

export function makeCode(brand: string, part: string): string {
  return `${brand}-${part}`
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^a-z0-9-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

type RawNode = Record<string, unknown>;

function attr(node: RawNode | undefined, key: string): string | undefined {
  if (!node) return undefined;
  const val = node[`@_${key}`];
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return val.toString();
  return undefined;
}

function asRawNode(val: unknown): RawNode | undefined {
  return val && typeof val === 'object' ? (val as RawNode) : undefined;
}

function asRawArray(val: unknown): RawNode[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as RawNode[];
  if (typeof val === 'object') return [val as RawNode];
  return [];
}

interface PaperSize {
  widthMm: number;
  heightMm: number;
}

export function parsePaperSizes(xml: string): Map<string, PaperSize> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: name => name === 'Paper-size',
  });
  const doc = parser.parse(xml) as { 'Glabels-paper-sizes'?: { 'Paper-size'?: RawNode[] } };
  const items = doc['Glabels-paper-sizes']?.['Paper-size'] ?? [];
  const map = new Map<string, PaperSize>();
  for (const ps of items) {
    const id = attr(ps, 'id');
    const w = attr(ps, 'width');
    const h = attr(ps, 'height');
    if (id === undefined || w === undefined || h === undefined) continue;
    map.set(id, { widthMm: parseDistance(w), heightMm: parseDistance(h) });
  }
  return map;
}

interface Stats {
  filesRead: number;
  templatesFound: number;
  templatesConverted: number;
  equivResolved: number;
  equivUnresolved: number;
  skippedCd: number;
  skippedRoll: number;
  skippedMalformed: number;
  duplicates: number;
  multiLayout: number;
  brands: Set<string>;
  warnings: string[];
}

function getDescription(tmpl: RawNode): string | undefined {
  return attr(tmpl, 'description') ?? attr(tmpl, '_description');
}

function getCategories(tmpl: RawNode): string[] | undefined {
  const arr = asRawArray(tmpl.Meta);
  if (arr.length === 0) return undefined;
  const cats = arr.map(m => attr(m, 'category')).filter((c): c is string => c !== undefined);
  return cats.length > 0 ? cats : undefined;
}

function getMargin(labelEl: RawNode): number | undefined {
  const arr = asRawArray(labelEl['Markup-margin']);
  const first = arr[0];
  if (!first) return undefined;
  const size = attr(first, 'size');
  return size === undefined ? undefined : parseDistance(size);
}

function extractLayouts(labelEl: RawNode): SheetLayout[] {
  const arr = asRawArray(labelEl.Layout);
  return arr.map(l => ({
    columns: parseInt(attr(l, 'nx') ?? '0', 10),
    rows: parseInt(attr(l, 'ny') ?? '0', 10),
    originXMm: parseDistance(attr(l, 'x0')),
    originYMm: parseDistance(attr(l, 'y0')),
    pitchXMm: parseDistance(attr(l, 'dx')),
    pitchYMm: parseDistance(attr(l, 'dy')),
  }));
}

interface ResolvedPaper {
  paperSize: string;
  paperWidthMm: number;
  paperHeightMm: number;
}

function resolvePaper(
  size: string,
  tmpl: RawNode,
  paperSizes: Map<string, PaperSize>,
): ResolvedPaper | null {
  if (size.toLowerCase() === 'other') {
    const w = attr(tmpl, 'width');
    const h = attr(tmpl, 'height');
    if (w === undefined || h === undefined) return null;
    return { paperSize: 'Other', paperWidthMm: parseDistance(w), paperHeightMm: parseDistance(h) };
  }
  const paper = paperSizes.get(size);
  if (!paper) return null;
  return { paperSize: size, paperWidthMm: paper.widthMm, paperHeightMm: paper.heightMm };
}

interface ParsedFull {
  kind: 'full';
  template: SheetTemplate;
}
interface ParsedEquiv {
  kind: 'equiv';
  brand: string;
  part: string;
  equivOf: string;
}
interface ParsedSkipped {
  kind: 'skipped-cd';
  brand: string;
  part: string;
}
type ParseResult = ParsedFull | ParsedEquiv | ParsedSkipped;

export function parseTemplate(
  tmpl: RawNode,
  paperSizes: Map<string, PaperSize>,
  stats: Stats,
): ParseResult | null {
  const brand = attr(tmpl, 'brand');
  const part = attr(tmpl, 'part');
  if (brand === undefined || part === undefined) {
    stats.skippedMalformed++;
    return null;
  }

  const equivOf = attr(tmpl, 'equiv');
  if (equivOf !== undefined) {
    return { kind: 'equiv', brand, part, equivOf };
  }

  if (tmpl['Label-cd']) {
    stats.skippedCd++;
    return { kind: 'skipped-cd', brand, part };
  }

  const size = attr(tmpl, 'size') ?? '';
  if (size.toLowerCase() === 'roll') {
    stats.skippedRoll++;
    return null;
  }

  const paper = resolvePaper(size, tmpl, paperSizes);
  if (!paper) {
    stats.warnings.push(`Unknown paper size "${size}" for ${brand} ${part}`);
    stats.skippedMalformed++;
    return null;
  }

  let labelShape: 'rectangle' | 'round' | 'ellipse';
  let labelWidthMm: number;
  let labelHeightMm: number;
  let cornerRadiusMm: number | undefined;
  let labelEl: RawNode;

  const rect = asRawNode(tmpl['Label-rectangle']);
  const round = asRawNode(tmpl['Label-round']);
  const ellipse = asRawNode(tmpl['Label-ellipse']);

  if (rect) {
    labelShape = 'rectangle';
    labelEl = rect;
    labelWidthMm = parseDistance(attr(rect, 'width'));
    labelHeightMm = parseDistance(attr(rect, 'height'));
    const r = attr(rect, 'round');
    if (r !== undefined) cornerRadiusMm = parseDistance(r);
  } else if (round) {
    labelShape = 'round';
    labelEl = round;
    const r = parseDistance(attr(round, 'radius'));
    labelWidthMm = r * 2;
    labelHeightMm = r * 2;
  } else if (ellipse) {
    labelShape = 'ellipse';
    labelEl = ellipse;
    labelWidthMm = parseDistance(attr(ellipse, 'width'));
    labelHeightMm = parseDistance(attr(ellipse, 'height'));
  } else {
    stats.skippedMalformed++;
    return null;
  }

  const layouts = extractLayouts(labelEl);
  if (layouts.length === 0) {
    stats.skippedMalformed++;
    return null;
  }
  if (layouts.length > 1) stats.multiLayout++;

  const categories = getCategories(tmpl);
  const description = getDescription(tmpl);
  const marginMm = getMargin(labelEl);

  const code = makeCode(brand, part);
  const name = description === undefined ? `${brand} ${part}` : `${brand} ${part} — ${description}`;

  const template: SheetTemplate = {
    code,
    name,
    brand,
    part,
    paperSize: paper.paperSize,
    paperWidthMm: paper.paperWidthMm,
    paperHeightMm: paper.paperHeightMm,
    labelWidthMm,
    labelHeightMm,
    labelShape,
    ...(cornerRadiusMm === undefined ? {} : { cornerRadiusMm }),
    layouts,
    ...(marginMm === undefined ? {} : { marginMm }),
    ...(categories === undefined ? {} : { categories }),
  };

  stats.brands.add(brand);
  return { kind: 'full', template };
}

export interface ConvertResult {
  templates: SheetTemplate[];
  stats: Stats;
}

export function convert(
  templateXmls: { name: string; xml: string }[],
  paperSizesXml: string,
): ConvertResult {
  const stats: Stats = {
    filesRead: 0,
    templatesFound: 0,
    templatesConverted: 0,
    equivResolved: 0,
    equivUnresolved: 0,
    skippedCd: 0,
    skippedRoll: 0,
    skippedMalformed: 0,
    duplicates: 0,
    multiLayout: 0,
    brands: new Set<string>(),
    warnings: [],
  };

  const paperSizes = parsePaperSizes(paperSizesXml);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: name => ['Template', 'Meta', 'Layout'].includes(name),
  });

  const fullTemplates = new Map<string, SheetTemplate>();
  const pendingEquivs: { brand: string; part: string; equivOf: string }[] = [];
  const skippedCdCodes = new Set<string>();

  for (const { name: file, xml } of templateXmls) {
    stats.filesRead++;
    let doc: { 'Glabels-templates'?: { Template?: RawNode[] } };
    try {
      doc = parser.parse(xml) as typeof doc;
    } catch (e) {
      stats.warnings.push(`Failed to parse ${file}: ${(e as Error).message}`);
      continue;
    }
    const tmpls = doc['Glabels-templates']?.Template ?? [];
    for (const tmpl of tmpls) {
      stats.templatesFound++;
      try {
        const parsed = parseTemplate(tmpl, paperSizes, stats);
        if (!parsed) continue;
        if (parsed.kind === 'skipped-cd') {
          skippedCdCodes.add(makeCode(parsed.brand, parsed.part));
          continue;
        }
        if (parsed.kind === 'equiv') {
          pendingEquivs.push(parsed);
          continue;
        }
        const code = parsed.template.code;
        if (fullTemplates.has(code)) {
          stats.duplicates++;
          continue;
        }
        fullTemplates.set(code, parsed.template);
        stats.templatesConverted++;
      } catch (e) {
        const id = `${attr(tmpl, 'brand') ?? '?'}/${attr(tmpl, 'part') ?? '?'}`;
        stats.warnings.push(`Error in ${file} ${id}: ${(e as Error).message}`);
        stats.skippedMalformed++;
      }
    }
  }

  for (const eq of pendingEquivs) {
    const code = makeCode(eq.brand, eq.part);
    if (fullTemplates.has(code)) {
      stats.duplicates++;
      continue;
    }
    const targetCode = makeCode(eq.brand, eq.equivOf);
    if (skippedCdCodes.has(targetCode)) {
      stats.skippedCd++;
      continue;
    }
    const target = fullTemplates.get(targetCode);
    if (!target) {
      stats.equivUnresolved++;
      stats.warnings.push(`Unresolved equiv: ${eq.brand} ${eq.part} → ${eq.equivOf}`);
      continue;
    }
    const clone: SheetTemplate = {
      ...target,
      code,
      brand: eq.brand,
      part: eq.part,
      name: target.name.replaceAll(`${target.brand} ${target.part}`, `${eq.brand} ${eq.part}`),
    };
    fullTemplates.set(code, clone);
    stats.equivResolved++;
    stats.brands.add(eq.brand);
  }

  const templates = [...fullTemplates.values()].sort((a, b) => {
    const byBrand = a.brand.localeCompare(b.brand);
    if (byBrand !== 0) return byBrand;
    return a.part.localeCompare(b.part);
  });

  return { templates, stats };
}

function fmtStat(label: string, value: number | string): string {
  const s = typeof value === 'number' ? value.toString() : value;
  return `${label.padEnd(28)}${s}`;
}

/* v8 ignore start -- CLI shim; the underlying convert() is fully tested and the CI convert step exercises this path end-to-end */
function runCli(): void {
  const paperSizesXml = fs.readFileSync(path.join(TEMPLATES_DIR, 'paper-sizes.xml'), 'utf-8');
  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith('.xml') && f !== 'paper-sizes.xml' && f !== 'categories.xml')
    .sort();

  const templateXmls = files.map(f => ({
    name: f,
    xml: fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf-8'),
  }));

  const { templates, stats } = convert(templateXmls, paperSizesXml);

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(templates, null, 2)}\n`);

  const wantStats = process.argv.includes('--stats');

  const lines = [
    fmtStat('Files read:', stats.filesRead),
    fmtStat('Templates found:', stats.templatesFound),
    fmtStat('Converted (full):', stats.templatesConverted),
    fmtStat('Equiv resolved:', stats.equivResolved),
    fmtStat('Equiv unresolved:', stats.equivUnresolved),
    fmtStat('Skipped (CD):', stats.skippedCd),
    fmtStat('Skipped (roll):', stats.skippedRoll),
    fmtStat('Skipped (malformed):', stats.skippedMalformed),
    fmtStat('Duplicates:', stats.duplicates),
    fmtStat('Multi-layout sheets:', stats.multiLayout),
    fmtStat('Total in registry:', templates.length),
    fmtStat('Brands:', stats.brands.size),
    fmtStat('Output:', path.relative(ROOT, OUTPUT_FILE)),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);

  if (wantStats) {
    process.stdout.write(`\nBrands:\n  ${[...stats.brands].sort().join(', ')}\n`);
    if (stats.warnings.length > 0) {
      process.stdout.write(`\nWarnings (${stats.warnings.length.toString()}):\n`);
      for (const w of stats.warnings) process.stdout.write(`  - ${w}\n`);
    }
  } else if (stats.warnings.length > 0) {
    process.stdout.write(
      `\n(${stats.warnings.length.toString()} warnings — run with --stats to see)\n`,
    );
  }
}

const isDirectRun = import.meta.url === `file://${process.argv[1] ?? ''}`;
if (isDirectRun) {
  runCli();
}
/* v8 ignore stop */
