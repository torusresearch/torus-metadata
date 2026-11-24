---
"torus-metadata": patch
---

Harden the service and bump deps that EMBED-609 deferred.

- Add per-IP rate limiting at 300 requests per minute. Requests with a valid Torus node `x-web3-api-key` and requests to `/health` skip the limit. The limit counts per process, so it does not hold across instances.
- Set CORS `credentials` to `false`.
- Group `/bulk_set` shares by DB table with a `Map` instead of a plain object keyed by `tableName`.
- Bump `celebrate` 16, `dotenv` 18, `ioredis` 6, `redis` 6, and `js-sha3` 0.16. Add `express-rate-limit` and `lint-staged`.
- Use the Husky v9 pre-commit hook format.
