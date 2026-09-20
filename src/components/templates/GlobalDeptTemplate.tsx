import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function GlobalDeptTemplate(): CanvasItem[] {
  return [
    textItem('003-coords', "40° 44' 40\" N, 73° 58' 42\" W", 455, 330, 20),
    textItem('003-title', 'GLBL\nDSGN\nDEPT', 455, 396, 42),
    symbolItem('003-world', 'world', 650, 420, 220),
    symbolItem('003-bars', 'barcode', 522, 532, 170),
    // The XIV/globe/CE compliance-mark row previously sat at y548, close enough
    // to touch each other's glyphs and to overlap the badge below it. Raised
    // and re-spaced so each glyph clears its neighbors.
    textItem('003-xiv', 'XIV', 700, 538, 26),
    symbolItem('003-globe', 'globe', 778, 538, 28),
    symbolItem('003-ce', 'ce', 828, 538, 30),
    textItem('003-dashes', '- - -', 872, 538, 16),
    textItem('003-meta', '1920  /  9:16  /  1 X 1', 455, 596, 22),
    symbolItem('003-pill', 'badge', 812, 594, 120),
    // Serial text previously overflowed past the pill's right edge; shrunk
    // and nudged left so it fits inside the capsule outline.
    textItem('003-pill-text', '43R-004585', 758, 601, 14),
    textItem('003-rule', '- - - - - - - - - - - - - - - - - -', 518, 627, 13),
    textItem('003-footer', '©  2026     PROPERTY OF DSGN DEPT', 558, 656, 17),
  ];
}
