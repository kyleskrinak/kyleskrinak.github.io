#!/usr/bin/env bash
#
# Deploy the Redirect_Trailing_Slash CloudFront Function.
#
#   ./infra/cloudfront/deploy.sh              # safe half: snapshot, stage, test. Stops there.
#   ./infra/cloudfront/deploy.sh --publish    # same, then promote DEVELOPMENT -> LIVE.
#
# Publishing is opt-in on purpose. This function sits at viewer-request on the
# distribution serving the whole site, so a malformed version breaks every
# request, and the credentials that can publish it are unrestricted admin.
# Running with no flag exercises the full pipeline against the DEVELOPMENT
# stage without touching production, which is what you want almost every time.
#
# Every run writes the current LIVE source to infra/cloudfront/.rollback/ before
# changing anything. To roll back, copy that file over redirect-trailing-slash.js
# and re-run with --publish.
set -euo pipefail

FUNCTION_NAME="Redirect_Trailing_Slash"
DISTRIBUTION_ID="E1YF7GVLAW8XON"   # kyle.skrinak.com

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$HERE/redirect-trailing-slash.js"
CASES="$HERE/test-cases.json"
ROLLBACK_DIR="$HERE/.rollback"

PUBLISH=0
case "${1:-}" in
  "")         PUBLISH=0 ;;
  --publish)  PUBLISH=1 ;;
  *) echo "unknown argument: $1 (expected --publish or nothing)" >&2; exit 2 ;;
esac

for tool in aws jq; do
  command -v "$tool" >/dev/null || { echo "required tool not found: $tool" >&2; exit 1; }
done
[ -f "$SOURCE" ] || { echo "missing $SOURCE" >&2; exit 1; }
[ -f "$CASES" ]  || { echo "missing $CASES" >&2; exit 1; }

# The published source is capped at 10 KB, comments included.
SIZE=$(wc -c < "$SOURCE" | tr -d ' ')
if [ "$SIZE" -gt 10240 ]; then
  echo "source is ${SIZE} bytes, over the 10240-byte CloudFront Functions limit" >&2
  exit 1
fi
echo "function:     $FUNCTION_NAME"
echo "distribution: $DISTRIBUTION_ID (viewer-request)"
echo "source:       ${SIZE} bytes (limit 10240)"

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
if [ "$PUBLISH" -ne 1 ]; then
  echo
  echo "Not publishing (no --publish). Re-run with --publish to promote to LIVE."
  exit 0
fi

echo
echo "publishing to LIVE..."
aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$DEV_ETAG" >/dev/null
echo "published. Viewer-request functions run ahead of the cache, so this is"
echo "effective immediately with no invalidation."

# ------------------------------------------------------- verify against prod ---
echo
echo "verifying against production:"
PROD_FAILED=0
for i in $(seq 0 $((COUNT - 1))); do
  URI=$(jq -r ".[$i].uri" "$CASES")
  STATUS_WANT=$(jq -r ".[$i].expect.status // \"\"" "$CASES")
  LOC_WANT=$(jq -r ".[$i].expect.location // \"\"" "$CASES")

  read -r CODE LOC < <(curl -sS -o /dev/null --path-as-is --max-time 20 \
      -w '%{http_code} %{redirect_url}' "https://kyle.skrinak.com${URI}"; echo)

  if [ -n "$STATUS_WANT" ]; then
    # curl reports redirect_url absolute; compare the path portion.
    LOC_PATH="${LOC#https://kyle.skrinak.com}"
    if [ "$CODE" = "$STATUS_WANT" ] && [ "$LOC_PATH" = "$LOC_WANT" ]; then
      printf '  PASS  %-70s %s -> %s\n' "$URI" "$CODE" "$LOC_PATH"
    else
      PROD_FAILED=$((PROD_FAILED + 1))
      printf '  FAIL  %-70s want %s %s, got %s %s\n' "$URI" "$STATUS_WANT" "$LOC_WANT" "$CODE" "$LOC_PATH"
    fi
  else
    # Pass-through cases should serve content, not redirect.
    if [ "$CODE" = "200" ]; then
      printf '  PASS  %-70s 200\n' "$URI"
    else
      PROD_FAILED=$((PROD_FAILED + 1))
      printf '  FAIL  %-70s want 200, got %s\n' "$URI" "$CODE"
    fi
  fi
done

echo
if [ "$PROD_FAILED" -ne 0 ]; then
  echo "$PROD_FAILED production checks failed after publish."
  echo "ROLL BACK: cp \"$ROLLBACK\" \"$SOURCE\" && \"$0\" --publish"
  exit 1
fi
echo "all production checks passed."
