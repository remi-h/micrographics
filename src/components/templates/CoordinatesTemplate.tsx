import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function CoordinatesTemplate(): CanvasItem[] {
  return [
    symbolItem('006-arch', 'semicircle', 600, 540, 620),
    textItem('006-left', 'BUILDING\nBEYOND\n20', 382, 506, 31),
    textItem('006-design', 'DESIGN', 542, 472, 31),
    textItem('006-the', 'THE', 548, 538, 31),
    textItem('006-platform', 'PLATFORM\n26', 662, 538, 31),
    textItem('006-dept', 'DEPT.', 722, 472, 31),
  ];
}
