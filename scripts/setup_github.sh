#!/usr/bin/env bash
# Configura una sola vez los ambientes de GitHub y la protección de main.
# Requiere `gh` con permisos de admin sobre el repo.
#
#   PROD_REVIEWERS="usuario1 usuario2" scripts/setup_github.sh
#
# PROD_REVIEWERS: quiénes pueden aprobar el paso de stage a producción.
set -euo pipefail

REPO="${REPO:-JosephChomboM/ayni-digital-startup}"
: "${PROD_REVIEWERS:?Define PROD_REVIEWERS con los usuarios que aprueban producción}"

reviewers_json=$(for user in $PROD_REVIEWERS; do
  gh api "users/$user" --jq '{type: "User", id: .id}'
done | jq -s .)

only_main() {
  gh api -X POST "repos/$REPO/environments/$1/deployment-branch-policies" \
    -f name=main -f type=branch --silent || true
}

echo "→ Ambiente localhost (tests de integración en CI)"
gh api -X PUT "repos/$REPO/environments/localhost" --silent

echo "→ Ambiente stage (deploy automático al mergear a main)"
gh api -X PUT "repos/$REPO/environments/stage" --input - --silent <<JSON
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
only_main stage

echo "→ Ambiente production (requiere aprobación)"
gh api -X PUT "repos/$REPO/environments/production" --input - --silent <<JSON
{
  "prevent_self_review": true,
  "reviewers": $reviewers_json,
  "deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}
}
JSON
only_main production

echo "→ Ruleset de main (PR obligatorio, 1 aprobación, CI OK en verde)"
gh api -X POST "repos/$REPO/rulesets" --input - --silent <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"], "exclude": []}},
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [{"context": "CI OK"}]
      }
    }
  ]
}
JSON

echo "✓ Listo. Falta cargar en stage y production: secret RAILWAY_TOKEN y las variables"
echo "  RAILWAY_ENVIRONMENT, RAILWAY_API_SERVICE, RAILWAY_WEB_SERVICE, API_URL, WEB_URL."
