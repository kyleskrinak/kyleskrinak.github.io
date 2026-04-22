# Archive: `add-pr-work-protocol` branch

Branch deleted 2026-04-22 after confirmation the work was not needed. Recorded here for reference in case the diff ever needs to be retrieved.

## Recovery

The commits still exist in the remote git object store for ~90 days after branch deletion. To retrieve during that window:

```bash
git fetch origin +refs/heads/add-pr-work-protocol:refs/heads/add-pr-work-protocol   # only works while GH retains the ref
# or directly from tip SHA if known:
git fetch origin ee3cac0
```

After GitHub's retention expires, recovery requires access to the pre-delete packed refs.

## Scope

- **Tip commit (deleted):** `ee3cac0`
- **Branched from:** `origin/main` around 2026-03-04
- **Range:** `origin/main..origin/add-pr-work-protocol` = 31 commits by Kyle Skrinak, 2026-03-04 → 2026-03-12
- **Diffstat:** 124 files changed, 13,119 insertions(+), 4,616 deletions(-)

## Themes

The commits cluster around four streams that landed on `main` via separate PRs during the same window — so the net code is already in production. This branch appears to have been an early staging integration branch that was superseded by the develop → staging → main gitflow.

1. **PR #54 — image workflow docs and image handling**
2. **PR #55 — sanitizer/validator hardening** (22-round Copilot review that shaped the text-processing rules in `CLAUDE.md`). Commits include:
   - `9fa9ae1` image workflow docs and improve image handling
   - `99c40c0`, `ec976ec`, `3fcaedb` addressing Copilot review rounds
   - `0283276` relative URL validation
   - `64f2ca6` block `file:` URLs
   - `f4bb4cf` preserve HTML comments in code blocks
   - `9b9981d` 5 critical bugs found by Copilot
   - `f15b6e9` code block range boundary
   - `0d174cf` fail build when slides dir missing
   - `02003c4` comment removal + unclosed code blocks
   - `ed4b5ce` padding regex + reverse-tabnabbing
   - `4623ae3` shared `ALLOWED_URL_SCHEMES` constant
   - `9adccb2` anchor color regex patterns to prevent sanitizer bypass
3. **PR #56, #60 — content + layout**
   - `bd9b46b` hero image + cross-link
   - `f9817fa` "The Middle Tract" blog post
   - `6b83617` Middle Tract layout + date context
   - `6f6aea1` Fall of Icarus image + narrative
   - `6e40928` Daedalus caption correction
4. **PR #62 — link check improvements and share button updates**
   - `cf62e28` the PR merge itself
   - `0c24265` separate `SocialLink` and `ShareLink` types
   - `71a4cb0` event delegation comment
   - `5144cf3` share label accuracy + URL matching
   - `319f5d1` Facebook share path

Plus housekeeping merges: `61ee461`, `a8eb34e`, `2b391b7`, `ee3cac0`.

## Why it was abandoned

The canonical path for that work was the numbered PRs (#54 / #55 / #56 / #60 / #62 / #64) merging into `main`. Those landed cleanly. This branch was a parallel copy — redundant once the gitflow (`develop → staging → main`) was in place. Keeping it around invited future confusion about which history was authoritative.

## Full commit list

```
ee3cac0  2026-03-12 09:07:49 -0400  Merge remote-tracking branch 'origin/main' into staging
319f5d1  2026-03-12 08:37:04 -0400  fix: update Facebook share path to match actual endpoint
2b391b7  2026-03-12 08:35:24 -0400  chore: merge main into staging after PR #64
6e40928  2026-03-10 07:56:01 -0400  fix: correct Fall of Icarus caption to identify Daedalus
6f6aea1  2026-03-10 07:54:15 -0400  feat: add Fall of Icarus image and enhance narrative context
6b83617  2026-03-10 07:32:53 -0400  fix: adjust The Middle Tract layout and add date context
5144cf3  2026-03-12 07:34:02 -0400  fix: improve share label accuracy and URL matching
71a4cb0  2026-03-12 07:24:12 -0400  docs: clarify event delegation comment in ShareLinks
0c24265  2026-03-12 07:14:02 -0400  refactor: separate SocialLink and ShareLink types
cf62e28  2026-03-11 20:58:39 -0400  fix: link check improvements and share button updates (#62)
f9817fa  2026-03-11 08:25:23 -0400  feat: The Middle Tract blog post (#60)
a8eb34e  2026-03-06 18:30:46 -0500  chore: sync staging with main after PR #57 merge
9adccb2  2026-03-04 18:23:45 -0500  fix: anchor color regex patterns to prevent sanitizer bypass
4623ae3  2026-03-04 18:04:33 -0500  refactor: extract shared ALLOWED_URL_SCHEMES constant
ed4b5ce  2026-03-04 17:51:43 -0500  fix: correct padding regex and prevent reverse-tabnabbing
bd9b46b  2026-03-04 15:26:05 -0500  feat: add hero image to presentation and cross-link blog post (#56)
61ee461  2026-03-04 12:54:58 -0500  Merge branch 'main' into staging
88b8f75  2026-03-04 12:42:25 -0500  docs: add text processing and parsing rules to CLAUDE.md
02003c4  2026-03-04 12:07:40 -0500  fix: prevent comment removal bugs and handle unclosed code blocks
0d174cf  2026-03-04 11:42:59 -0500  fix: fail build when slides directory is missing
f15b6e9  2026-03-04 11:14:47 -0500  fix: correct code block range boundary check
9b9981d  2026-03-04 10:53:47 -0500  fix: address 5 critical bugs found by Copilot
f4bb4cf  2026-03-04 10:25:13 -0500  fix: preserve HTML comments in code blocks
abd0820  2026-03-04 10:04:14 -0500  docs: add GitHub Copilot custom instructions
64f2ca6  2026-03-04 10:02:38 -0500  fix: block file: URLs in presentation link validation
0283276  2026-03-04 09:10:57 -0500  fix: correct URL validation to allow relative links
d4132a6  2026-03-04 08:35:36 -0500  feat: add /copilot-review skill for systematic review handling
3fcaedb  2026-03-04 08:35:26 -0500  fix: address final Copilot review comments on PR #55
ec976ec  2026-03-04 07:59:42 -0500  fix: address additional Copilot review comments on PR #55
99c40c0  2026-03-04 07:41:42 -0500  fix: address Copilot review comments on PR #55
9fa9ae1  2026-03-04 07:25:16 -0500  feat: add image workflow docs and improve image handling (#54)
```
