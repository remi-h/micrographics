import { expect, type Page } from '@playwright/test';
import { initialSettings, loadTemplateItems } from '../src/data';
import { STORAGE_KEY, STORAGE_VERSION } from '../src/lib/persistence';
import type { CanvasItem } from '../src/types';

// The templates open with a group or two already playing an entrance, the
// default one included. Most specs are about editing plain layers, though --
// grouping them, giving one an entrance, typing into one -- and count on
// starting with none of that done. This opens the editor on the default
// template's layers as they were before it had any: no groups, no entrances,
// in the order it paints them unanimated.
//
// Seeded as a save, and only when there is none, so a spec that reloads gets
// back what it left, not this.

/** The default template, with its groups taken apart and nothing animated. */
export function stillTemplateItems(): CanvasItem[] {
  const items = loadTemplateItems(initialSettings.template);
  const still: CanvasItem[] = [];
  // animatedGroup lists a group's members reversed, so its first item plays
  // first; put each run back the way the template wrote it.
  let run: CanvasItem[] = [];
  const flush = () => {
    still.push(...run.reverse());
    run = [];
  };
  for (const item of items) {
    if (run.length && item.groups?.[0]?.id !== run[0].groups?.[0]?.id) flush();
    if (item.groups?.length) run.push(item);
    else still.push(item);
  }
  flush();
  return still.map((item) => {
    const plain = { ...item };
    delete plain.groups;
    delete plain.animation;
    return plain;
  });
}

/** Opens the editor on `stillTemplateItems`, once it is showing them. */
export async function openStillCreator(page: Page) {
  const save = JSON.stringify({
    version: STORAGE_VERSION,
    settings: initialSettings,
    canvasItems: stillTemplateItems(),
    canvasZoom: 1,
  });
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: save },
  );
  await page.goto('/creator');
  // The editor renders the template first and reads the save once it has
  // mounted; wait for the save, so nothing counts the template's rows.
  await expect(page.locator('.layer-row[data-group]')).toHaveCount(0);
  await expect(page.locator('.layer-row')).toHaveCount(stillTemplateItems().length);
}
