---
description: "Use when building, deploying, troubleshooting CodeGraph, reindexing semantic search, or verifying XFlex workspace indexing and deploy workflows."
name: "XFlex Ops and CodeGraph"
---

# XFlex Ops and CodeGraph

- Activate the approved Node runtime before installs/checks/builds: on Windows, `. .\scripts\use-project-node.ps1` (first use adds `-Install`); elsewhere use `.node-version`. Run `pnpm security:runtime`. See `docs/security-node-runtime.md`; direct CLI commands bypass package-script runtime guards.
- Frontend build uses the root `vite.config.ts` through the guarded `pnpm build` command.
- Frontend deploy: `pnpm deploy:pages` after preparing the intended production artifact; this includes the runtime preflight.
- Worker build and deploy: `npm run build:worker` then `wrangler deploy dist/worker.js --config wrangler-worker.toml --env production`.
- Combined worker shortcut: `npm run deploy:worker`.
- Staging deploy must use `npm run deploy:worker:staging`, which runs `security:staging-resources` before building or deploying. Do not bypass a failed preflight with a direct Wrangler command. See `docs/security-staging-isolation.md`; resource checks do not certify outbound integration or secret isolation.
- Local development defaults to loopback. Use `XFLEX_DEV_HOST` only for intentional network access; preserve Vite host and filesystem restrictions in middleware mode.
- Vitest 4 verification uses `pnpm test --maxWorkers=4`; `--minWorkers` is removed. Preserve test discovery, assertions and isolation during tooling updates, and keep explicitly enabled UI/API listeners private. See `docs/security-tooling-update.md` for migration evidence and remaining findings.
- Batch at least five fixes before building and deploying; do not redeploy after every small change.
- Prefer `codegraph_*` tools over raw search for code analysis when graph coverage exists.
- A `codegraph.reindexWorkspace returned null` tool error can still coincide with successful backend reindexing if the logs show `Workspace reindexed` and symbol queries work afterward.
- Parse warnings at `0:0` on otherwise clean TS/TSX files are usually CodeGraph parser limitations, not real TypeScript errors. Verify with diagnostics plus a direct symbol query.
- Useful verification pattern after reindex: search for a newly changed symbol, then request symbol info or edit context for it.
