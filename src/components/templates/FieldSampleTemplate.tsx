import type { CanvasItem } from '../../types';
import { registrationMarks, ruleLine, symbolItem, textItem } from './helpers';

export function FieldSampleTemplate(): CanvasItem[] {
  return [
    ...registrationMarks('002'),
    textItem('002-eyebrow', 'FIELD SAMPLE', 140, 150, 15),
    textItem('002-headline', 'SPECIMEN\nINDEX', 140, 290, 50),
    ruleLine('002-rule-head', 140, 400, 560),
    textItem('002-cap-1', 'SITE', 140, 450, 14),
    textItem('002-val-1', "35.6895N 139.6917E", 140, 510, 24),
    textItem('002-cap-2', 'BATCH', 140, 590, 14),
    textItem('002-val-2', 'MG-014', 140, 650, 24),
    symbolItem('002-icon-fingerprint', 'fingerprint', 660, 520, 64),
    textItem('002-cap-fingerprint', 'ID MARK', 660, 600, 14),
    symbolItem('002-icon-target', 'target', 830, 520, 56),
    textItem('002-cap-target', 'CAL.', 830, 600, 14),
    ruleLine('002-rule-foot', 140, 700, 400),
    textItem('002-footer', 'HANDLE UNDER CONTROLLED LIGHT', 140, 745, 14),
    textItem('002-edition', 'N°02', 980, 705, 28),
  ];
}
