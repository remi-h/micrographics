import { loadTemplateItems } from '../../data';
import { layerRows, normalizeGroups } from '../../lib/groups';
import { resolveGroupTiming } from '../../lib/groupTiming';
import type { CanvasItem, Template } from '../../types';
import { animatedGroup, textItem } from './helpers';
import { templateComponents } from '.';

const templateIds = Object.keys(templateComponents) as Array<Exclude<Template, 'blank'>>;

const delayOf = (items: CanvasItem[], id: string) => {
  const item = items.find((candidate) => candidate.id === id);
  if (!item?.animation) throw new Error(`${id} has no entrance`);
  return item.animation.delay;
};

describe('animatedGroup', () => {
  const slide = { kind: 'slide-up' as const, duration: 0.5, delay: 0.2 };
  const grouped = animatedGroup('g', slide, 0.1, [
    textItem('first', 'A', 0, 0),
    textItem('second', 'B', 0, 40),
    textItem('third', 'C', 0, 80),
  ]);

  it('puts every item in one group carrying the entrance and stagger', () => {
    expect(grouped.map((item) => item.groups)).toEqual(Array(3).fill([{ id: 'g', animation: slide, stagger: 0.1 }]));
  });

  it('plays the items in the order they were given, one stagger apart, after the delay', () => {
    const resolved = resolveGroupTiming(grouped);
    expect(['first', 'second', 'third'].map((id) => delayOf(resolved, id))).toEqual([0.2, 0.3, 0.4]);
  });

  it('leaves the stagger off a group that has none', () => {
    expect(animatedGroup('g', slide, 0, [textItem('a', 'A', 0, 0)])[0].groups).toEqual([{ id: 'g', animation: slide }]);
  });
});

describe.each(templateIds)('template %s', (template) => {
  const items = loadTemplateItems(template);
  const groups = layerRows(items).filter((row) => row.kind === 'group');

  it('animates with one or two groups, each with an entrance and no group inside it', () => {
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(groups.length).toBeLessThanOrEqual(2);
    for (const group of groups) {
      expect(group.level.animation).toBeDefined();
      expect(group.children.every((child) => child.kind === 'item')).toBe(true);
    }
  });

  it('keeps the group invariants', () => {
    expect(normalizeGroups(items)).toEqual(items);
  });

  it('loads with every grouped item already playing its group entrance, and nothing else animated', () => {
    expect(resolveGroupTiming(items)).toBe(items);
    for (const item of items) {
      expect(Boolean(item.animation)).toBe(Boolean(item.groups?.length));
    }
  });

  it('ends its entrances within a few seconds', () => {
    const end = Math.max(...items.map((item) => (item.animation ? item.animation.delay + item.animation.duration : 0)));
    expect(end).toBeLessThanOrEqual(3);
  });
});

// The reading order a template was written in is the order it plays: these
// would flip if animatedGroup stopped reversing its members to match the
// layer list.
describe('template entrance order', () => {
  it('surfaces the quiet word before the caption under it', () => {
    const items = loadTemplateItems('001');
    expect(delayOf(items, '001-word')).toBeLessThan(delayOf(items, '001-rule'));
    expect(delayOf(items, '001-rule')).toBeLessThan(delayOf(items, '001-caption'));
  });

  it('fills the index plate from its first mark to its last', () => {
    const items = loadTemplateItems('002');
    expect(delayOf(items, '002-cell-0')).toBe(0);
    expect(delayOf(items, '002-cell-1')).toBeGreaterThan(0);
    expect(delayOf(items, '002-cell-39')).toBe(Math.max(...items.map((item) => item.animation?.delay ?? 0)));
  });

  it('runs the level bars top band first, and reads the values out after them', () => {
    const items = loadTemplateItems('005');
    const bars = ['SUB', 'LOW', 'MID', 'HIGH', 'AIR'].map((band) => delayOf(items, `005-bar-${band}`));
    expect(bars).toEqual([...bars].sort((a, b) => a - b));
    expect(new Set(bars).size).toBe(bars.length);
    expect(delayOf(items, '005-value-SUB')).toBeGreaterThan(delayOf(items, '005-bar-SUB'));
  });

  it('slides the plate callouts in after the figure', () => {
    const items = loadTemplateItems('003');
    expect(delayOf(items, '003-call-1')).toBeGreaterThan(delayOf(items, '003-figure'));
  });
});
