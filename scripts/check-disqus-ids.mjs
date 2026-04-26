#!/usr/bin/env node
/**
 * Regression guard: verifies migrated posts still carry their `disqusId`
 * frontmatter. Without these values, historical Disqus threads orphan
 * because Disqus resolves by identifier first.
 *
 * The list below was derived at migration time by extracting the
 * `disqus_config.this.page.identifier` literal from every rendered page
 * in the legacy Jekyll `_site/` build, then cross-checking the resulting
 * identifiers against the live Disqus thread list via the Disqus REST API.
 * Threads that had no comments were dropped; only posts whose identifier
 * was confirmed to point at a real, populated thread are listed here.
 *
 * `first-blog-post` is intentionally excluded — its thread was reassigned
 * via the Disqus URL Mapper to `a-pound-of-flesh-and-a-hot-tub` so that a
 * single canonical post owns the conversation, breaking a stale Disqus
 * identifier alias that previously paired the two pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.resolve(__dirname, "../src/content/blog");

const REQUIRED = [
	"2017-02-09-vim-for-writers.md",
	"2019-09-14-my-windows-10-setup.md",
	"2021-01-18-two-guys-watch-a-burning-house.md",
	"2021-01-30-meet-holly.md",
	"2021-01-30-gratitude-and-that-s-right.md",
	"2019-10-31-lorraine-barbara-kubik-skrinak.md",
	"2021-01-19-shinleaf-campsite.md",
	"2021-02-20-loose-shorts-and-the-tsa.md",
	"2021-01-19-my-hero-karen.md",
	"2017-04-23-drupalcon-baltimore-2017-mdash-backend-security-notes.md",
	"2019-05-22-2019-drupalcon-higher-ed-summit.md",
	"2017-05-26-drupal-8-multisite-documentation.md",
	"2017-02-13-duke-meetup.md",
	"2018-04-07-drupalcon-nashville-2018.md",
	"2018-05-21-5-drupalcon-nashville-take-aways.md",
	"2018-05-13-drupalcon-nashville-2018-video-playlist.md",
	"2018-04-09-drupalcon-nashville-higher-ed-summit-day.md",
	"2018-04-10-drupalcon-nashville-higher-ed-summit-day.md",
	"2018-04-11-drupalcon-nashville-higher-ed-summit-day.md",
	"2019-01-15-old-again-new-again.md",
	"2018-10-20-my-morning-routine.md",
	"2018-09-30-my-first-lchf-post.md",
	"2018-10-31-a-pound-of-flesh-and-a-hot-tub.md",
	"2019-09-02-diminished-zeal-with-steady-commitment.md",
	"2020-06-08-happy-third-lowcarbiversary.md",
	"2019-09-17-don-t-you-miss-carbs.md",
	"2018-10-28-how-to-restaurant.md",
	"2018-10-13-n-1.md",
	"2021-04-02-in-the-jekyll-garden.md",
	"2021-01-16-jekyll-hugo-and-me.md",
];

const failures = [];

for (const filename of REQUIRED) {
	const filepath = path.join(BLOG_DIR, filename);
	if (!fs.existsSync(filepath)) {
		failures.push(`MISSING FILE: ${filename}`);
		continue;
	}
	const content = fs.readFileSync(filepath, "utf8");
	const fmEnd = content.indexOf("\n---", 4);
	const frontmatter = fmEnd === -1 ? content : content.slice(0, fmEnd);
	if (!/^disqusId:\s*\S/m.test(frontmatter)) {
		failures.push(`MISSING disqusId: ${filename}`);
	}
}

if (failures.length === 0) {
	console.log(`✅ all ${REQUIRED.length} migrated posts carry disqusId frontmatter`);
	process.exit(0);
} else {
	console.error(`❌ disqusId regressions in ${failures.length} file(s):\n`);
	for (const f of failures) console.error(`  - ${f}`);
	process.exit(1);
}
