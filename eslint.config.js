import eslintPluginAstro from "eslint-plugin-astro";
import tsParser from "@typescript-eslint/parser";

export default [
  ...eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
  },
  { rules: { "no-console": "error" } },
  // SITE-OVERRIDE: no-console allowances. Site code reports through
  // console.warn and console.error; CLI tooling, build and config scripts, and
  // test specs write to the console as part of their job.
  { rules: { "no-console": ["error", { allow: ["warn", "error"] }] } },
  {
    files: ["scripts/**", "config/**", "tests/**"],
    rules: { "no-console": "off" },
  },
  { ignores: ["dist/**", ".astro/**", "public/pagefind/**"] },
  // SITE-OVERRIDE: gitignored rollback snapshots that the infra/cloudfront
  // scripts write.
  { ignores: ["infra/cloudfront/.rollback/**"] },
];
