import { clamp } from './utils';

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the minimum when below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to the maximum when above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles min and max being equal', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});
