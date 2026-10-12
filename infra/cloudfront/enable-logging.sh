#!/usr/bin/env bash
#
# Manage CloudFront standard (access) logging for kyle.skrinak.com.
#
#   ./infra/cloudfront/enable-logging.sh             plan: show current state and what --apply would change. Read-only.
#   ./infra/cloudfront/enable-logging.sh --apply     create/configure the log bucket, then enable logging on the distribution.
#   ./infra/cloudfront/enable-logging.sh --disable   turn logging off on the distribution. Leaves the bucket and its logs.
#   ./infra/cloudfront/enable-logging.sh --verify    read-only: confirm bucket + distribution settings and list recent log files.
#   Add --yes to --apply or --disable to skip the confirmation prompt (required when not on a terminal).
#
# Environment overrides: LOG_BUCKET, LOG_PREFIX, LOG_RETENTION_DAYS.
#
# WHY THIS EXISTS
#
# In Oct 2026 Search Console failed validation of "Redirect error" for five
# legacy URLs, each of which answers a clean single-hop 301 to a live page:
#
#   /year-archive/
#   /lchf/don-t-you-miss-carbs
#   /lchf/my-first-lchf-post
#   /personal/lorraine-barbara-kubik-skrinak/
#   /code-presentation/
#
# Crawl stats confirmed Googlebot received the 301s, but with logging off
# there was no server-side record of what each request looked like, so the
# report could be neither confirmed nor refuted. These logs are that record.
# Background only: GitHub issue #376 covers the earlier Search Console
# remediation that added these redirects. It does not track this logging.
#
# Logging is temporary. It went on 2026-10-12 and comes off with --disable
# once the cause is found. Logs hold visitor IP addresses and user agents, so
# the bucket keeps them 30 days. Search Console data lags about 11 days, so
# pull the log lines for any request it flags as soon as it flags it.
#
# WHAT IT CHANGES
#
#   S3:          a dedicated bucket, never the site bucket. The deploy syncs the
#                site bucket, which would delete or publish log files.
#   CloudFront:  DistributionConfig.Logging only. The update is the config as
#                read, with .Logging replaced by jq. A backstop check refuses to
#                send it if anything outside .Logging changed in that step; it
#                compares jq output to jq output, so it cannot see a change jq
#                would make to both sides alike.
#
# Every step is idempotent: re-running --apply against a configured account
# makes no changes and says so.
#
# The bucket has ACLs enabled (ObjectOwnership=BucketOwnerPreferred) because
# CloudFront standard logging delivers through the awslogsdelivery account's
# ACL grant, which CloudFront adds to the bucket when logging is enabled.
# If that grant later goes missing, --apply adds it back, since CloudFront
# re-adds it only while changing .Logging. Public access stays fully blocked;
# that grant is not public.
#
# REVERTING
#
# Use --disable, not the config snapshot in .rollback/. The snapshot is a full
# DistributionConfig; sending it back would also undo any unrelated change made
# to the distribution since. --disable edits .Logging alone, the same way
# --apply does. Disable logging before ever deleting the bucket: while
# logging points at a name nobody owns, anyone who claims that name and grants
# CloudFront write access receives the site's access logs. --disable leaves
# the awslogsdelivery grant on the bucket ACL; deleting the bucket removes it.
set -euo pipefail

DISTRIBUTION_ID="E1YF7GVLAW8XON"   # kyle.skrinak.com
SITE_ORIGIN="https://kyle.skrinak.com"
LOG_BUCKET="${LOG_BUCKET:-kyle-skrinak-com-cf-logs}"
LOG_PREFIX="${LOG_PREFIX:-kyle.skrinak.com/}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
BUCKET_REGION="us-east-1"
# Canonical user ID of the awslogsdelivery account (AWS-documented constant).
AWSLOGSDELIVERY_ID="c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d0"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROLLBACK_DIR="$HERE/.rollback"

