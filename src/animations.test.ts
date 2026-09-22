import {
  ANIMATION_EASING,
  ANIMATION_KINDS,
  DEFAULT_ANIMATION,
  MAX_DELAY,
  MAX_DURATION,
  MIN_DURATION,
  animationClassName,
  animationFrames,
  animationLabel,
  animationRunTime,
  animationStyleSheet,
  animationTiming,
  type AnimationKind,
} from './animations';
import type { CanvasItem, CanvasSymbol } from './types';

// One description, two consumers: the canvas previews through the Web
// Animations API and the export writes CSS. These cover that both come out of
// the same table and say the same thing. Whether the browser then honours it
// is e2e/animations.spec.ts's job.

function symbol(id: string, animation?: CanvasSymbol['animation']): CanvasSymbol {
  return { ...(animation ? { animation } : {}), id, kind: 'symbol', mark: 'ring', rotate: 0, size: 42, x: 100, y: 200 };
}

const slide = { delay: 0.2, duration: 0.6, kind: 'slide-left' as const };

describe('the entrance catalogue', () => {
  it('names every kind the type allows', () => {
    // The list is derived from the table, so a kind added to one and not the
    // other cannot happen -- this pins that it is still derived.
    const kinds: AnimationKind[] = ['fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'pop'];

    expect([...ANIMATION_KINDS].sort()).toEqual([...kinds].sort());
  });

  it('gives every kind a label to show in the picker', () => {
    for (const kind of ANIMATION_KINDS) {
      expect(animationLabel(kind)).toMatch(/\S/);
    }
  });

  it('offers a default that is a real kind', () => {
    expect(ANIMATION_KINDS).toContain(DEFAULT_ANIMATION.kind);
  });
});

describe('animationFrames', () => {
  it('always ends at the item’s own untouched state', () => {
    // This is what keeps an exported file correct in a viewer that does not
    // run CSS: the elements' own attributes are the finished artwork.
    for (const kind of ANIMATION_KINDS) {
      const frames = animationFrames(kind);
      expect(frames[frames.length - 1]).toEqual({ opacity: 1, transform: 'none' });
    }
  });

  it('starts every entrance from invisible', () => {
    for (const kind of ANIMATION_KINDS) {
      expect(animationFrames(kind)[0].opacity).toBe(0);
    }
  });

  it('moves the slides in the direction they are named for', () => {
    expect(animationFrames('slide-left')[0].transform).toBe('translateX(-240px)');
    expect(animationFrames('slide-right')[0].transform).toBe('translateX(240px)');
    // "Slide in from above" starts above, so it travels downwards.
    expect(animationFrames('slide-down')[0].transform).toBe('translateY(-240px)');
    expect(animationFrames('slide-up')[0].transform).toBe('translateY(240px)');
  });

  it('leaves a dissolve with no transform of its own', () => {
    expect(animationFrames('fade')[0].transform).toBe('none');
  });
});

describe('animationTiming', () => {
  it('converts seconds to the milliseconds the Web Animations API wants', () => {
    expect(animationTiming(slide)).toEqual({
      delay: 200,
      duration: 600,
      easing: ANIMATION_EASING,
      fill: 'both',
    });
  });

  it('holds the start state through the delay rather than jumping into it', () => {
    expect(animationTiming(slide).fill).toBe('both');
  });

  it('refuses a duration of zero, which would make the entrance a jump cut', () => {
    expect(animationTiming({ ...slide, duration: 0 }).duration).toBe(MIN_DURATION * 1000);
  });

  it('refuses a negative delay, which would start the entrance mid-flight', () => {
    expect(animationTiming({ ...slide, delay: -3 }).delay).toBe(0);
  });
});

describe('animationStyleSheet', () => {
  it('writes nothing at all when no item is animated', () => {
    expect(animationStyleSheet([symbol('a'), symbol('b')])).toBeNull();
  });

  it('keys the rule to the item’s position, which is what the canvas classes it by', () => {
    const sheet = animationStyleSheet([symbol('a'), symbol('b', slide)]);

    expect(sheet).toContain(`.${animationClassName(1)} {`);
    expect(sheet).not.toContain(`.${animationClassName(0)} {`);
  });

  it('writes the timing the preview runs on', () => {
    const sheet = animationStyleSheet([symbol('a', slide)]);

    expect(sheet).toContain('0.6s');
    expect(sheet).toContain('0.2s');
    expect(sheet).toContain(ANIMATION_EASING);
    expect(sheet).toContain('both');
  });

  it('carries only the entrances actually used', () => {
    const sheet = animationStyleSheet([symbol('a', slide)]);

    expect(sheet).toContain('@keyframes mg-slide-left');
    expect(sheet).not.toContain('@keyframes mg-pop');
  });

  it('writes one keyframes block for two items sharing an entrance', () => {
    const sheet = animationStyleSheet([symbol('a', slide), symbol('b', slide)]) ?? '';

    expect(sheet.match(/@keyframes mg-slide-left/g)).toHaveLength(1);
    expect(sheet).toContain(`.${animationClassName(0)} {`);
    expect(sheet).toContain(`.${animationClassName(1)} {`);
  });

  it('namespaces the keyframes, so inlining the file cannot collide with the page', () => {
    // An exported SVG is often pasted into a document, and `@keyframes fade`
    // is a name plenty of stylesheets already define.
    const sheet = animationStyleSheet([symbol('a', { ...slide, kind: 'fade' })]) ?? '';

    expect(sheet).toContain('@keyframes mg-fade');
    expect(sheet).not.toMatch(/@keyframes fade\b/);
  });

  it('ends every entrance back at the item’s own state', () => {
    const sheet = animationStyleSheet([symbol('a', slide)]) ?? '';

    expect(sheet).toContain('to { opacity: 1; transform: none; }');
  });
});

describe('animationRunTime', () => {
  it('is zero for a canvas with nothing animated', () => {
    expect(animationRunTime([symbol('a')])).toBe(0);
  });

  it('is the last item to finish, not the sum of them', () => {
    const items: CanvasItem[] = [
      symbol('a', { delay: 0, duration: 1, kind: 'fade' }),
      symbol('b', { delay: 2, duration: 0.5, kind: 'fade' }),
    ];

    expect(animationRunTime(items)).toBe(2.5);
  });

  it('is positive as soon as one item animates, which is what offers Play', () => {
    expect(animationRunTime([symbol('a'), symbol('b', slide)])).toBeGreaterThan(0);
  });

  it('survives a stored value outside the range the editor allows', () => {
    const wild = animationRunTime([symbol('a', { delay: -5, duration: 0, kind: 'fade' })]);

    expect(wild).toBe(MIN_DURATION);
    expect(Number.isFinite(wild)).toBe(true);
  });
});

describe('the range the editor offers', () => {
  it('cannot ask for an entrance that never finishes', () => {
    expect(MAX_DURATION).toBeLessThan(Infinity);
    expect(MAX_DELAY).toBeLessThan(Infinity);
    expect(MIN_DURATION).toBeGreaterThan(0);
  });
});
