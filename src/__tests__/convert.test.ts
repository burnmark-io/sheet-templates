import { describe, expect, it } from 'vitest';

import { convert, makeCode, parseDistance, parsePaperSizes } from '../../scripts/convert.js';

const PAPER_SIZES_XML = `<?xml version="1.0"?>
<Glabels-paper-sizes>
  <Paper-size id="A4"        name="A4"        width="210mm"  height="297mm"/>
  <Paper-size id="US-Letter" name="US Letter" width="8.5in"  height="11in"/>
  <Paper-size id="A5"        name="A5"        width="148mm"  height="210mm"/>
</Glabels-paper-sizes>`;

function wrap(templates: string): string {
  return `<?xml version="1.0"?>\n<Glabels-templates>\n${templates}\n</Glabels-templates>`;
}

describe('parseDistance', () => {
  it('converts points to mm', () => {
    expect(parseDistance('72pt')).toBeCloseTo(25.4, 4);
    expect(parseDistance('189pt')).toBeCloseTo(66.675, 3);
  });

  it('converts inches to mm', () => {
    expect(parseDistance('1.0in')).toBe(25.4);
    expect(parseDistance('8.5in')).toBe(215.9);
  });

  it('passes millimetres through', () => {
    expect(parseDistance('10mm')).toBe(10);
    expect(parseDistance('210mm')).toBe(210);
  });

  it('converts centimetres to mm', () => {
    expect(parseDistance('1cm')).toBe(10);
  });

  it('converts picas to mm', () => {
    expect(parseDistance('1pc')).toBeCloseTo(25.4 / 6, 4);
  });

  it('defaults to points when no unit given', () => {
    expect(parseDistance('72')).toBeCloseTo(25.4, 4);
  });

  it('accepts trailing-dot notation like 11.in', () => {
    expect(parseDistance('11.in')).toBe(11 * 25.4);
    expect(parseDistance('1.in')).toBe(25.4);
  });

  it('accepts scientific notation', () => {
    expect(parseDistance('3.93386e-16pt')).toBe(0);
    expect(parseDistance('1e1mm')).toBe(10);
  });

  it('accepts leading dot', () => {
    expect(parseDistance('.5in')).toBe(12.7);
  });

  it('rejects garbage', () => {
    expect(() => parseDistance('abc')).toThrow(/Invalid distance/);
    expect(() => parseDistance('in')).toThrow(/Invalid distance/);
  });

  it('rejects missing value', () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- explicitly testing undefined handling
    expect(() => parseDistance(undefined)).toThrow(/Missing distance/);
    expect(() => parseDistance(null)).toThrow(/Missing distance/);
    expect(() => parseDistance('')).toThrow(/Missing distance/);
  });

  it('accepts raw numbers', () => {
    expect(parseDistance(10)).toBeCloseTo(3.5278, 3); // interpreted as points
  });

  it('rounds out floating-point noise', () => {
    // 8.5 * 25.4 === 215.89999999999998 pre-rounding
    expect(parseDistance('8.5in')).toBe(215.9);
  });
});

describe('makeCode', () => {
  it('lowercases brand and part', () => {
    expect(makeCode('Avery', 'L7160')).toBe('avery-l7160');
  });

  it('replaces whitespace with hyphens', () => {
    expect(makeCode('Online Labels', 'OL175')).toBe('online-labels-ol175');
  });

  it('collapses multiple hyphens', () => {
    expect(makeCode('Foo--Bar', 'X')).toBe('foo-bar-x');
  });

  it('strips non-alphanumeric characters', () => {
    expect(makeCode('Q-CONNECT', 'KF10001')).toBe('q-connect-kf10001');
    expect(makeCode('Encre.com', 'X1')).toBe('encre-com-x1');
  });
});

describe('parsePaperSizes', () => {
  it('parses the paper size catalog', () => {
    const sizes = parsePaperSizes(PAPER_SIZES_XML);
    expect(sizes.get('A4')).toEqual({ widthMm: 210, heightMm: 297 });
    expect(sizes.get('US-Letter')).toEqual({ widthMm: 215.9, heightMm: 279.4 });
    expect(sizes.get('A5')).toEqual({ widthMm: 148, heightMm: 210 });
  });
});

