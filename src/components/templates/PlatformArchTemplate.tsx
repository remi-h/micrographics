import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function PlatformArchTemplate(): CanvasItem[] {
  return [
    symbolItem('001-arch', 'semicircle', 600, 540, 620),
    textItem('001-left', 'BUILDING\nBEYOND\n20', 382, 506, 31),
    textItem('001-design', 'DESIGN', 542, 472, 31),
    textItem('001-the', 'THE', 548, 538, 31),
    textItem('001-platform', 'PLATFORM\n26', 662, 538, 31),
    textItem('001-dept', 'DEPT.', 722, 472, 31),
  ];
}