usage() {
  sed -n '3,11p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

die() { echo "$*" >&2; exit 1; }

# Set by main from --yes|-y.
ASSUME_YES=0
# Set by report: how many items differ from the desired state.
REPORT_GAPS=0

confirm() {
  local prompt="$1" reply
  [ "$ASSUME_YES" -eq 1 ] && return 0
  if [ ! -t 0 ]; then
    echo "Refusing to change the distribution non-interactively. Re-run with --yes if intended." >&2
    exit 1
  fi
  printf '%s [y/N] ' "$prompt"
  read -r reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "aborted."; exit 1 ;;
  esac
}

# ------------------------------------------------------------------ checks ---
validate_settings() {
  case "$LOG_RETENTION_DAYS" in
    ''|*[!0-9]*) die "LOG_RETENTION_DAYS must be a positive integer, got '$LOG_RETENTION_DAYS'" ;;
  esac
  [ "$LOG_RETENTION_DAYS" -ge 1 ] || die "LOG_RETENTION_DAYS must be at least 1"
  # S3 bucket naming rules, restricted to what CloudFront logging accepts
  # (no dots: a dotted bucket name breaks the *.s3.amazonaws.com TLS wildcard).
  printf '%s' "$LOG_BUCKET" | grep -Eq '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' \
    || die "LOG_BUCKET '$LOG_BUCKET' is not a valid dot-free S3 bucket name"
  case "$LOG_PREFIX" in
    */) ;;
    *) die "LOG_PREFIX must end with '/', got '$LOG_PREFIX'" ;;
  esac
}

require_tools() {
  local t
  for t in aws jq; do
    command -v "$t" >/dev/null || die "required tool not found: $t"
  done
}

account_id() {
  aws sts get-caller-identity --query Account --output text
}

# Every S3 call pins the bucket's region rather than inheriting the profile's
# default, which may differ on another machine.
s3api() {
  aws s3api "$@" --region "$BUCKET_REGION"
}

# Run an AWS read command ($2...). On success print its output. When it fails
# with the error code $1 (the "never configured" error for that setting),
# return 3; pass '' for a read that has no such state. Any other failure is
# fatal: a denied or throttled read must not be taken for "not set" and lead
# to a write that replaces existing settings.
aws_read() {
  local absent="$1" err out msg
  shift
  err=$(mktemp)
  if out=$("$@" 2>"$err"); then
    rm -f "$err"; printf '%s' "$out"; return 0
  fi
  if [ -n "$absent" ] && grep -q "$absent" "$err"; then
    rm -f "$err"; return 3
  fi
  msg=$(tr -s '\n' ' ' < "$err"); rm -f "$err"
  die "$2 on $LOG_BUCKET failed:$msg"
}

# Prints "ours" or "missing". Any other outcome is fatal: an unexpected
# failure must not be read as "missing" and lead to a create.
bucket_state() {
  local acct="$1" out
  if out=$(s3api head-bucket --bucket "$LOG_BUCKET" \
             --expected-bucket-owner "$acct" 2>&1); then
    echo ours; return 0
  fi
  case "$out" in
    *"(404)"*) echo missing ;;
    *"(403)"*) die "head-bucket on $LOG_BUCKET returned 403: either another account owns it, or these credentials (account $acct) cannot read it. Choose another LOG_BUCKET or check credentials." ;;
    *) die "head-bucket on $LOG_BUCKET failed unexpectedly: $out" ;;
  esac
}

desired_logging_json() {
  jq -n --arg b "${LOG_BUCKET}.s3.amazonaws.com" --arg p "$LOG_PREFIX" \
    '{Enabled: true, IncludeCookies: false, Bucket: $b, Prefix: $p}'
}

# The shape CloudFront returns for a distribution that has never logged.
disabled_logging_json() {
  jq -n '{Enabled: false, IncludeCookies: false, Bucket: "", Prefix: ""}'
}

desired_lifecycle_json() {
  jq -n --argjson d "$LOG_RETENTION_DAYS" '{Rules: [{
    ID: "expire-access-logs",
    Status: "Enabled",
    Filter: {Prefix: ""},
    Expiration: {Days: $d},
    AbortIncompleteMultipartUpload: {DaysAfterInitiation: 1}
  }]}'
}

# Set .Logging to $1 (JSON) in a DistributionConfig on stdin; print the result.
# Pure function, unit-testable without AWS.
with_logging() {
  jq --argjson l "$1" '.Logging = $l'
}

# The grant CloudFront adds to the log bucket's ACL when logging is enabled.
delivery_grant_json() {
  jq -n --arg id "$AWSLOGSDELIVERY_ID" \
    '{Grantee: {Type: "CanonicalUser", ID: $id}, Permission: "FULL_CONTROL"}'
}

# Count delivery grants in a get-bucket-acl response on stdin. Only
# FULL_CONTROL counts: log delivery fails with a narrower grant.
delivery_grant_count() {
  jq --arg id "$AWSLOGSDELIVERY_ID" \
    '[(.Grants // [])[] | select(.Grantee.ID == $id and .Permission == "FULL_CONTROL")] | length'
}

