import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function CalibrationGridTemplate(): CanvasItem[] {
  return [
    textItem('008-asset', 'GRID_ID 2026_MG_015', 420, 322, 30),
    textItem('008-process', '/CALIBRATION/V02', 420, 378, 30),
    textItem('008-year', '©2026', 420, 430, 30),
    symbolItem('008-triad', 'triad', 328, 530, 74),
    symbolItem('008-chevrons', 'chevrons', 436, 530, 62),
    symbolItem('008-arrows', 'arrows', 548, 530, 70),
    textItem('008-labs', 'SIGNAL CALIBRATION LAB\n51.5072° N     0.1276° W', 612, 524, 31),
    textItem('008-caption', 'EVERY GRID LINE EARNS\nITS PLACE ON THE PAGE', 420, 642, 30),
    textItem('008-numeral', 'X', 420, 742, 34),
  ];
}
