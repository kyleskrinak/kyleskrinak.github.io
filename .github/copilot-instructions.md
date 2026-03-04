# GitHub Copilot Code Review Instructions

## Files to Review

Focus code reviews on:
- Source code files (`.ts`, `.js`, `.astro`, `.tsx`, `.jsx`)
- Configuration files (`.json`, `.yaml`, `.toml`)
- Build scripts and tooling
- Documentation that describes technical behavior

## Files to Skip

**Do NOT review or comment on:**
- Blog post content files: `src/content/blog/**/*.md` and `src/content/blog/**/*.mdx`
- Presentation content files: `slidev-presentations/slides/**/*.md`
- Documentation narrative in `docs/**/*.md` (unless specifically about code behavior)

**Reason:** These are authored content where narrative voice, style, and editorial decisions belong to the author. Technical accuracy in code and technical documentation is the review focus.

## Review Focus

When reviewing code:
1. **Security**: XSS, injection, validation, dangerous protocols
2. **Correctness**: Logic errors, type safety, edge cases
3. **Completeness**: Missing error handling, related files not updated
4. **Patterns**: Fix root causes, not just symptoms
5. **Technical accuracy**: Documentation that describes code behavior must match actual implementation

## What NOT to Comment On

- Prose style or narrative voice in blog posts
- Editorial decisions in authored content
- Content structure in markdown files (unless it breaks technical functionality)
- Subjective writing improvements

## Example

✅ **Good comment:** "This code claims it auto-converts to WebP, but the component requires explicit `format` prop"

❌ **Bad comment:** "This blog post sentence about Astro could be rephrased" (content, not code)
