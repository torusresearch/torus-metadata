#!/usr/bin/env bash
set -euo pipefail

# Runs prdChangelog.sh against a temporary git repo, with PREV_SHA set so no GitHub API call happens.

script="$(cd "$(dirname "$0")" && pwd)/prdChangelog.sh"
repo=$(mktemp -d)
trap 'rm -r "$repo"' EXIT
cd "$repo"
git init -q -b master
git config user.email test@example.com
git config user.name test
git config commit.gpgsign false
unset GITHUB_OUTPUT

mkdir -p .changeset src
echo "# Changesets" > .changeset/README.md
echo a > src/app.ts
git add . && git commit -qm "chore: base"
prod=$(git rev-parse HEAD)

printf -- '---\n"app": patch\n---\n\nFix the login\nredirect.\n' > .changeset/fix-login.md
echo b > src/app.ts
git add . && git commit -qm "fix: login redirect"
printf -- '---\n"app": patch\n---\n\nFix logout.\n' > .changeset/fix-logout.md
git add . && git commit -qm "fix: logout"
printf -- '---\n"app": patch\n---\n\nFix logout on Safari.\n' > .changeset/fix-logout.md
git add . && git commit -qm "docs: reword the logout entry"
echo "more" >> .changeset/README.md
git add . && git commit -qm "docs: changeset readme"

failures=0
check() { # check <name> <output> <expected substring> [absent]
  if [[ ("${4:-}" == absent && "$2" != *"$3"*) || ("${4:-}" != absent && "$2" == *"$3"*) ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1"
    failures=$((failures + 1))
  fi
}

out=$(PREV_SHA="$prod" "$script" HEAD)
check "lists the changeset text on one line" "$out" "- Fix the login redirect. (\`.changeset/fix-login.md\`)"
check "lists the commits since production" "$out" "fix: login redirect"
check "does not list the production commit" "$out" "chore: base" absent
check "skips the changeset README" "$out" "README.md" absent
check "shows the edited text of an entry" "$out" "- Fix logout on Safari. (\`.changeset/fix-logout.md\`)"
check "does not show the old text of an edited entry" "$out" "- Fix logout. (" absent

out=$(PREV_SHA="$(git rev-parse HEAD)" "$script" HEAD)
check "nothing new after production" "$out" "- No changeset entries."

out=$(PREV_SHA="" "$script" HEAD)
check "no production deployment yet" "$out" "No production deployment found"

out=$(PREV_SHA="0123456789abcdef0123456789abcdef01234567" "$script" HEAD)
check "a production commit not in the clone falls back" "$out" "which is not in this clone"

out=$(PREV_SHA="$prod" TITLE="Changes in this PR" "$script" HEAD)
check "custom title" "$out" "### Changes in this PR"

# An npm release PR runs `changeset version`, which deletes the entry before production deploys.
git rm -q .changeset/fix-login.md .changeset/fix-logout.md && git commit -qm "chore: release packages"
out=$(PREV_SHA="$prod" "$script" HEAD)
check "an entry consumed by changeset version is still listed" "$out" "- Fix the login redirect. (\`.changeset/fix-login.md\`)"
check "a consumed entry shows its edited text" "$out" "- Fix logout on Safari. (\`.changeset/fix-logout.md\`)"

exit $((failures > 0))
