#!/usr/bin/env bash
#
# Manage the Redirect_Trailing_Slash CloudFront Function.
#
#   ./infra/cloudfront/deploy.sh                    snapshot, stage, test. Stops there.
#   ./infra/cloudfront/deploy.sh --publish          same, then promote DEVELOPMENT -> LIVE.
#   ./infra/cloudfront/deploy.sh --verify           read-only: curl production. Mutates nothing.
#   ./infra/cloudfront/deploy.sh --list-rollbacks   show saved LIVE snapshots.
#   ./infra/cloudfront/deploy.sh --rollback FILE    republish a snapshot. Leaves the source alone.
#
# Publishing is opt-in on purpose. This function sits at viewer-request on the
# distribution serving the whole site, so a malformed version breaks every
# request, and the credentials that can publish it are unrestricted admin.
# Running with no flag exercises the full pipeline against the DEVELOPMENT
# stage without touching production, which is what you want almost every time.
#
#
# WHY --verify IS SEPARATE FROM --publish
#
# Three different questions get asked around a deploy, and only two of them
# have deterministic answers:
#
#   Is the logic correct?              test-function vs DEVELOPMENT   deterministic
#   Did the right bytes reach LIVE?    get-function --stage LIVE      deterministic
#   Has it propagated to the edge?     curl                           NOT deterministic
#
# publish-function returns when the control plane accepts the change, not when
# edge locations are serving it; propagation takes minutes. An earlier version
# of this script curled production on the line after publishing, so a correct
# deploy reported seven failures and printed a rollback command. Worse, that
# command was `cp SNAPSHOT SOURCE && deploy.sh --publish`, which would have
# overwritten the committed function source with the old version — regressing
# the repo's source of truth on the strength of a race condition.
#
# So: the publish path now asks only the question it can answer, by diffing the
# LIVE stage against the source. Production observation moved to --verify, which
# writes nothing, and whose failure means "not visible from this edge yet"
# rather than "the deploy is wrong". Rollback is a deliberate subcommand that
# never edits redirect-trailing-slash.js.
set -euo pipefail

FUNCTION_NAME="Redirect_Trailing_Slash"
DISTRIBUTION_ID="E1YF7GVLAW8XON"   # kyle.skrinak.com
SITE_ORIGIN="https://kyle.skrinak.com"
SIZE_LIMIT=10240                   # CloudFront Functions cap, comments included

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$HERE/redirect-trailing-slash.js"
CASES="$HERE/test-cases.json"
ROLLBACK_DIR="$HERE/.rollback"

usage() {
  sed -n '3,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

MODE="stage"
ROLLBACK_FROM=""
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --publish)        MODE="publish" ;;
    --verify)         MODE="verify" ;;
    --list-rollbacks) MODE="list" ;;
    --rollback)
      MODE="rollback"
      shift
      [ $# -gt 0 ] || { echo "--rollback needs a snapshot path" >&2; exit 2; }
      ROLLBACK_FROM="$1"
      ;;
    --yes|-y)         ASSUME_YES=1 ;;
    -h|--help)        usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; echo >&2; usage >&2; exit 2 ;;
  esac
  shift
done

command -v jq >/dev/null || { echo "required tool not found: jq" >&2; exit 1; }
[ -f "$CASES" ] || { echo "missing $CASES" >&2; exit 1; }

# --------------------------------------------------------------------------
# Production observation. Read-only: no AWS calls, no writes, no remedies.
# A failure here means the expected response was not visible from THIS client
# at THIS moment, which propagation delay satisfies just as well as a genuine
# defect. It is deliberately not wired to anything destructive.
# --------------------------------------------------------------------------
do_verify() {
  local count i uri status_want loc_want code loc loc_path failed=0
  count=$(jq 'length' "$CASES")
  echo "checking $count cases against $SITE_ORIGIN"
  echo

  for i in $(seq 0 $((count - 1))); do
    uri=$(jq -r ".[$i].uri" "$CASES")
    status_want=$(jq -r ".[$i].expect.status // \"\"" "$CASES")
    loc_want=$(jq -r ".[$i].expect.location // \"\"" "$CASES")

    read -r code loc < <(curl -sS -o /dev/null --path-as-is --max-time 20 \
        -w '%{http_code} %{redirect_url}' "${SITE_ORIGIN}${uri}"; echo)

    if [ -n "$status_want" ]; then
      loc_path="${loc#"$SITE_ORIGIN"}"
      if [ "$code" = "$status_want" ] && [ "$loc_path" = "$loc_want" ]; then
        printf '  ok    %-64s %s -> %s\n' "$uri" "$code" "$loc_path"
      else
        failed=$((failed + 1))
        printf '  MISS  %-64s want %s %s, saw %s %s\n' \
          "$uri" "$status_want" "$loc_want" "$code" "$loc_path"
      fi
    else
      # Pass-through cases should serve content, not redirect.
      if [ "$code" = "200" ]; then
        printf '  ok    %-64s 200\n' "$uri"
      else
        failed=$((failed + 1))
        printf '  MISS  %-64s want 200, saw %s\n' "$uri" "$code"
      fi
    fi
  done

  echo
  if [ "$failed" -ne 0 ]; then
    echo "$failed of $count not visible from here yet."
    echo
    echo "This is an observation, not a verdict. If you have just published,"
    echo "edge propagation is the usual cause — wait a few minutes and re-run."
    echo "To confirm what is actually published, compare the LIVE stage:"
    echo "  aws cloudfront get-function --name $FUNCTION_NAME --stage LIVE /tmp/live.js"
    echo "  diff /tmp/live.js $SOURCE"
    return 1
  fi
  echo "all $count visible on production."
  return 0
}

