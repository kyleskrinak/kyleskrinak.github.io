# Dependency Pins

This site uses `package.json` `overrides` to pin specific transitive dependencies to exact versions. The pins exist to resolve open npm audit advisories without invoking `npm audit fix`, which would also drag in unrelated freshly-published packages.

## Current pins

| Package | Pinned version | Advisory | Severity |
|---|---|---|---|
| `devalue` | 5.8.1 | GHSA-77vg-94rm-hx3p (DoS via sparse array deserialization) | high |
| `fast-uri` | 3.1.2 | GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc (path traversal, host confusion) | high |
| `fast-xml-builder` | 1.1.7 | GHSA-5wm8-gmm8-39j9 (XML injection via unwanted quotes) | high |
| `fast-xml-parser` | 5.7.0 | GHSA-gh4j-gqv2-49f6 (XML comment / CDATA injection) | moderate |
| `flatted` | 3.4.2 | GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh (DoS, prototype pollution) | high |
| `brace-expansion` | 5.0.6 | GHSA-jxxr-4gwj-5jf2 (DoS via large numeric range) | moderate |
| `postcss` | 8.5.10 | GHSA-qx2v-qp2m-jg93 (XSS via stringify) | moderate |

Each pin is set to the **oldest** version that satisfies the advisory, minimizing supply-chain exposure from freshly-published packages.

### Per-pin API-risk notes

- **`brace-expansion`** — v5 is a recent major across the npm ecosystem (long-stable v1/v2 lineage broken by v5's API changes). Our pin is a patch bump within v5 (`5.0.5` → `5.0.6`), not a cross-major jump, because the dep tree was already resolving to v5 before the pin. No additional consumer-side API risk introduced by the pin itself. During quarterly review, verify no consumer in the tree has regressed to a v4 expectation.

## Deliberately deferred

| Advisory | Affected chain | Why not fixed |
|---|---|---|
| GHSA-48c2-rrv3-qjmp (yaml stack overflow on deeply nested collections) | `yaml-language-server` → `volar-service-yaml` → `@astrojs/language-server` → `@astrojs/check` | Fix requires `npm audit fix --force`, which downgrades `@astrojs/check` (breaking change). The vulnerable code runs in IDE tooling only — not in the build pipeline or shipped output. |

## Operational notes

### Exact-version pins do not self-update
These are pinned without `^`/`~`, so `npm update` will not advance them. Future security patches must be applied manually.

### Sibling packages must stay in sync
`fast-xml-builder` and `fast-xml-parser` are co-released by the same maintainer (`amitgupta`, NaturalIntelligence). When bumping one, bump both, and check that the new versions are still released together upstream.

### Review cadence
**Quarterly.** At each review:

1. Run `npm view <pkg> versions --json` for each pinned package to see what newer versions are available.
2. For each advisory in the table above, check if a newer non-vulnerable version exists. If so, consider bumping the pin (preferring the oldest still-fixed version).
3. Run `npm audit` to see whether new advisories have surfaced — extend the overrides block as needed.
4. Run `npm audit signatures` to confirm registry signature integrity.
5. After any bump: `npm install`, `npm run build`, `npm run check:links`, `npm run test:visual`.
6. Re-evaluate the deferred `yaml` chain — when `@astrojs/check` ships a release that no longer pulls the vulnerable `yaml-language-server`, drop the deferral and update.

### When to remove a pin
A pin can be removed once the dependency tree naturally resolves to a non-vulnerable version on its own (i.e., a parent package upgraded its dependency range). Verify by temporarily removing the override and running `npm install` followed by `npm audit`. If audit stays clean, the pin is no longer load-bearing.

### Supply-chain hygiene applied here
- `overrides` instead of `npm audit fix` — avoids pulling in unrelated newly-published packages.
- Each pin chosen as the oldest version that resolves the advisory — minimizes exposure to fresh, less-audited releases.
- New transitive packages introduced by the pins (e.g., `@nodable/entities` via `fast-xml-parser`) were verified out-of-band: same maintainer as the parent, established adoption, repository confirmed.
