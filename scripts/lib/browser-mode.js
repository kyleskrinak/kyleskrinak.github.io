export function resolveBrowserMode(env = process.env) {
  const headedEnv = env.PLAYWRIGHT_HEADED;
  const isCI = Boolean(env.CI) && env.CI !== 'false';
  const isLinux = process.platform === 'linux';
  const hasDisplay = isLinux ? Boolean(env.DISPLAY || env.WAYLAND_DISPLAY) : true;
  const autoHeadless = isCI || !hasDisplay;
  let headed;

  if (headedEnv === 'true') {
    headed = true;
  } else if (headedEnv === 'false') {
    headed = false;
  } else {
    headed = !autoHeadless;
  }

  return { headed, headless: !headed };
}
