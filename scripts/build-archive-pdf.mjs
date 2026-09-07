#!/usr/bin/env node
/**
 * Generate the complete-archive PDF book from the `/archive-book/` print page.
 *
 *   node scripts/build-archive-pdf.mjs [--output <path>] [--skip-build] [--base-url <url>]
 *   npm run archive:pdf
 *
 * Pipeline: `astro build` -> `astro preview` -> Chromium renders /archive-book/
 * to a 6x9in PDF. Uses the Chromium already installed with @playwright/test, so
 * it needs no extra dependency and renders MDX, components, and WebP at full
 * fidelity (Astro has already resolved those into plain HTML + optimized images).
 *
 * Privacy safeguards baked in (see the archive discussion):
 *   - Post selection is delegated entirely to the page, which reuses the site's
 *     own publish filter — the book can never include drafts or future-dated posts.
 *   - Inline images are the Astro-optimized variants, which are re-encoded by
 *     sharp with metadata (EXIF/GPS) stripped — no photo geolocation leaks.
 *   - The emitted PDF metadata comes from Chromium (Title from <title>, generic
 *     Creator/Producer) and embeds no local username or file paths.
 *   - Non-printable <iframe> embeds are replaced with a visible caption + the URL,
 *     so references survive without pulling third-party frames into the file.
 */
import { spawnSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import {
  parseFlags,
  parsePreviewPort,
  rewriteToProductionUrl,
  startPreview,
  stopPreview,
  waitForServer,
} from "./lib/pdf-helpers.mjs";

const ROOT = process.cwd();

/**
 * Runs in the page, not in Node. Reads the printed-URL rule out of the live
 * stylesheet and returns the hosts its `:not()` exclusions treat as same-origin.
 *
 * This is the only place the site's public host is determined. archive-book.astro
 * bakes it into those exclusions at *site build* time from SITE.website, while
 * this script runs in a separate process that CI gives no SITE_URL. Resolving it
 * independently here could therefore disagree with the page, and a disagreement
 * is not cosmetic: step 4c-ter rewrites relative hrefs to absolute ones, and an
 * absolute href is exactly what `a[href^="http"]` starts matching. Suppression
 * then rests entirely on these exclusions, so a mismatch would print every
 * internal URL with `word-break: break-all` -- reintroducing the truncated
 * phantom URLs that 19c819b and 212d8e5 removed. Asking the page is the only
 * source that cannot drift from it.
 */
function readPrintedUrlHosts() {
  const printRules = [];
  // Recursive: the rule sits at the top level today, but wrapping it in
  // `@media print` is the obvious future refactor of a print stylesheet, and a
  // flat scan would quietly stop finding it.
  const collect = (rules) => {
    for (const rule of rules) {
      if (rule.style && (rule.style.content || "").includes("attr(href)")) {
        printRules.push(rule);
      }
      if (rule.cssRules) collect(rule.cssRules); // @media, @supports, nesting
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      collect(sheet.cssRules);
    } catch {
      continue; // cross-origin sheet, not ours
    }
  }
  // Fail loudly rather than pass vacuously: a guard that finds nothing to check
  // is worse than no guard, because it reports success either way.
  if (printRules.length === 0) {
    throw new Error(
      'no printed-URL rule found in the page stylesheet. Did the `content: " (" attr(href) ")"` rule in archive-book.astro move?'
    );
  }

  const hosts = new Set();
  for (const rule of printRules) {
    const exclusions = rule.selectorText.matchAll(/:not\(\[href\^?=["']https?:\/\/([^"'\/?#]+)/g);
    for (const m of exclusions) hosts.add(m[1]);
  }
  if (hosts.size === 0) {
    throw new Error(
      "the printed-URL rule excludes no same-origin host, so every internal link will print its URL and truncate. This is the original defect."
    );
  }
  return [...hosts];
}

const FLAGS = {
  "--output": { key: "output", value: true },
  "--skip-build": { key: "skipBuild" },
  "--base-url": { key: "baseUrl", value: true },
};

async function main() {
  // Parsed here, not at module scope: a throw during module evaluation escapes
  // main().catch below and reaches the user as a raw stack trace. Matches
  // build-resume-variant.mjs, which exits 2 on bad configuration input.
  let PORT;
  try {
    // 4324, not the dev server's 4321: see parsePreviewPort for the allocation.
    PORT = parsePreviewPort("ARCHIVE_PREVIEW_PORT", 4324);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const args = parseFlags(process.argv.slice(2), FLAGS, {
    output: "public/blog-archive.pdf",
    skipBuild: false,
    baseUrl: null,
  });
  const outputPath = resolve(ROOT, args.output);

  // 1. Build (unless reusing an existing dist or an external server).
  if (!args.baseUrl && !args.skipBuild) {
    console.log("→ Building site (astro build)…");
    const build = spawnSync("npx", ["astro", "build"], { stdio: "inherit", cwd: ROOT });
    if (build.status !== 0) {
      console.error("✘ astro build failed.");
      process.exit(build.status ?? 1);
    }
  }

  // 2. Start a preview server unless one was supplied.
  let preview = null;
  let baseUrl = args.baseUrl;
  if (!baseUrl) {
    baseUrl = `http://localhost:${PORT}`;
    console.log(`→ Starting astro preview on :${PORT}…`);
    preview = await startPreview(PORT, { cwd: ROOT });
    await waitForServer(baseUrl + "/", { child: preview });
  }

  const pageUrl = `${baseUrl.replace(/\/$/, "")}/archive-book/`;
  let browser = null;
  try {
    // 3. Render to PDF.
    console.log(`→ Rendering ${pageUrl} → ${args.output}`);
    browser = await chromium.launch();
    const page = await browser.newPage();
    // Use "load", not "networkidle": video-embed iframes keep connections alive,
    // so the network never goes idle on this page.
    const resp = await page.goto(pageUrl, { waitUntil: "load", timeout: 120000 });
    if (!resp || !resp.ok()) {
      throw new Error(`Failed to load ${pageUrl} (status ${resp ? resp.status() : "none"})`);
    }

    // 4a. Replace non-printable iframe embeds FIRST — before any waiting — so the
    // embedded players stop holding network connections open.
    const rewritten = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll("iframe"));
      for (const frame of frames) {
        const src = frame.getAttribute("src") || "";
        const fallback = document.createElement("div");
        fallback.className = "print-embed-fallback";
        const label = document.createElement("div");
        label.textContent = "Embedded media (view online):";
        const link = document.createElement("div");
        link.className = "url";
        link.textContent = src;
        fallback.appendChild(label);
        fallback.appendChild(link);
        frame.replaceWith(fallback);
      }
      return frames.length;
    });
    if (rewritten > 0) console.log(`  · replaced ${rewritten} embed(s) with printed URLs`);

    // 4a-bis. Tag external links whose visible text already IS their href, so the
    // print CSS (.chapter a[href^="http"]::after { content: " (" attr(href) ")" })
    // does not print the URL twice (e.g. `[https://x](https://x)` or `<https://x>`).
    const tagged = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.chapter a[href^="http"]'));
      let n = 0;
      for (const a of links) {
        if (a.textContent.trim() === a.getAttribute("href")) {
          a.classList.add("url-in-text");
          n++;
        }
      }
      return n;
    });
    if (tagged > 0) console.log(`  · tagged ${tagged} self-URL link(s) to avoid duplicate printing`);

    // 4b. Force lazy images to load: this is one tall page, so off-screen images
    // with loading="lazy" never enter the viewport in headless. Mark them eager
    // and scroll the full height to trigger their fetch.
    await page.evaluate(async () => {
      for (const img of document.images) img.loading = "eager";
      const step = window.innerHeight || 800;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });

    // 4c. Wait for fonts + images to settle, but CAP the wait so a single image
    // that never fires load/error can never hang the whole run.
    await page.evaluate(async () => {
      await document.fonts.ready;
      const imgs = Array.from(document.images);
      await Promise.race([
        Promise.all(
          imgs.map(img =>
            img.complete
              ? Promise.resolve()
              : new Promise(res => {
                  img.addEventListener("load", res, { once: true });
                  img.addEventListener("error", res, { once: true });
                })
          )
        ),
        new Promise(r => setTimeout(r, 15000)),
      ]);
    });

    // 4c-bis. Ask the page which host it considers same-origin. See
    // readPrintedUrlHosts for why this cannot come from process.env.
    const sameOriginHosts = await page.evaluate(readPrintedUrlHosts);
    if (sameOriginHosts.length !== 1) {
      throw new Error(
        `expected exactly one same-origin host in the printed-URL rule, found ${sameOriginHosts.length} ` +
          `(${sameOriginHosts.join(", ")}). Cannot choose which one internal links should point at.`
      );
    }
    // https, not http: archive-book.astro excludes both schemes for the host, so
    // either is suppressed, and only one of them is a URL worth shipping.
    const siteOrigin = `https://${sameOriginHosts[0]}`;

    // 4c-ter. Rewrite local links to the public site. Chromium writes the
    // *resolved* URL into each link annotation, so without this every internal
    // link in the book ships as http://localhost:<port>/... and dead-ends for
    // the reader. Runs before the 4d guard on purpose: these rewrites turn
    // relative hrefs into absolute ones, which is precisely what the guard below
    // exists to check, so the guard has to see the page in its final state.
    //
    // Split across the page/Node boundary rather than done in one evaluate():
    // the decision is a pure function that unit tests can reach, and only the
    // reading and writing happen in the page.
    const authored = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"), (a, index) => ({
        index,
        href: a.getAttribute("href"),
      }))
    );
    if (authored.length === 0) {
      throw new Error(
        "no anchors found in the rendered book. Either the page failed to render its content or the markup changed; rewriting and guarding both silently pass on an empty set."
      );
    }
    const rewriteOptions = {
      // The book resolves relative links against its own directory, and it sits
      // at the same path in both places, so only the origin differs. Keeping the
      // path identical means link resolution is byte-for-byte what it is today.
      localDocBase: pageUrl,
      prodDocBase: `${siteOrigin}/archive-book/`,
      localOrigins: [new URL(pageUrl).origin],
    };
    const rewrites = authored
      .map(({ index, href }) => ({ index, href: rewriteToProductionUrl(href, rewriteOptions) }))
      .filter(entry => entry.href !== null);
    await page.evaluate(entries => {
      const anchors = document.querySelectorAll("a[href]");
      for (const { index, href } of entries) anchors[index].setAttribute("href", href);
    }, rewrites);

    // Re-run the same decision over the rewritten page: anything still eligible
    // is something the rewrite failed to correct. Idempotence is the assertion,
    // which reuses the tested function instead of restating its rules here.
    const remaining = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"), a => a.getAttribute("href"))
    );
    const missed = remaining.filter(href => rewriteToProductionUrl(href, rewriteOptions) !== null);
    if (missed.length > 0) {
      throw new Error(
        `${missed.length} link(s) still point at the preview server after rewriting, and would ship ` +
          `as dead localhost URLs:\n${missed.map(h => `    · ${h}`).join("\n")}`
      );
    }
    console.log(`  · rewrote ${rewrites.length} local link(s) to ${siteOrigin}`);

    // 4d. Regression guard for the phantom same-origin URLs this book used to
    // emit. Three print rules can split a string mid-word: the generated
    // `::after` URL and `.print-embed-fallback .url` both set
    // `word-break: break-all`, and `pre` sets `word-wrap: break-word`. A
    // same-origin URL reaching any of them can print as a fragment such as
    // `https://kyle.skrinak.com/posts/2026-02-02-fun-at-scal`, which Google
    // extracts from the PDF and crawls as a real page, then reports as a 404.
    //
    // The rule is read back out of the live stylesheet rather than restated
    // here, so this cannot drift from archive-book.astro: the selector that
    // decides what prints is the selector the guard tests, and the same-origin
    // hosts come from that selector's own :not() exclusions.
    //
    // Ordinary prose is deliberately not scanned. Without a mid-word break rule
    // a long URL wraps intact, and an intact same-origin URL is a real page
    // rather than a phantom.
    const guard = await page.evaluate((hosts) => {
      const printRules = [];
      // Recursive: the rule sits at the top level today, but wrapping it in
      // `@media print` is the obvious future refactor of a print stylesheet,
      // and a flat scan would quietly stop finding it.
      const collect = (rules) => {
        for (const rule of rules) {
          if (rule.style && (rule.style.content || "").includes("attr(href)")) {
            printRules.push(rule);
          }
          if (rule.cssRules) collect(rule.cssRules); // @media, @supports, nesting
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          collect(sheet.cssRules);
        } catch {
          continue; // cross-origin sheet, not ours
        }
      }
      // The live rule objects cannot cross the page boundary, so they are
      // re-collected here for the scan below. The hosts are not: they arrive
      // from step 4c-bis, which read this same stylesheet, so the origin the
      // rewrite targeted and the origin this guard trusts are one value.
      if (printRules.length === 0) {
        throw new Error(
          'no printed-URL rule found in the page stylesheet. Did the `content: " (" attr(href) ")"` rule in archive-book.astro move?'
        );
      }

      // The host must run out at this exact point: the next character cannot be
      // one a hostname could continue with. That is what stops a lookalike such
      // as kyle.skrinak.com.example or kyle.skrinak.computer from counting as
      // same-origin, and requiring the scheme immediately before the host stops
      // an unrelated host like notkyle.skrinak.com matching as a substring.
      // Case-insensitive on purpose: CSS attribute selectors match the href
      // case-sensitively, so an uppercase host slips past the exclusion above
      // and does print. That is a leak worth failing on, not one to mirror.
      const escaped = [...hosts].map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const sameOrigin = new RegExp(`https?://(?:${escaped.join("|")})(?![a-z0-9.-])`, "i");

      const findings = [];
      const scan = (text, where) => {
        const value = (text || "").trim();
        if (sameOrigin.test(value)) findings.push({ where, text: value.slice(0, 160) });
      };

      // (a) The URLs the print CSS generates. getComputedStyle resolves
      // attr(href), so this is the literal string that reaches the page.
      for (const rule of printRules) {
        // Read the pseudo-element the rule actually targets. Stripping ::before
        // from the selector while only ever reading ::after would silently scan
        // the wrong side of the element.
        const pseudo = /::before\b/.test(rule.selectorText) ? "::before" : "::after";
        const selector = rule.selectorText.replace(/::(after|before)\b/g, "");
        for (const el of document.querySelectorAll(selector)) {
          scan(getComputedStyle(el, pseudo).content, `printed URL on <a href="${el.getAttribute("href")}">`);
        }
      }
      // (b) The embed fallbacks this script substitutes at step 4a.
      for (const el of document.querySelectorAll(".print-embed-fallback .url")) {
        scan(el.textContent, "embed fallback URL");
      }
      // (c) Code blocks, which break mid-token once one overruns the column.
      for (const el of document.querySelectorAll("pre")) {
        scan(el.textContent, "code block");
      }
      return { findings, hosts: [...hosts] };
    }, sameOriginHosts);

    if (guard.findings.length > 0) {
      const detail = guard.findings.map(f => `    \u00b7 ${f.where}\n      ${f.text}`).join("\n");
      throw new Error(
        `${guard.findings.length} same-origin URL(s) would print into the PDF, where they can ` +
          `truncate mid-word into phantom URLs that Google crawls and reports as 404s:\n${detail}\n` +
          `  same-origin hosts checked: ${guard.hosts.join(", ")}`
      );
    }
    console.log(`  \u00b7 phantom-URL guard: clean (${guard.hosts.join(", ")})`);

    // 5. Emit the PDF. preferCSSPageSize honours the page's @page 6x9in rule.
    await mkdir(dirname(outputPath), { recursive: true });
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;text-align:center;font-size:8pt;color:#666;">' +
        'Page <span class="pageNumber"></span> of <span class="totalPages"></span>' +
        "</div>",
    });

    const { size } = await stat(outputPath);
    console.log(`✅ Wrote ${args.output} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  } finally {
    if (browser) await browser.close();
    stopPreview(preview);
  }
}

main().catch(err => {
  console.error(`✘ ${err.message}`);
  process.exit(1);
});
