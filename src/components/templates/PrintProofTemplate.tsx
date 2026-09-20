import type { CanvasItem } from '../../types';
import { registrationMarks, ruleLine, symbolItem, textItem } from './helpers';

export function PrintProofTemplate(): CanvasItem[] {
  return [
    ...registrationMarks('005'),
    textItem('005-eyebrow', 'PRINT PROOF', 140, 150, 15),
    textItem('005-headline', 'COLOR\nRUN', 140, 290, 50),
    ruleLine('005-rule-head', 140, 400, 560),
    textItem('005-cap-1', 'PLATE', 140, 450, 14),
    textItem('005-val-1', 'CMYK 02', 140, 510, 24),
    textItem('005-cap-2', 'PASS', 140, 590, 14),
    textItem('005-val-2', '03 / 04', 140, 650, 24),
    symbolItem('005-icon-layers', 'layers', 660, 520, 64),
    textItem('005-cap-layers', 'SEPARATIONS', 660, 600, 14),
    symbolItem('005-icon-target', 'target', 830, 520, 56),
    textItem('005-cap-target', 'REG.', 830, 600, 14),
    ruleLine('005-rule-foot', 140, 700, 400),
    textItem('005-footer', 'HOLD FOR APPROVAL BEFORE RUN', 140, 745, 14),
    textItem('005-edition', 'N°05', 980, 705, 28),
  ];
}
