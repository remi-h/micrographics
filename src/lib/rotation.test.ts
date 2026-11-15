import { normalizeAngle, rotationSnapStep, snapAngle, stepAngle } from './rotation';

describe('rotationSnapStep', () => {
  it('rotates freely with no modifier', () => {
    expect(rotationSnapStep({ altKey: false, shiftKey: false })).toBeNull();
  });

  it('snaps to 15 degrees with Shift and 90 with Alt', () => {
    expect(rotationSnapStep({ altKey: false, shiftKey: true })).toBe(15);
    expect(rotationSnapStep({ altKey: true, shiftKey: false })).toBe(90);
  });

  it('lets Alt win when both are held', () => {
    expect(rotationSnapStep({ altKey: true, shiftKey: true })).toBe(90);
  });
});

describe('normalizeAngle', () => {
  it('folds any angle into [0, 360)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(-720)).toBe(0);
    expect(normalizeAngle(450)).toBe(90);
  });
});

describe('snapAngle', () => {
  it('rounds the absolute angle to the nearest step', () => {
    expect(snapAngle(7, 15)).toBe(0);
    expect(snapAngle(8, 15)).toBe(15);
    expect(snapAngle(52, 15)).toBe(45);
    expect(snapAngle(44, 90)).toBe(0);
    expect(snapAngle(46, 90)).toBe(90);
    expect(snapAngle(200, 90)).toBe(180);
  });

  it('wraps past a full turn and below zero', () => {
    expect(snapAngle(350, 90)).toBe(0);
    expect(snapAngle(-100, 90)).toBe(270);
    expect(snapAngle(-3, 15)).toBe(0);
  });
});

describe('stepAngle', () => {
  it('moves a whole step from an angle on the grid', () => {
    expect(stepAngle(0, 90, 1)).toBe(90);
    expect(stepAngle(90, 90, -1)).toBe(0);
    expect(stepAngle(0, 90, -1)).toBe(270);
    expect(stepAngle(270, 90, 1)).toBe(0);
  });

  it('lands on the next line in the direction of travel from between lines', () => {
    expect(stepAngle(20, 90, 1)).toBe(90);
    expect(stepAngle(20, 90, -1)).toBe(0);
    expect(stepAngle(350, 90, 1)).toBe(0);
    expect(stepAngle(350, 90, -1)).toBe(270);
  });

  it('treats a float a hair off the grid as on it', () => {
    expect(stepAngle(89.9999999, 90, 1)).toBe(180);
    expect(stepAngle(90.0000001, 90, -1)).toBe(0);
  });
});
