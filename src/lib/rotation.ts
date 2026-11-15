// Snapped rotation for the rotate handle and the `[`/`]` shortcuts. Holding
// Shift turns in 15 degree steps and Alt/Option in quarter turns; Alt wins when
// both are down, so the coarser snap is never hidden behind the finer one.

export const FINE_ROTATE_STEP = 15;
export const QUARTER_ROTATE_STEP = 90;

/** The snap step the held modifiers ask for, or null for a free rotation. */
export function rotationSnapStep(modifiers: { altKey: boolean; shiftKey: boolean }): number | null {
  if (modifiers.altKey) return QUARTER_ROTATE_STEP;
  if (modifiers.shiftKey) return FINE_ROTATE_STEP;
  return null;
}

/** Normalises an angle in degrees to [0, 360). */
export function normalizeAngle(angle: number) {
  const turned = angle % 360;
  // `+ 0` folds -0 into 0, so a snapped angle compares equal to a literal 0.
  return (turned < 0 ? turned + 360 : turned) + 0;
}

/**
 * Rounds an absolute angle to the nearest multiple of `step`, so a snapped
 * item sits on 0, 15, 30... (or 0, 90, 180, 270) whatever angle it started at.
 */
export function snapAngle(angle: number, step: number) {
  return normalizeAngle(Math.round(angle / step) * step);
}

/**
 * The next multiple of `step` past `angle` in `direction` (1 clockwise, -1
 * anticlockwise). An angle already on the grid moves a whole step; one between
 * lines lands on the nearest line that way, so 20 steps clockwise to 90 and
 * anticlockwise to 0.
 */
export function stepAngle(angle: number, step: number, direction: 1 | -1) {
  const position = normalizeAngle(angle) / step;
  // A float a hair off the grid (89.99999 from a drag) counts as on it, or a
  // press would only nudge it the last fraction of a degree.
  const rounded = Math.round(position);
  const onGrid = Math.abs(position - rounded) < 1e-6;
  const base = onGrid ? rounded : direction === 1 ? Math.floor(position) : Math.ceil(position);
  return normalizeAngle((base + direction) * step);
}
