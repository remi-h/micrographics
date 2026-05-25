import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function OpticalTemplate(): CanvasItem[] {
  return [
    textItem('007-title', 'OPTICAL / 20', 486, 330, 30),
    textItem('007-code', '43R-004585', 596, 370, 13),
    textItem('007-asset', 'ASSET_ID 2026_MG_990X', 596, 412, 20),
    textItem('007-xiv', 'XIV', 484, 466, 36),
    textItem('007-index', 'LENS FIELD\nREV 04', 760, 330, 12),
    symbolItem('007-pill', 'badge', 672, 456, 98),
    textItem('007-pill-text', '43R-004585', 628, 462, 12),
    symbolItem('007-warning', 'warning', 818, 342, 40),
    symbolItem('007-waves', 'waves', 828, 462, 46),
    symbolItem('007-orbit-a', 'orbit', 420, 407, 32),
    symbolItem('007-orbit-b', 'orbit', 870, 406, 32),
    symbolItem('007-line-a', 'line', 604, 486, 88),
    symbolItem('007-line-b', 'line', 758, 486, 88),
    symbolItem('007-tally', 'tally', 736, 372, 28),
    symbolItem('007-ce', 'ce', 878, 504, 20),
  ];
}
