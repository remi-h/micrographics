import type { CanvasItem } from '../../types';
import { ruleLine, symbolItem, textItem } from './helpers';

// Archetype: minimal. One enormous word, a hairline, and almost nothing else.
// The point is negative space — proof the tool doesn't have to be loud.
export function QuietTemplate(): CanvasItem[] {
  return [
    textItem('001-tag', '001 / MINIMAL', 120, 120, 14),
    textItem('001-word', 'QUIET', 110, 470, 172),
    ruleLine('001-rule', 120, 540, 420),
    textItem('001-caption', 'NO SIGNAL DETECTED BETWEEN 04:00 AND 05:00', 120, 590, 15),
    symbolItem('001-mark', 'quarter', 1060, 660, 44),
  ];
}