# Add the delivery grant to a get-bucket-acl response on stdin, keeping every
# existing grant; print it as a put-bucket-acl policy. Pure, unit-testable.
with_delivery_grant() {
  local g
  g=$(delivery_grant_json) || return
  jq --argjson g "$g" '{Owner: .Owner, Grants: ((.Grants // []) + [$g])}'
}

# Backstop: the only difference between two DistributionConfigs is .Logging.
# Both sides pass through jq, so this catches a faulty transform, not jq itself.
# Callers use it in a || test, which turns set -e off, so a failed read returns
# non-zero explicitly; two empty strings would otherwise compare equal.
only_logging_differs() {
  local before after
  before=$(jq -S 'del(.Logging)' "$1") || return 1
  after=$(jq -S 'del(.Logging)' "$2") || return 1
  [ "$before" = "$after" ]
}

# ------------------------------------------------------- bucket inspection ---
# Each check prints "ok" or a short description of the gap, and exits non-zero
# when the read itself fails. Callers capture with a plain assignment
# (r=$(check_x)) so set -e stops the script on that failure; a capture inside
# [ ] or if would discard it. Bash turns set -e off inside $(...), so every
# step in a check that can fail ends in an explicit exit.
check_public_block() {
  local cfg all rc=0
  cfg=$(aws_read NoSuchPublicAccessBlockConfiguration s3api get-public-access-block \
          --bucket "$LOG_BUCKET" --query PublicAccessBlockConfiguration --output json) || rc=$?
  case "$rc" in 0) ;; 3) echo "not set"; return 0 ;; *) exit "$rc" ;; esac
  all=$(printf '%s' "$cfg" | jq '[.[]] | all') || exit
  [ "$all" = "true" ] && echo ok || echo "not fully blocked: $cfg"
}

check_ownership() {
  local own rc=0
  own=$(aws_read OwnershipControlsNotFoundError s3api get-bucket-ownership-controls \
          --bucket "$LOG_BUCKET" --query 'OwnershipControls.Rules[0].ObjectOwnership' --output text) || rc=$?
  case "$rc" in 0) ;; 3) echo "not set"; return 0 ;; *) exit "$rc" ;; esac
  [ "$own" = "BucketOwnerPreferred" ] && echo ok || echo "is $own"
}

check_lifecycle() {
  local cur want rc=0
  cur=$(aws_read NoSuchLifecycleConfiguration s3api get-bucket-lifecycle-configuration \
          --bucket "$LOG_BUCKET" --output json) || rc=$?
  case "$rc" in 0) ;; 3) echo "not set"; return 0 ;; *) exit "$rc" ;; esac
  # Keep Rules only: the response also carries top-level fields, such as
  # TransitionDefaultMinimumObjectSize, that the desired config does not set.
  cur=$(printf '%s' "$cur" | jq -S '{Rules: .Rules}') || exit
  want=$(desired_lifecycle_json | jq -S .) || exit
  [ "$cur" = "$want" ] && echo ok || echo "differs from desired ${LOG_RETENTION_DAYS}-day expiry"
}

check_delivery_grant() {
  local acl n
  acl=$(aws_read '' s3api get-bucket-acl --bucket "$LOG_BUCKET" --output json) || exit
  n=$(printf '%s' "$acl" | delivery_grant_count) || exit
  [ "$n" -gt 0 ] && echo ok || echo "absent (--apply adds it)"
}

# --------------------------------------------------------- bucket changes ---
ensure_bucket() {
  local acct="$1" state r
  state=$(bucket_state "$acct")
  case "$state" in
    missing)
      echo "  creating bucket $LOG_BUCKET in $BUCKET_REGION"
      # us-east-1 takes no LocationConstraint.
      s3api create-bucket --bucket "$LOG_BUCKET" \
        --object-ownership BucketOwnerPreferred >/dev/null
      s3api wait bucket-exists --bucket "$LOG_BUCKET" --expected-bucket-owner "$acct"
      ;;
    ours) echo "  bucket $LOG_BUCKET exists (owned by $acct)" ;;
  esac

  r=$(check_public_block)
  if [ "$r" = ok ]; then
    echo "  public access block: already set"
  else
    s3api put-public-access-block --bucket "$LOG_BUCKET" --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    echo "  public access block: set"
  fi

  r=$(check_ownership)
  if [ "$r" = ok ]; then
    echo "  object ownership: already BucketOwnerPreferred"
  else
    s3api put-bucket-ownership-controls --bucket "$LOG_BUCKET" \
      --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerPreferred}]'
    echo "  object ownership: set to BucketOwnerPreferred"
  fi

  r=$(check_lifecycle)
  if [ "$r" = ok ]; then
    echo "  lifecycle: already ${LOG_RETENTION_DAYS}-day expiry"
  else
    r=$(desired_lifecycle_json)
    s3api put-bucket-lifecycle-configuration --bucket "$LOG_BUCKET" \
      --lifecycle-configuration "$r" >/dev/null
    echo "  lifecycle: set to ${LOG_RETENTION_DAYS}-day expiry"
  fi
}

