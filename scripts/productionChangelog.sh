#!/usr/bin/env bash
set -euo pipefail

# Write the production changelog to stdout.
# The deployment lookup is the prd-changelog job from va-mmcx-authentication-api.
# Changeset entries are the changelog when a previous production deploy exists.

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
head_sha="${GITHUB_SHA:?set GITHUB_SHA}"
prev_sha=$("$root/scripts/lastProductionSha.sh" || true)

echo "## Changes queued for production"
echo

print_entries() {
  local tree="$1"
  local files="$2"
  if [[ -z "$files" ]]; then
    echo "_No changeset entries in this range._"
    return
  fi
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    echo "### ${file}"
    echo
    git show "${tree}:${file}"
    echo
  done <<< "$files"
}

if [[ -n "$prev_sha" ]]; then
  echo "Comparing \`${prev_sha:0:7}\` → \`${head_sha:0:7}\`"
  echo
  files=$(git diff --name-only --diff-filter=A "${prev_sha}".."${head_sha}" -- .changeset \
    | grep -E '^\.changeset/.+\.md$' \
    | grep -v '^\.changeset/README\.md$' || true)
  print_entries "$head_sha" "$files"
else
  echo "_No previous production deployment found — showing last 20 commits_"
  echo
  echo '```'
  git log --oneline -20
  echo '```'
fi
