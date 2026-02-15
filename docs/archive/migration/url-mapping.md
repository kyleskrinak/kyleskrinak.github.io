# URL Mapping: Jekyll to Astro

This document maps all blog post URLs from the Jekyll format to the new Astro format. The old Jekyll URLs automatically redirect to the new Astro URLs using a 301 permanent redirect.

## URL Format Changes

### Old Jekyll Format
```
https://kyle.skrinak.com/YYYY/MM/DD/post-slug/
```

### New Astro Format
```
https://kyle.skrinak.com/posts/YYYY-MM-DD-post-slug/
```

## Redirect Implementation

All old Jekyll URLs are automatically redirected via:
- **Route**: `src/pages/[year]/[month]/[day]/[...slug].astro`
- **Type**: 301 Permanent Redirect
- **Mechanism**: Dynamic route generation from blog collection

## Complete URL Mapping

| Jekyll URL | Astro URL | Post Title | Status |
|-----------|-----------|-----------|--------|
| `/2016/10/31/first-blog-post/` | `/posts/2016-10-31-first-blog-post/` | First Blog Post | ✓ |
| `/2017/02/09/vim-for-writers/` | `/posts/2017-02-09-vim-for-writers/` | Vim for Writers | ✓ |
| `/2017/02/13/duke-meetup/` | `/posts/2017-02-13-duke-meetup/` | Duke Meetup | ✓ |
| `/2017/04/23/drupalcon-baltimore-2017-mdash-backend-security-notes/` | `/posts/2017-04-23-drupalcon-baltimore-2017-mdash-backend-security-notes/` | DrupalCon Baltimore 2017 – Backend Security Notes | ✓ |
| `/2017/05/26/drupal-8-multisite-documentation/` | `/posts/2017-05-26-drupal-8-multisite-documentation/` | Drupal 8 Multisite Documentation | ✓ |
| `/2018/04/07/drupalcon-nashville-2018/` | `/posts/2018-04-07-drupalcon-nashville-2018/` | DrupalCon Nashville 2018 | ✓ |
| `/2018/04/09/drupalcon-nashville-2018-04-09-2018-higher-ed-summit-day/` | `/posts/2018-04-09-drupalcon-nashville-2018-04-09-2018-higher-ed-summit-day/` | DrupalCon Nashville 2018 - 04/09/2018 Higher Ed Summit Day | ✓ |
| `/2018/04/10/drupalcon-nashville-2018-04-10-2018-higher-ed-summit-day/` | `/posts/2018-04-10-drupalcon-nashville-2018-04-10-2018-higher-ed-summit-day/` | DrupalCon Nashville 2018 - 04/10/2018 Higher Ed Summit Day | ✓ |
| `/2018/04/11/drupalcon-nashville-2018-04-11-2018-higher-ed-summit-day/` | `/posts/2018-04-11-drupalcon-nashville-2018-04-11-2018-higher-ed-summit-day/` | DrupalCon Nashville 2018 - 04/11/2018 Higher Ed Summit Day | ✓ |
| `/2018/05/13/drupalcon-nashville-2018-video-playlist/` | `/posts/2018-05-13-drupalcon-nashville-2018-video-playlist/` | DrupalCon Nashville 2018 Video Playlist | ✓ |
| `/2018/05/21/5-drupalcon-nashville-take-aways/` | `/posts/2018-05-21-5-drupalcon-nashville-take-aways/` | 5 DrupalCon Nashville Take-Aways | ✓ |
| `/2018/09/30/my-first-lchf-post/` | `/posts/2018-09-30-my-first-lchf-post/` | My First LCHF Post | ✓ |
| `/2018/10/13/n-1/` | `/posts/2018-10-13-n-1/` | N+1 | ✓ |
| `/2018/10/20/my-morning-routine/` | `/posts/2018-10-20-my-morning-routine/` | My Morning Routine | ✓ |
| `/2018/10/28/how-to-restaurant/` | `/posts/2018-10-28-how-to-restaurant/` | How To: Restaurant | ✓ |
| `/2018/10/31/a-pound-of-flesh-and-a-hot-tub/` | `/posts/2018-10-31-a-pound-of-flesh-and-a-hot-tub/` | A Pound of Flesh and a Hot Tub | ✓ |
| `/2019/01/15/old-again-new-again/` | `/posts/2019-01-15-old-again-new-again/` | Old Again, New Again | ✓ |
| `/2019/05/22/2019-drupalcon-higher-ed-summit/` | `/posts/2019-05-22-2019-drupalcon-higher-ed-summit/` | 2019 DrupalCon Higher Ed Summit | ✓ |
| `/2019/09/02/diminished-zeal-with-steady-commitment/` | `/posts/2019-09-02-diminished-zeal-with-steady-commitment/` | Diminished Zeal with Steady Commitment | ✓ |
| `/2019/09/14/my-windows-10-setup/` | `/posts/2019-09-14-my-windows-10-setup/` | My Windows 10 Setup | ✓ |
| `/2019/09/17/don-t-you-miss-carbs/` | `/posts/2019-09-17-don-t-you-miss-carbs/` | Don't you miss carbs? | ✓ |
| `/2019/10/31/lorraine-barbara-kubik-skrinak/` | `/posts/2019-10-31-lorraine-barbara-kubik-skrinak/` | Lorraine Barbara Kubik Skrinak | ✓ |
| `/2020/06/08/happy-third-lowcarbiversary/` | `/posts/2020-06-08-happy-third-lowcarbiversary/` | Happy Third Lowcarbiversary | ✓ |
| `/2020/12/03/drupal-multisite-on-a-dime/` | `/posts/2020-12-03-drupal-multisite-on-a-dime/` | Drupal Multisite on a Dime | ✓ |
| `/2021/01/16/jekyll-hugo-and-me/` | `/posts/2021-01-16-jekyll-hugo-and-me/` | Jekyll, Hugo, and Me | ✓ |
| `/2021/01/18/two-guys-watch-a-burning-house/` | `/posts/2021-01-18-two-guys-watch-a-burning-house/` | Two Guys Watch a Burning House | ✓ |
| `/2021/01/19/my-hero-karen/` | `/posts/2021-01-19-my-hero-karen/` | My Hero Karen | ✓ |
| `/2021/01/19/shinleaf-campsite/` | `/posts/2021-01-19-shinleaf-campsite/` | Shinleaf Campsite | ✓ |
| `/2021/01/30/gratitude-and-that-s-right/` | `/posts/2021-01-30-gratitude-and-that-s-right/` | Gratitude and That's Right | ✓ |
| `/2021/02/20/loose-shorts-and-the-tsa/` | `/posts/2021-02-20-loose-shorts-and-the-tsa/` | Loose Shorts and the TSA | ✓ |
| `/2021/04/02/in-the-jekyll-garden/` | `/posts/2021-04-02-in-the-jekyll-garden/` | In the Jekyll Garden | ✓ |
| `/2022/04/07/code-presentation/` | `/posts/2022-04-07-code-presentation/` | Code Presentation | ✓ |
| `/2022/05/04/wohd/` | `/posts/2022-05-04-wohd/` | WOHD | ✓ |
| `/2025/09/19/modernizing-an-old-jekyll-blog-with-github-actions-and-ai/` | `/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/` | Modernizing an Old Jekyll Blog with GitHub Actions and AI | ✓ |
| `/2025/09/19/modernizing-an-old-jekyll-blog-with-github-actions-and-ai/` | `/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/` | Modernizing an Old Jekyll Blog with GitHub Actions and AI | ✓ |

