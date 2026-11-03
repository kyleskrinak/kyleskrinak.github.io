import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
// SITE-OVERRIDE: /sitemap.xml (Kyle's selection, 2026-11-03). The site serves
// one sitemap from src/pages/sitemap.xml.ts in place of @astrojs/sitemap, which
// can only write sitemap-index.xml plus numbered files.
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { rehypeTableWrapper } from "./src/utils/rehypeTableWrapper";
// SITE-OVERRIDE: site markdown plugins (resume sections, :::cards and other
// directives, facets, image optimization).
import remarkDirective from "remark-directive";
import { remarkFacets } from "./src/lib/remark-facets.mjs";
import { remarkResumeSections } from "./src/lib/remark-resume-sections.mjs";
import { remarkCards } from "./src/lib/remark-cards.mjs";
import { rehypeImageOptimization } from "./src/lib/rehype-components";
import config from "./astro-paper.config";

// SITE-OVERRIDE: explicit base, read by config/validate.mjs.
// The site deploys to the root of kyle.skrinak.com (S3 + CloudFront), never to a
// subpath, so base stays "/". Canonical URLs, asset paths and link validation all assume it.
// See: docs/operations/deployment.md.
const base = "/";

export default defineConfig({
  base,
  site: config.site.url,
  // SITE-OVERRIDE: trailing slashes, for the S3 and CloudFront canonical URLs.
  trailingSlash: "always",
  // SITE-OVERRIDE: DISABLE_DEV_TOOLBAR turns the dev toolbar off.
  devToolbar: {
    enabled: process.env.DISABLE_DEV_TOOLBAR !== "true",
  },
  integrations: [
    mdx(),
    // SITE-OVERRIDE: no sitemap integration; see the import note above.
  ],
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        // SITE-OVERRIDE: site remark plugins. remarkResumeSections runs first:
        // it expands the resume's frontmatter-driven sections into real
        // headings, so every later plugin sees the finished document.
        // remarkCards runs before remarkToc so card titles don't pollute TOCs.
        remarkResumeSections,
        remarkDirective,
        remarkCards,
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
        // SITE-OVERRIDE: remarkFacets.
        remarkFacets,
      ],
      rehypePlugins: [
        rehypeCallouts,
        rehypeTableWrapper,
        // SITE-OVERRIDE: rehypeImageOptimization.
        rehypeImageOptimization,
      ],
    }),
    shikiConfig: {
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
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
    // SITE-OVERRIDE: IBM Plex Mono for the site's OG card designs
    // (src/utils/og-templates/), read by the two OG routes. Pages don't use it.
    // Local files, not Google's: Google's copy lacks U+2011, the non-breaking
    // hyphen the home card sets in "AI-assisted".
    {
      name: "IBM Plex Mono",
      cssVariable: "--font-ibm-plex-mono",
      provider: fontProviders.local(),
      fallbacks: ["monospace"],
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            src: ["./src/assets/fonts/ibm-plex-mono-400.ttf"],
          },
          {
            weight: 700,
            style: "normal",
            src: ["./src/assets/fonts/ibm-plex-mono-700.ttf"],
          },
        ],
      },
    },
  ],
  // SITE-OVERRIDE: Sharp image service with an input-pixel cap, and
  // constrained responsive images.
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
      // SITE-OVERRIDE: site env vars (Cloudflare analytics, BUILD_ENV, SITE_URL).
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      // BUILD_ENV and SITE_URL are "type-system only" entries - declared here for
      // validation but consumed via process.env in astro-paper.config.ts (not astro:env)
      // because that file runs at build initialization before Astro env is available.
      // Hardcoded fallback values in astro-paper.config.ts are validated against the
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
    svgOptimizer: svgoOptimizer(),
  },
});
