import type { CanvasItem } from '../../types';
import { registrationMarks, ruleLine, symbolItem, textItem } from './helpers';

export function AssemblyGuideTemplate(): CanvasItem[] {
  return [
    ...registrationMarks('007'),
    textItem('007-eyebrow', 'ASSEMBLY GUIDE', 140, 150, 15),
    textItem('007-headline', 'MODULE\nUNIT', 140, 290, 50),
    ruleLine('007-rule-head', 140, 400, 560),
    textItem('007-cap-1', 'TORQUE', 140, 450, 14),
    textItem('007-val-1', '12 N.M', 140, 510, 24),
    textItem('007-cap-2', 'REV.', 140, 590, 14),
    textItem('007-val-2', 'B', 140, 650, 24),
    symbolItem('007-icon-bracket', 'bracket', 660, 520, 64),
    textItem('007-cap-bracket', 'MOUNT', 660, 600, 14),
    symbolItem('007-icon-swap', 'swapbox', 830, 520, 64),
    textItem('007-cap-swap', 'ROTATE', 830, 600, 14),
    ruleLine('007-rule-foot', 140, 700, 400),
    textItem('007-footer', 'TIGHTEN IN A CROSS PATTERN', 140, 745, 14),
    textItem('007-edition', 'N°07', 980, 705, 28),
  ];
}
