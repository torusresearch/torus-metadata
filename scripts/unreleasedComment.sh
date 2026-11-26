#!/usr/bin/env bash
set -euo pipefail

# Comment on the pull request.
# The comment lists changesets merged but not in production yet, and the changesets in this pull request.

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
base_ref="${BASE_REF:?set BASE_REF}"
pr="${PR_NUMBER:?set PR_NUMBER}"
repo="${GITHUB_REPOSITORY:?set GITHUB_REPOSITORY}"
marker="<!-- unreleased-changes -->"
base="origin/${base_ref}"

print_entries() {
  local tree="$1"
  local files="$2"
  if [[ -z "$files" ]]; then
    echo "_None._"
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

changeset_files() {
  local range="$1"
  git diff --name-only --diff-filter=A "$range" -- .changeset \
    | grep -E '^\.changeset/.+\.md$' \
    | grep -v '^\.changeset/README\.md$' || true
}

prev_sha=$("$root/scripts/lastProductionSha.sh" || true)
note=$(mktemp)

{
  echo "$marker"
  echo "## Merged, not in production yet"
  echo
  if [[ -n "$prev_sha" ]]; then
    files=$(changeset_files "${prev_sha}..${base}")
    print_entries "$base" "$files"
  else
    echo "_No previous production deployment found — showing last 20 commits on ${base_ref}._"
    echo
    echo '```'
    git log --oneline -20 "$base"
    echo '```'
  fi
  echo
  echo "## In this pull request"
  echo
  files=$(changeset_files "${base}...HEAD")
  print_entries "HEAD" "$files"
} > "$note"

payload=$(mktemp)
jq -n --rawfile body "$note" '{body:$body}' > "$payload"

existing=$(gh api "repos/${repo}/issues/${pr}/comments?per_page=100" \
  --jq "first(.[] | select(.body | contains(\"${marker}\")) | .id) // empty")

if [[ -n "$existing" ]]; then
  gh api -X PATCH "repos/${repo}/issues/comments/${existing}" --input "$payload" > /dev/null
else
  gh api -X POST "repos/${repo}/issues/${pr}/comments" --input "$payload" > /dev/null
fi
