---
description: "Use when building, deploying, troubleshooting CodeGraph, reindexing semantic search, or verifying XFlex workspace indexing and deploy workflows."
name: "XFlex Ops and CodeGraph"
---

# XFlex Ops and CodeGraph

- Frontend build uses the root `vite.config.ts`: `npx vite build`.
- Frontend deploy: `npx wrangler pages deploy dist/public --project-name xflexacademy --branch main`.
- Worker build and deploy: `npm run build:worker` then `wrangler deploy dist/worker.js --config wrangler-worker.toml --env production`.
- Combined worker shortcut: `npm run deploy:worker`.
- Batch at least five fixes before building and deploying; do not redeploy after every small change.
- Prefer `codegraph_*` tools over raw search for code analysis when graph coverage exists.
- A `codegraph.reindexWorkspace returned null` tool error can still coincide with successful backend reindexing if the logs show `Workspace reindexed` and symbol queries work afterward.
- Parse warnings at `0:0` on otherwise clean TS/TSX files are usually CodeGraph parser limitations, not real TypeScript errors. Verify with diagnostics plus a direct symbol query.
- Useful verification pattern after reindex: search for a newly changed symbol, then request symbol info or edit context for it.