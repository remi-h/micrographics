import type { CanvasItem } from '../../types';
import { registrationMarks, ruleLine, symbolItem, textItem } from './helpers';

export function TransitLogTemplate(): CanvasItem[] {
  return [
    ...registrationMarks('001'),
    textItem('001-eyebrow', 'TRANSIT LOG', 140, 150, 15),
    textItem('001-headline', 'SIGNAL\nARCHIVE', 140, 290, 50),
    ruleLine('001-rule-head', 140, 400, 560),
    textItem('001-cap-1', 'ORIGIN', 140, 450, 14),
    textItem('001-val-1', "48.8566N 2.3522E", 140, 510, 24),
    textItem('001-cap-2', 'REV.', 140, 590, 14),
    textItem('001-val-2', '04 / 2026', 140, 650, 24),
    symbolItem('001-icon-orbit', 'orbit', 660, 520, 64),
    textItem('001-cap-orbit', 'RELAY', 660, 600, 14),
    symbolItem('001-icon-bars', 'barcode', 830, 520, 64),
    textItem('001-cap-bars', 'MANIFEST', 830, 600, 14),
    ruleLine('001-rule-foot', 140, 700, 400),
    textItem('001-footer', 'PRINTED ON SIGNAL STOCK', 140, 745, 14),
    textItem('001-edition', 'N°01', 980, 705, 28),
  ];
}
