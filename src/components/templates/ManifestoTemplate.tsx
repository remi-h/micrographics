import type { CanvasItem } from '../../types';
import { animatedGroup, ruleLine, symbolItem, textItem } from './helpers';

// Archetype: type-led poster. The headline is the artwork; everything else
// is fine print pushed to the edges.
export function ManifestoTemplate(): CanvasItem[] {
  return [
    textItem('004-kicker', 'A NOTE ON METHOD', 120, 130, 15),
    // The headline lands, then the rule under it.
    ...animatedGroup('004-group-headline', { kind: 'slide-up', duration: 0.7, delay: 0 }, 0.4, [
      textItem('004-headline', 'FORM\nOVER\nNOISE', 112, 310, 118),
      ruleLine('004-rule', 120, 700, 720),
    ]),
    textItem('004-side', 'EDITION 04 / MMXXVI', 1124, 660, 18, -90),
    textItem('004-footer', 'SET IN MONO, PRINTED ONE COLOR', 120, 748, 14),
    symbolItem('004-mark', 'asterisk', 1052, 744, 34),
  ];
}
