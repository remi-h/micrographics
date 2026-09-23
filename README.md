# Micrographics Creator

A React + Base UI micrographic generator for building dense, print-inspired layouts with rules, glyphs, labels, modules, and exportable SVG, PNG, and animated GIF output.

## Setup

Install dependencies:

```bash
npm install
```

## Run Locally

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

If port `3000` is busy, Next.js will prompt you to use another port.

## Build

Create a production build:

```bash
npm run build
```

Run the production server after building:

```bash
npm run start
```

## Testing

Run unit tests (Jest + React Testing Library):

```bash
npm run test
```

Run end-to-end tests (Playwright):

```bash
npm run test:e2e
```

Typecheck the project:

```bash
npm run typecheck
```

Lint the project (ESLint with `eslint-config-next` and the React Hooks rules):

```bash
npm run lint
```

`npm run lint` fails on warnings as well as errors, and CI runs it on every pull
request.

## Formatting

Prettier owns formatting; its settings live in `.prettierrc.json` and match the
style the codebase already uses (two spaces, single quotes, semicolons, a
generous 120-column width). `eslint-config-prettier` switches off ESLint's own
formatting rules, so the two never disagree about the same line.

Format the files you are working on by passing them to the script:

```bash
npm run format -- src/App.tsx e2e/navigation.spec.ts
```

The repository predates Prettier and is not formatted end to end yet, so there
is deliberately no repo-wide formatting check in CI: running Prettier over
everything is a reformatting change of its own.

## Basic Use

- Pick a starting point from the `Template` dropdown in the left panel, or
  `Start from scratch` for an empty canvas.
- Add symbols from the right panel. They are grouped into `Daily` marks and
  `Tech` logos. Add text from the same panel.
- Drag items on the canvas to move them; select one to rotate or resize it
  with its handles. Resizing keeps the opposite corner of the selection
  pinned, so the item grows along with the pointer. Select several to align or
  distribute them.
- Select several items and press `Group`, in the `Layers` list or on the
  toolbar that appears over the selection, to lock them together. A group is
  one row in `Layers`, clicking any member selects all of them, and moving,
  resizing, rotating, copying or deleting the group treats it as one thing.
  `Ungroup` takes it apart again. Copying a group gives you a second,
  independent group rather than enlarging the first. `Cmd`/`Ctrl` + `G` and
  `Shift` + `Cmd`/`Ctrl` + `G` do the same from the keyboard.
- Reorder and select items through the `Layers` list in the left panel.
- Give a layer an entrance with the sparkle button on its row in `Layers`:
  dissolve, slide in from any side, or pop. Set how long it takes and how long
  it waits first — the wait is what puts a sequence in order, and two layers
  can share a moment by sharing a delay. `Play`, above the canvas, previews the
  whole sequence; it only appears once something has an entrance.
- Choose a palette from the swatches above the canvas, and zoom with the
  controls next to them.
- Toggle `Grid` and `Include background` in the right panel, or upload your
  own background image.
- Use the toolbar to randomize, restart the current template, undo/redo, and
  export. Exports hold the artwork only: selection outlines, the rotate and
  resize handles, and the alignment toolbar stay in the editor.
- `Export` opens one dialog with every format in it: SVG, PNG at three sizes,
  and GIF. When anything on the canvas has an entrance, the dialog says so —
  only SVG and GIF carry the animation, because a PNG is a single frame.
- The PNG sizes are `1x`, `2x` or `4x` of the 1200 x 800 artboard, so
  1200 x 800, 2400 x 1600 or 4800 x 3200 pixels. Every row in the dialog is a
  button that exports on the spot — there is nothing to select and nothing to
  confirm, and no size is marked as the current one. The SVG always writes the
  artboard size, and that file scales to any size wherever it is placed.
- Entrances travel with the SVG: the file animates when it is opened in a
  browser or embedded in a page. They are written as CSS that moves each item
  *away from* its own position and back, so a viewer that does not run CSS —
  and every PNG — shows the finished artwork rather than the first frame.
- The GIF plays the same entrances for anywhere that will not run an SVG. It
  is always 1200 x 800, since a GIF stores every frame as its own picture, and
  it holds on the finished artwork for a moment before looping. The option is
  only offered once at least one layer has an entrance.
- A GIF is always written on the background colour, even with `Include
  background` off. GIF transparency is one bit — a pixel is either fully clear
  or fully opaque — and an entrance is made of the in-between, so on a
  transparent canvas every fade would become a hard cut. The SVG and the PNG
  both carry real transparency and honour the toggle as usual.
- Each export reports back in the corner of the window, naming the file it
  wrote, or saying what went wrong if the browser could not produce it.
- Your work is saved automatically in the browser, so closing the tab or
  reloading brings the canvas, palette, and zoom back as you left them. Use
  `Restart template` or `Start from scratch` in the toolbar to discard it. The
  save is per browser and is skipped silently if the browser blocks storage.

## Stack

- React
- Next.js
- Base UI
- Lucide React icons
- ESLint + Prettier
