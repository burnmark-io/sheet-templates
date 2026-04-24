export interface SheetLayout {
  columns: number;
  rows: number;
  originXMm: number;
  originYMm: number;
  pitchXMm: number;
  pitchYMm: number;
}

export interface SheetTemplate {
  code: string;
  name: string;
  brand: string;
  part: string;
  paperSize: string;
  paperWidthMm: number;
  paperHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  labelShape: 'rectangle' | 'round' | 'ellipse';
  cornerRadiusMm?: number;
  layouts: SheetLayout[];
  marginMm?: number;
  categories?: string[];
}
