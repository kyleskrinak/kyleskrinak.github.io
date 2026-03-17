/**
 * Shared utilities for config generation and validation
 */

/**
 * Generate environment variable matrix for documentation
 * Used by both generate-docs.mjs and validate.mjs to ensure consistency
 */
export function generateEnvironmentMatrix(ConfigRegistry) {
  const envs = Object.keys(ConfigRegistry.environments);
  const allVars = new Set();

  envs.forEach(env => {
    Object.keys(ConfigRegistry.environments[env]).forEach(v => allVars.add(v));
  });

  const rows = Array.from(allVars).map(varName => {
    const cells = envs.map(env => {
      const config = ConfigRegistry.environments[env][varName];
      if (!config) return '-';
      // Handle null values explicitly
      if (config.value === null) return '(omitted)';
      const required = config.required ? ' ✓' : '';
      return `\`${config.value}\`${required}`;
    });
    return `| \`${varName}\` | ${cells.join(' | ')} |`;
  });

  const headerRow = `| Variable | ${envs.join(' | ')} |`;
  const separatorRow = `|----------|${envs.map(() => '----------').join('|')}|`;

  return `${headerRow}\n${separatorRow}\n${rows.join('\n')}`;
}
