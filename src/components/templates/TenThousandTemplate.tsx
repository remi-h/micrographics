import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function TenThousandTemplate(): CanvasItem[] {
  return [
    textItem('012-asset', 'ASSET_ID 2026_MG_990X', 420, 322, 30),
    textItem('012-process', '/PROCESS/V01', 420, 378, 30),
    textItem('012-year', '©2026', 420, 430, 30),
    symbolItem('012-globe', 'globe', 328, 530, 74),
    symbolItem('012-kmark', 'bracket', 436, 530, 62),
    symbolItem('012-swap', 'swapbox', 548, 530, 70),
    textItem('012-labs', 'DIGITAL DESIGN LABS\n45.5248° N    122.6841° W', 612, 524, 31),
    textItem('012-caption', 'INTENTION OVER TIME LEADS\nTO MASTERY OF CRAFT', 420, 642, 30),
    textItem('012-xiv', 'XIV', 420, 742, 34),
  ];
}
