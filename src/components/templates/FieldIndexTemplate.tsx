import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function FieldIndexTemplate(): CanvasItem[] {
  return [
    textItem('007-asset', 'FIELD_ID 2026_MG_014', 420, 328, 27),
    textItem('007-process', '/BATCH/V03\n©2026', 420, 382, 27),
    symbolItem('007-orbit', 'orbit', 334, 522, 68),
    symbolItem('007-tally', 'tally', 424, 522, 54),
    symbolItem('007-nodes', 'nodes', 520, 522, 64),
    textItem('007-labs', 'FIELD RESEARCH UNIT\n35.6895° N    139.6917° E', 600, 516, 27),
    textItem('007-caption', 'PRECISION MEASURED IN SIGNAL\nNOT IN NOISE', 420, 640, 27),
    textItem('007-numeral', 'IX', 420, 734, 32),
  ];
}
