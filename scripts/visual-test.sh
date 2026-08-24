#!/bin/bash

# Visual Regression Testing Helper
#
# Usage:
#   ./scripts/visual-test.sh local              # Test local dev
#   ./scripts/visual-test.sh staging            # Test staging
#   ./scripts/visual-test.sh production         # Test production
#   ./scripts/visual-test.sh baseline           # Create/update baselines from local (guarded; see ALLOW_NATIVE_BASELINE)
#   ./scripts/visual-test.sh docker             # Test against a container matching CI's OS/fonts
#   ./scripts/visual-test.sh docker-baseline    # Create/update baselines from that container
#
# Any arguments after the mode are forwarded to Playwright, so
# `./scripts/visual-test.sh docker --grep home` filters as it would directly.
#
# Why docker/docker-baseline: pr-visual-check.yml runs on ubuntu-latest, whose font
# stack renders slightly taller than macOS. Baselines committed from a bare `npm run
# test:visual:baseline` on macOS will consistently fail CI's height comparison even
# with no real visual change. These modes run the same test through the official
# Playwright Docker image (matched to the installed @playwright/test version, on the
# Ubuntu codename CI currently uses) so committed baselines are pixel-consistent with CI.

set -e

# Astro records a running preview server in .astro/preview.json and refuses to
# start a second one. The docker modes bind-mount the working directory, so a
# containerised run writes that record with a PID from inside the container;
# when the container exits the record survives on the host and blocks the next
# run. `astro preview stop` only trusts the PID, which means nothing across that
# namespace boundary, so test the recorded port instead: if nothing answers on
# it, no server exists and the record is stale.
#
# Note this deliberately does not try to detect a live *containerised* server:
# `docker run` here publishes no ports, so the container's preview is never
# reachable from the host and concurrent runs are unsupported either way.

# Is anything listening on $1? The port arrives through the environment rather
# than being pasted into the program text — it comes out of a file, and file
# contents must never reach node as source code.
#
# Both loopback families are probed because the server's is not knowable from
# here: playwright.config.ts starts `astro preview --host localhost`, and Node
# resolves localhost with verbatim DNS ordering, which on macOS can put ::1
# first. A v4-only probe would call a live v6 server dead, delete its record,
# and hand the run the EADDRINUSE failure this guard exists to prevent. Live on
# either address means the port is taken; only when every family refuses (or an
# unsupported family errors immediately) is the record stale.
preview_port_is_live() {
  PROBE_PORT="$1" node -e "
    const net = require('net');
    const hosts = ['127.0.0.1', '::1'];
    let pending = hosts.length;
    for (const host of hosts) {
      const sock = net.connect({ host, port: Number(process.env.PROBE_PORT) });
      let settled = false;
      const giveUp = () => {
        if (settled) return;
        settled = true;
        sock.destroy();
        if (--pending === 0) process.exit(1);
      };
      sock.on('connect', () => { sock.destroy(); process.exit(0); });
      sock.on('error', giveUp);
      sock.setTimeout(1000, giveUp);
    }
  " 2>/dev/null
}

clear_stale_preview_record() {
  local record=".astro/preview.json"
  [ -f "$record" ] || return 0

  local port
  port=$(PREVIEW_RECORD="$record" node -p "try{require(require('path').resolve(process.env.PREVIEW_RECORD)).port ?? ''}catch(e){''}" 2>/dev/null) || port=""

  # No usable port means there is nothing to probe, so whether a server is live
  # is unknown. Deleting the record on a guess would let the run proceed into a
  # port-already-in-use failure that is harder to read than this message, so
  # stop and let the operator decide — the file is disposable and gitignored.
  if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    echo "Preview record $record carries no usable port, so this cannot tell whether" >&2
    echo "a preview server is still running. Inspect it, then remove it if it is stale:" >&2
    echo "  cat $record && rm $record" >&2
    exit 1
  fi

  if preview_port_is_live "$port"; then
    echo "A preview server is live on port $port — leaving its record in place." >&2
    echo "Stop it with 'npx astro preview stop' if this run should own the port." >&2
    exit 1
  fi

  echo "🧹 Clearing stale preview record (port $port had no listener)"
  rm -f "$record"
}

