import type { CanvasItem } from '../../types';
import { ruleLine, symbolItem, textItem } from './helpers';

// Archetype: type-led poster. The headline is the artwork; everything else
// is fine print pushed to the edges.
export function ManifestoTemplate(): CanvasItem[] {
  return [
    textItem('004-kicker', 'A NOTE ON METHOD', 120, 130, 15),
    textItem('004-headline', 'FORM\nOVER\nNOISE', 112, 310, 118),
    ruleLine('004-rule', 120, 700, 720),
    textItem('004-side', 'EDITION 04 / MMXXVI', 1124, 660, 18, -90),
    textItem('004-footer', 'SET IN MONO, PRINTED ONE COLOR', 120, 748, 14),
    symbolItem('004-mark', 'asterisk', 1052, 744, 34),
  ];
}
