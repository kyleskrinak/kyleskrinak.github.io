/**
 * Shared helpers for the PDF-generation scripts. One implementation of CLI flag
 * parsing, preview-port resolution, and the astro-preview server lifecycle, so
 * fixes land everywhere.
 *
 * Preview-lifecycle consumers: build-archive-pdf.mjs and lib/resume-render.mjs
 * (shared by print-resume-pdf.mjs and build-resume-variant.mjs).
 * build-presentations-pdf.mjs starts no preview server, so it uses parseFlags,
 * resolveSiteUrl and rewriteToProductionUrl only.
 */

import { spawn } from "node:child_process";
import net from "node:net";

/**
 * Parse CLI flags against a spec: { "--output": { key: "output", value: true },
 * "--skip-build": { key: "skipBuild" } }. Flags with `value: true` consume the
 * next argv entry; a missing value (end of argv) or another flag in its place
 * is a usage error, not a silent `undefined` that fails later. Unknown flags
 * exit 2.
 */
export function parseFlags(argv, spec, defaults = {}) {
  const args = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const entry = spec[flag];
    if (!entry) {
      console.error(`Unknown argument: ${flag}`);
      process.exit(2);
    }
    if (entry.value) {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        console.error(`Missing value for ${flag}`);
        process.exit(2);
      }
      args[entry.key] = value;
    } else {
      args[entry.key] = true;
    }
  }
  return args;
}

/**
 * Resolve a preview port from `envVar`, falling back to `fallback`.
 *
 * Every preview port in this repo is read through here so one variable cannot
 * mean two different things depending on which script read it. Throws rather
 * than exiting, so callers control the exit code and the parsing is testable.
 *
 * Port allocation (see also tests/test-utils.ts, which owns 4322):
 *   4321  astro dev, CI
 *   4322  Playwright suite
 *   4323  resume PDF (RESUME_PREVIEW_PORT)
 *   4324  blog archive PDF (ARCHIVE_PREVIEW_PORT)
 *
 * None of these default to 4321: a script that did would collide with a running
 * dev server by construction, every time.
 */
export function parsePreviewPort(envVar, fallback, env = process.env) {
  const raw = env[envVar] || String(fallback);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${envVar} '${env[envVar]}' — must be an integer 1-65535.`);
  }
  return port;
}

/**
 * Is anything listening on `port`?
 *
 * Both loopback families are probed because the caller cannot know which one a
 * given server chose: `astro dev` on this machine binds [::1] only, so a v4-only
 * probe would report a busy port as free — the exact mistake that lets a render
 * proceed against the wrong server. Live on either address means taken.
 */
export function portIsLive(port) {
  const hosts = ["127.0.0.1", "::1"];
  return new Promise(resolve => {
    let pending = hosts.length;
    let settled = false;
    const done = result => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    for (const host of hosts) {
      const sock = net.connect({ host, port });
      const giveUp = () => {
        sock.destroy();
        if (--pending === 0) done(false);
      };
      sock.on("connect", () => {
        sock.destroy();
        done(true);
      });
      sock.on("error", giveUp);
      sock.setTimeout(1000, giveUp);
    }
  });
}

/**
 * Start `astro preview` on the given port in its own process group so the
 * whole tree can be torn down with one signal. Caller is responsible for
 * calling stopPreview() in a finally block.
 *
 * Refuses to spawn onto an occupied port. `astro preview` does not fail loudly
 * in that case -- it exits without binding -- and the caller then renders
 * whatever else is answering that port (a dev server, typically) while believing
 * it is rendering dist/. That produces a plausible, verifiable, wrong document,
 * so the port is checked before anything is spawned. Rendering against an
 * already-running server is supported deliberately, via --base-url.
 */
export async function startPreview(port, { cwd = process.cwd() } = {}) {
  if (await portIsLive(port)) {
    throw new Error(
      `Port ${port} is already in use, so 'astro preview' cannot serve dist/ there.\n` +
        `Whatever holds that port would be rendered instead — check with:\n` +
        `  lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
        `Stop it, or pass --base-url to render against a running server on purpose.`
    );
  }
  return spawn("npx", ["astro", "preview", "--port", String(port)], {
    stdio: ["ignore", "ignore", "inherit"], // surface astro errors (e.g. port in use)
    cwd,
    detached: true, // own process group so we can kill the whole tree
    // Astro detaches `astro preview` when it detects an agent session, which
    // would put the server outside the process group stopPreview() signals and
    // leave it running after this script exits. Any value disables that
    // detection; only an unset variable enables it.
    env: { ...process.env, ASTRO_PREVIEW_BACKGROUND: "0" },
  });
}

/** Tear down a preview started with startPreview(). Safe to call on null. */
export function stopPreview(preview) {
  if (preview && preview.pid) {
    try {
      // POSIX-only: negative PID signals the whole process group (macOS/ubuntu
      // CI runners). Windows has no process groups; this path would need a
      // different teardown there, but the build pipeline never runs on Windows.
      process.kill(-preview.pid, "SIGTERM"); // kill the group, not just npx
    } catch {
      /* already exited */
    }
  }
}

/**
 * Poll `url` until the server answers (2xx or 404 both count as "up").
 * Each request carries its own 5s abort signal so one hung connection can't
 * blow past the deadline. When `child` is provided (the process expected to
 * be serving), an early child exit — e.g. the port was already in use — fails
 * fast instead of polling a port some other process may be serving.
 */
