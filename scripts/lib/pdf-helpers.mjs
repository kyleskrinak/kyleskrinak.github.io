/**
 * Shared helpers for the PDF-generation scripts. One implementation of CLI flag
 * parsing, preview-port resolution, and the astro-preview server lifecycle, so
 * fixes land everywhere.
 *
 * Preview-lifecycle consumers: build-archive-pdf.mjs and lib/resume-render.mjs
 * (shared by print-resume-pdf.mjs and build-resume-variant.mjs).
 * build-presentations-pdf.mjs uses parseFlags only -- it starts no server.
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
