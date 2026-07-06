/**
 * Shared helpers for the PDF-generation scripts (build-archive-pdf,
 * build-presentations-pdf, print-resume-pdf). One implementation of CLI flag
 * parsing and the astro-preview server lifecycle, so fixes land everywhere.
 */

import { spawn } from "node:child_process";

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
 * Start `astro preview` on the given port in its own process group so the
 * whole tree can be torn down with one signal. Caller is responsible for
 * calling stopPreview() in a finally block.
 */
export function startPreview(port, { cwd = process.cwd() } = {}) {
  return spawn("npx", ["astro", "preview", "--port", String(port)], {
    stdio: ["ignore", "ignore", "inherit"], // surface astro errors (e.g. port in use)
    cwd,
    detached: true, // own process group so we can kill the whole tree
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
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
      if (res.ok || res.status === 404) return; // server is up and answering
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Preview server did not become ready at ${url} within ${timeoutMs}ms`);
}
