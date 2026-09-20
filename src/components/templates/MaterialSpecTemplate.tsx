import type { CanvasItem } from '../../types';
import { registrationMarks, ruleLine, symbolItem, textItem } from './helpers';

export function MaterialSpecTemplate(): CanvasItem[] {
  return [
    ...registrationMarks('003'),
    textItem('003-eyebrow', 'MATERIAL SPEC', 140, 150, 15),
    textItem('003-headline', 'WOVEN\nSYSTEM', 140, 290, 50),
    ruleLine('003-rule-head', 140, 400, 560),
    textItem('003-cap-1', 'COMPOSITION', 140, 450, 14),
    textItem('003-val-1', '100% SIGNAL', 140, 510, 24),
    textItem('003-cap-2', 'WEIGHT', 140, 590, 14),
    textItem('003-val-2', '240 GSM', 140, 650, 24),
    symbolItem('003-icon-swap', 'swapbox', 660, 520, 64),
    textItem('003-cap-swap', 'CARE', 660, 600, 14),
    symbolItem('003-icon-bars', 'barcode', 830, 520, 64),
    textItem('003-cap-bars', 'SKU', 830, 600, 14),
    ruleLine('003-rule-foot', 140, 700, 400),
    textItem('003-footer', 'CUT ON THE BIAS, ALWAYS', 140, 745, 14),
    textItem('003-edition', 'N°03', 980, 705, 28),
  ];
}
