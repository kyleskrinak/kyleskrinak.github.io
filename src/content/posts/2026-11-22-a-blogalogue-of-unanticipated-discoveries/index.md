---
title: A Blogalogue of Unanticipated Discoveries
pubDatetime: 2026-11-22T00:00:00.000Z
tags:
  - maintenance
  - astro
  - claude-code
  - indieweb
  - web-development
  - career
  - accessibility
  - seo
draft: false
description: Since my last post, I rebuilt my resume, fixed my social cards and
  accessibility, learned my theme had started my site as a copy, and left
  IndieWeb.
caption: Gustave Caillebotte, <em>The Floor Scrapers</em>, 1875. The Salon jury
  rejected it as vulgar.
image: ./floor-scrapers.webp
alt: Three shirtless men kneel on a bare wooden floor and scrape away its old
  finish, while light from a balcony window falls across the curled shavings.
---

Well, hello there. It’s been a while. Even though my last post was over a month ago, I have burned through my weekly Claude Pro token allotments on website updates, such as security configuration, maintenance, and a rethought, reimplemented resume (each of which led to unanticipated discoveries). I also withdrew from [IndieWeb](https://indieweb.org/). Once the bloom was off the IndieWeb rose, I found myself dry from the initial excitement. Here’s what went down and some out-loud thinking about the changes.

### Resume (Oct 6–Nov 10)

I have had my employer request quarterly performance updates for some time. For years, I would mostly do the “minimum viable product” of output here, since I saw that much of it was more human resources (HR) activity than valuable work. Thanks to [Manager Tools’ podcasts](https://www.manager-tools.com/), I have come to believe this is a lost opportunity, not only for me to review and reassess my current performance, but also to review and reassess where I am in my career and what adjustments I should make. But, as people in recovery programs say, the longest distance is the path from your head to your heart, and despite being a fan for years, I am slowly reflecting on Manager Tools’ guidance in my actual vocation management.

As I was reviewing my performance, I came to learn that I need to be mindful of my employer’s sharing guidelines. Resumes can be (should be) oddly specific, so I needed to update my quarterly resume review, which echoes my employer’s quarterly cycle, to respect the company’s guardrails. After adding my quarterly achievements, I started to walk the fine line between including specific deliverables and broadly alluding to them.

Also, these updates uncovered many weaknesses in my resume management system that I needed to address. These gaps included dumb things, like front matter, PDF and print view, and adding DOCX and TXT outputs. I then aligned my resume with my LinkedIn in a way that previously was a costly effort. In the process, I made sure my LinkedIn content followed my employer’s sharing guidelines. To keep sensitive information out of public view, I moved the private, specific achievements to local, secure storage. Since Claude lacks my “just get it done” bias, it found inconsistencies in my work history and info that wasn’t making sense, and I reconciled the findings. I made other minor updates, such as providing a way to rank resume bullets.

### Search (Oct 8–Nov 11)

Filed under “the care and feeding of one’s website” are the reports I receive from [Google Search Console](https://search.google.com/search-console/about) (GSC). My click count is very humbling. I’m confident that I have far more scrapers and bots than humans reading my musings. Nevertheless, I am professionally adjacent to all things search engine optimization (SEO). I like to keep tabs on this space and am familiar with how it behaves. Note that I deliberately did not enable Google Analytics, as it is more privacy-invasive than I care for on a personal website.

I get regular notifications from GSC about issues it’s finding. The reports led me to review how I build and meta-tag my pages, fix semantic problems, and adjust other SEO-related configuration. Google had crawled a 2018 test deck, a reveal.js experiment that my presentations page still listed, so I deleted it. I also came to accept that, without a significant effort, I will be bottom-dwelling with the carp when it comes to traffic and how Google sees whether it’s worth its compute to see what’s up on this domain.

### Social cards (Oct 12–31)

Lift a rock, find a snake. Social cards are the previews that LinkedIn, Facebook, X, and messaging apps show when someone shares a link: an image, a title, and a short description. I have automated tests to confirm there is no visual drift, and when I extended them to cover social cards, they turned up [Open Graph](https://ogp.me/) (OG) images with a byline reading "by" and no name. I fixed the byline and a checkerboard showing through my avatar badge, then redesigned the home page card. We settled on a good enough social card.

### IndieWeb (Oct 31)

In my GitHub issue tracker was my IndieWeb on-ramp, a checklist I opened in July for joining the community. I was [so initially excited](https://kyle.skrinak.com/posts/2026-08-24-from-big-kibble-to-indie-feed/) by the prospect of serendipitous content discoveries like what social media affords but without the trickery. Three months in, I found something else entirely. IndieWeb is a great idea, but it lacks momentum and breadth. It’s a volunteer community, so sure, I could have hung around to be the outlier I’m looking for. How will a community of people with my temperament and taste grow if we don’t stick around? But time is limited, life is short, and I decided to unenroll myself. That said, it was not all for naught. The onboarding helped strengthen my site: an [h-card](https://microformats.org/wiki/h-card) that tells other sites who I am, [`rel="me"`](https://indieweb.org/rel-me) links that tie my profiles to this site, a “Reply by email” link on every post, and a nightly check that measures page weight the way the [512KB Club](https://512kb.club/) does.

### Accessibility (Oct 31–Nov 1)

[Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) flagged faint link and badge colors, breadcrumbs that relied on color alone, a skipped heading, and two untitled embeds. After the fixes, Accessibility scores were 100 on every page type. Lighthouse also caught a hero image larger than its container, and on a standard desktop screen, it now loads at 750 px, not 1200.

### Theme (Nov 3–5)

As I worked through the accessibility fixes, I realized that my theme, [AstroPaper](https://github.com/satnaing/astro-paper), had been essentially static since I started using it. First, a digression. I have been a fan of theme inheritance since Drupal 6 introduced it in 2008. My previous Jekyll theme, [Minimal Mistakes](https://mmistakes.github.io/minimal-mistakes/), supported it, and a simple Ruby update brought in the base theme’s changes. I got the benefits of the maintainers’ expertise while keeping my local variations. I wrongly presumed that AstroPaper supported the same. However, as my customizations grew, I learned, to my astonishment, that AstroPaper lacks theme inheritance: it had started my site as a copy.

So I scrambled to find a way to bring upstream changes into my copy of the theme. AstroPaper’s own guide, “[How to update dependencies of AstroPaper](https://astro-paper.pages.dev/posts/how-to-update-dependencies/),” had the answer in its section on Git: add the theme’s repository as a second Git remote and merge its releases the way any fork would. A file in my repo, `UPSTREAM.md`, details the steps and the rules for conflicts. Where the theme and my site do the same job differently, the theme’s method wins, after my review. That’s the whole idea. I learn from reviewing the work of others. My site-only features stay, and I note each place where my site forks from the theme as a comment in the code and a row in a table. The first merge, Nov 3–5, took the site from v5.5.1 to v7.0.0, 39 upstream commits I’d missed.

### Dependencies (Oct 6–Nov 14)

I thought I had Renovate configured correctly after [my last post](https://kyle.skrinak.com/posts/2026-10-04-a-proactive-defense-against-supply-chain-attacks/), but Claude was alerting me, sideways, that it wasn't. It pointed out pending Dependabot alerts that Renovate seemed to be ignoring. Patches had backed up and sat idle, and the alerts made it look like a security problem. Digging deeper, Claude found the trouble somewhere else. Renovate's security updates only reach the packages I install directly, and most of the alerts sat in packages those packages depend on. A weekly job covers those, and it had never produced a single update. Routine updates crowded it out of its early-Monday window, and npm 12 blocked the lockfile rebuild it needed, which Renovate reported as nothing to do. We repaired both, and Renovate's next update cleared 19 Dependabot alerts, 7 of them high. The system has been behaving since these changes.

### “What stands in the way becomes the way”

Early in this post, I mentioned a Manager Tools lesson: a quarterly review is a chance to reassess where I stand, and, in this very post-2022 world, I used this opportunity to clean up my website as well, like a colonoscopy when I just needed to update some bullets. GSC's reports, my new social card tests, Lighthouse's audits, the theme's upstream commits, and Claude's look at my Renovate setup each made me look again at something I thought was settled. Sure, I ate up all my weekly token allotments, but the site came out better for each one.
