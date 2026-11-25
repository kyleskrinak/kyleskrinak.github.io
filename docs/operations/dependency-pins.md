# Dependency Pins

> Part of the broader [Supply-Chain Security](./supply-chain.md) posture. This page covers **npm `overrides`** and the **direct dependencies held below their latest release**; SHA-pinned GitHub Actions and the Docker base image are documented there.

This site uses `package.json` `overrides` to pin specific transitive dependencies to exact versions. The pins exist to resolve open npm audit advisories without invoking `npm audit fix`, which would also drag in unrelated freshly-published packages.

## Current pins

| Package | Pinned version | Advisory | Severity |
|---|---|---|---|
| `fast-uri` | 3.1.9 | GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc (path traversal, host confusion); GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp (scheme spoofing, path equivalence, host confusion, scheme injection) | high |
| `fast-xml-builder` | 1.1.7 | GHSA-5wm8-gmm8-39j9 (XML injection via unwanted quotes) | high |
| `fast-xml-parser` | 5.7.0 | GHSA-gh4j-gqv2-49f6 (XML comment / CDATA injection) | moderate |
| `fflate` (under `satori` only) | 0.7.5 | GHSA-px8p-9vwx-vf98 (`unzipSync` infinite loop on malformed ZIP64 archives) | moderate |
| `flatted` | 3.4.2 | GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh (DoS, prototype pollution) | high |
| `brace-expansion` | 5.0.6 | GHSA-jxxr-4gwj-5jf2 (DoS via large numeric range) | moderate |
| `postcss` | 8.5.10 | GHSA-qx2v-qp2m-jg93 (XSS via stringify) | moderate |
| `postcss-selector-parser` (under `@tailwindcss/typography` only) | 6.1.5 | GHSA-rj75-hqrm-r3gf (quadratic-time CPU exhaustion in flat selector parsing) | moderate |

Each pin is set to the **oldest** version that satisfies the advisory, minimizing supply-chain exposure from freshly-published packages.

### Per-pin API-risk notes

