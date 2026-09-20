import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function GlobalFormTemplate(): CanvasItem[] {
  return [
    textItem('004-coords', '51° 30\' 26" N, 0° 07\' 39" W', 458, 344, 18),
    textItem('004-title', 'GLBL\nFORM\nDEPT', 458, 404, 38),
    symbolItem('004-worldmap', 'world', 650, 424, 190),
    symbolItem('004-bars', 'barcode', 526, 535, 150),
    // 'code' and 'globe' previously overlapped; moved the globe further right
    // and shrunk it to clear the code text's glyphs.
    textItem('004-code', 'MMXXVI', 690, 548, 25),
    symbolItem('004-globe', 'globe', 800, 548, 26),
    symbolItem('004-ce', 'ce', 842, 548, 28),
    textItem('004-meta', '2026  /  16:9  /  V02', 458, 594, 20),
    textItem('004-footer', 'PROPERTY OF MICROGRAPHICS', 594, 648, 16),
  ];
}