export async function waitForServer(url, { timeoutMs = 60000, child = null } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(
        `Server process exited with code ${child.exitCode} before becoming ready ` +
          `(is the port already in use?)`
      );
    }
    let answered = false;
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
      answered = res.ok || res.status === 404;
      // Only the status is read above, and an undrained body keeps its socket
      // checked out of undici's pool until GC. Release it on every pass -- this
      // loop can poll ~120 times before the default deadline. Assigning
      // `answered` first keeps a throw from cancel() behaviourally inert: it
      // lands in the catch below exactly as a connection error would.
      await res.body?.cancel();
    } catch {
      // not ready yet
    }
    // Deliberately outside the try: the catch above swallows connection errors,
    // and the identity check below throws on purpose. Inside, its throw would be
    // caught and the loop would poll on until the deadline.
    if (answered) {
      // Something is answering -- but "something" is not necessarily ours. The
      // check at the top of the loop runs before the first fetch, so a server
      // that was already up answers immediately and the child's exit is never
      // observed. Re-check now that we have a response: a dead child plus a
      // live port means another process owns it, and rendering would silently
      // take its content.
      if (child && child.exitCode !== null) {
        throw new Error(
          `${url} is being served, but not by this run's preview ` +
            `(it exited with code ${child.exitCode}). Refusing to render an unknown source.`
        );
      }
      return; // server is up and answering
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Preview server did not become ready at ${url} within ${timeoutMs}ms`);
}

/**
 * The site's public origin, for the one PDF builder that cannot ask the page it
 * is printing. Same env-with-fallback shape as send-webmentions.mjs and
 * migrate-notion-post.mjs. Returns the URL without a trailing slash so callers
 * can append a path directly.
 *
 * build-archive-pdf.mjs deliberately does NOT use this: it reads the origin out
 * of the page's own print-CSS exclusions instead, so the URL it rewrites links
 * to and the URL the page suppresses printed URLs for cannot disagree. See the
 * comment on step 4d there.
 */
export function resolveSiteUrl(env = process.env) {
  const raw = (env.SITE_URL || "https://kyle.skrinak.com/").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SITE_URL is not a valid absolute URL: ${JSON.stringify(raw)}`);
  }
  // The result becomes a link target in a published PDF, so only the two web
  // schemes are meaningful. file: and ftp: parse cleanly and would otherwise
  // ship as clickable annotations pointing somewhere a reader cannot follow.
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`SITE_URL must be http or https, got ${JSON.stringify(raw)}`);
  }
  return url.href.replace(/\/+$/, "");
}

// Schemes that address something other than a page, so they carry no origin to
// correct. `about:` is here for completeness; an anchor should never use it.
const NON_NAVIGATIONAL = new Set([
  "mailto:",
  "tel:",
  "sms:",
  "data:",
  "javascript:",
  "blob:",
  "about:",
]);

// An href that supplies its own origin: `https://host/…`, or the protocol-
// relative `//host/…`. Anything else resolves against the document's base.
const CARRIES_ORIGIN = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/**
 * Map one authored href onto the URL it should carry in a printed PDF, or null
 * to leave it exactly as authored.
 *
 * Chromium writes the *resolved absolute* URL into a PDF link annotation -- it
 * has no notion of "this was relative" -- so whatever origin the page rendered
 * from becomes permanent in the file. Rendering happens against a local preview,
 * which is how localhost URLs reach readers.
 *
 * Two bases rather than one origin swap, because the local and production
 * documents do not always sit at the same path. The presentations PDF is
 * assembled at the server root while the decks it inlines are served from
 * /presentations/, so a deck-relative `other-deck.html` needs the prefix
 * restored, not just the host replaced.
 *
 * @param {string} href                raw attribute value, not the resolved .href property
 * @param {object} opts
 * @param {string} opts.localDocBase   base the href resolves against today
 * @param {string} opts.prodDocBase    base it should resolve against in the PDF
 * @param {Iterable<string>} opts.localOrigins origins that mean "not shippable"
 * @returns {string|null}              the corrected absolute URL, or null to skip
 */
export function rewriteToProductionUrl(href, { localDocBase, prodDocBase, localOrigins }) {
  const raw = (href ?? "").trim();
  if (raw === "") return null;
  // Same-document: Chromium already emits these as internal PDF destinations
  // rather than URI annotations, so rewriting one would break navigation that
  // currently works.
  if (raw.startsWith("#")) return null;

  const scheme = raw.match(/^[a-z][a-z0-9+.-]*:/i);
  if (scheme && NON_NAVIGATIONAL.has(scheme[0].toLowerCase())) return null;

  let current;
  try {
    current = new URL(raw, localDocBase);
  } catch {
    return null; // unparseable; leave it as authored rather than guess
  }

  // Compare parsed origins, never string prefixes. A prefix test treats
  // localhost.example.com as local; URL.origin cannot, because the host has
  // already run out by then.
  const locals = new Set();
  for (const origin of localOrigins) locals.add(new URL(origin).origin);
  if (!locals.has(current.origin)) return null; // genuinely external, never touched

  const prodOrigin = new URL(prodDocBase).origin;
  if (CARRIES_ORIGIN.test(raw)) {
    // Already absolute, so only the origin is wrong: re-resolving against the
    // production base would ignore the base entirely and hand back the same
    // local URL. Assign the parts onto a production URL rather than assigning
    // .host (which would leave the local port in place) or re-parsing the path
    // as a relative reference (a path starting `//` would then read as
    // protocol-relative and silently discard the production origin).
    const rebuilt = new URL(prodOrigin);
    rebuilt.pathname = current.pathname;
    rebuilt.search = current.search;
    rebuilt.hash = current.hash;
    return rebuilt.href;
  }
  // Path-relative: resolve against the production base, which may carry a
  // different path prefix than the local one.
  return new URL(raw, prodDocBase).href;
}
