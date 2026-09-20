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

- Pick a layout template in the `Layout` tab.
- Adjust density, scale, and detail with the sliders.
- Choose a palette and toggle labels, grid, or paper noise in the `Style` tab.
- Use the toolbar buttons to randomize, reset the seed, export SVG, or export PNG.

## Stack

- React
- Next.js
- Base UI
- Lucide React icons
