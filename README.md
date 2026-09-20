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
  export SVG or PNG.

## Stack

- React
- Next.js
- Base UI
- Lucide React icons
