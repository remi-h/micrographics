import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function AmpersTemplate(): CanvasItem[] {
  return [
    textItem('011-coords', '51° 30\' 26" N, 0° 07\' 39" W', 458, 344, 18),
    textItem('011-title', 'GLBL\nFORM\nDEPT', 458, 404, 38),
    symbolItem('011-worldmap', 'world', 650, 424, 190),
    symbolItem('011-bars', 'barcode', 526, 535, 150),
    textItem('011-code', 'MMXXVI', 690, 548, 25),
    symbolItem('011-globe', 'globe', 760, 548, 30),
    symbolItem('011-ce', 'ce', 810, 548, 30),
    textItem('011-meta', '2026  /  16:9  /  V02', 458, 594, 20),
    textItem('011-footer', 'PROPERTY OF MICROGRAPHICS', 594, 648, 16),
  ];
}