do_list() {
  if [ ! -d "$ROLLBACK_DIR" ] || [ -z "$(ls -A "$ROLLBACK_DIR" 2>/dev/null)" ]; then
    echo "no snapshots in ${ROLLBACK_DIR#"$PWD"/}"
    return 0
  fi
  echo "snapshots in ${ROLLBACK_DIR#"$PWD"/} (newest last):"
  local f
  for f in "$ROLLBACK_DIR"/*.js; do
    printf '  %-58s %6s bytes\n' "$(basename "$f")" "$(wc -c < "$f" | tr -d ' ')"
  done
}

# --------------------------------------------------------------------------
# Republish a saved snapshot. Never writes to $SOURCE — that was the defect
# this subcommand exists to replace. The repo's committed function stays
# exactly as it is; only the deployed function changes.
# --------------------------------------------------------------------------
do_rollback() {
  local snap="$ROLLBACK_FROM" size etag dev_etag reply
  command -v aws >/dev/null || { echo "required tool not found: aws" >&2; exit 1; }
  [ -f "$snap" ] || { echo "no such snapshot: $snap" >&2; exit 1; }
  size=$(wc -c < "$snap" | tr -d ' ')
  [ "$size" -gt 0 ] || { echo "snapshot is empty: $snap" >&2; exit 1; }
  if [ "$size" -gt "$SIZE_LIMIT" ]; then
    echo "snapshot is ${size} bytes, over the ${SIZE_LIMIT}-byte limit" >&2; exit 1
  fi
  # A snapshot came out of AWS, so it should always parse. If it does not, the
  # file is corrupt on disk and must not be published. Distinguish that from a
  # missing interpreter rather than reporting both as the same soft note.
  if command -v node >/dev/null; then
    node --check "$snap" >/dev/null || {
      echo "snapshot fails syntax check, refusing to publish: $snap" >&2; exit 1; }
  else
    echo "  note: node not present, skipping snapshot syntax check"
  fi

  echo "function:  $FUNCTION_NAME"
  echo "snapshot:  ${snap#"$PWD"/} (${size} bytes)"
  echo
  echo "This republishes the snapshot to LIVE. ${SOURCE#"$PWD"/} is NOT modified,"
  echo "so the repo keeps its current function source and the working tree stays clean."
  echo

  if [ "$ASSUME_YES" -ne 1 ]; then
    if [ ! -t 0 ]; then
      echo "Refusing to roll back non-interactively. Re-run with --yes if intended." >&2
      exit 1
    fi
    printf 'Publish this snapshot to LIVE? [y/N] '
    read -r reply
    case "$reply" in
      y|Y|yes|YES) ;;
      *) echo "aborted."; exit 1 ;;
    esac
  fi

  etag=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --stage DEVELOPMENT \
         --query 'ETag' --output text)
  dev_etag=$(aws cloudfront update-function \
    --name "$FUNCTION_NAME" --if-match "$etag" \
    --function-config "Comment=\"rollback to ${snap##*/}\",Runtime=\"cloudfront-js-1.0\"" \
    --function-code "fileb://$snap" --query 'ETag' --output text)
  aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$dev_etag" >/dev/null
  echo "rolled back. Edge propagation takes a few minutes;"
  echo "run '$0 --verify' once it settles (expect misses for anything the"
  echo "snapshot predates)."
}

case "$MODE" in
  verify)   do_verify; exit $? ;;
  list)     do_list;   exit 0  ;;
  rollback) do_rollback; exit 0 ;;
esac

# ======================= stage / publish path ==============================

command -v aws >/dev/null || { echo "required tool not found: aws" >&2; exit 1; }
[ -f "$SOURCE" ] || { echo "missing $SOURCE" >&2; exit 1; }

SIZE=$(wc -c < "$SOURCE" | tr -d ' ')
if [ "$SIZE" -gt "$SIZE_LIMIT" ]; then
  echo "source is ${SIZE} bytes, over the ${SIZE_LIMIT}-byte CloudFront Functions limit" >&2
  exit 1
