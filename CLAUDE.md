# Micrographics Creator — agent workflow

Next.js 15 + React 19 + TypeScript app (see README.md for stack/setup).

## Testing

- Unit tests: Jest + React Testing Library. Run `npm run test`.
- E2E tests: Playwright, in `e2e/`. Run `npm run test:e2e` (spins up its own dev
  server on port 3100).
- Typecheck: `npm run typecheck`. `npm run build` also typechecks.
- CI (`.github/workflows/ci.yml`) runs all of the above on every PR and on
  push to `main`. Treat a PR as mergeable only once CI is green.

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
