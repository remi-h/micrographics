import type { CanvasItem } from './types';

// Entrance animations.
//
// An item can carry one: what it does, how long it takes, and how long it
// waits first. The delay is what orders a sequence -- it is strictly more
// expressive than a "1st, 2nd, 3rd" field, since two items can also share a
// moment, and it is the same number whether you think in order or in timing.
//
// One description, two consumers. The canvas previews an animation through the
// Web Animations API, and `exportMarkup` writes the same thing into the
// exported SVG as CSS `@keyframes`. Both are generated from `ENTRANCES` below,
// so a new entrance is one entry here and is immediately both previewable and
// exportable -- there is no second list to keep in step.
//
// Every entrance animates *from* an offset *to* the item's own natural state,
// never the other way round. That is what lets the exported file stay correct
// in a viewer that does not run CSS at all: the elements' own attributes are
// the finished artwork, and the animation is a departure from it that resolves
// back. An SVG opened in a tool with no CSS animation support shows the poster,
// not a pile of transparent items stacked off the left edge.

export type AnimationKind = 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'pop';

export type ItemAnimation = {
  kind: AnimationKind;
  /** Seconds the movement takes. */
  duration: number;
  /** Seconds before it starts. This is what puts a sequence in order. */
  delay: number;
};

/** How far a slide travels, in canvas units. */
const SLIDE_DISTANCE = 240;

export const MIN_DURATION = 0.1;
export const MAX_DURATION = 5;
export const MIN_DELAY = 0;
export const MAX_DELAY = 10;

export const DEFAULT_ANIMATION: ItemAnimation = { delay: 0, duration: 0.6, kind: 'slide-left' };

/**
 * The starting state each entrance animates away from, as numbers rather than
 * as a CSS string.
 *
 * There are three consumers now, not two: the CSS the exported .svg carries,
 * the Web Animations keyframes the canvas previews with, and the GIF export,
 * which has no engine to run either and has to work out where an item *is* at
 * a given moment. A string like `translateX(-240px)` serves the first two and
 * leaves the third parsing its own format back out, so the offset is kept as
 * the numbers it is and the CSS is generated from them.
 */
type Offset = { opacity: number; translateX?: number; translateY?: number; scale?: number };

const ENTRANCES: Record<AnimationKind, { label: string; from: Offset }> = {
  fade: { from: { opacity: 0 }, label: 'Dissolve in' },
  'slide-left': { from: { opacity: 0, translateX: -SLIDE_DISTANCE }, label: 'Slide in from left' },
  'slide-right': { from: { opacity: 0, translateX: SLIDE_DISTANCE }, label: 'Slide in from right' },
  'slide-up': { from: { opacity: 0, translateY: SLIDE_DISTANCE }, label: 'Slide in from below' },
  'slide-down': { from: { opacity: 0, translateY: -SLIDE_DISTANCE }, label: 'Slide in from above' },
  pop: { from: { opacity: 0, scale: 0.4 }, label: 'Pop in' },
};

/**
 * An offset as a CSS transform, or `none` when the entrance only fades. The
 * order is fixed rather than incidental: no entrance combines a translate with
 * a scale today, but if one did, a transform list is applied right to left and
 * the two do not commute.
 */
