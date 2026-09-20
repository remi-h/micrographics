import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function DigitalLabsTemplate(): CanvasItem[] {
  return [
    textItem('005-asset', 'ASSET_ID 2026_MG_990X', 420, 322, 30),
    textItem('005-process', '/PROCESS/V01', 420, 378, 30),
    textItem('005-year', '©2026', 420, 430, 30),
    symbolItem('005-globe', 'globe', 328, 530, 74),
    symbolItem('005-kmark', 'bracket', 436, 530, 62),
    symbolItem('005-swap', 'swapbox', 548, 530, 70),
    textItem('005-labs', 'DIGITAL DESIGN LABS\n45.5248° N    122.6841° W', 612, 524, 31),
    textItem('005-caption', 'INTENTION OVER TIME LEADS\nTO MASTERY OF CRAFT', 420, 642, 30),
    textItem('005-xiv', 'XIV', 420, 742, 34),
  ];
}
