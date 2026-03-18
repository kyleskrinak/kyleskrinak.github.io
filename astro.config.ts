import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
// Removed: using custom sitemap endpoint instead
// import sitemap from "@astrojs/sitemap";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { rehypeImageOptimization } from "./src/lib/rehype-components";
import { SITE } from "./src/config/index";

// https://astro.build/config
// NOTE: Repository "kyleskrinak.github.io" is a GitHub Pages USER SITE and MUST deploy to root (/).
// GitHub Pages does not allow user sites to deploy to subpaths like /astro-blog/.
// Both staging and production use base: "/" (root path).
// See: docs/operations/staging-url-reference.md for authoritative staging URL documentation.
const base = "/";

export default defineConfig({
  base,
  site: SITE.website,
  trailingSlash: "always",
  devToolbar: {
    enabled: process.env.DISABLE_DEV_TOOLBAR !== "true",
  },
  integrations: [
    // Sitemap is generated via custom endpoint (src/pages/sitemap.xml.ts)
  ],
  markdown: {
    remarkPlugins: [remarkToc, [remarkCollapse, { test: "Table of contents" }]],
    rehypePlugins: [rehypeImageOptimization],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: {
        limitInputPixels: 100000000, // 100MP max (~10000x10000px) - protects against memory exhaustion
      },
    },
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      PUBLIC_DEPLOY_ENV: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      PUBLIC_GOOGLE_ANALYTICS_ID: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      // BUILD_ENV and SITE_URL are "type-system only" entries - declared here for
      // validation but consumed via process.env in src/config/index.ts (not astro:env)
      // because that file runs at build initialization before Astro env is available.
      // Hardcoded fallback values in src/config/index.ts are validated against the
      // registry by config/validate.mjs to prevent drift.
      //
      // access: "secret" here is NOT a credential classification — these are not
      // sensitive values. "secret" (vs "public") is used to prevent these vars from
      // being inlined into client-side JavaScript bundles; the server-only constraint
      // is intentional since these vars are only needed at build time.
      BUILD_ENV: envField.string({
        access: "secret", // prevents client bundling — not a credential (see comment above)
        context: "server",
        optional: true,
        default: "production",
      }),
      SITE_URL: envField.string({
        access: "secret", // prevents client bundling — not a credential (see comment above)
        context: "server",
        optional: true,
      }),
    },
  },
  experimental: {
    preserveScriptOrder: true,
    fonts: [
      {
        name: "Google Sans Code",
        cssVariable: "--font-google-sans-code",
        provider: fontProviders.google(),
        fallbacks: ["monospace"],
        weights: [300, 400, 500, 600, 700],
        styles: ["normal", "italic"],
      },
    ],
  },
});