function transformCss(offset: Offset): string {
  const parts: string[] = [];
  // Identity values are left out rather than written, so a finished entrance
  // reads `none` -- the same thing the CSS `to` frame says -- instead of
  // `scale(1)`. They paint identically, but the last GIF frame should be the
  // artwork itself, not a transformed copy that happens to land on it.
  if (offset.translateX) parts.push(`translateX(${offset.translateX}px)`);
  if (offset.translateY) parts.push(`translateY(${offset.translateY}px)`);
  if (offset.scale !== undefined && offset.scale !== 1) parts.push(`scale(${offset.scale})`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export const ANIMATION_KINDS = Object.keys(ENTRANCES) as AnimationKind[];

export function animationLabel(kind: AnimationKind): string {
  return ENTRANCES[kind].label;
}

/**
 * The easing every entrance uses. Named once because the preview and the
 * exported CSS have to agree, and because `ease-out` is the shape an entrance
 * wants: quick to arrive, slow to settle.
 */
export const ANIMATION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * `pop` scales, and an SVG element's default transform origin is the canvas
 * corner, not the item -- so without this it scales about (0, 0) and flies in
 * from the top-left instead of growing in place. `fill-box` puts the origin on
 * the element's own bounding box.
 *
 * This is set on the element itself rather than only in the exported
 * stylesheet, because the canvas preview runs through the Web Animations API,
 * which animates the transform but does not supply an origin. Setting it in
 * one place is what keeps the preview and the exported file agreeing.
 */
export const ANIMATION_ORIGIN_STYLE = { transformBox: 'fill-box', transformOrigin: 'center' } as const;

/** Keyframes for `Element.animate`, used by the canvas preview. */
export function animationFrames(kind: AnimationKind): Keyframe[] {
  const { from } = ENTRANCES[kind];
  return [
    { opacity: from.opacity, transform: transformCss(from) },
    { opacity: 1, transform: 'none' },
  ];
}

/** Timing for `Element.animate`, matching what `animationStyleSheet` writes. */
export function animationTiming(animation: ItemAnimation): KeyframeAnimationOptions {
  return {
    delay: Math.max(0, animation.delay) * 1000,
    duration: Math.max(MIN_DURATION, animation.duration) * 1000,
    easing: ANIMATION_EASING,
    // `both` so the item holds its starting state through the delay instead of
    // sitting in place and then jumping, and holds the finished state after.
    fill: 'both',
  };
}

/** The class the nth animated item wears, in the preview and in the export. */
export function animationClassName(index: number): string {
  return `mg-anim-${index}`;
}

/**
 * The `@keyframes` name an entrance is written under. Prefixed because an
 * exported SVG is often inlined into a page, and `@keyframes fade` is a name
 * plenty of stylesheets already use -- the later definition would win and the
 * artwork would animate as whatever that page meant by it.
 */
function keyframesName(kind: AnimationKind): string {
  return `mg-${kind}`;
}

function frameCss(frame: Offset): string {
  return `opacity: ${frame.opacity}; transform: ${transformCss(frame)};`;
}

/**
 * A `<style>` body that animates the items with `animationClassName` indices,
 * or `null` when nothing on the canvas is animated. Only the entrances
 * actually used are written out, so a file with one fading item does not carry
 * the whole catalogue.
 *
 * The rules are keyed by class rather than by item id because ids come from
 * templates and from the id minter and are not guaranteed to be valid CSS
 * identifiers; an index is. `scope` is the id of the root the rules belong to,
 * which they are qualified by: an exported SVG inlined into a page has
 * document-global styles, so two of them would otherwise both claim
 * `.mg-anim-0` and the second would win for both.
 */
export function animationStyleSheet(items: CanvasItem[], scope: string): { css: string; scope: string } | null {
  const animated = items.map((item, index) => ({ animation: item.animation, index })).filter((entry) => entry.animation);
  if (animated.length === 0) return null;

  const used = [...new Set(animated.map((entry) => entry.animation!.kind))];
  const keyframes = used.map(
    (kind) =>
      `@keyframes ${keyframesName(kind)} { from { ${frameCss(ENTRANCES[kind].from)} } to { opacity: 1; transform: none; } }`,
  );

  // The origin is already an inline style on each element (see
  // ANIMATION_ORIGIN_STYLE), which serializes into the file with it, so these
  // rules only have to carry the timing.
  const rules = animated.map((entry) => {
    const { delay, duration, kind } = entry.animation!;
    return (
      `#${scope} .${animationClassName(entry.index)} { animation: ${keyframesName(kind)}` +
      ` ${Math.max(MIN_DURATION, duration)}s ${ANIMATION_EASING} ${Math.max(0, delay)}s both; }`
    );
  });

  return { css: [...keyframes, ...rules].join('\n'), scope };
}

/**
 * The easing curve's own control points, kept beside the CSS string above so
 * the GIF frames and the CSS cannot drift apart. `cubic-bezier(x1, y1, x2, y2)`
 * implies (0, 0) and (1, 1) as the endpoints.
 */
const EASING_POINTS = { x1: 0.22, y1: 1, x2: 0.36, y2: 1 } as const;

function bezier(a: number, b: number, t: number): number {
  // The standard cubic with P0 = 0 and P3 = 1.
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t;
}

/**
 * The eased progress at a linear progress, by solving the curve's x for t and
 * reading off its y -- which is what a browser does for `cubic-bezier`.
 *
 * Bisection: the curve is monotonic in x, so halving the interval converges
 * unconditionally. Newton would get there in fewer steps but stalls where the
 * derivative is near zero, which this curve's long flat tail is made of.
 *
 * Twenty steps rather than the eight that looked like enough. Eight leaves the
 * result up to 0.010 out near the start of the curve, where it is steepest --
 * about a hundredth of an item's opacity on the frames where the eye is most
 * likely to catch a step. Twenty brings that under 1e-6 and costs nothing:
 * this runs a few hundred times for a whole file.
 */
function ease(progress: number): number {
  const { x1, x2, y1, y2 } = EASING_POINTS;
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  let low = 0;
  let high = 1;
  let t = progress;
  for (let step = 0; step < 20; step += 1) {
    const x = bezier(x1, x2, t);
    if (Math.abs(x - progress) < 1e-6) break;
    if (x < progress) low = t;
    else high = t;
    t = (low + high) / 2;
  }

  return bezier(y1, y2, t);
}

/**
 * Where an animated item sits at a given moment, in seconds from the start of
 * the sequence. Before its delay it holds its starting offset and after it
 * finishes it holds its natural state, which is `fill: both` in the preview and
 * `both` in the exported CSS -- the same behaviour, worked out rather than run.
 *
 * This is what the GIF export draws each frame from. A GIF is a stack of
 * finished pictures, so there is no engine to hand the animation to: every
 * frame has to be rendered with the state already applied.
 */
export function animationStateAt(animation: ItemAnimation, seconds: number): { opacity: number; transform: string } {
  const { from } = ENTRANCES[animation.kind];
  const delay = Math.max(0, animation.delay);
  const duration = Math.max(MIN_DURATION, animation.duration);
  const progress = ease(Math.min(1, Math.max(0, (seconds - delay) / duration)));

  // Every entrance runs from its offset to the item's own natural state, so
  // interpolating towards the identity value of each property is the whole of
  // it: opacity 1, no translation, scale 1.
  const between = (start: number, end: number) => start + (end - start) * progress;

  return {
    opacity: between(from.opacity, 1),
    transform: transformCss({
      opacity: 0,
      scale: from.scale === undefined ? undefined : between(from.scale, 1),
      translateX: from.translateX === undefined ? undefined : between(from.translateX, 0),
      translateY: from.translateY === undefined ? undefined : between(from.translateY, 0),
    }),
  };
}

/**
 * Two entrances are the same entrance when they would play the same way. Used
 * to keep a no-op out of the undo stack, and to decide whether a group of
 * items has one entrance to show or several; an `ItemAnimation` is three flat
 * fields, so this is the whole of it.
 */
export function sameAnimation(left: ItemAnimation | undefined, right: ItemAnimation | null | undefined) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.kind === right.kind && left.duration === right.duration && left.delay === right.delay;
}

/** The most one member of a group may start after the one before it, in seconds. */
export const MAX_STAGGER = 2;

// Delays are set in tenths from a slider and summed here, so a stagger of 0.1
// three times over is 0.30000000000000004. Rounding keeps what is stored, and
// what the dialog reads back, the number the user chose.
const roundDelay = (seconds: number) => Math.round(seconds * 1000) / 1000;

/**
 * A group's entrance, as its layer row shows it: the entrance its members
 * share, and how far apart they start.
 *
 * There is nothing to store for this: a group is its members, and each member
 * keeps its own entrance. Staggering is only a way of setting them -- the
 * first plays at the group's delay, each next one `stagger` seconds after the
 * one before -- so reading it back means finding that pattern in them. Undo,
 * saving, the preview and every export already work per member, and so work
 * unchanged.
 *
 * `items` are in stagger order, the order they start in. Returns undefined
 * when there is no one pattern to show: a member with no entrance, members
 * that play a different entrance or for a different time, or delays that are
 * not evenly spaced (set one by one before they were grouped, say). The
 * control then reads as unset until one is chosen for all of them.
 */
export function groupAnimation(items: CanvasItem[]): { animation: ItemAnimation; stagger: number } | undefined {
  const first = items[0]?.animation;
  if (!first) return undefined;
  const stagger = items.length > 1 ? roundDelay((items[1].animation?.delay ?? NaN) - first.delay) : 0;
  if (!(stagger >= 0)) return undefined;

  const evenlySpaced = items.every(
    (item, index) => item.animation && sameAnimation(item.animation, staggeredAnimation(first, stagger, index)),
  );
  return evenlySpaced ? { animation: first, stagger } : undefined;
}

/** The entrance the member `index` places into a staggered group plays. */
export function staggeredAnimation(animation: ItemAnimation, stagger: number, index: number): ItemAnimation {
  return { ...animation, delay: roundDelay(animation.delay + stagger * index) };
}

/**
 * How far apart a group of `count` may start, given the first one's delay:
 * as far as `MAX_STAGGER`, and no further than keeps the last member within
 * `MAX_DELAY`. A save clamps every delay to that on the way back in, so a
 * stagger that ran past it would come back from a reload bunched up at the
 * end.
 */
export function maxStagger(count: number, delay: number): number {
  if (count < 2) return 0;
  // In whole tenths, the slider's step: (10 - 9.4) / 2 * 10 is 2.9999999999999982
  // in floating point, which floors a whole step short of the 0.3 that fits.
  const tenths = Math.floor(Math.round((MAX_DELAY - delay) * 10) / (count - 1));
  return Math.max(0, Math.min(MAX_STAGGER, tenths / 10));
}

/** How long the whole sequence runs, in seconds. Zero when nothing animates. */
export function animationRunTime(items: CanvasItem[]): number {
  return items.reduce((longest, item) => {
    if (!item.animation) return longest;
    return Math.max(longest, Math.max(0, item.animation.delay) + Math.max(MIN_DURATION, item.animation.duration));
  }, 0);
}
