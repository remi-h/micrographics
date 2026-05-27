import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function FormFunctionTemplate(): CanvasItem[] {
  return [
    textItem('013-asset', 'ASSET_ID 2026_MG_013', 420, 328, 27),
    textItem('013-process', '/PROCESS/V02\n©2026', 420, 382, 27),
    symbolItem('013-globe', 'globe', 334, 522, 68),
    symbolItem('013-swap', 'swapbox', 520, 522, 64),
    symbolItem('013-fingerprint', 'fingerprint', 424, 522, 54),
    textItem('013-labs', 'MICRO DESIGN LABS\n40.7128° N     74.0060° W', 600, 516, 27),
    textItem('013-caption', 'BUILDING BEYOND THE PLATFORM\nWITH EDITABLE MICROGRAPHICS', 420, 640, 27),
    textItem('013-xiv', 'XIV', 420, 734, 32),
  ];
}
