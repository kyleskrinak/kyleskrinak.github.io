## Description

Brief summary of the changes in this PR.

## Type of Change

- [ ] Feature (non-breaking change which adds functionality)
- [ ] Fix (non-breaking change which fixes an issue)
- [ ] Chore (maintenance, dependencies, configuration)
- [ ] Docs (documentation update)
- [ ] Breaking change (feature or fix that would cause existing functionality to change)

## Checklist

### Code Quality
- [ ] Code follows project conventions (ESLint, TypeScript, Prettier).
- [ ] No hardcoded secrets, tokens, or sensitive data.
- [ ] Type safety: no `@ts-ignore` without justification.
- [ ] Comments added for complex logic.

### Testing & Validation
- [ ] Local build succeeds: `npm run build`.
- [ ] Local preview works: `npx astro preview` (if UI changes).
- [ ] CI passes on this branch (GitHub Actions).
- [ ] Environment variables are correctly documented in `.env.example` (if new vars added).

### Staging (if applicable)
- [ ] Staging CI environment variables configured (e.g., `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`).
- [ ] Feature validated on staging deployment.
- [ ] Staging build passes without errors.
- [ ] No TypeScript or linting errors.

### Documentation & Changelog
- [ ] `CHANGELOG.md` updated (for user-facing changes).
- [ ] Inline code comments or README updated (if needed).
- [ ] Deployment or setup impact documented (if applicable).

### Security & Performance
- [ ] No new dependencies without justification and security review.
- [ ] No hardcoded API endpoints or domains; use config/env where applicable.
- [ ] No performance regression (e.g., new script loads efficiently).

## Related Issues

Closes #(issue number) or References #(issue number)

## Additional Context

Add any other context or reasoning for the change.
