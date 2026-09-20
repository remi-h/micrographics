import type { CanvasItem } from '../../types';
import { registrationMarks, ruleLine, symbolItem, textItem } from './helpers';

export function CertificationTemplate(): CanvasItem[] {
  return [
    ...registrationMarks('008'),
    textItem('008-eyebrow', 'CERTIFICATION', 140, 150, 15),
    textItem('008-headline', 'COMPLIANCE\nMARK', 140, 290, 50),
    ruleLine('008-rule-head', 140, 400, 560),
    textItem('008-cap-1', 'STANDARD', 140, 450, 14),
    textItem('008-val-1', 'EN 71-3', 140, 510, 24),
    textItem('008-cap-2', 'BATCH', 140, 590, 14),
    textItem('008-val-2', '04585', 140, 650, 24),
    symbolItem('008-icon-ce', 'ce', 680, 520, 48),
    textItem('008-cap-ce', 'CE MARK', 680, 600, 14),
    symbolItem('008-icon-badge', 'badge', 850, 520, 110),
    textItem('008-val-badge', '045-8X-5C', 808, 524, 12),
    textItem('008-cap-badge', 'SERIAL', 850, 590, 14),
    ruleLine('008-rule-foot', 140, 700, 400),
    textItem('008-footer', 'CONFORMS TO ANNEX III', 140, 745, 14),
    textItem('008-edition', 'N°08', 980, 705, 28),
  ];
}
