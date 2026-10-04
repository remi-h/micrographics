import type { CanvasItem } from '../../types';
import { animatedGroup, comb, ruleLine, textItem } from './helpers';

const BANDS: Array<[string, number, string]> = [
  ['SUB', 31, '-04 DB'],
  ['LOW', 24, '-09 DB'],
  ['MID', 34, '-02 DB'],
  ['HIGH', 17, '-14 DB'],
  ['AIR', 9, '-21 DB'],
];

const bandY = (index: number) => 310 + index * 80;

// Archetype: data readout. A measured bar chart built from tick strokes,
// with a scale along the bottom — a level meter printed as a document.
export function LevelsTemplate(): CanvasItem[] {
  return [
    textItem('005-title', 'SIGNAL LEVELS', 120, 150, 30),
    textItem('005-sub', 'MEASURED AT THE DESK / RUN 07', 120, 182, 14),
    ruleLine('005-rule-top', 120, 218, 960),
    ...BANDS.map(([label], index) => textItem(`005-label-${label}`, label, 120, bandY(index), 18)),
    // The bars run out from the left one band at a time, and each reading
    // follows once the bars are up.
    ...animatedGroup(
      '005-group-bars',
      { kind: 'slide-left', duration: 0.5, delay: 0 },
      0.12,
      BANDS.map(([label, units], index) => comb(`005-bar-${label}`, 300, bandY(index), units, 26)),
    ),
    ...animatedGroup(
      '005-group-values',
      { kind: 'fade', duration: 0.4, delay: 0.7 },
      0.12,
      BANDS.map(([label, , value], index) => textItem(`005-value-${label}`, value, 980, bandY(index), 18)),
    ),
    comb('005-axis', 300, 700, 62, 14),
    textItem('005-axis-min', '0', 300, 734, 13),
    textItem('005-axis-max', '100', 812, 734, 13),
    textItem('005-footer', 'NO LIMITER ENGAGED', 980, 734, 13),
  ];
}
