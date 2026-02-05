---
title: "Fun at Scale"
pubDate: 2026-02-02T00:00:00.000Z
description: "How AI tools transformed my blog from languishing Jekyll infrastructure to a modern Astro site—and made computing enjoyable again"
image: ../../assets/images/fun-at-scale.svg
alt: "Good, Better, Best - progression diagram"
tags:
  - ai
  - claude-code
  - copilot
  - astro
  - jekyll
  - blog
  - workflow
---

When I started my blog, it was a novel and fun way to "get the word out," whatever that meant at my whim, both personally and professionally. As time went on, technologies changed, and so did my priorities. Complexity increased. Over the years, what was novel and practical became an unmanageable burden. Eventually, I just let it languish. I knew I had to do something, but it wasn't clear what that meant in practice.

Then the current buzz about "AI all the things" started. We couldn't use it at work, but I could play with it, and I had a specific use for it, this blog, that reflects my vocation as well as my personal life. I've already posted [about my initial Jekyll modernization using GitHub Actions and LLMs](/blog/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/) and [my two-day AI-assisted sprint that condensed weeks of work](/blog/2026-01-01-ai-assisted-modernization/) on my findings. Now, however, its application has become clear. Not only has my personal use case been relevant, but I've also dramatically improved my personal site, gained professional takeaways, and…

I am having fun again.

We know AI isn't a slam dunk. It hallucinates. It proposes overly complicated implementations. Yet I can manage the once diverse and disorderly mix of elements and guide them, using natural language, to an integrated end product. It's like a small team that dutifully processes my prompts and, if I phrase them right, outputs a deliverable or a milestone toward one. When I wrote a "recipe" program in BASIC, it was novel but only questionably functional. Even so, it was fun to show off. Now, at scale, this isn't a prototype. It's my website. And soon, important deliverables at my work.

Ready to have more fun, I pointed [GitHub Copilot](https://github.com/features/copilot) at whether I could refactor my [Jekyll](https://jekyllrb.com/) to a modern component-based replacement. Then I came across a recommendation to check out [Claude Code](https://claude.ai/download).

## The Migration: Claude Code and Astro

In my continuing AI journey, I can confirm that using Anthropic's Claude Code CLI in my terminal is, in a word, amazing. I heard about this from a tech podcast. I already had a task in mind: I had taken my [Jekyll](https://jekyllrb.com/) and [Minimal Mistakes](https://mmistakes.github.io/minimal-mistakes/) theme well past its end-of-life. I considered contributing back, but nearly every component the theme uses is deprecated or obsolete. So I installed Claude Code and was greeted with the terminal user interface (TUI). Oh, now you're singing to me. It is an impressive terminal interface. "Can you glean my intent from my repo?" In minutes, I had a shockingly accurate mirror of my blog and where we were. "Based on your review, suggest a contemporary Static Site Generator target I can migrate to." It had several suggestions that required my review. I finally arrived at [Astro](https://astro.build/), an NPM-based generator. [Hugo](https://gohugo.io/) was my fallback. "Create a plan to move my site from Jekyll to Astro." It developed a plan with a timeline. Claude Code estimated, "It should take about two weeks." That's quick; let's go. In hours, I was 80% finished. The markdown conversion was relatively smooth. I had to use a different markdown parser as I use an extended formatting set. Claude also converted my [reveal.js](https://revealjs.com/) presentation to [slidev](https://sli.dev/), a newer markdown-based presentation library. This took a few iterations, as I had custom markdown within reveal.js and had to identify the patterns that mapped to Astro components. With several more hours of effort, reviewing prompt suggestions across multiple options, Claude prompted me, and we had a nearly complete migration. Late in the migration, I learned I missed my second-most important page about my low-carb journey. I will be re-adding that page when I commit the branch in support of this blog post.

By the numbers, the migration was surprisingly successful. It seemed more performant, but I wanted numbers. I prompted Claude Code to identify and capture the difference using Chrome's [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/). Claude generated Lighthouse testing scripts that ran against both the Jekyll production site and the new Astro build, testing a sample of pages across desktop and mobile. It executed the tests, collected the Lighthouse JSON reports, and produced a comparison document.

The results were consistent: desktop scores improved by an average of 29 points (58.5 → 87.5), and mobile scores increased by 32 points (56.5 → 88.5). The best performer was my "Vim for Writers" post, which went from a 60 on desktop to 98, and from 58 to a perfect 100 on mobile. I found that ironic, as it's a simple light-touch text post.

For context, Lighthouse measures performance, accessibility, best practices, and SEO on a 0-100 scale. These weren't just theoretical gains; they represent real improvements in page load times, responsiveness, and user experience. The 30-point average improvement came from Astro's static site generation, which eliminates run-time overhead, handles responsive image variants and lazy loading, and ships zero unnecessary JavaScript by default.

What's interesting is that these gains applied across the entire blog, over 35 posts, without any per-post optimization. The architectural shift from Jekyll to Astro made better performance the default. I didn't have to fight for it on each page; it came with the migration. I also didn't have to manually run the tests and compile the results. I just asked for the comparison, and Claude handled the instrumentation.

## The Safety Net: Copilot's Second Opinion

OK, new theme, content migrated, working great locally, now it's time to push to my staging (github.io) and main blog website. I have been disciplined in using a PR for commits to both staging and main to become familiar with Gitflow. While stepping through the PR process and looking at GitHub's PR page, I discovered I can invite GitHub Copilot (GHC) to review my commit and trigger a review. This looked interesting, so I gave it a try. GHC started finding inconsistencies: testing, coding, documentation, and legitimate misses by Claude. I ran the comments through Claude, which confirmed the misses. I instructed Claude to address the comments and update the PR. Two or three passes later, (depending on the issues) the GHC review was clean, and I merged my PR. Claude has plugins that can do the same, but I prefer passing the review off this way. For now. That could change. This is all still highly dynamic and evolving.

## Why Bother Owning It?

So, here I am, 12 years after stumbling onto a fun way to share information, then blogging and playing with static sites, to, as of a year ago, an anchor and chain to the past.

Ironically, what motivated all of this is my growing dissatisfaction with social media. My blog was the forgotten option. I need to spend more time with long-form reading, writing, thinking, and less time with the quick distractions of cat memes and one-dimensional hot takes. As I considered options like [Substack](https://substack.com/) and [Medium](https://medium.com/), I was underwhelmed. They're not bad, but they all offer a model that isn't mine. I was ready to retire my blog when I realized I already had a platform I owned and could shape however I wanted. As a committed contrarian, I don't care about engagement, likes, or shares. With my platform, I own my content. My "platform" was this rusty old bucket. That's where AI comes in. Thanks to what I've described above, my 12-year-old blog now runs on a thoroughly refactored and contemporary stack with well-supported features.

So, my blog's back, baby! I'll be spending as much time on the content as the infrastructure with my AI amanuensis and the infra minions. I'll be writing and continuing to cut my teeth on the latest continuous integration routines and practices.
