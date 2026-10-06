---
title: A Proactive Defense Against Supply-Chain Attacks
pubDate: 2026-10-04T00:00:00.000Z
description: "A blow-by-blow timeline of adding Renovate to this blog as a supply-chain defense, and the gap that writing about it exposed."
image: ./2026-10-04-tiepolo-trojan-horse.webp
alt: Giovanni Domenico Tiepolo painting of a crowd of Trojans pushing and hauling a giant white wooden horse on a wheeled cart toward the walls of Troy
caption: Giovanni Domenico Tiepolo, "The Procession of the Trojan Horse into Troy," c. 1760. The Trojans skipped the seven-day wait.
tags:
  - security
  - supply-chain
  - renovate
published: true
---

## Preamble

Hey, all, Kyle, the human, here. I tried using Claude to write a narrative about my decision to incorporate Renovate as a safeguard against supply-chain attacks. I had already spent hours arguing with Claude over a reasonable narrative, so I'm handing the mic to Claude to piece together how I came to this decision and implemented it — mistakes and all.

Over to you, Claude.

---

What follows is a blow-by-blow timeline of what happened, in order, with dates wherever Kyle has them. It's less pleasant to read than an essay, but every line in it is true.

The timeline also turned up something unexpected. Writing this post exposed a hole in the blog's setup that Kyle hadn't noticed. That part starts at "The gap."

## Blow by blow

**The news, Sep 2025 to Mar 2026**

- Sep 8, 2025: [Attackers published malicious versions of chalk and debug](https://vercel.com/blog/critical-npm-supply-chain-attack-response-september-8-2025) after phishing their maintainer.
- Sep 15, 2025: [The Shai-Hulud worm spread through stolen npm publishing tokens](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem).
- Nov 24, 2025: [Shai-Hulud 2.0 appeared](https://securitylabs.datadoghq.com/articles/shai-hulud-2.0-npm-worm/).
- Dec 29, 2025: [Shai-Hulud 3.0 appeared](https://snyk.io/blog/shai-hulud-3-0/).
- Jan 2026: [Koi Security researchers disclosed PackageGate](https://www.securityweek.com/packagegate-flaws-open-javascript-ecosystem-to-supply-chain-attacks/amp/).
- Mar 31, 2026: [Attackers hijacked the axios maintainer's account and published a malicious axios 1.14.1](https://github.com/axios/axios/issues/10636).
- None of these hit the blog.

**The setup, May 31, 2026**

- Looking for a more secure alternative to Dependabot version updates, Kyle added Renovate for heightened protection against supply-chain attacks.
- Kyle chose Renovate because a review of the options showed it was a mainstream path for securing the supply chain.
- Routine bumps wait seven days before Renovate proposes them, because npm and the maintainers pulled recent malicious releases quickly: most of the bad chalk and debug versions within [about an hour after the community spotted them](https://www.miggo.io/post/pwned-debrief-npms-debug-chalk-package-attack-explained), and the bad axios release within [about three hours](https://phoenix.security/axios-supply-chain-compromise-npm-rat-2026/).
- Security PRs skip the wait.
- Renovate opens PRs against develop, and Kyle vets each one before merging.
- Dependabot alerts still supply the security findings that Renovate acts on.

**The gap**

- Kyle turned off the repo's Dependabot alerts because they were flooding Kyle's inbox.
- Turning off alerts also cut off Renovate's security path, because Renovate reads those alerts.
- Routine PRs kept arriving, so the setup looked healthy.

**The fix**

- Writing this post led Kyle to Renovate's logs, which showed it wasn't receiving any alerts.
- Kyle turned the alerts back on, and Renovate started opening security PRs again.
- The security PRs only covered packages Kyle manages directly. To cover the rest, Kyle added weekly lockfile maintenance, which also respects the seven-day wait.

**What it bought**

- Kyle put defenses in place before any attack reached the blog. Renovate holds routine updates for seven days, and in the recent incidents, npm and the maintainers pulled the malicious releases within hours.
- Every dependency change now arrives as a PR against develop, so Kyle sees and approves each one instead of trusting an auto-update.
- Kyle now understands the moving parts of a supply-chain defense: alerts, cooldowns, PR review, and lockfile refresh. That understanding carries over to work.
- Writing this post forced an audit, and the audit found the gap before any attacker could exploit it.

---

*Claude Opus 5.5, working in Claude Code, wrote everything after "Over to you, Claude," from Kyle's direction, corrections, and edits. Kyle wrote the lead-in.*
