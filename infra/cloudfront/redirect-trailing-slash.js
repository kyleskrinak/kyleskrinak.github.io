/**
 * CloudFront Function — Redirect_Trailing_Slash
 *
 * Distribution: E1YF7GVLAW8XON   Event type: viewer-request
 * Runtime:      cloudfront-js-1.0
 *
 * THIS FILE IS THE SOURCE OF TRUTH. AWS holds a deployed copy; edit here and
 * ship with ./infra/cloudfront/deploy.sh, never through the console. Before
 * this file existed the function lived only in AWS, which broke the project's
 * single-source-of-truth rule for configuration.
 *
 * Runtime constraints (cloudfront-js-1.0 is ES5.1 plus a few ES6 additions):
 *   - No const/let, arrow functions, template literals, Object.entries,
 *     Object.assign, spread, or default parameters.
 *   - String endsWith/includes ARE available. That is not read off the docs:
 *     the previously deployed version used both in production for months.
 *   - Hard 10 KB limit on the published source. The map below is ~2 KB.
 *   - Only one function may be attached per event type, so legacy redirects
 *     have to live inside this function rather than in a second one.
 *
 * Why 301s here instead of the repo's meta-refresh stub convention: a viewer-
 * request function runs ahead of the cache, so a real 301 passes link signal
 * cleanly and takes effect on publish with no invalidation. The existing stubs
 * pair a refresh with noindex, which is contradictory signaling.
 */

/**
 * Legacy URL -> current URL.
 *
 * Keys are canonical (trailing slash) except where the legacy path carries a
 * file extension. handler() also probes the slash-appended form, so a request
 * for /wohd and one for /wohd/ both resolve in a single hop rather than
 * bouncing through the trailing-slash 301 first.
 *
 * request.uri arrives PERCENT-ENCODED. Verified against production: a request
 * for "/personal%20productivity/first-blog-post" comes back 301 with
 * "location: /personal%20productivity/first-blog-post/", and the function
 * builds that header from uri + '/'. So space-bearing keys use %20.
 *
 * Never point an entry at a noindex page. /posts/, its pagination, and /tags/
 * are all noindex; redirecting indexed legacy URLs there would discard the
 * link equity this map exists to preserve. /archives/ is the only indexable
 * listing page, which is why the Jekyll listing URLs land on it.
 *
 * Every target below was confirmed 200 on production, and every key below was
 * confirmed 404, before this map was written.
 */
var LEGACY_REDIRECTS = {
    // Jekyll listing and pagination pages.
    '/year-archive/': '/archives/',
    '/categories/': '/archives/',
    '/page2/': '/archives/',
    '/page3/': '/archives/',
    '/page4/': '/archives/',
    '/page5/': '/archives/',

    // Jekyll category-prefixed post URLs.
    '/personal/meet-holly/': '/posts/2021-01-30-meet-holly/',
    '/lchf/don-t-you-miss-carbs/': '/posts/2019-09-17-don-t-you-miss-carbs/',
    '/lchf/my-first-lchf-post/': '/posts/2018-09-30-my-first-lchf-post/',
    '/drupal/drupalcon-nashville-2018-video-playlist/': '/posts/2018-05-13-drupalcon-nashville-2018-video-playlist/',
    '/in-the-jekyll-garden/': '/posts/2021-04-02-in-the-jekyll-garden/',

    // Presentation shortcut. Points at the deck, not at the post that
    // announces it, matching the /code-presentation/ stub, which canonicals
    // to /presentations/code-presentation.html. A deck is the destination in
    // its own right; it does not need a post as a landing page.
    '/wohd/': '/presentations/wohd.html',

    // "personal productivity" category, space percent-encoded as it arrives.
    '/personal%20productivity/first-blog-post/': '/posts/2016-10-31-first-blog-post/',
    '/personal%20productivity/vim-for-writers/': '/posts/2017-02-09-vim-for-writers/',

    // Leftover from the duplicate /blog/ route removed in 89a82a6. That route
    // used dateless slugs in this era, so there is no mechanical /blog/ ->
    // /posts/ rewrite; entries here are added only with evidence the URL was
    // actually indexed.
    '/blog/modernizing-an-old-jekyll-blog-with-github-actions-and-ai/': '/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/',

    // Renamed in bcc0768. The old slugs repeated the date segment, e.g.
    // 2018-04-09-drupalcon-nashville-2018-04-09-2018-higher-ed-summit-day.
    '/posts/2018-04-09-drupalcon-nashville-2018-04-09-2018-higher-ed-summit-day/': '/posts/2018-04-09-drupalcon-nashville-higher-ed-summit-day/',
    '/posts/2018-04-10-drupalcon-nashville-2018-04-10-2018-higher-ed-summit-day/': '/posts/2018-04-10-drupalcon-nashville-higher-ed-summit-day/',
    '/posts/2018-04-11-drupalcon-nashville-2018-04-11-2018-higher-ed-summit-day/': '/posts/2018-04-11-drupalcon-nashville-higher-ed-summit-day/',

    // Contains a dot, so it never reaches the extensionless branch below and
    // would otherwise fall straight through to a 404. Exact match required.
    '/pages/my-low-carb.html': '/lchf/'
};

function movedPermanently(location) {
    return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: {
            location: { value: location }
        }
    };
}

function legacyTarget(uri) {
    // hasOwnProperty.call, not `uri in LEGACY_REDIRECTS` or a truthiness test:
    // a request for /constructor or /__proto__ would otherwise hit an inherited
    // Object.prototype member and redirect to garbage.
    if (Object.prototype.hasOwnProperty.call(LEGACY_REDIRECTS, uri)) {
        return LEGACY_REDIRECTS[uri];
    }
    if (!uri.endsWith('/')) {
        var withSlash = uri + '/';
        if (Object.prototype.hasOwnProperty.call(LEGACY_REDIRECTS, withSlash)) {
            return LEGACY_REDIRECTS[withSlash];
        }
    }
    return null;
}

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Legacy map first, so a mapped path reaches its target in one hop instead
    // of being rewritten by the trailing-slash rule on the way.
    var target = legacyTarget(uri);
    if (target) {
        return movedPermanently(target);
    }

    // Redirect extensionless paths without trailing slash to canonical slash URL.
    if (!uri.endsWith('/') && !uri.includes('.')) {
        return movedPermanently(uri + '/');
    }

    // Let root be handled by DefaultRootObject.
    if (uri === '/') {
        return request;
    }

    // For trailing-slash paths, serve index.html from origin.
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    }

    return request;
}
