import type { CanvasItem } from '../../types';
import { ruleLine, symbolItem, textItem } from './helpers';

const CARE_MARKS = ['wash', 'bleach', 'tumble-dry', 'iron', 'dry-clean'];

// Archetype: product tag. A narrow centered column between two rules, the
// shape of a garment care label — regulatory symbols doing the talking.
export function CareLabelTemplate(): CanvasItem[] {
  return [
    ruleLine('006-rule-top', 430, 140, 340),
    textItem('006-brand', 'MICRO', 510, 234, 58),
    textItem('006-dept', 'FORM DEPT.', 557, 268, 14),
    ...CARE_MARKS.map((mark, index) => symbolItem(`006-care-${mark}`, mark, 400 + index * 100, 384, 50)),
    textItem('006-care-text', 'MACHINE WASH COLD / DO NOT BLEACH / WARM IRON', 423, 456, 13),
    textItem('006-composition', '60% SIGNAL  40% NOISE', 491, 516, 16),
    textItem('006-size', 'SIZE M', 570, 552, 16),
    symbolItem('006-bars', 'barcode', 600, 626, 120),
    textItem('006-serial', '0448 5512 09', 552, 696, 13),
    ruleLine('006-rule-bottom', 430, 736, 340),
  ];
}
