# Changesets

This service publishes nothing. The changeset entries are the production changelog. CI does not run `changeset version`.

Add a changeset when a pull request changes what ships: `npx changeset`. That includes source, the Dockerfile, build config, and dependencies.

The `changeset` check requires an entry unless every changed file is on the allowlist in `.github/workflows/changeset.yml`. Docs, CI, and tests need no entry. Dependabot pull requests and pull requests with the `skip-changeset` label need none.

`npm run version-packages` bumps the version locally. No workflow runs it.
