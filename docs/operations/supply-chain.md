# Supply-Chain Security

The single source of truth for this project's dependency and supply-chain posture. It covers how dependencies are updated, what runs before package code is trusted, and which pins are maintained **by hand**.

Related: [Dependency Pins](./dependency-pins.md) (npm `overrides` detail) · [Maintenance Guide](./maintenance.md) (cadence checklist).

## Layers at a glance

| Layer | Mechanism | Where |
|---|---|---|
| Automated dependency updates | Renovate (npm only) | `renovate.json` |
| Install-time isolation | `ignore-scripts=true` | `.npmrc` |
| Pre-install local audit | `npm run audit:deps` | `scripts/audit-deps.mjs` |
| CI signature verification | `npm audit signatures` | `.github/workflows/supply-chain-audit.yml` |
| Helper unit tests | `npm run test:unit` | `.github/workflows/unit-tests.yml` |
| Transitive CVE pins | npm `overrides` | `package.json` → see [Dependency Pins](./dependency-pins.md) |
| Pinned CI/build dependencies | SHA pins (manual) | workflows + `Dockerfile` (see below) |

## Automated updates — Renovate

Configured in `renovate.json`. Key posture:

- **`enabledManagers: ["npm"]`** — Renovate manages **only** npm dependencies. It does **not** touch the `Dockerfile` base image or the SHA-pinned GitHub Actions; those are maintained manually (see "Manually pinned" below). This is deliberate — it keeps the supply-chain-critical pins under explicit human control.
- **`minimumReleaseAge: "7 days"`** — a cooling-off window on all routine bumps so freshly published (potentially compromised) releases age before they can land. Security alerts override this with `minimumReleaseAge: "0 days"`.
- **`baseBranches: ["develop"]`** + `useBaseBranchConfig: "merge"` — PRs open against `develop` and flow `develop → staging → main`; for a critical CVE the operator fast-tracks promotion manually.
- Updates are grouped by ecosystem (astro, testing, dev-tools, tailwind, markdown, build-tools, utilities); major bumps and minor TypeScript bumps open as individual PRs for explicit review.

Review Renovate PRs and the **"Renovate Dependency Dashboard"** GitHub issue as part of the monthly cadence.

> **Migration note:** Renovate replaced Dependabot (`.github/dependabot.yml` was removed). The Renovate GitHub App must be installed and have run at least once for automated monitoring to exist — confirm the Dependency Dashboard issue is present.

## Install-time isolation

`.npmrc` sets `ignore-scripts=true`, so no `postinstall`/lifecycle scripts run on `npm install`/`npm ci` locally. CI mirrors this with `npm ci --ignore-scripts`.

## Pre-install local audit — `npm run audit:deps`

Run before merging a Renovate PR or installing a new dependency, to inspect the would-be change **without executing any package code**:

```sh
npm run audit:deps                             # audit uncommitted package.json / lockfile changes
npm run audit:deps -- --base develop           # audit a committed branch (e.g. checked-out Renovate PR)
npm run audit:deps -- --base HEAD~1            # audit the last commit against its parent
npm run audit:deps -- --package dayjs@1.11.21  # audit a hypothetical bump
npm run audit:deps -- --help                   # full usage
```

For Renovate PRs, check out the PR branch and run `--base develop` (or whichever branch the PR targets). The `--base` flag diffs `<ref>:package-lock.json` against the working-tree lockfile, so it captures all committed changes on the branch even when the working tree is clean.

What it does (`scripts/audit-deps.mjs`):

- **Lockfile diff** — default mode diffs `HEAD` vs the working tree; `--base <ref>` diffs `<ref>` vs the working tree; `--package <spec>` snapshots both files, runs `npm install <spec> --package-lock-only --ignore-scripts`, then restores them. All three paths surface added / removed / changed packages.
- **Publish-age check** — flags any new/changed package published in the last 7 days.
- **Dormant-revival detection** — flags a package that was silent for >2 years then republished. This runs for **both** version bumps and **newly added** packages (for a new package the predecessor version is derived from the npm registry time map).
- **Signature verification** — runs `npm audit signatures`.
- Emits a **GO / REVIEW / BLOCK** recommendation (exit 0 / 0 / 1). Pass `--strict` to escalate metadata unavailability and missing timestamps from REVIEW to BLOCK — recommended when running in CI.

> Caveat: `npm audit signatures` exits 0 for packages with **no** signature — it only fails on a *tampered* signed package. Unsigned legacy packages are not flagged. The lockfile-diff scrutiny above is the complementary layer.

## CI gates

Both run on pull requests **and** on direct pushes to `develop`/`staging`/`main` (so a change can't reach a deploy branch without the gate), plus `workflow_dispatch`:

- **`supply-chain-audit.yml`** — `npm ci --ignore-scripts` then `npm audit signatures`. Runs on all PRs and all pushes to `develop`/`staging`/`main`.
- **`unit-tests.yml`** — `npm run test:unit` (the `audit-deps.mjs` helper's unit suite). Runs on all PRs and all pushes to `develop`/`staging`/`main`.

## Manually pinned (NOT managed by Renovate)

These pins are excluded from Renovate on purpose and must be reviewed/bumped **by hand** (see the quarterly checklist in [Maintenance Guide](./maintenance.md) and [Dependency Pins](./dependency-pins.md)):

| Pin | Current | Location |
|---|---|---|
| `actions/checkout` | `34e114876b0b11c390a56381ad16ebd13914f8d5` (v4) | all `.github/workflows/*.yml` |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` (v4) | `.github/actions/setup-node-build/action.yml` |
| `node:24-alpine` base image | `sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f` | `Dockerfile` |
| npm transitive overrides | various | `package.json` → [Dependency Pins](./dependency-pins.md) |

**Why pinned to SHA, not tag:** a moved tag (e.g. `@v4`) can silently point at new code. A SHA pin is immutable, so the action/image that runs is exactly the one that was reviewed.

**Bumping a SHA pin:** resolve the new tag to its commit SHA (e.g. `git ls-remote https://github.com/actions/checkout v4`), update the pin, keep the `# v4` comment in sync, and confirm CI passes. The same approach applies to `actions/setup-node` (pinned in `.github/actions/setup-node-build/action.yml`). For the Docker base image, pull the tag and record its `sha256` digest.
