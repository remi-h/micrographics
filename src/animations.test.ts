import {
  ANIMATION_EASING,
  ANIMATION_KINDS,
  DEFAULT_ANIMATION,
  MAX_DELAY,
  MAX_DURATION,
  MAX_STAGGER,
  MIN_DURATION,
  animationClassName,
  animationFrames,
  animationLabel,
  animationRunTime,
  animationStateAt,
  animationStyleSheet,
  animationTiming,
  groupAnimation,
  maxStagger,
  staggeredAnimation,
  type AnimationKind,
  type ItemAnimation,
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
  // The scope is the id of the root the rules are written for.
  const sheetFor = (items: CanvasItem[]) => animationStyleSheet(items, 'mg-test')?.css ?? null;

  it('writes nothing at all when no item is animated', () => {
    expect(animationStyleSheet([symbol('a'), symbol('b')], 'mg-test')).toBeNull();
  });

  it('keys the rule to the item’s position, which is what the canvas classes it by', () => {
    const sheet = sheetFor([symbol('a'), symbol('b', slide)]);

    expect(sheet).toContain(`.${animationClassName(1)} {`);
    expect(sheet).not.toContain(`.${animationClassName(0)} {`);
  });

  it('writes the timing the preview runs on', () => {
    const sheet = sheetFor([symbol('a', slide)]);

    expect(sheet).toContain('0.6s');
    expect(sheet).toContain('0.2s');
    expect(sheet).toContain(ANIMATION_EASING);
    expect(sheet).toContain('both');
  });

  it('carries only the entrances actually used', () => {
    const sheet = sheetFor([symbol('a', slide)]);

    expect(sheet).toContain('@keyframes mg-slide-left');
    expect(sheet).not.toContain('@keyframes mg-pop');
  });

  it('writes one keyframes block for two items sharing an entrance', () => {
    const sheet = sheetFor([symbol('a', slide), symbol('b', slide)]) ?? '';

    expect(sheet.match(/@keyframes mg-slide-left/g)).toHaveLength(1);
    expect(sheet).toContain(`.${animationClassName(0)} {`);
    expect(sheet).toContain(`.${animationClassName(1)} {`);
  });

  it('namespaces the keyframes, so inlining the file cannot collide with the page', () => {
    // An exported SVG is often pasted into a document, and `@keyframes fade`
    // is a name plenty of stylesheets already define.
    const sheet = sheetFor([symbol('a', { ...slide, kind: 'fade' })]) ?? '';

    expect(sheet).toContain('@keyframes mg-fade');
    expect(sheet).not.toMatch(/@keyframes fade\b/);
  });

  it('qualifies every rule with the root it was written for', () => {
    // Two exported files inlined in one page have document-global styles, so
    // unqualified `.mg-anim-0` rules would fight and the later one would win
    // for both drawings.
    const sheet = animationStyleSheet([symbol('a', slide), symbol('b', slide)], 'mg-abc123');

    for (const rule of (sheet?.css ?? '').split('\n').filter((line) => line.startsWith('.') || line.startsWith('#'))) {
      expect(rule).toMatch(/^#mg-abc123 /);
    }
    expect(sheet?.scope).toBe('mg-abc123');
  });

  it('ends every entrance back at the item’s own state', () => {
    const sheet = sheetFor([symbol('a', slide)]) ?? '';

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

// The GIF export has no animation engine behind it: each frame is rendered
// with the state already applied. These pin the interpolation that does that,
// since a mistake here is a file that plays wrong rather than a crash.
describe('animationStateAt', () => {
  const slide: ItemAnimation = { delay: 1, duration: 2, kind: 'slide-left' };

  it('holds the starting offset through the delay', () => {
    // `fill: both` in the preview and `both` in the exported CSS. Without it
    // the item sits finished in place and then jumps back to start.
    expect(animationStateAt(slide, 0)).toEqual({ opacity: 0, transform: 'translateX(-240px)' });
    expect(animationStateAt(slide, 0.99)).toEqual({ opacity: 0, transform: 'translateX(-240px)' });
  });

  it('holds the finished artwork after it ends', () => {
    expect(animationStateAt(slide, 3)).toEqual({ opacity: 1, transform: 'none' });
    expect(animationStateAt(slide, 60)).toEqual({ opacity: 1, transform: 'none' });
  });

  it('is somewhere in between while it runs', () => {
    const middle = animationStateAt(slide, 2);

    expect(middle.opacity).toBeGreaterThan(0);
    expect(middle.opacity).toBeLessThan(1);
    expect(middle.transform).toMatch(/^translateX\(-?\d/);
  });

  it('eases rather than running at a constant rate', () => {
    // The entrance is `cubic-bezier(0.22, 1, 0.36, 1)` -- quick to arrive,
    // slow to settle -- so it is well past half way at its own half time.
    const halfway = animationStateAt({ delay: 0, duration: 1, kind: 'fade' }, 0.5);

    expect(halfway.opacity).toBeGreaterThan(0.8);
  });

  it('never goes backwards', () => {
    const at = (time: number) => animationStateAt({ delay: 0, duration: 1, kind: 'fade' }, time).opacity;
    const samples = Array.from({ length: 21 }, (_, index) => at(index / 20));

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1]);
    }
  });

  it('scales rather than translates for a pop', () => {
    const middle = animationStateAt({ delay: 0, duration: 1, kind: 'pop' }, 0.5);

    expect(middle.transform).toMatch(/^scale\(/);
    expect(Number(/scale\(([\d.]+)\)/.exec(middle.transform)![1])).toBeGreaterThan(0.4);
  });

  it('arrives exactly, so the last frame is the artwork itself', () => {
    // A frame that is 0.999 opacity and a hair off position would make the
    // poster the GIF loops on subtly wrong.
    expect(animationStateAt({ delay: 0, duration: 1, kind: 'pop' }, 1)).toEqual({ opacity: 1, transform: 'none' });
  });
});

// A group is one thing everywhere else in the editor, so its layer row shows
// one entrance rather than a control per member -- plus how far apart its
// members start, read back from their own delays.
describe('groupAnimation', () => {
  const item = (animation?: ItemAnimation): CanvasSymbol => ({
    id: `symbol-${Math.random()}`,
    kind: 'symbol',
    mark: 'ring',
    rotate: 0,
    size: 42,
    x: 0,
    y: 0,
    ...(animation ? { animation } : {}),
  });
  const pop: ItemAnimation = { delay: 0.4, duration: 1.2, kind: 'pop' };
  const at = (delay: number) => item({ ...pop, delay });

  it('reports the entrance, and no stagger, when every member plays the same one', () => {
    expect(groupAnimation([item(pop), item({ ...pop })])).toEqual({ animation: pop, stagger: 0 });
  });

  it('reads evenly spaced delays back as a stagger, from the first member', () => {
    expect(groupAnimation([at(0.4), at(0.7), at(1)])).toEqual({ animation: pop, stagger: 0.3 });
  });

  it('reads delays that only add up to a stagger in floating point as that stagger', () => {
    // 0.1 three times over is 0.30000000000000004; the slider set 0.3.
    expect(groupAnimation([at(0), at(0.1), at(0.2), at(0.3)])?.stagger).toBe(0.1);
  });

  it('reports nothing when the delays are not evenly spaced', () => {
    expect(groupAnimation([at(0.4), at(0.7), at(1.3)])).toBeUndefined();
  });

  it('reports nothing when the members start in the reverse order', () => {
    // Stagger runs in the order given; a group counting down is not one.
    expect(groupAnimation([at(1), at(0.7), at(0.4)])).toBeUndefined();
  });

  it('reports nothing when the members play different entrances', () => {
    // There is no single answer to show, so the control reads as unset until
    // one is chosen for all of them.
    expect(groupAnimation([item(pop), item({ ...pop, kind: 'fade' })])).toBeUndefined();
    expect(groupAnimation([item(pop), item({ ...pop, duration: 2 })])).toBeUndefined();
  });

  it('counts a member with no entrance as a disagreement', () => {
    expect(groupAnimation([item(pop), item()])).toBeUndefined();
    expect(groupAnimation([item(), item(pop)])).toBeUndefined();
  });

  it('reports nothing when no member has an entrance', () => {
    expect(groupAnimation([item(), item()])).toBeUndefined();
  });

  it('answers for an empty set rather than throwing', () => {
    expect(groupAnimation([])).toBeUndefined();
  });
});

describe('staggeredAnimation', () => {
  const pop: ItemAnimation = { delay: 0.5, duration: 1, kind: 'pop' };

  it('starts each member one stagger after the one before, from the group delay', () => {
    expect([0, 1, 2].map((index) => staggeredAnimation(pop, 0.2, index).delay)).toEqual([0.5, 0.7, 0.9]);
  });

  it('keeps everything but the delay', () => {
    expect(staggeredAnimation(pop, 0.2, 3)).toEqual({ ...pop, delay: 1.1 });
  });

  it('round-trips through groupAnimation', () => {
    const members = [0, 1, 2, 3].map((index) => ({
      animation: staggeredAnimation(pop, 0.3, index),
      id: `m${index}`,
      kind: 'symbol' as const,
      mark: 'ring',
      rotate: 0,
      size: 42,
      x: 0,
      y: 0,
    }));
    expect(groupAnimation(members)).toEqual({ animation: pop, stagger: 0.3 });
  });
});

describe('maxStagger', () => {
  it('allows up to MAX_STAGGER when there is room', () => {
    expect(maxStagger(3, 0)).toBe(MAX_STAGGER);
  });

  it('keeps the last member within MAX_DELAY, where a reload would clamp it', () => {
    // Five members from 6s: the last starts 4 staggers later, so 1s each.
    expect(maxStagger(5, 6)).toBe(1);
    expect(6 + 4 * maxStagger(5, 6)).toBeLessThanOrEqual(MAX_DELAY);
  });

  it('rounds down to the slider step, never up past the limit', () => {
    // (10 - 0.5) / 6 = 1.583..., so 1.5.
    expect(maxStagger(7, 0.5)).toBe(1.5);
  });

  it('does not lose a step to floating point', () => {
    // (10 - 9.4) / 2 is 0.29999999999999982, which a plain floor made 0.2 --
    // a step short of what the delay slider had just allowed.
    expect(maxStagger(3, 9.4)).toBe(0.3);
    expect(maxStagger(2, 9.9)).toBe(0.1);
    expect(maxStagger(2, 8.3)).toBe(1.7);
  });

  it('allows none for a single item, or with no room left', () => {
    expect(maxStagger(1, 0)).toBe(0);
    expect(maxStagger(4, MAX_DELAY)).toBe(0);
  });
});
