import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function OpticalTemplate(): CanvasItem[] {
  return [
    textItem('007-coords', '40° 44\' 40" N, 73° 58\' 42" W', 455, 330, 20),
    textItem('007-title', 'GLBL\nDSGN\nDEPT', 455, 396, 42),
    symbolItem('007-world', 'world', 650, 420, 220),
    symbolItem('007-bars', 'barcode', 522, 532, 170),
    textItem('007-xiv', 'XIV', 705, 548, 28),
    symbolItem('007-globe', 'globe', 766, 548, 34),
    symbolItem('007-ce', 'ce', 812, 548, 34),
    textItem('007-dashes', '- - -', 872, 548, 18),
    textItem('007-meta', '1920  /  9:16  /  1 X 1', 455, 596, 22),
    symbolItem('007-pill', 'badge', 812, 594, 120),
    textItem('007-pill-text', '43R-004585', 765, 601, 16),
    textItem('007-rule', '- - - - - - - - - - - - - - - - - -', 518, 627, 13),
    textItem('007-footer', '©  2026     PROPERTY OF DSGN DEPT', 558, 656, 17),
  ];
}
