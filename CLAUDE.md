# Micrographics Creator — agent workflow

Next.js 16 + React 19 + TypeScript app (see README.md for stack/setup).

## Testing

- Unit tests: Jest + React Testing Library. Run `npm run test`.
- E2E tests: Playwright, in `e2e/`. Run `npm run test:e2e` (spins up its own dev
  server on port 3100).
- Typecheck: `npm run typecheck`. `npm run build` also typechecks.
- Lint: ESLint. Run `npm run lint`. The config is flat config in
  `eslint.config.mjs` (`next lint` was removed in Next 16), built from
  `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`,
  which bring the React Hooks rules with them. The script uses
  `--max-warnings 0`, so a warning fails the run like an error does.
- Formatting: Prettier, configured in `.prettierrc.json` to match the style
  already in the tree. `eslint-config-prettier` is applied last in the ESLint
  config so ESLint never enforces formatting. `npm run format -- <paths>`
  formats the files you name; the repository is not Prettier-formatted end to
  end, so there is no repo-wide format check and CI does not run one.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, unit tests and
  the Playwright suite on every PR and on push to `main`. Treat a PR as
  mergeable only once CI is green.
- Suppressing a lint rule is a targeted `eslint-disable-next-line` with a
  comment saying why. Never turn a rule off across the project to get a clean
  run.

## Keep tests and docs current

Every change ships with its tests and docs updated in the same PR — not as a
follow-up. Specifically:

- **Changed logic** → add or update its Jest test. **Changed user-visible
  behavior or navigation** → add or update a Playwright test in `e2e/`.
- **Added or edited a template** → `src/components/templates/overlap.test.ts`
  covers every template in `templateComponents` automatically, so a new one is
  tested the moment it is registered. Confirm it still passes, and render the
  template in a browser too: that test catches collisions and off-canvas
  items, not whether the design reads well.
- **Changed what a control is called, where it lives, or what the app does** →
  update `README.md` in the same change. Its "Basic Use" section names real
  controls, so renaming or moving one makes that section wrong.
- **Changed the stack, scripts, or workflow** → update this file and the
  README's Setup/Testing sections to match.

## Fixing a GitHub issue end-to-end

When asked to resolve a GitHub issue in this repo, follow this pipeline:

1. **Plan.** Read the full issue (and comments). Confirm the root cause and
   scope before writing code.
2. **Implement.** Make the smallest change that fixes the issue. Add or
   update Jest unit tests for the changed logic, and add/update a Playwright
   e2e test in `e2e/` if the change affects user-visible behavior or
   navigation.
3. **Test & review gate.** Before opening a PR, spawn a subagent (Agent tool)
   whose only job is to test and review the diff — not to implement further:
   - Run `npm run typecheck`, `npm run test`, and `npm run test:e2e`, and
     report pass/fail with output.
   - Review the diff for correctness bugs (use the `code-review` skill).
   - Report a clear pass/fail verdict plus any findings.
   If it reports a failure or a blocking finding, fix it yourself and repeat
   this step. Do not open a PR until this subagent reports a clean pass.
4. **Open the PR.** Push the branch and open a PR that references the issue
   (`Closes #<n>`). Subscribe to PR activity on it.
5. **Drive to green.** Treat CI failures and review comments on this PR as
   yours to fix, per the standard PR-babysitting rules, until CI is green and
   there are no unresolved blocking review comments.
6. **Merge.** Once CI is green and review is clean, merge the PR.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
