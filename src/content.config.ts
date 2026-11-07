import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";
// SITE-OVERRIDE: hero and social-card format rules (src/utils/heroImageFormat.ts).
import { heroFormatIssues } from "./utils/heroImageFormat";

export const BLOG_PATH = "src/content/posts";

// SITE-OVERRIDE: schema helpers for the site-only fields below.
// Absolute external link fields that feed href attributes: must parse as a
// URL AND carry http(s) — z.string().url() alone accepts any parseable
// scheme, javascript: included. Requiring a scheme is correct for these
// always-absolute fields; the blocklist-over-allowlist rule applies to
// fields that may hold relative URLs, which these never do. The protocol
// check runs on the parsed URL, so scheme casing (HTTPS://) is handled per
// RFC 3986; .url() has already guaranteed new URL() won't throw.
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine(v => ["http:", "https:"].includes(new URL(v).protocol), {
    message: "Must be an absolute http(s) URL",
  });

// The context object superRefine hands its callback, derived from `z` itself
// so this module doesn't import zod directly, which is Astro's dependency and
// not ours to pin.
type RefinementCtx = Parameters<
  Parameters<ReturnType<typeof z.object>["superRefine"]>[0]
>[1];

// Adapter between heroImageFormat.ts (plain data in, plain findings out) and
// Zod. Both collections call it: `pages` also resolves an `image` through
// image(), and the format rules are a property of the image pipeline, not of
// one collection.
const addImageFormatIssues = (
  data: Record<string, unknown>,
  ctx: RefinementCtx
) => {
  for (const { field, message } of heroFormatIssues(data)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: [field],
    });
  }
};

const posts = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z
      .object({
        author: z.string().default(config.site.author),
        pubDatetime: z.date(),
        modDatetime: z.date().optional().nullable(),
        title: z.string(),
        featured: z.boolean().optional(),
        draft: z.boolean().optional(),
        tags: z.array(z.string()).default(["others"]),
        ogImage: image().or(z.string()).optional(),
        description: z.string(),
        canonicalURL: z.string().optional(),
        hideEditPost: z.boolean().optional(),
        // An empty value means "not set", so the site timezone applies.
        timezone: z
          .string()
          .optional()
          .transform(tz => tz || undefined),
        // SITE-OVERRIDE: site-only post fields: hero image, caption and crop
        // position, categories, migration source and table of contents.
        image: image().optional(),
        alt: z.string().trim().min(1).optional(),
        caption: z.string().trim().min(1).optional(),
        imagePosition: z
          .enum([
            "top",
            "right top",
            "right",
            "right bottom",
            "bottom",
            "left bottom",
            "left",
            "left top",
            "center",
            "centre",
            "north",
            "northeast",
            "east",
            "southeast",
            "south",
            "southwest",
            "west",
            "northwest",
            "entropy",
            "attention",
          ])
          .optional(),
        categories: z.array(z.string()).optional(),
        toc: z.boolean().optional(),
        source: z.enum(["jekyll", "astro"]).optional(),
      })
      // SITE-OVERRIDE: hero-image format rules and required alt text.
      .superRefine((data, ctx) => {
        // Hero and social-card format rules live in src/utils/heroImageFormat.ts
        // so they can be unit-tested; see that module for why `image` and
        // `ogImage` are judged differently, and why an unreadable reference is
        // an error rather than a pass.
        addImageFormatIssues(data, ctx);

        // Enforce: if an on-page image exists, alt text is required for accessibility
        if (data.image && !data.alt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Alt text is required when an on-page image is provided",
            path: ["alt"],
          });
        }
      }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
  // SITE-OVERRIDE: pages schema takes image() for the site-only fields below.
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string().optional(),
        ogImage: z.string().optional(),
        canonicalURL: z.string().optional(),
        // SITE-OVERRIDE: site-only page fields: page hero image and the resume
        // source fields.
        author: z.string().optional(),
        permalink: z.string().optional(),
        toc: z.boolean().optional(),
        image: image().optional(),
        alt: z.string().trim().min(1).optional(),
        // Email/URL fields feed hrefs (mailto:, links) on both resume routes
        // and the PDF — validate shape at build time (Copilot review, PR #242)
        contactEmail: z.string().trim().email().optional(),
        contactWebsite: httpUrl.optional(),
        contactLinkedin: httpUrl.optional(),
        contactAddress: z.string().trim().min(1).optional(),
        // The resume's name line: the h1 on both resume routes, and so the
        // first line of the PDF, .docx and .txt and the .docx's title and
        // author. Required there; both routes throw without it.
        name: z.string().trim().min(1).optional(),
        // Source of truth for the resume's lead heading and employer line (both
        // injected into the body at <!-- current-role -->), the page meta
        // description, and the About page's current-position sentence and its
        // employer link. `location` is required because the employer-line
        // convention ("**Employer** — Location | Dates") is what
        // resume-sections.mjs uses to recognize the line at all.
        // `employer_url` is required with it: the About page links the employer
        // name, and an optional field there would mean a silently unlinked name.
        current_role: z
          .object({
            title: z.string().trim().min(1),
            employer: z.string().trim().min(1),
            employer_url: httpUrl,
            location: z.string().trim().min(1),
            start_date: z.coerce.date(),
          })
          .optional(),
        // No `certifications` here by decision: Manager Tools puts no
        // certifications on a resume, tailored variants included
        // (docs/references/manager-tools-rubric.md).
        // Injected into the body at <!-- education -->, one section per item with
        // render: true. `degree` holds the formal name for data reuse;
        // `degree_abbr` is what the one-page resume prints as its heading.
        // location/years stay optional for an unrendered item, but a rendered
        // one without them fails the build (resume-sections.mjs) — the employer
        // line cannot be recognized without both.
        education: z
          .object({
            items: z.array(
              z.object({
                degree: z.string().trim().min(1),
                degree_abbr: z.string().trim().min(1).optional(),
                institution: z.string().trim().min(1),
                location: z.string().trim().min(1).optional(),
                years: z.string().trim().min(1).optional(),
                honors: z.string().trim().min(1).optional(),
                render: z.boolean().default(false),
              })
            ),
          })
          .optional(),
      })
      // SITE-OVERRIDE: hero-image format rules on pages.
      .superRefine(addImageFormatIssues),
});

export const collections = { posts, pages };
