import type { CanvasItem } from './types';

export function itemBounds(item: CanvasItem) {
  if (item.kind === 'symbol') {
    const half = item.size / 2;
    return { x: item.x - half - 8, y: item.y - half - 8, width: item.size + 16, height: item.size + 16 };
  }

  const lines = item.text.split('\n');
  const width = Math.max(90, Math.max(...lines.map((line) => line.length)) * item.size * 0.62) + 16;
  return { x: item.x - 8, y: item.y - item.size - 10, width, height: lines.length * item.size * 1.08 + 22 };
}

export function intersects(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}