- **`brace-expansion`** — v5 is a recent major across the npm ecosystem (long-stable v1/v2 lineage broken by v5's API changes). Our pin is a patch bump within v5 (`5.0.5` → `5.0.6`), not a cross-major jump, because the dep tree was already resolving to v5 before the pin. No additional consumer-side API risk introduced by the pin itself. During quarterly review, verify no consumer in the tree has regressed to a v4 expectation.
- **`fast-uri`** — stays on the 3.x line because `ajv` 8, its only dependent, declares `^3.0.1`. 4.2.3 fixes the same advisories, but pinning it would force `ajv` out of range, so decline a Renovate PR that moves this pin to 4.x unless `ajv` itself moves.
- **`fflate`** — nested carve-out: `satori` 0.63.2 pins 0.7.3 exactly, so the override forces it out of range, and `OUT_OF_RANGE_EXCEPTIONS` records the reviewed reason. 0.7.5 is a patch release on the same line, and `satori`'s own `@shuding/opentype.js` already declares `^0.7.3`. `docx` resolves 0.8.3 on its own and sits outside the carve-out. Remove the override and its exception when `satori` unpins or moves past 0.7.4.
- **`postcss-selector-parser`** — nested carve-out: `@tailwindcss/typography` 0.5.20 pins 6.0.10 exactly, so the override forces it out of range, and `OUT_OF_RANGE_EXCEPTIONS` records the reviewed reason. 6.1.5 stays on the 6.x line the plugin targets. `eslint-plugin-astro` resolves 7.2.1 on its own and sits outside the carve-out. Remove the override and its exception when `@tailwindcss/typography` unpins or moves past 6.1.4.

## Deliberately deferred

| Advisory | Affected chain | Why not fixed |
|---|---|---|
| GHSA-48c2-rrv3-qjmp (yaml stack overflow on deeply nested collections) | `yaml-language-server` → `volar-service-yaml` → `@astrojs/language-server` → `@astrojs/check` | Fix requires `npm audit fix --force`, which downgrades `@astrojs/check` (breaking change). The vulnerable code runs in IDE tooling only — not in the build pipeline or shipped output. |

## Held direct dependencies

| Package | Held at | Blocked by (checked 2026-11-02) | Upstream |
|---|---|---|---|
| `typescript` | `~6.0.3` | `typescript-eslint` and `@typescript-eslint/parser` 8.72.1 declare `typescript` `>=4.8.4 <6.1.0`; `@astrojs/check` 0.9.12 declares `^5.0.0 \|\| ^6.0.0`. Against 7.0.2, `npm ci` fails with ERESOLVE ([#273](https://github.com/kyleskrinak/kyleskrinak.github.io/pull/273)). | [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) |

- **The tilde matters.** `^6.0.3` admits 6.1 releases, which the `typescript-eslint` ceiling (`<6.1.0`) excludes. `~6.0.3` stays on 6.0.x.
- **Renovate won't announce TypeScript 7 support.** Closing #273 on 2026-08-11 made Renovate ignore every 7.x release, so the quarterly review checks the peer ranges instead. When both admit 7, tick #273's recreate box under "PR Closed (Blocked)" on the Renovate Dependency Dashboard, or bump `package.json` by hand. After a manual bump, Renovate resumes 7.x minor and patch updates.

## Operational notes

### Exact-version pins do not self-update
These are pinned without `^`/`~`, so `npm update` will not advance them. Future security patches must be applied manually.

### Pins must stay inside their dependents' ranges
npm applies an override even when it violates the range a dependent declares, and `npm ls` reports the copy as "overridden", not "invalid". `tests/unit/overrides-integrity.test.mjs` fails on any such override unless `OUT_OF_RANGE_EXCEPTIONS` records a reviewed reason for it, along with the exact declared range and forced version that the reason covers. A pin bump or a dependent's range change under the same key fails again until someone reviews the new mismatch and updates the entry. The check exists because the `devalue` 5.x pin outlived Astro 7.4's move to `devalue` ^6.0.2 and broke Astro's content serializer without failing the build. PR #425 removed that pin, because Astro's own range excludes the advisory.

### Sibling packages must stay in sync
`fast-xml-builder` and `fast-xml-parser` are co-released by the same maintainer (`amitgupta`, NaturalIntelligence). When bumping one, bump both, and check that the new versions are still released together upstream.

### Review cadence
**Quarterly.** At each review:

1. Run `npm ls <pkg>` for each pinned package to confirm it is still in the dep tree and that the override is still load-bearing. If a pin no longer appears (or naturally resolves to a non-vulnerable version), see "When to remove a pin" below.
2. Run `npm view <pkg> versions --json` for each pinned package to see what newer versions are available.
3. For each advisory in the table above, check if a newer non-vulnerable version exists. If so, consider bumping the pin (preferring the oldest still-fixed version).
4. Run `npm audit` to see whether new advisories have surfaced — extend the overrides block as needed.
5. Run `npm audit signatures` to confirm registry signature integrity.
6. After any bump: `npm install`, `npm run build`, `npm run check:links`, `npm run test:visual`.
7. Re-evaluate the deferred `yaml` chain — when `@astrojs/check` ships a release that no longer pulls the vulnerable `yaml-language-server`, drop the deferral and update.
8. Re-check the TypeScript hold: run `npm view typescript-eslint peerDependencies` and `npm view @astrojs/check peerDependencies`. When both admit `typescript` 7, follow [Held direct dependencies](#held-direct-dependencies).
9. Review the **manually pinned** CI/build dependencies (GitHub Action SHAs, Docker base image) — these are excluded from Renovate and do not self-update. See [Supply-Chain Security → Manually pinned](./supply-chain.md#manually-pinned-not-managed-by-renovate).

### When to remove a pin
A pin can be removed once the dependency tree naturally resolves to a non-vulnerable version on its own (i.e., a parent package upgraded its dependency range). Verify by temporarily removing the override and running `npm install` followed by `npm audit`. If audit stays clean, the pin is no longer load-bearing.

### Supply-chain hygiene applied here
- `overrides` instead of `npm audit fix` — avoids pulling in unrelated newly-published packages.
- Each pin chosen as the oldest version that resolves the advisory — minimizes exposure to fresh, less-audited releases.
- New transitive packages introduced by the pins (e.g., `@nodable/entities` via `fast-xml-parser`) were verified out-of-band: same maintainer as the parent, established adoption, repository confirmed.
