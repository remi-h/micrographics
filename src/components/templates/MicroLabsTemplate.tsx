import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function MicroLabsTemplate(): CanvasItem[] {
  return [
    textItem('006-asset', 'ASSET_ID 2026_MG_013', 420, 328, 27),
    textItem('006-process', '/PROCESS/V02\n©2026', 420, 382, 27),
    symbolItem('006-globe', 'globe', 334, 522, 68),
    symbolItem('006-swap', 'swapbox', 520, 522, 64),
    symbolItem('006-fingerprint', 'fingerprint', 424, 522, 54),
    textItem('006-labs', 'MICRO DESIGN LABS\n40.7128° N     74.0060° W', 600, 516, 27),
    textItem('006-caption', 'BUILDING BEYOND THE PLATFORM\nWITH EDITABLE MICROGRAPHICS', 420, 640, 27),
    textItem('006-xiv', 'XIV', 420, 734, 32),
  ];
}
