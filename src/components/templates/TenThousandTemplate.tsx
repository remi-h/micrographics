import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function TenThousandTemplate(): CanvasItem[] {
  return [
    textItem('012-title', 'Ten Thousand Hours', 348, 396, 44),
    textItem('012-caption', 'INTENTION OVER TIME LEADS\nTO THE HIGHEST FORM OF CRAFT', 420, 456, 15),
    symbolItem('012-top-a', 'line', 430, 340, 112),
    textItem('012-top-b', 'MMXXIV        #FFAAEE_SPEC', 520, 344, 14),
    symbolItem('012-rule-a', 'line', 514, 486, 180),
    symbolItem('012-rule-b', 'line', 700, 486, 180),
    symbolItem('012-info', 'info', 492, 532, 22),
    symbolItem('012-ce', 'ce', 562, 532, 25),
    symbolItem('012-arrows', 'arrows', 632, 532, 24),
    symbolItem('012-sun', 'sun', 704, 532, 25),
    symbolItem('012-year', 'badge', 690, 574, 62),
    textItem('012-year-text', '©2026', 668, 579, 10),
    symbolItem('012-orbit', 'orbit', 815, 394, 42),
    symbolItem('012-diamond', 'diamond', 324, 526, 20),
    symbolItem('012-spark', 'spark', 862, 526, 24),
  ];
}