describe('convert — basic template', () => {
  it('parses a rectangle template end to end', () => {
    const xml = wrap(`
  <Template brand="Test" part="T1" size="A4" _description="Test labels">
    <Meta category="label"/>
    <Meta category="rectangle-label"/>
    <Label-rectangle id="0" width="63.5mm" height="38.1mm" round="1mm">
      <Markup-margin size="1mm"/>
      <Layout nx="3" ny="7" x0="7mm" y0="15mm" dx="66.5mm" dy="41.1mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates).toHaveLength(1);
    const t = templates[0]!;
    expect(t).toMatchObject({
      code: 'test-t1',
      name: 'Test T1 — Test labels',
      brand: 'Test',
      part: 'T1',
      paperSize: 'A4',
      paperWidthMm: 210,
      paperHeightMm: 297,
      labelWidthMm: 63.5,
      labelHeightMm: 38.1,
      labelShape: 'rectangle',
      cornerRadiusMm: 1,
      marginMm: 1,
      categories: ['label', 'rectangle-label'],
    });
    expect(t.layouts).toEqual([
      {
        columns: 3,
        rows: 7,
        originXMm: 7,
        originYMm: 15,
        pitchXMm: 66.5,
        pitchYMm: 41.1,
      },
    ]);
    expect(stats.templatesConverted).toBe(1);
    expect(stats.multiLayout).toBe(0);
  });

  it('uses "Brand Part" as name when description missing', () => {
    const xml = wrap(`
  <Template brand="Test" part="T2" size="A4">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates[0]!.name).toBe('Test T2');
  });

  it('accepts a non-underscored description attribute', () => {
    const xml = wrap(`
  <Template brand="Test" part="T3" size="A4" description="Plain description">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates[0]!.name).toBe('Test T3 — Plain description');
  });
});

describe('convert — label shapes', () => {
  it('handles round labels (diameter = 2 × radius)', () => {
    const xml = wrap(`
  <Template brand="Test" part="ROUND" size="A4">
    <Label-round id="0" radius="20mm">
      <Layout nx="2" ny="3" x0="10mm" y0="10mm" dx="50mm" dy="50mm"/>
    </Label-round>
  </Template>`);
    const { templates } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    const t = templates[0]!;
    expect(t.labelShape).toBe('round');
    expect(t.labelWidthMm).toBe(40);
    expect(t.labelHeightMm).toBe(40);
  });

  it('handles ellipse labels', () => {
    const xml = wrap(`
  <Template brand="Test" part="OVAL" size="A4">
    <Label-ellipse id="0" width="50mm" height="30mm">
      <Layout nx="2" ny="3" x0="10mm" y0="10mm" dx="60mm" dy="40mm"/>
    </Label-ellipse>
  </Template>`);
    const { templates } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    const t = templates[0]!;
    expect(t.labelShape).toBe('ellipse');
    expect(t.labelWidthMm).toBe(50);
    expect(t.labelHeightMm).toBe(30);
  });

  it('skips CD/DVD labels', () => {
    const xml = wrap(`
  <Template brand="Test" part="DISC" size="A4">
    <Label-cd id="0" radius="60mm" hole="20mm"/>
  </Template>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates).toHaveLength(0);
    expect(stats.skippedCd).toBe(1);
  });
});

