---
"torus-metadata": patch
---

Align the backend setup with broadcast-channel-server.

- Require the Node.js security releases: `>=24.22.3 <25 || >=26.13.1`. Docker images use 24.22.3. CI tests 24.22.3 and 26.13.1. `.nvmrc` uses 26.13.1.
- Keep the redis v5 client behavior on redis 6: RESP2 replies and no command timeout.
- `Dockerfile.dev` no longer uses `COPY --chown` and has a `/health` healthcheck. The Docker build stage skips lifecycle scripts. `coverage/` and `dist/` stay out of the build context.
- Bump `vite-plus` to 1.7.0 and `@lavamoat/harden` to 0.9.0.
- Group Dependabot updates. Set the Changesets base branch to `develop`. Set the `main` field in `package.json` to `dist/index.js`.
