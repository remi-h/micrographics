import type { CanvasItem } from '../../types';
import { centredRuleLine, centredText, symbolItem } from './helpers';

const CARE_MARKS = ['wash', 'bleach', 'tumble-dry', 'iron', 'dry-clean'];

// Archetype: product tag. A narrow centered column between two rules, the
// shape of a garment care label — regulatory symbols doing the talking.
// The column's axis. Every line below is centred on it through the text
// model rather than placed by a hand-computed start, so it stays centred
// whatever the line says and whatever the font measures.
const AXIS = 600;

export function CareLabelTemplate(): CanvasItem[] {
  return [
    centredRuleLine('006-rule-top', AXIS, 140, 340),
    centredText('006-brand', 'MICRO', AXIS, 234, 58),
    centredText('006-dept', 'FORM DEPT.', AXIS, 268, 14),
    ...CARE_MARKS.map((mark, index) => symbolItem(`006-care-${mark}`, mark, AXIS - 200 + index * 100, 384, 50)),
    centredText('006-care-text', 'MACHINE WASH COLD / DO NOT BLEACH / WARM IRON', AXIS, 456, 13),
    centredText('006-composition', '60% SIGNAL  40% NOISE', AXIS, 516, 16),
    centredText('006-size', 'SIZE M', AXIS, 552, 16),
    symbolItem('006-bars', 'barcode', AXIS, 626, 120),
    centredText('006-serial', '0448 5512 09', AXIS, 696, 13),
    centredRuleLine('006-rule-bottom', AXIS, 736, 340),
  ];
}