ENVIRONMENT=${1:-local}
# Everything after the mode is forwarded verbatim to Playwright, preserving the
# `npm run test:visual:baseline -- --grep foo` interface these scripts had before
# they were routed through this wrapper.
shift $(( $# > 0 ? 1 : 0 ))
PLAYWRIGHT_ARGS=("$@")

# Ubuntu codename backing GitHub's `ubuntu-latest` runner (see .github/workflows/pr-visual-check.yml).
# Update this if CI's runs-on target changes (e.g. a future ubuntu-latest bump).
DOCKER_UBUNTU_CODENAME="noble"

run_in_docker() {
  local update_flag="$1"

  # %q-quote each forwarded argument so it survives the container's `bash -c` string.
  local inner_args="$update_flag"
  if [ ${#PLAYWRIGHT_ARGS[@]} -gt 0 ]; then
    inner_args="$inner_args$(printf ' %q' "${PLAYWRIGHT_ARGS[@]}")"
  fi
  local test_command="npm run test:visual"
  if [ -n "$inner_args" ]; then
    test_command="$test_command --$inner_args"
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Install Docker Desktop and retry." >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Start Docker and retry." >&2
    exit 1
  fi

  local playwright_version
  playwright_version=$(node -p "require('./node_modules/@playwright/test/package.json').version" 2>/dev/null) || {
    echo "Could not read @playwright/test version from node_modules. Run 'npm ci' first." >&2
    exit 1
  }

  clear_stale_preview_record

  local image="mcr.microsoft.com/playwright:v${playwright_version}-${DOCKER_UBUNTU_CODENAME}"
  echo "🐳 Running visual tests in Docker (${image}) — fonts/rendering match the CI runner"

  # -v /app/node_modules shadows the bind-mounted host node_modules with a container-only
  # volume, so `npm ci` installs Linux-native binaries (e.g. sharp) without touching the
  # host's macOS node_modules. CI=true mirrors playwright.config.ts's CI branch (workers=1,
  # retries=2, list reporter) for output parity with the actual gate.
  docker run --rm \
    -v "$(pwd)":/app \
    -v /app/node_modules \
    -w /app \
    -e CI=true \
    "$image" \
    bash -c "npm ci && $test_command"
}

# Only the modes that start their own preview server call
# clear_stale_preview_record, and each calls it *after* its own preconditions:
# a Darwin `baseline` run must report the refusal to write baselines, not a
# stale-record message, and the docker modes must confirm Docker is up first.
# The staging/production modes set PLAYWRIGHT_TEST_BASE_URL, which makes
# playwright.config.ts skip webServer entirely (see its webServer branch), and
# `compare` starts no server at all.
case $ENVIRONMENT in
  local)
    clear_stale_preview_record
    echo "🧪 Running visual tests against LOCAL (http://localhost:4321)"
    npm run test:visual -- "${PLAYWRIGHT_ARGS[@]}"
    ;;

  staging)
    echo "🧪 Running visual tests against STAGING (GitHub Pages)"
    PLAYWRIGHT_TEST_BASE_URL="https://kyleskrinak.github.io" npm run test:visual -- "${PLAYWRIGHT_ARGS[@]}"
    ;;

  production)
    echo "🧪 Running visual tests against PRODUCTION (kyle.skrinak.com)"
    PLAYWRIGHT_TEST_BASE_URL="https://kyle.skrinak.com" npm run test:visual -- "${PLAYWRIGHT_ARGS[@]}"
    ;;

  baseline)
    # Baselines are compared against CI's Ubuntu rendering, so snapshots written by a
    # bare (host-rendered) run are only ever correct on a Linux host matching CI. On
    # any other host they overwrite committed files with pixels that CI will reject.
    # Refuse by default; ALLOW_NATIVE_BASELINE=1 is the deliberate escape hatch.
    # A Linux host already matches CI's rendering, so it needs no override -- the same
    # exception guardActive() makes in tests/snapshot-guard.ts. Refuse only elsewhere.
    if [ "$(uname -s)" != "Linux" ]; then
      if [ "${ALLOW_NATIVE_BASELINE:-}" != "1" ]; then
        echo "Refusing to write baselines from a $(uname -s) host." >&2
        echo "" >&2
        echo "Committed baselines must match CI's Ubuntu rendering. Use:" >&2
        echo "  ./scripts/visual-test.sh docker-baseline" >&2
        echo "" >&2
        echo "To override anyway (only correct on a Linux host matching CI):" >&2
        echo "  ALLOW_NATIVE_BASELINE=1 ./scripts/visual-test.sh baseline" >&2
        exit 1
      fi
      echo "⚠️  ALLOW_NATIVE_BASELINE=1 — writing baselines from this host's rendering"
    fi
    clear_stale_preview_record
    echo "📸 Creating/updating baselines from LOCAL dev"
    # =changed is spelled out because --update-snapshots takes an *optional* mode: a
    # bare flag would swallow a following positional filter as its mode, so
    # `... baseline tests/visual/foo.spec.ts` would exit on an invalid mode instead of
    # updating that one test. 'changed' is Playwright's own preset for the bare flag.
    npm run test:visual -- --update-snapshots=changed "${PLAYWRIGHT_ARGS[@]}"
    echo "✓ Baselines updated in tests/visual/visual-regression.spec.ts-snapshots/"
    ;;

  docker)
    run_in_docker ""
    ;;

  docker-baseline)
    echo "📸 Creating/updating baselines via Docker (Ubuntu, matches CI)"
    # Explicit mode for the same reason as the native baseline path above.
    run_in_docker " --update-snapshots=changed"
    echo "✓ Baselines updated in tests/visual/visual-regression.spec.ts-snapshots/ (Ubuntu-rendered)"
    ;;

  compare)
    echo "📊 Opening HTML report of last test run"
    npx playwright show-report "${PLAYWRIGHT_ARGS[@]}"
    ;;

  *)
    echo "Unknown environment: $ENVIRONMENT"
    echo ""
    echo "Usage:"
    echo "  ./scripts/visual-test.sh local              # Test local dev"
    echo "  ./scripts/visual-test.sh staging            # Test staging (GitHub Pages)"
    echo "  ./scripts/visual-test.sh production         # Test production (kyle.skrinak.com)"
    echo "  ./scripts/visual-test.sh baseline           # Create/update baselines (guarded; see ALLOW_NATIVE_BASELINE)"
    echo "  ./scripts/visual-test.sh docker             # Test in a container matching CI's OS/fonts"
    echo "  ./scripts/visual-test.sh docker-baseline    # Create/update baselines from that container"
    echo "  ./scripts/visual-test.sh compare            # View HTML report"
    echo ""
    echo "Arguments after the mode are forwarded to Playwright (e.g. --grep home)."
    exit 1
    ;;
esac
