import { describe, expect, it } from 'vitest';

import {
  SHEETS,
  findByBrand,
  findByPaper,
  findBySize,
  findSheet,
  listBrands,
  primaryLayout,
} from '../index.js';

describe('SHEETS', () => {
  it('is non-empty', () => {
    expect(SHEETS.length).toBeGreaterThan(0);
  });

  it('is sorted by brand then part', () => {
    for (let i = 1; i < SHEETS.length; i++) {
      const prev = SHEETS[i - 1]!;
      const curr = SHEETS[i]!;
      const brandCmp = prev.brand.localeCompare(curr.brand);
      if (brandCmp > 0) {
        throw new Error(`Brand out of order: ${prev.brand} before ${curr.brand}`);
      }
      if (brandCmp === 0 && prev.part.localeCompare(curr.part) > 0) {
        throw new Error(`Part out of order within ${prev.brand}: ${prev.part} before ${curr.part}`);
      }
    }
  });

  it('has unique codes across the whole registry', () => {
    const codes = new Set<string>();
    for (const s of SHEETS) {
      expect(codes.has(s.code)).toBe(false);
      codes.add(s.code);
    }
  });

  it('every template has the full required shape', () => {
    for (const s of SHEETS) {
      expect(typeof s.code).toBe('string');
      expect(s.code.length).toBeGreaterThan(0);
      expect(typeof s.name).toBe('string');
      expect(typeof s.brand).toBe('string');
      expect(typeof s.part).toBe('string');
      expect(typeof s.paperSize).toBe('string');
      expect(s.paperWidthMm).toBeGreaterThan(0);
      expect(s.paperHeightMm).toBeGreaterThan(0);
      expect(s.labelWidthMm).toBeGreaterThan(0);
      expect(s.labelHeightMm).toBeGreaterThan(0);
      expect(['rectangle', 'round', 'ellipse']).toContain(s.labelShape);
      expect(Array.isArray(s.layouts)).toBe(true);
      expect(s.layouts.length).toBeGreaterThanOrEqual(1);
      for (const layout of s.layouts) {
        expect(layout.columns).toBeGreaterThanOrEqual(1);
        expect(layout.rows).toBeGreaterThanOrEqual(1);
        expect(layout.originXMm).toBeGreaterThanOrEqual(0);
        expect(layout.originYMm).toBeGreaterThanOrEqual(0);
        // pitch is a don't-care when that axis only has 1 cell; otherwise it
        // must be positive to separate adjacent labels.
        if (layout.columns > 1) expect(layout.pitchXMm).toBeGreaterThan(0);
        if (layout.rows > 1) expect(layout.pitchYMm).toBeGreaterThan(0);
        expect(layout.pitchXMm).toBeGreaterThanOrEqual(0);
        expect(layout.pitchYMm).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('contains well-known Avery templates', () => {
    expect(findSheet('avery-l4770')).toBeDefined();
    expect(findSheet('avery-l7160')).toBeDefined();
  });

  it('includes at least one multi-layout template', () => {
    const multi = SHEETS.filter(s => s.layouts.length > 1);
    expect(multi.length).toBeGreaterThan(0);
  });
});

describe('findSheet', () => {
  it('returns the matching template', () => {
    const sheet = findSheet('avery-l4770');
    expect(sheet).toBeDefined();
    expect(sheet?.brand).toBe('Avery');
    expect(sheet?.part).toBe('L4770');
  });

  it('returns undefined for unknown codes', () => {
    expect(findSheet('nonexistent-xyz')).toBeUndefined();
  });
});

describe('findByBrand', () => {
  it('returns only templates of the given brand', () => {
    const avery = findByBrand('Avery');
    expect(avery.length).toBeGreaterThan(0);
    for (const s of avery) expect(s.brand).toBe('Avery');
  });

  it('is case-insensitive', () => {
    const upper = findByBrand('AVERY');
    const lower = findByBrand('avery');
    expect(upper.length).toBe(lower.length);
    expect(upper.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown brands', () => {
    expect(findByBrand('NoSuchBrand')).toEqual([]);
  });
});

describe('findBySize', () => {
  it('finds templates with matching dimensions within default tolerance', () => {
    // 63.5 × 38.1 mm — a very common address-label size (Avery L7160 etc.)
    const matches = findBySize(63.5, 38.1);
    expect(matches.length).toBeGreaterThan(0);
    for (const s of matches) {
      expect(Math.abs(s.labelWidthMm - 63.5)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.labelHeightMm - 38.1)).toBeLessThanOrEqual(1);
    }
  });

  it('widens via explicit tolerance', () => {
    const strict = findBySize(64, 38, 0.1);
    const loose = findBySize(64, 38, 1);
    expect(loose.length).toBeGreaterThanOrEqual(strict.length);
    expect(loose.some(s => s.labelWidthMm === 63.5 && s.labelHeightMm === 38.1)).toBe(true);
  });

  it('returns empty array when nothing fits', () => {
    expect(findBySize(9999, 9999)).toEqual([]);
  });
});

describe('findByPaper', () => {
  it('returns only A4 templates', () => {
    const a4 = findByPaper('A4');
    expect(a4.length).toBeGreaterThan(0);
    for (const s of a4) expect(s.paperSize).toBe('A4');
  });

  it('returns only US-Letter templates', () => {
    const letter = findByPaper('US-Letter');
    expect(letter.length).toBeGreaterThan(0);
    for (const s of letter) expect(s.paperSize).toBe('US-Letter');
  });

  it('is exact-match (no case folding)', () => {
    expect(findByPaper('a4')).toEqual([]);
  });
});

describe('listBrands', () => {
  it('returns a sorted, unique list', () => {
    const brands = listBrands();
    expect(brands.length).toBeGreaterThan(0);
    const sorted = [...brands].sort((a, b) => a.localeCompare(b));
    expect(brands).toEqual(sorted);
    expect(new Set(brands).size).toBe(brands.length);
  });

  it('includes Avery and Herma', () => {
    const brands = listBrands();
    expect(brands).toContain('Avery');
    expect(brands).toContain('Herma');
  });
});

describe('primaryLayout', () => {
  it('returns layouts[0]', () => {
    const sheet = findSheet('avery-l4770')!;
    expect(primaryLayout(sheet)).toBe(sheet.layouts[0]);
  });

  it('throws when the template has no layouts', () => {
    const empty = {
      ...findSheet('avery-l4770')!,
      code: 'synthetic-empty',
      layouts: [],
    };
    expect(() => primaryLayout(empty)).toThrow(/no layouts/);
  });
});
