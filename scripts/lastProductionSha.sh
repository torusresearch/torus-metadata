#!/usr/bin/env bash
set -euo pipefail

# Print the SHA of the latest successful deployment for ENVIRONMENT.
# Skip GITHUB_SHA so the release job still sees the previous production deploy.
# The lookup matches va-mmcx-authentication-api service.yaml (prd-changelog).

environment="${ENVIRONMENT:-production}"
repo="${GITHUB_REPOSITORY:?set GITHUB_REPOSITORY}"
skip="${GITHUB_SHA:-}"

deployments=$(gh api "/repos/${repo}/deployments?environment=${environment}&per_page=10")
while IFS= read -r id; do
  [[ -z "$id" ]] && continue
  state=$(gh api "/repos/${repo}/deployments/${id}/statuses?per_page=1" | jq -r '.[0].state // empty')
  if [[ "$state" != "success" ]]; then
    continue
  fi
  sha=$(echo "$deployments" | jq -r --argjson id "$id" '.[] | select(.id == $id) | .sha')
  if [[ -n "$sha" && "$sha" != "$skip" && "$sha" != "null" ]]; then
    printf '%s\n' "$sha"
    exit 0
  fi
done < <(echo "$deployments" | jq -r '.[].id')
