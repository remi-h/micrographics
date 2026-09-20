import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function SystemArchTemplate(): CanvasItem[] {
  return [
    symbolItem('002-arch', 'semicircle', 600, 510, 510),
    textItem('002-left', 'DIGITAL\nBEYOND\n01', 402, 506, 25),
    textItem('002-mid-top', 'DESIGN', 548, 480, 26),
    textItem('002-mid', 'THE', 548, 536, 26),
    textItem('002-right', 'SYSTEM\n24', 668, 536, 26),
    // Was 'globe' at x770/'warning' at x808 (both size ~30) — their glyphs
    // touched. Shrunk slightly and spaced further apart to clear each other.
    symbolItem('002-globe', 'globe', 768, 480, 28),
    symbolItem('002-warning', 'warning', 822, 480, 26),
  ];
}
