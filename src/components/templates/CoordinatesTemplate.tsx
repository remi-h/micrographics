import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function CoordinatesTemplate(): CanvasItem[] {
  return [
    symbolItem('006-frame', 'badge', 560, 430, 260),
    symbolItem('006-flower', 'flower', 318, 430, 64),
    symbolItem('006-orbit', 'orbit', 318, 430, 78),
    symbolItem('006-left-pin', 'target', 230, 430, 18),
    symbolItem('006-right-pin', 'target', 892, 430, 18),
    textItem('006-coordinates', "51°50'18\"N     12°13'38\"E", 436, 388, 18),
    textItem('006-title', 'STAATLICHES BAUHAUS', 436, 434, 20),
    textItem('006-founded', 'FOUNDED 1919', 436, 480, 16),
    symbolItem('006-rule-a', 'line', 505, 506, 120),
    symbolItem('006-rule-b', 'line', 710, 506, 120),
    symbolItem('006-ce', 'ce', 646, 508, 20),
    symbolItem('006-mark', 'diamond', 805, 478, 22),
  ];
}
