import type { CanvasSymbol, CanvasText } from '../../types';

export function textItem(id: string, text: string, x: number, y: number, size = 28, rotate = 0): CanvasText {
  return { id, kind: 'text', rotate, size, text, tone: 0.8, x, y };
}

export function symbolItem(id: string, mark: string, x: number, y: number, size = 34, rotate = 0): CanvasSymbol {
  return { id, kind: 'symbol', mark, rotate, size, tone: 0.88, x, y };
}
