---
"torus-metadata": major
---

Move to the 2026 Q4 stack (EMBED-609).

- Require Node.js `>=24.22.3 <25 || >=26.13.1` and npm `>=12`. `.nvmrc` is 26.13.1.
- Use `@toruslabs/metadata-helpers@9`, `@toruslabs/eccrypto@8`, `@toruslabs/loglevel-sentry@10`, and `@sentry/node@11`.
- Turn off the Sentry 11 default collection of HTTP bodies, database query data, user info, and cookies.
- Replace ESLint and Prettier with the Oxlint Node preset and `formatPreset()` through Vite+. Replace `tsx` with `vpx` and `vite-plus/register`.
- Use TypeScript 7 and the `@toruslabs/config@5` Node profile, with `strictNullChecks`.
- Remove the direct `@babel/runtime` dependency. The server code does not import it. `@toruslabs/http-helpers` still installs it.
- Build the Docker images on Node.js 24.22.3 with npm 12 and run them as the `node` user. The production image has a health check on `/health`.
