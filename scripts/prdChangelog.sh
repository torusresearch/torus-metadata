#!/usr/bin/env bash
set -euo pipefail

# Prints, as Markdown, the changeset entries and commits that are in <to-ref> but not in production yet.
# The last production commit is the latest successful deployment to $PROD_ENVIRONMENT (GitHub Deployments API).
# Set PREV_SHA to skip that lookup (an empty PREV_SHA means "no production deployment yet").
# Writes prev=<sha> to $GITHUB_OUTPUT when it is set. Needs GH_TOKEN with deployments: read for the lookup.
# Usage: prdChangelog.sh <to-ref>

to=$(git rev-parse "${1:-HEAD}")
title="${TITLE:-Changes not in production yet}"

if [[ -z "${PREV_SHA+set}" ]]; then
  PREV_SHA=""
  # Every merge adds a production deployment that waits (one per region), so read all pages, newest first.
  for id in $(gh api --paginate "repos/${GITHUB_REPOSITORY}/deployments?environment=${PROD_ENVIRONMENT:-production}&per_page=100" --jq '.[].id'); do
    state=$(gh api "repos/${GITHUB_REPOSITORY}/deployments/${id}/statuses?per_page=1" --jq '.[0].state // empty')
    if [[ "$state" == success ]]; then
      PREV_SHA=$(gh api "repos/${GITHUB_REPOSITORY}/deployments/${id}" --jq .sha)
      break
    fi
  done
fi
[[ -n "${GITHUB_OUTPUT:-}" ]] && echo "prev=${PREV_SHA}" >> "$GITHUB_OUTPUT"

echo "### ${title}"
echo
# A production commit that is not in this clone (for example from a deleted branch) cannot be compared.
if [[ -n "$PREV_SHA" ]] && ! git cat-file -e "${PREV_SHA}^{commit}" 2>/dev/null; then
  echo "_Production runs \`${PREV_SHA:0:7}\`, which is not in this clone._"
  PREV_SHA=""
fi
if [[ -n "$PREV_SHA" ]]; then
  echo "\`${PREV_SHA:0:7}\` → \`${to:0:7}\`"
  # Walk the commits, not the two end points: `changeset version` (an npm release PR) deletes entries,
  # and an entry added and deleted inside the range would not show in a diff of the end points.
  entries=$(git log --reverse --diff-filter=A --name-only --format='commit %H' "$PREV_SHA..$to" -- .changeset)
  commits=$(git log --no-merges --oneline "$PREV_SHA..$to")
else
  echo "_No production deployment found. Showing the last 20 commits._"
  entries=""
  commits=$(git log --no-merges --oneline -20 "$to")
fi
echo
echo "**Changelog**"
echo
found=0
seen=" "
while read -r line; do
  case "$line" in
    "commit "*) commit="${line#commit }" ;;
    .changeset/README.md) ;;
    .changeset/*.md)
      [[ "$seen" == *" $line "* ]] && continue
      seen+="$line "
      # Read the latest text: from <to-ref> when the entry still exists, else from just before the commit
      # that deleted it (`changeset version`). Reading the adding commit would miss later edits.
      if git cat-file -e "$to:$line" 2>/dev/null; then
        source="$to"
      else
        source="$(git log -1 --format=%H "$PREV_SHA..$to" -- "$line")^"
      fi
      # The entry text is everything after the second '---' line.
      text=$(git show "$source:$line" | awk 'n >= 2 { print } /^---$/ { n++ }' | tr '\n' ' ' | sed 's/  */ /g; s/^ //; s/ $//')
      echo "- ${text} (\`${line}\`)"
      found=1
      ;;
  esac
done <<<"$entries"
[[ $found -eq 0 ]] && echo "- No changeset entries."
echo
echo "**Commits**"
echo
echo '```'
echo "${commits:-No commits.}"
echo '```'
