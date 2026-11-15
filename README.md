# Micrographics Creator

A React + Base UI micrographic generator for building dense, print-inspired layouts with rules, glyphs, labels, modules, and exportable SVG, PNG, and animated GIF output.

Example Output (GIF Export):  
<img width="600" height="400" alt="micrographic" src="https://github.com/user-attachments/assets/8902b8f4-bf21-425d-93d9-c18dbde6e766" />


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

## Accounts (optional)

Signing in with Google lets a user save several canvases and upload their own
SVG symbols. It runs on [Supabase](https://supabase.com) — Google sign-in and a
Postgres database — and is switched on by two environment variables. With them
unset the app has no sign-in at all and works as a single canvas kept in the
browser.

1. Create a Supabase project.
2. Run every file in `supabase/migrations/`, oldest first, against it (paste
   each into the SQL editor, or `supabase db push` with the CLI). They create
   the `canvases` and `symbols` tables, the row-level security policies that
   limit each user to their own rows, and the grants that let signed-in users
   reach the tables at all.
3. In Google Cloud, create an OAuth client of type "Web application" and add
   the callback URL Supabase shows under Authentication → Sign In / Providers →
   Google (`https://<project>.supabase.co/auth/v1/callback`) as an authorized
   redirect URI. Paste the client ID and secret into that same Supabase page
   and enable the provider.
4. In Supabase, under Authentication → URL Configuration, set the Site URL to
   the deployed site and add `<site>/creator` for every origin the app runs on
   (`http://localhost:3000/creator` included) to the redirect URLs.
5. Copy `.env.example` to `.env.local` and fill in the project URL and its
   publishable (or legacy `anon`) key. Set the same two variables wherever the
   app is deployed, and rebuild: they are inlined at build time.

If signing in works but saving says `Could not save the canvas.`, open the
browser console: the line starting `[account]` has what the database said.
`permission denied for table` means a migration has not been run.

Both values are public. The browser talks to the database directly, and what
keeps one user out of another's data is the row-level security from step 2, so
never put the `service_role` key in the app.

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

The suite runs with accounts switched on and pointed at an address nothing
serves (see `playwright.config.ts`), so it needs no Supabase project. A spec
about the signed-in editor calls `signInWithFakeAccount` from `e2e/account.ts`
before `page.goto`: it seeds a session and answers the account's requests from
memory.

The templates open with animated groups. A spec about editing plain layers
should start from `openStillCreator` in `e2e/still-template.ts`, which opens
the default template's layers with no groups and no entrances, rather than
`page.goto('/creator')`.

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
npm run format -- src/components/App.tsx e2e/navigation.spec.ts
```

The repository predates Prettier and is not formatted end to end yet, so there
is deliberately no repo-wide formatting check in CI: running Prettier over
everything is a reformatting change of its own.

## Basic Use

- Pick a starting point from the `Template` dropdown in the left panel, or
  `Start from scratch` for an empty canvas. Every template opens with a group
  or two already set to play a simple entrance — the plate's marks popping in
  row by row, the level bars running out one band at a time — so `Play` works
  straight away. Change or take off a group's entrance on its row in `Layers`,
  or ungroup it to work with its layers one by one.
- Add symbols from the right panel. They are grouped into `Daily` marks and
  `Tech` logos. Add text from the same panel.
- `Sign in with Google`, under the title in the left panel, adds an account
  to the editor (where the deployment has accounts set up; see "Accounts").
  Nothing needs one: signed out, the editor keeps one canvas in the browser as
  before.
- Signed in, the left panel names the canvas on screen and says where it is
  kept. `Canvases` opens the list of saved ones: name what is on screen and
  `Save canvas` to keep it in the account, after which every change to it is
  saved as you work. Click another canvas to open it, use the pencil and bin
  on its row to rename or delete it (`Delete for good` confirms), `Save a
  copy` to branch the open one under a new name, and `New canvas` to start a
  fresh one. Opening or starting a canvas while an unsaved one is on screen
  asks first. Undo does not reach back across canvases.
- Signed in, the `Custom` tab beside `Daily` and `Tech` holds your own
  symbols. `Upload SVG` adds a file (up to 200 KB; scripts and outside links
  are stripped), and it is then there on every canvas. An uploaded symbol
  keeps its own colours rather than taking the palette's ink. The `×` on a
  symbol removes it from the tab; canvases it was already placed on keep it.
- Drag items on the canvas to move them; select one to rotate or resize it
  with its handles. Resizing keeps the opposite corner of the selection
  pinned, so the item grows along with the pointer. Select several to align or
  distribute them; aligning centres works from what each item draws and meets
  in the middle of the selection, so a label lines up with a mark by its
  glyphs rather than by its click target. If aligning would push the selection
  past an edge of the artboard, the whole selection shifts back together, so
  the items stay aligned with each other. A group aligns and distributes as
  one thing, by the middle of everything it draws, and keeps its own layout;
  one group on its own has nothing to line up against, so it gets no align
  toolbar.
- Hold `Shift` while dragging the rotate handle to snap to 15° steps, or
  `Alt`/`Option` to snap to quarter turns (0°, 90°, 180°, 270°). The snap
  lands the item you grabbed on the angle; the rest of a selection turns by
  the same amount. From the keyboard, `[` and `]` turn the selection 15° (45°
  with `Shift`), and `Alt`/`Option` + `[`/`]` turns it until its first item reaches the next
  quarter.
- Select several items and right-click them — on a layer in the `Layers`
  list, or on the canvas — and choose `Group` to lock them together. The menu
  offers only what applies: `Group` for loose items, `Ungroup` for a group,
  both only when a group is selected together with other items. Right-clicking
  a layer or item that is not selected selects it first, so the menu is always
  about what is under the pointer. `Cmd`/`Ctrl` + `G` and
  `Shift` + `Cmd`/`Ctrl` + `G` do the same from the keyboard.
- A group is one row in `Layers`. Its `>` shows the layers inside it; clicking
  any of them, or any member on the canvas, selects the whole group, and
  moving, resizing, rotating, copying or deleting the group treats it as one
  thing. Copying a group gives you a second, independent group rather than
  enlarging the first.
- Groups nest: group a group with other layers, or two groups together, and
  they sit inside a new group, each still whole. An open group lists the
  groups inside it as rows of their own, each with its own `>`. A click
  anywhere inside still selects the outermost group, and `Ungroup` takes off
  one level at a time.
- Select items through the `Layers` list in the left panel, and drag a layer
  up or down the list to change what sits in front of what: the top of the
  list is the front of the canvas. A line shows where the layer will land, and
  a group is dragged as one. Inside an open group, drag its layers and the
  groups inside it among themselves to change which is in front; they stay in
  the group. The
  numbers beside the rows count places in the stack, so they stay put while
  the layers move past them. Undo puts a move back.
- Give a layer an entrance with the sparkle button on its row in `Layers`:
  dissolve, slide in from any side, or pop. Set how long it takes and how long
  it waits first — the wait is what puts a sequence in order, and two layers
  can share a moment by sharing a delay. `Play`, above the canvas, previews the
  whole sequence; it only appears once something has an entrance.
- Every group, at any depth, has an entrance of its own on its row, plus
  `Each next layer`: a stagger, so each thing listed in the open group starts
  that long after the one above it. At 0 they all arrive together. A group
  inside another takes one turn in it, then staggers its own layers from
  there, and can play a different movement from the group around it; with
  none of its own, it plays the outer group's, and its sparkle shows that.
  With no entrance here, around it or in groups inside it, the stagger is
  off. Drag the layers inside a group to change who
  starts first; the timing follows the new order. Ungrouping keeps what
  everything plays.
- Choose a palette from the swatches above the canvas, and zoom with the
  controls next to them.
- Toggle `Grid` and `Include background` in the right panel, or upload your
  own background image. Uploading one sets the canvas to the image's shape
  (its long side at 1200), so a portrait photo shows whole instead of being
  cropped to a landscape strip. The bin button beside the file picker
  (`Remove background`) takes the image away again and leaves the palette's paper colour; the canvas keeps its
  size. (`Include background` off hides the paper colour as well.)
- `Canvas size` in the right panel switches the artboard between Landscape
  3:2 (1200 x 800, the default), Portrait 2:3, Square 1:1, Widescreen 16:9 and
  Story 9:16, or back to `Match background` after an upload. What is on the
  canvas keeps its place in the frame and only shrinks if it no longer fits,
  and templates are fitted to the current size. Each change is one undo step.
- Use the toolbar to randomize, restart the current template, undo/redo, and
  export. Exports hold the artwork only: selection outlines, the rotate and
  resize handles, and the alignment toolbar stay in the editor.
- `Export` opens one dialog with every format in it: SVG, PNG at three sizes,
  and GIF. When anything on the canvas has an entrance, the dialog says so —
  only SVG and GIF carry the animation, because a PNG is a single frame.
- The PNG sizes are `1x`, `2x` or `4x` of the artboard — on the default
  1200 x 800 frame that is 1200 x 800, 2400 x 1600 or 4800 x 3200 pixels. Every row in the dialog is a
  button that exports on the spot — there is nothing to select and nothing to
  confirm, and no size is marked as the current one. The SVG always writes the
  artboard size, and that file scales to any size wherever it is placed.
- Entrances travel with the SVG: the file animates when it is opened in a
  browser or embedded in a page. They are written as CSS that moves each item
  *away from* its own position and back, so a viewer that does not run CSS —
  and every PNG — shows the finished artwork rather than the first frame.
- The GIF plays the same entrances for anywhere that will not run an SVG. It
  is always the artboard's size (1200 x 800 by default), since a GIF stores every frame as its own picture, and
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
- On a laptop-sized screen, `Shortcuts` under the canvas lists every
  keyboard and pointer shortcut, naming `Cmd`/`Option` on a Mac and
  `Ctrl`/`Alt` elsewhere. Keys pressed while a dialog is open stay in the
  dialog; they never edit the canvas behind it.
- On a laptop-sized screen, `Feedback?` under the canvas opens a short form
  (bug, idea or other, a title and optional details). `Continue on GitHub`
  opens a new issue on this repository with it filled in, to check and submit
  there with a GitHub account. The homepage footer asks for feedback too,
  with the GitHub mark linking to the repository and a link to open an issue.

## Stack

- React
- Next.js
- Base UI
- Lucide React icons
- Supabase (optional: Google sign-in and account storage)
- ESLint + Prettier

## Project Structure

```text
app/                  Next.js routes: the landing page and /creator
src/
  components/         React components, App included
    templates/        one component per template, plus their layout helpers
  hooks/              React hooks: canvas items, history, export, keyboard,
                      sign-in and the account's canvases and symbols
  lib/                logic with no React state: animations, geometry,
                      groups, export markup, GIF encoding, persistence,
                      feedback links, rotation snapping, shortcut labels,
                      the Supabase client and account storage, SVG cleaning
  data/               palettes, templates, symbol marks, links and the
                      shortcuts list
  types/              shared types, and declarations for untyped packages
  styles.css          global styles
e2e/                  Playwright tests
supabase/migrations/  the database schema for accounts
```

Unit tests sit next to the file they cover (`groups.ts` and `groups.test.ts`).
