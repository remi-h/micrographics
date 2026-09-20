import type { CanvasItem } from '../../types';
import { ruleLine, symbolItem, textItem } from './helpers';

const STEPS: Array<[string, string, string]> = [
  ['bracket', '01', 'MOUNT BRACKET'],
  ['swapbox', '02', 'DRIVE MODULE'],
  ['nodes', '03', 'CONTACT ARRAY'],
  ['triad', '04', 'BASE PLATE'],
];

const PARTS = ['BR-01    X2', 'DM-02    X1', 'CA-03    X4', 'BP-04    X1'];

// Archetype: assembly drawing. Parts stacked down a centre line with dashed
// connectors, each one numbered and called out to the right.
export function ExplodedTemplate(): CanvasItem[] {
  return [
    textItem('008-title', 'EXPLODED VIEW', 120, 110, 26),
    textItem('008-sub', 'UNIT 12 / FOUR PARTS', 120, 140, 14),
    textItem('008-section', 'SECTION A-A', 150, 560, 20, -90),
    ...STEPS.flatMap(([mark, number, label], index) => {
      const y = 232 + index * 130;
      const items: CanvasItem[] = [
        symbolItem(`008-part-${number}`, mark, 420, y, 64),
        ruleLine(`008-lead-${number}`, 472, y + 2, 76, 11),
        textItem(`008-call-${number}`, `${number}  ${label}`, 572, y + 7, 17),
      ];
      if (index < STEPS.length - 1) {
        // Stacked single dashes read as a vertical dashed connector. A rotated
        // one-line string collapses into near-invisible specks at this size.
        items.push(textItem(`008-link-${number}`, '-\n-\n-', 415, y + 60, 15));
      }
      return items;
    }),
    textItem('008-parts-head', 'PARTS', 900, 236, 14),
    ruleLine('008-parts-rule', 900, 258, 170, 11),
    ...PARTS.map((row, index) => textItem(`008-parts-${index}`, row, 900, 298 + index * 38, 14)),
    ruleLine('008-rule', 120, 700, 960),
    textItem('008-footer', 'TIGHTEN IN A CROSS PATTERN TO 12 N.M', 120, 742, 14),
  ];
}
