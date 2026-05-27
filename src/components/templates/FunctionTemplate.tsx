import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function FunctionTemplate(): CanvasItem[] {
  return [
    symbolItem('008-arch', 'semicircle', 600, 510, 510),
    textItem('008-left', 'DIGITAL\nBEYOND\n01', 402, 506, 25),
    textItem('008-mid-top', 'DESIGN', 548, 480, 26),
    textItem('008-mid', 'THE', 548, 536, 26),
    textItem('008-right', 'SYSTEM\n24', 668, 536, 26),
    symbolItem('008-globe', 'globe', 770, 480, 32),
    symbolItem('008-warning', 'warning', 808, 480, 28),
  ];
}