fi
echo "function:     $FUNCTION_NAME"
echo "distribution: $DISTRIBUTION_ID (viewer-request)"
echo "source:       ${SIZE} bytes (limit ${SIZE_LIMIT})"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------- snapshot ---
mkdir -p "$ROLLBACK_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ROLLBACK="$ROLLBACK_DIR/${FUNCTION_NAME}.LIVE.${STAMP}.js"
aws cloudfront get-function --name "$FUNCTION_NAME" --stage LIVE "$ROLLBACK" >/dev/null
echo "rollback snapshot: ${ROLLBACK#"$PWD"/}"

if diff -q "$ROLLBACK" "$SOURCE" >/dev/null 2>&1; then
  echo "LIVE already matches this source; nothing to deploy."
  exit 0
fi

# ------------------------------------------------------------------- stage ---
# Read the ETag from DEVELOPMENT, not LIVE. They match on a clean function, but
# once anything has been staged the DEVELOPMENT ETag advances while LIVE's stays
# put — so a second run after a failed test would send a stale ETag and get
# PreconditionFailed. DEVELOPMENT is the mutable stage; its ETag is the current one.
ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --stage DEVELOPMENT \
       --query 'ETag' --output text)

DEV_ETAG=$(aws cloudfront update-function \
  --name "$FUNCTION_NAME" \
  --if-match "$ETAG" \
  --function-config 'Comment="trailing-slash canonicalization + legacy URL redirect map",Runtime="cloudfront-js-1.0"' \
  --function-code "fileb://$SOURCE" \
  --query 'ETag' --output text)
echo "staged to DEVELOPMENT (etag $DEV_ETAG)"

# -------------------------------------------------------------------- test ---
FAILED=0
COUNT=$(jq 'length' "$CASES")
echo
echo "running $COUNT cases against DEVELOPMENT:"

for i in $(seq 0 $((COUNT - 1))); do
  URI=$(jq -r ".[$i].uri" "$CASES")
  WHY=$(jq -r ".[$i].why" "$CASES")

  jq -n --arg uri "$URI" '{
    version: "1.0",
    context: { eventType: "viewer-request" },
    viewer:  { ip: "203.0.113.1" },
    request: { method: "GET", uri: $uri, headers: {}, querystring: {}, cookies: {} }
  }' > "$TMP/event.json"

  RESULT=$(aws cloudfront test-function \
    --name "$FUNCTION_NAME" --if-match "$DEV_ETAG" --stage DEVELOPMENT \
    --event-object "fileb://$TMP/event.json" --output json)

  ERR=$(printf '%s' "$RESULT" | jq -r '.TestResult.FunctionErrorMessage // ""')
  OUT=$(printf '%s' "$RESULT" | jq -r '.TestResult.FunctionOutput // "{}"')

  if [ -n "$ERR" ]; then
    GOT="ERROR $ERR"
  elif [ "$(printf '%s' "$OUT" | jq 'has("response")')" = "true" ]; then
    GOT="$(printf '%s' "$OUT" | jq -r '"\(.response.statusCode) \(.response.headers.location.value // "")"')"
  else
    GOT="pass $(printf '%s' "$OUT" | jq -r '.request.uri')"
  fi

  WANT=$(jq -r ".[$i].expect | if has(\"status\") then \"\(.status) \(.location)\" else \"pass \(.passthrough)\" end" "$CASES")

  if [ "$GOT" = "$WANT" ]; then
    printf '  PASS  %s\n' "$URI"
  else
    FAILED=$((FAILED + 1))
    printf '  FAIL  %s\n        want: %s\n        got:  %s\n        why:  %s\n' \
      "$URI" "$WANT" "$GOT" "$WHY"
  fi
done

echo
if [ "$FAILED" -ne 0 ]; then
  echo "$FAILED of $COUNT cases failed. DEVELOPMENT stage holds the bad version;"
  echo "LIVE is untouched. Fix $SOURCE and re-run."
  exit 1
fi
echo "$COUNT/$COUNT passed against DEVELOPMENT. LIVE is still unchanged."

# ----------------------------------------------------------------- publish ---
if [ "$MODE" != "publish" ]; then
  echo
  echo "Not publishing (no --publish). Re-run with --publish to promote to LIVE."
  exit 0
fi

echo
echo "publishing to LIVE..."
aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$DEV_ETAG" >/dev/null

# The only post-publish question this script can answer deterministically:
# did the intended bytes land on the LIVE stage? Edge propagation is a separate
# concern, observed later with --verify.
aws cloudfront get-function --name "$FUNCTION_NAME" --stage LIVE "$TMP/live.js" >/dev/null
if ! diff -q "$TMP/live.js" "$SOURCE" >/dev/null 2>&1; then
  echo "PUBLISH MISMATCH: the LIVE stage does not match $SOURCE." >&2
  echo "Diff against ${ROLLBACK#"$PWD"/} to see what is deployed." >&2
  exit 1
fi
echo "published. LIVE stage now byte-identical to ${SOURCE#"$PWD"/}."
echo
echo "Edge propagation takes a few minutes. Confirm production separately:"
echo "  $0 --verify"
