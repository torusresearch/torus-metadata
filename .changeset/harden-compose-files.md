---
"torus-metadata": patch
---

Harden the Docker Compose services for KICS checks.

- Run the Redis and MySQL services as their own users, with `no-new-privileges` and all Linux capabilities dropped.
- Bind the Redis and MySQL ports, and the dev service port, to `127.0.0.1`.
- Add a `/health` health check to the dev and CI service containers.