# CloudFront adds the delivery grant only while it changes .Logging, so a grant
# removed later stays missing with logging already on. Run after
# ensure_logging: add the grant if CloudFront has not.
ensure_delivery_grant() {
  local r acl policy
  r=$(check_delivery_grant)
  if [ "$r" = ok ]; then
    echo "  log delivery grant: present"
    return 0
  fi
  acl=$(s3api get-bucket-acl --bucket "$LOG_BUCKET" --output json)
  policy=$(printf '%s' "$acl" | with_delivery_grant)
  s3api put-bucket-acl --bucket "$LOG_BUCKET" --access-control-policy "$policy"
  r=$(check_delivery_grant)
  [ "$r" = ok ] || die "log delivery grant still absent after put-bucket-acl"
  echo "  log delivery grant: added"
}

# --------------------------------------------------- distribution changes ---
# Set the distribution's .Logging to $2 (JSON); $3 describes it for output.
ensure_logging() {
  local tmp="$1" desired="$2" label="$3" etag stamp snap got want status
  aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --output json > "$tmp/current.json"
  etag=$(jq -r '.ETag' "$tmp/current.json")
  [ -n "$etag" ] && [ "$etag" != null ] || die "no ETag returned for $DISTRIBUTION_ID"
  jq '.DistributionConfig' "$tmp/current.json" > "$tmp/before.json"
  with_logging "$desired" < "$tmp/before.json" > "$tmp/after.json"

  got=$(jq -S .Logging "$tmp/before.json")
  want=$(jq -S .Logging "$tmp/after.json")
  if [ "$got" = "$want" ]; then
    echo "  distribution logging: already $label"
    return 0
  fi
  only_logging_differs "$tmp/before.json" "$tmp/after.json" \
    || die "refusing to update: computed config differs outside .Logging"

  mkdir -p "$ROLLBACK_DIR"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  snap="$ROLLBACK_DIR/distribution-${DISTRIBUTION_ID}.${stamp}.json"
  cp "$tmp/before.json" "$snap"
  echo "  config snapshot: ${snap#"$PWD"/}"

  aws cloudfront update-distribution --id "$DISTRIBUTION_ID" --if-match "$etag" \
    --distribution-config "file://$tmp/after.json" --output json > "$tmp/updated.json"

  # The deterministic post-check: the control plane now holds the intended Logging.
  got=$(jq -S '.Distribution.DistributionConfig.Logging' "$tmp/updated.json")
  want=$(printf '%s' "$desired" | jq -S .)
  [ "$got" = "$want" ] \
    || die "UPDATE MISMATCH: distribution Logging is not the requested value; see $snap for the prior config"
  status=$(jq -r '.Distribution.Status' "$tmp/updated.json")
  echo "  distribution logging: $label"
  echo "  distribution status: $status (propagation takes several minutes)"
}

