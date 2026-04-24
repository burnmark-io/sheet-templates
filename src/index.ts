import templatesData from './templates.json' with { type: 'json' };

// eslint-disable-next-line import-x/consistent-type-specifier-style -- prefer top-level `import type` when all imports are types; pairs with @typescript-eslint/no-import-type-side-effects
import type { SheetLayout, SheetTemplate } from './types.js';

export type { SheetLayout, SheetTemplate };

export const SHEETS: SheetTemplate[] = templatesData as SheetTemplate[];

export function findSheet(code: string): SheetTemplate | undefined {
  return SHEETS.find((s) => s.code === code);
}

export function findByBrand(brand: string): SheetTemplate[] {
  const lower = brand.toLowerCase();
  return SHEETS.filter((s) => s.brand.toLowerCase() === lower);
}

export function findBySize(
  widthMm: number,
  heightMm: number,
  toleranceMm = 1,
): SheetTemplate[] {
  return SHEETS.filter(
    (s) =>
      Math.abs(s.labelWidthMm - widthMm) <= toleranceMm &&
      Math.abs(s.labelHeightMm - heightMm) <= toleranceMm,
  );
}

export function findByPaper(paperSize: string): SheetTemplate[] {
  return SHEETS.filter((s) => s.paperSize === paperSize);
}

export function listBrands(): string[] {
  const brands = new Set(SHEETS.map((s) => s.brand));
  return [...brands].sort();
}

export function primaryLayout(sheet: SheetTemplate): SheetLayout {
  const first = sheet.layouts[0];
  if (!first) throw new Error(`Template ${sheet.code} has no layouts`);
  return first;
}