describe('convert — multi-layout', () => {
  it('preserves multiple Layout elements as layouts[]', () => {
    const xml = wrap(`
  <Template brand="Test" part="STAGGER" size="A4">
    <Label-rectangle id="0" width="50mm" height="30mm">
      <Layout nx="2" ny="3" x0="10mm" y0="10mm" dx="60mm" dy="40mm"/>
      <Layout nx="2" ny="3" x0="15mm" y0="25mm" dx="60mm" dy="40mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates[0]!.layouts).toHaveLength(2);
    expect(templates[0]!.layouts[0]!.originXMm).toBe(10);
    expect(templates[0]!.layouts[1]!.originXMm).toBe(15);
    expect(stats.multiLayout).toBe(1);
  });

  it('reports single-layout templates in layouts of length 1', () => {
    const xml = wrap(`
  <Template brand="Test" part="SINGLE" size="A4">
    <Label-rectangle id="0" width="50mm" height="30mm">
      <Layout nx="2" ny="3" x0="10mm" y0="10mm" dx="60mm" dy="40mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates[0]!.layouts).toHaveLength(1);
  });
});

describe('convert — paper size resolution', () => {
  it('resolves standard paper IDs to width/height', () => {
    const xml = wrap(`
  <Template brand="Test" part="LETTER" size="US-Letter">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates[0]!.paperSize).toBe('US-Letter');
    expect(templates[0]!.paperWidthMm).toBe(215.9);
    expect(templates[0]!.paperHeightMm).toBe(279.4);
  });

  it('handles size="other" with explicit width/height', () => {
    const xml = wrap(`
  <Template brand="Dymo" part="D1" size="other" width="30mm" height="90mm">
    <Label-rectangle id="0" width="28mm" height="88mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="30mm" dy="90mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates[0]!.paperSize).toBe('Other');
    expect(templates[0]!.paperWidthMm).toBe(30);
    expect(templates[0]!.paperHeightMm).toBe(90);
  });

  it('skips templates with unknown paper size', () => {
    const xml = wrap(`
  <Template brand="Test" part="UNKNOWN" size="Martian">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates).toHaveLength(0);
    expect(stats.skippedMalformed).toBe(1);
    expect(stats.warnings[0]).toMatch(/Unknown paper size/);
  });

  it('skips size="roll" templates', () => {
    const xml = wrap(`
  <Template brand="Test" part="ROLL" size="roll">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates).toHaveLength(0);
    expect(stats.skippedRoll).toBe(1);
  });
});

describe('convert — equiv resolution', () => {
  it('clones properties from the referenced template', () => {
    const xml = wrap(`
  <Template brand="Avery" part="BASE" size="A4" _description="Master template">
    <Label-rectangle id="0" width="50mm" height="30mm" round="2mm">
      <Markup-margin size="1mm"/>
      <Layout nx="2" ny="3" x0="10mm" y0="10mm" dx="60mm" dy="40mm"/>
    </Label-rectangle>
  </Template>
  <Template brand="Avery" part="CLONE" equiv="BASE"/>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates).toHaveLength(2);
    const clone = templates.find(t => t.part === 'CLONE')!;
    expect(clone.code).toBe('avery-clone');
    expect(clone.labelWidthMm).toBe(50);
    expect(clone.labelHeightMm).toBe(30);
    expect(clone.cornerRadiusMm).toBe(2);
    expect(clone.name).toBe('Avery CLONE — Master template');
    expect(stats.equivResolved).toBe(1);
  });

  it('silently skips equiv chains that point to CD templates', () => {
    const xml = wrap(`
  <Template brand="Avery" part="DISC1" size="A4">
    <Label-cd id="0" radius="60mm" hole="20mm"/>
  </Template>
  <Template brand="Avery" part="DISC2" equiv="DISC1"/>`);
    const { stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(stats.skippedCd).toBe(2);
    expect(stats.equivUnresolved).toBe(0);
  });

  it('records unresolved equivs when the target is missing', () => {
    const xml = wrap(`
  <Template brand="Avery" part="ORPHAN" equiv="MISSING"/>`);
    const { stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(stats.equivUnresolved).toBe(1);
    expect(stats.warnings[0]).toMatch(/Unresolved equiv/);
  });

  it('drops equiv entries that collide with an existing full template', () => {
    const xml = wrap(`
  <Template brand="Avery" part="X" size="A4">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>
  <Template brand="Avery" part="Y" size="A4">
    <Label-rectangle id="0" width="20mm" height="20mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="20mm" dy="20mm"/>
    </Label-rectangle>
  </Template>
  <Template brand="Avery" part="X" equiv="Y"/>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates).toHaveLength(2);
    // The equiv (full 'X', equiv→Y) collides with the already-seen full X and is counted as a dup.
    expect(stats.duplicates).toBe(1);
    expect(templates.find(t => t.part === 'X')!.labelWidthMm).toBe(10);
  });
});

describe('convert — bookkeeping', () => {
  it('sorts by brand then part', () => {
    const xml = wrap(`
  <Template brand="Zebra" part="B1" size="A4">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>
  <Template brand="Apple" part="A2" size="A4">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>
  <Template brand="Apple" part="A1" size="A4">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates.map(t => t.code)).toEqual(['apple-a1', 'apple-a2', 'zebra-b1']);
  });

  it('dedupes: same brand+part keeps first occurrence', () => {
    const xml1 = wrap(`
  <Template brand="Avery" part="DUP" size="A4">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>`);
    const xml2 = wrap(`
  <Template brand="Avery" part="DUP" size="A4">
    <Label-rectangle id="0" width="99mm" height="99mm">
      <Layout nx="9" ny="9" x0="9mm" y0="9mm" dx="99mm" dy="99mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates, stats } = convert(
      [
        { name: 'a.xml', xml: xml1 },
        { name: 'b.xml', xml: xml2 },
      ],
      PAPER_SIZES_XML,
    );
    expect(templates).toHaveLength(1);
    expect(templates[0]!.labelWidthMm).toBe(10); // first wins
    expect(stats.duplicates).toBe(1);
  });

  it('skips malformed templates without crashing the whole run', () => {
    const xml = wrap(`
  <Template brand="Good" part="G1" size="A4">
    <Label-rectangle id="0" width="10mm" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>
  <Template brand="Bad" part="B1" size="A4">
    <Label-rectangle id="0" height="10mm">
      <Layout nx="1" ny="1" x0="1mm" y0="1mm" dx="10mm" dy="10mm"/>
    </Label-rectangle>
  </Template>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates.map(t => t.brand)).toEqual(['Good']);
    expect(stats.skippedMalformed).toBe(1);
    expect(stats.warnings.some(w => w.includes('Bad/B1'))).toBe(true);
  });

  it('skips templates missing brand or part', () => {
    const xml = wrap(`<Template size="A4"/>`);
    const { templates, stats } = convert([{ name: 'test.xml', xml }], PAPER_SIZES_XML);
    expect(templates).toHaveLength(0);
    expect(stats.skippedMalformed).toBe(1);
  });

  it('reports parse failures as a warning and continues', () => {
    const { templates, stats } = convert(
      [{ name: 'broken.xml', xml: '<<< not valid xml' }],
      PAPER_SIZES_XML,
    );
    expect(templates).toHaveLength(0);
    expect(stats.warnings.some(w => w.startsWith('Failed to parse broken.xml'))).toBe(true);
  });
});
