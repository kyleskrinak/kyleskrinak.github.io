import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  // Ban stray console.log debugging, but allow intentional warn/error reporting.
  { rules: { "no-console": ["error", { allow: ["warn", "error"] }] } },
  // CLI tooling and build/config scripts legitimately write to the console.
  {
    files: ["scripts/**", "config/**"],
    rules: { "no-console": "off" },
  },
  // Test specs assert on and surface console output as part of their job.
  {
    files: ["tests/**"],
    rules: { "no-console": "off" },
  },
  { ignores: ["dist/**", ".astro", "public/_pagefind/**"] },
];
