# Micrographics Creator

A React + Base UI micrographic generator for building dense, print-inspired layouts with rules, glyphs, labels, modules, and exportable SVG/PNG output.

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
  with its handles. Select several to align or distribute them.
- Reorder and select items through the `Layers` list in the left panel.
- Choose a palette from the swatches above the canvas, and zoom with the
  controls next to them.
- Toggle `Grid` and `Include background` in the right panel, or upload your
  own background image.
- Use the toolbar to randomize, restart the current template, undo/redo, and
  export SVG or PNG. Exports hold the artwork only: selection outlines, the
  rotate and resize handles, and the alignment toolbar stay in the editor.
- Choose the PNG resolution from the size menu in the toolbar, which reads
  `PNG 2x` until you change it: `1x`, `2x` or `4x` of the 1200 x 800 artboard,
  so 1200 x 800, 2400 x 1600 or 4800 x 3200 pixels. `2x` is the default.
  `Export SVG` always writes the artboard size, and that file scales to any
  size wherever it is placed.
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
