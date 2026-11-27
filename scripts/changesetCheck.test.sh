#!/usr/bin/env bash
set -euo pipefail

# Runs changesetCheck.sh against a temporary git repo and checks when it requires a changeset.

check_script="$(cd "$(dirname "$0")" && pwd)/changesetCheck.sh"
repo=$(mktemp -d)
trap 'rm -r "$repo"' EXIT
cd "$repo"
git init -q -b master
git config user.email test@example.com
git config user.name test
# The developer's global config can require signed commits; the test needs none.
git config commit.gpgsign false
export NO_CHANGESET_PATHS='^(docs/|\.github/)|(^|/)__tests__/|\.test\.ts$'

mkdir -p src/__tests__ .changeset docs
echo "# Changesets" > .changeset/README.md
echo "a" > src/app.ts
echo "t" > src/__tests__/app.test.ts
git add . && git commit -qm base

failures=0
# expect <name> <pass|fail>; runs on the current branch against master
expect() {
  local status=0
  "$check_script" master >/dev/null 2>&1 || status=$?
  if [[ ("$2" == pass && $status -eq 0) || ("$2" == fail && $status -ne 0) ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1: expected $2, exit $status"
    failures=$((failures + 1))
  fi
}
branch() { git switch -q master && git switch -q -c "$1"; }

branch docs-only
echo "x" > docs/guide.md && git add . && git commit -qm docs
expect "allowlisted docs need no changeset" pass

branch test-only
echo "t2" > src/__tests__/app.test.ts && git add . && git commit -qm test
expect "allowlisted tests under src/ need no changeset" pass

branch source-no-entry
echo "b" > src/app.ts && git add . && git commit -qm code
expect "source change without a changeset" fail

branch source-with-entry
echo "b" > src/app.ts && printf -- '---\n"app": patch\n---\n\nFix.\n' > .changeset/fix.md && git add . && git commit -qm code
expect "source change with a changeset" pass

branch unlisted-file
echo '{}' > tsconfig.json && git add . && git commit -qm config
expect "a file not on the allowlist needs a changeset" fail

branch source-readme-only
echo "b" > src/app.ts && echo "more" >> .changeset/README.md && git add . && git commit -qm code
expect "a README edit is not a changeset" fail

branch changeset-readme-only
echo "more" >> .changeset/README.md && git add . && git commit -qm docs
expect "a .changeset/ edit alone needs no changeset" pass

exit $((failures > 0))
