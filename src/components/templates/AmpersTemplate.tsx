import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function AmpersTemplate(): CanvasItem[] {
  return [
    symbolItem('011-info', 'info', 290, 360, 34),
    textItem('011-title', 'AMPERS', 328, 410, 64),
    textItem('011-amp', '&', 712, 408, 84),
    symbolItem('011-orbit', 'orbit', 746, 360, 48),
    symbolItem('011-badge', 'badge', 376, 498, 84),
    textItem('011-time-text', '11:6:18', 330, 504, 16),
    textItem('011-code', 'ASSET_ID 2026_MG_990X\n_PROCESS/SV01\n©2026', 570, 482, 13),
    symbolItem('011-grid', 'grid', 746, 508, 26),
    symbolItem('011-target', 'target', 798, 508, 26),
    symbolItem('011-line-a', 'line', 512, 354, 100),
    symbolItem('011-line-b', 'line', 868, 456, 84),
    symbolItem('011-nodes', 'nodes', 270, 486, 32),
    symbolItem('011-quarter', 'quarter', 842, 358, 28),
  ];
}
