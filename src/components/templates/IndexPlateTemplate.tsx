import type { CanvasItem } from '../../types';
import { markGrid, ruleLine, textItem } from './helpers';

const PLATE_MARKS = [
  'orbit', 'sun', 'chevrons', 'diamond', 'triple', 'eye', 'flower', 'asterisk',
  'umbrella', 'layers', 'info', 'quarter', 'target', 'warning', 'bracket', 'waves',
  'arch', 'fingerprint', 'expand', 'triad', 'swapbox', 'nodes', 'arrows', 'globe',
  'turn', 'temple', 'flag', 'leaf', 'swirl', 'camera', 'grid', 'tally',
  'spark', 'mc', 'ce', 'iron', 'wash', 'bleach', 'hang-dry', 'dry-clean',
];

const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROWS = ['01', '02', '03', '04', '05'];

// Archetype: maximal. A full plate of specimens on a strict pitch, with
// column letters and row numbers, the way a type catalogue or a parts index
// lays out its contents.
export function IndexPlateTemplate(): CanvasItem[] {
  return [
    textItem('002-title', 'INDEX PLATE', 120, 100, 30),
    textItem('002-sub', '40 MARKS / REV 02 / SHEET 1 OF 1', 120, 132, 14),
    ruleLine('002-rule-top', 120, 168, 960),
    ...COLUMNS.map((letter, index) => textItem(`002-col-${letter}`, letter, 214 + index * 118, 208, 13)),
    ...ROWS.map((row, index) => textItem(`002-row-${row}`, row, 120, 268 + index * 104, 13)),
    ...markGrid('002', PLATE_MARKS, { x: 220, y: 262, columns: 8, pitchX: 118, pitchY: 104, size: 48 }),
    ruleLine('002-rule-bottom', 120, 730, 960),
    textItem('002-footer', 'ALL MARKS DRAWN TO A 36 UNIT GRID', 120, 768, 13),
  ];
}
