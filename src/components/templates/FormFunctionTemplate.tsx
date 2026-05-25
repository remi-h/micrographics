import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function FormFunctionTemplate(): CanvasItem[] {
  return [
    symbolItem('013-nodes', 'nodes', 376, 390, 76),
    symbolItem('013-orbit', 'orbit', 376, 390, 92),
    textItem('013-title', 'FORM  &\nFUNCTION', 532, 392, 28),
    textItem('013-meta-a', '#FFF7E7_LAYOUT\n03 KGCL_ELEMENTS', 386, 480, 12),
    textItem('013-meta-b', 'TYPEFACE\n3.4 LAYOUT', 700, 480, 12),
    symbolItem('013-eye', 'eye', 456, 540, 20),
    symbolItem('013-triple', 'triple', 804, 540, 20),
    symbolItem('013-rule', 'line', 626, 534, 160),
    symbolItem('013-warning', 'warning', 500, 336, 24),
    symbolItem('013-tally', 'tally', 828, 392, 24),
    symbolItem('013-badge', 'badge', 626, 448, 118),
    textItem('013-badge-text', 'FUNCTION INDEX', 570, 454, 11),
    symbolItem('013-flag', 'flag', 864, 490, 24),
  ];
}
