#!/usr/bin/env bash
set -euo pipefail

# Fails when the PR changes a file that is not on the allowlist and adds no .changeset/*.md entry.
# NO_CHANGESET_PATHS is an extended regex of the paths that need no changeset (docs, CI, tests).
# Every other path needs one, so a new kind of file fails the check until someone allowlists it.
# Usage: NO_CHANGESET_PATHS='^(docs/|\.github/)' changesetCheck.sh <base-ref>

base="${1:?usage: changesetCheck.sh <base-ref>}"
no_changeset_paths="${NO_CHANGESET_PATHS:?set NO_CHANGESET_PATHS to a regex of the paths that need no changeset}"

# .changeset/ itself never needs an entry.
needs_entry=$(git diff --name-only "$base...HEAD" | grep -vE '^\.changeset/' | grep -vE "$no_changeset_paths" || true)
entries=$(git diff --name-only --diff-filter=A "$base...HEAD" -- .changeset | grep -E '^\.changeset/.+\.md$' | grep -v '^\.changeset/README\.md$' || true)

if [[ -z "$needs_entry" ]]; then
  echo "Only allowlisted files changed. No changeset needed."
elif [[ -n "$entries" ]]; then
  echo "Changeset found: $entries"
else
  echo "::error::This PR changes files that need a changeset but adds none. Add one with 'changeset add'. If these files never need an entry, add them to NO_CHANGESET_PATHS; for a one-off, add the skip-changeset label."
  echo "Files that need a changeset:"
  echo "$needs_entry"
  exit 1
fi
