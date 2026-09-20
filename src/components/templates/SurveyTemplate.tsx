import type { CanvasItem } from '../../types';
import { comb, ruleLine, symbolItem, textItem } from './helpers';

const STATIONS: Array<[string, string, string, number]> = [
  ['01', 'LONDON', '51.5072N 0.1276W', 268],
  ['02', 'TOKYO', '35.6895N 139.6917E', 372],
  ['03', 'NAIROBI', '1.2921S 36.8219E', 476],
];

// Archetype: annotated chart. An asymmetric split — a station list keyed with
// crosshairs down the left, the map carrying the right half of the page.
// Labels stay off the map itself, which is a solid fill and would swallow them.
export function SurveyTemplate(): CanvasItem[] {
  return [
    textItem('007-title', 'SURVEY 04', 120, 110, 28),
    textItem('007-sub', 'MERCATOR / DATUM WGS-84', 120, 142, 14),
    ruleLine('007-rule-top', 120, 176, 960),
    ...STATIONS.flatMap(([number, name, coords, y]) => [
      symbolItem(`007-pin-${number}`, 'target', 142, y - 6, 26),
      textItem(`007-name-${number}`, `${number}  ${name}`, 180, y, 17),
      textItem(`007-coords-${number}`, coords, 180, y + 28, 13),
    ]),
    symbolItem('007-map', 'world', 760, 400, 460),
    comb('007-scale', 560, 622, 20, 16),
    textItem('007-scale-label', '0 - 5000 KM', 560, 660, 13),
    ruleLine('007-rule-bottom', 120, 700, 960),
    textItem('007-footer', 'PLOTTED FROM SHEET 04 OF 08', 120, 742, 14),
  ];
}