## How It Works

### Dynamic Route Generation

The redirect route at `src/pages/[year]/[month]/[day]/[...slug].astro` works as follows:

1. **Collect all blog posts** from the `blog` collection
2. **Parse each post ID** (e.g., `2025-09-19-modernizing-...`) into components:
   - Year: `2025`
   - Month: `09`
   - Day: `19`
   - Slug: `modernizing-an-old-jekyll-blog-with-github-actions-and-ai`
3. **Generate static paths** for all posts in the Jekyll URL format
4. **Match incoming requests** to the Jekyll format and redirect to Astro format with HTTP 301

### Example

**Old Jekyll URL:**
```
https://kyle.skrinak.com/2025/09/19/modernizing-an-old-jekyll-blog-with-github-actions-and-ai/
```

**Browser request triggers:**
1. Route matching: `[year]=2025`, `[month]=09`, `[day]=19`, `[slug]=modernizing-an-old-jekyll-blog-with-github-actions-and-ai`
2. Post lookup: Finds post with ID `2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai`
3. Permanent redirect (HTTP 301) to:
```
https://kyle.skrinak.com/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/
```

## SEO Implications

- **301 Permanent Redirects**: Search engines will transfer page authority from old URLs to new URLs
- **Sitemap**: Only new Astro URLs are included in `sitemap.xml`
- **Search Engines**: Will gradually reindex new URLs and deprecate old ones
- **Backlinks**: Old links will continue to work and preserve SEO value

## Additional Routes

### New Astro URLs

Besides the redirect route, the following routes serve the new Astro URLs:

- **Primary Posts Route**: `/posts/[...slug]` (default)
- **Alternate Blog Route**: `/blog/[...slug]` (also available)

## Testing Redirects

To test redirects locally:

```bash
npm run dev
curl -I http://localhost:4321/2025/09/19/modernizing-an-old-jekyll-blog-with-github-actions-and-ai/
```

Expected output:
```
HTTP/1.1 301 Moved Permanently
Location: /posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/
```

## Future Considerations

- Monitor Google Search Console for redirect patterns
- Verify old Jekyll URLs are properly indexed and redirecting
- Consider adding canonical tags to new URLs (already done by Astro)
- Track redirect performance in analytics
