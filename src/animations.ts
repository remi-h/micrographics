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

/** The starting state each entrance animates away from. */
const ENTRANCES: Record<AnimationKind, { label: string; from: { opacity: number; transform?: string } }> = {
  fade: { from: { opacity: 0 }, label: 'Dissolve in' },
  'slide-left': { from: { opacity: 0, transform: `translateX(${-SLIDE_DISTANCE}px)` }, label: 'Slide in from left' },
  'slide-right': { from: { opacity: 0, transform: `translateX(${SLIDE_DISTANCE}px)` }, label: 'Slide in from right' },
  'slide-up': { from: { opacity: 0, transform: `translateY(${SLIDE_DISTANCE}px)` }, label: 'Slide in from below' },
  'slide-down': { from: { opacity: 0, transform: `translateY(${-SLIDE_DISTANCE}px)` }, label: 'Slide in from above' },
  pop: { from: { opacity: 0, transform: 'scale(0.4)' }, label: 'Pop in' },
};

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
    { opacity: from.opacity, transform: from.transform ?? 'none' },
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

function frameCss(frame: { opacity: number; transform?: string }): string {
  const transform = frame.transform ? ` transform: ${frame.transform};` : '';
  return `opacity: ${frame.opacity};${transform}`;
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

/** How long the whole sequence runs, in seconds. Zero when nothing animates. */
export function animationRunTime(items: CanvasItem[]): number {
  return items.reduce((longest, item) => {
    if (!item.animation) return longest;
    return Math.max(longest, Math.max(0, item.animation.delay) + Math.max(MIN_DURATION, item.animation.duration));
  }, 0);
}