# Show the distribution's current and requested .Logging. Read-only.
show_logging_change() {
  local desired="$1" current after
  current=$(aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" \
              --query 'DistributionConfig.Logging' --output json | jq -c .)
  after=$(printf '%s' "$desired" | jq -c .)
  echo "  distribution logging now:   $current"
  echo "  distribution logging after: $after"
}

# ------------------------------------------------------------ plan/verify ---
report() {
  local acct="$1" mode="$2" state logging want gaps=0 r
  echo "distribution: $DISTRIBUTION_ID ($SITE_ORIGIN)"
  echo "log target:   s3://$LOG_BUCKET/$LOG_PREFIX  (expire after ${LOG_RETENTION_DAYS} days)"
  echo

  state=$(bucket_state "$acct")
  case "$state" in
    missing) echo "  bucket:               missing"; gaps=$((gaps + 1)) ;;
    ours)
      echo "  bucket:               exists"
      r=$(check_public_block);   echo "  public access block:  $r"; [ "$r" = ok ] || gaps=$((gaps + 1))
      r=$(check_ownership);      echo "  object ownership:     $r"; [ "$r" = ok ] || gaps=$((gaps + 1))
      r=$(check_lifecycle);      echo "  lifecycle:            $r"; [ "$r" = ok ] || gaps=$((gaps + 1))
      r=$(check_delivery_grant); echo "  log delivery grant:   $r"; [ "$r" = ok ] || gaps=$((gaps + 1))
      ;;
  esac

  # Every value is captured before use: a failure inside a "$(...)" that sits
  # in a command's argument or a [ ] test goes unseen.
  logging=$(aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" \
              --query 'DistributionConfig.Logging' --output json | jq -S .)
  want=$(desired_logging_json | jq -S .)
  if [ "$logging" = "$want" ]; then
    echo "  distribution logging: ok"
  else
    r=$(printf '%s' "$logging" | jq -c .)
    echo "  distribution logging: $r"
    gaps=$((gaps + 1))
  fi
  r=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query 'Distribution.Status' --output text)
  echo "  distribution status:  $r"

  if [ "$mode" = verify ] && [ "$state" = ours ]; then
    echo
    echo "most recent log files:"
    # The CLI prints nothing at all for an empty listing; give jq an object.
    r=$(s3api list-objects-v2 --bucket "$LOG_BUCKET" --prefix "$LOG_PREFIX" --output json)
    [ -n "$r" ] || r='{}'
    printf '%s' "$r" \
      | jq -r '(.Contents // []) | sort_by(.LastModified) | .[-5:] | if length == 0
               then "  none yet (delivery lags requests by up to an hour)"
               else .[] | "  \(.LastModified)  \(.Key)" end'
  fi

  echo
  REPORT_GAPS=$gaps
  if [ "$gaps" -eq 0 ]; then
    echo "fully configured."
    return 0
  fi
  case "$mode" in
    plan)    echo "$gaps item(s) differ from the desired state. Re-run with --apply to configure."; return 0 ;;
    preview) echo "$gaps item(s) differ from the desired state."; return 0 ;;
  esac
  echo "$gaps item(s) differ from the desired state."
  return 1
}

main() {
  local mode="plan" acct tmp desired disabled
  while [ $# -gt 0 ]; do
    case "$1" in
      --apply|--disable|--verify)
        if [ "$mode" != plan ] && [ "$mode" != "${1#--}" ]; then
          echo "--$mode and $1 cannot be combined" >&2; exit 2
        fi
        mode="${1#--}"
        ;;
      --yes|-y)  ASSUME_YES=1 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "unknown argument: $1" >&2; echo >&2; usage >&2; exit 2 ;;
    esac
    shift
  done

  validate_settings
  require_tools
  acct=$(account_id)

  case "$mode" in
    plan|verify) report "$acct" "$mode"; exit $? ;;
  esac

  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064  # expand now: $tmp is local to main
  trap "rm -rf '$tmp'" EXIT

  desired=$(desired_logging_json)
  disabled=$(disabled_logging_json)

  if [ "$mode" = disable ]; then
    echo "distribution $DISTRIBUTION_ID ($SITE_ORIGIN):"
    show_logging_change "$disabled"
    echo "  the bucket s3://$LOG_BUCKET and its logs are left in place."
    echo
    confirm "Disable access logging on the production distribution?"
    ensure_logging "$tmp" "$disabled" "disabled"
    return 0
  fi

  report "$acct" preview
  if [ "$REPORT_GAPS" -eq 0 ]; then
    return 0
  fi
  echo
  echo "--apply will configure the bucket, then set:"
  show_logging_change "$desired"
  echo
  confirm "Apply these changes to the production distribution?"

  echo
  echo "log bucket:"
  ensure_bucket "$acct"
  echo
  echo "distribution $DISTRIBUTION_ID:"
  ensure_logging "$tmp" "$desired" "enabled -> s3://$LOG_BUCKET/$LOG_PREFIX"
  ensure_delivery_grant
  echo
  echo "Done. Run '$0 --verify' after propagation; the first log files arrive"
  echo "within about an hour of the first request. To turn logging off: '$0 --disable'."
}

# Sourcing (for tests) defines the functions without running anything.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
