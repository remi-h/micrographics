import type { CanvasItem } from '../../types';
import { symbolItem, textItem } from './helpers';

export function FunctionTemplate(): CanvasItem[] {
  return [
    textItem('008-form', 'FORM', 724, 338, 36, 180),
    textItem('008-function', 'FUNCT-\nION', 410, 430, 38),
    textItem('008-meta', 'SYSTEM_008\n©2026', 408, 535, 13),
    symbolItem('008-info', 'info', 742, 424, 32),
    symbolItem('008-fingerprint', 'fingerprint', 810, 424, 30),
    symbolItem('008-eye', 'eye', 878, 424, 30),
    symbolItem('008-corner-a', 'bracket', 394, 326, 56),
    symbolItem('008-corner-b', 'bracket', 828, 476, 56, 180),
    symbolItem('008-rule-a', 'line', 586, 380, 118),
    symbolItem('008-rule-b', 'line', 586, 498, 118),
    symbolItem('008-diamond', 'diamond', 640, 438, 24),
    symbolItem('008-spark', 'spark', 915, 332, 28),
    symbolItem('008-expand', 'expand', 350, 502, 26),
  ];
}
