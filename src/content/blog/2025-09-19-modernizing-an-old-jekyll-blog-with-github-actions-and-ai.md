---
title: Modernizing an Old Jekyll Blog with GitHub Actions and AI
pubDate: 2025-09-19T00:00:00.000Z
categories: []
tags:
  - Jekyll
  - GitHub Actions
  - AWS
  - CloudFront
  - OIDC
  - html-proofer
  - LLM
description: Well, hello there, 2025. After years away, I rebuilt my Jekyll blog with GitHub Actions, CloudFront, and AI—streamlined publishing with modern tools and lessons learned.
image: ../../assets/images/typewriter-to-laptop.jpg
alt: "typewriter to laptop"
source: jekyll
---


## Why Now?

Well, hello there, September 2025. It’s been a while, hasn’t it? I’ve been meaning to update my online presence for a while, and the old blog sitting untouched for years kept reminding me it was overdue. A recent home-grounding cold gave me the time and space to revisit a long-neglected pet project: this blog. Around the same time, I had also scaled back my time on social media — Facebook, X, Instagram, and the like. The constant distraction had become a death-by-a-thousand-cuts, and Facebook’s push to make “Reels” as prominent as TikTok (which I’ve avoided for that exact reason) only sealed the deal. With that space reclaimed, I found I had more energy to create instead of mindlessly scrolling through mediocre content. Before diving back in, I weighed whether to keep it in Jekyll or switch to one of the many newer static site generators. I examined various metrics, such as community size, commit activity, and available tools. In the end, Jekyll still met my simple purposes, even though the theme I use is essentially deprecated. The frustrating part is that the theme’s author no longer supports its development. Though it may not be cutting edge anymore, it works — and that’s enough to get the blog moving again.

## Setting the Stage

Since I last blogged, a revolutionary new tool has emerged: LLMs. In the past, my research for blog maintenance was a step-by-step cycle of searching for instructions, making trial attempts, and then searching again to figure out why things broke—more time on workflow, less time on content. With LLMs, I wondered if I could flip that balance and make the technical side easier.

One of the biggest attractions of coming back to this project was the promise of managing deployments entirely through code commits. No more manual directory uploads or ad-hoc scripts to remember — just write, commit, push, and let the pipeline do its job. First, though, I had to establish the fundamental environment. This blog has two targets: GitHub Pages, which I use for staging and preview, and an AWS S3 bucket served through CloudFront for production. To keep things clean, I maintain a clear separation between the two. Staging on GitHub Pages makes it easy to preview changes before they go live, while production on S3 + CloudFront gives me the durability and performance I need for a public-facing site. That balance — fast iteration on staging, solid delivery on production — sets the foundation for everything else in this rebuild.

## Automating with GitHub Actions

Once the environments were in place, the next step was getting deployments to happen automatically. In the past, publishing meant carefully following a checklist or running brittle scripts that never felt quite trustworthy. I had to log in to GitHub, check the GitHub pages, then log in to AWS and push directories up via SSH or the UI. Then I would have to reset the CloudFront cache each time. This time around, I wanted the workflow to live entirely inside the repo, so that committing code wasn’t just version control — it was deployment. GitHub Actions turned out to be the right fit.

With Actions, I could wire up a pipeline that builds the Jekyll site, runs tests, and pushes the results where they need to go. The key to making this work for production was establishing trust between GitHub and AWS, and that’s where OIDC comes in. Instead of hard-coding credentials or passing around access keys, GitHub can request temporary credentials directly from AWS. It feels both cleaner and more secure than what I used to cobble together. I wish to ensure that I am not only automating but also using secure practices.

That shift — from ad-hoc scripts and stored secrets to declarative workflows and ephemeral credentials — is one of the most evident signs that this blog’s infrastructure has grown up.

## Smarter Checks: html-proofer v5

Another unexpected, big, and pleasantly surprising change since I last touched this blog is how much the Jekyll ecosystem has matured. Back then, catching broken links or malformed markup meant either waiting until a page failed in production or trying to spot problems by hand. It wasn’t efficient, and it definitely wasn’t reliable. I use an old trusty web spider tool, Xenu, which is great for link discovery, but it progressively shows its age as HTML continues to evolve.

Enter the Ruby library html-proofer v5. The tool has been around for years, but the latest version is far more flexible and better integrated with modern workflows. It runs right inside the pipeline, checking links, images, and HTML validity before anything goes live. The days of scrolling through a published site hoping not to stumble across a 404 are, thankfully, over.

I might have discovered this upgrade eventually on my own, but LLMs accelerated the process. Instead of combing through outdated blog posts and scattered documentation, I was pointed directly to the library for inclusion in my workflow as an automated QA review. There was a glitch, however, as ChatGPT hallucinated that there was a configuration file for the library. More on that later. For once, the time spent was on writing content — not chasing down arcane build errors.

## Delivery with CloudFront

This site has always sat behind CloudFront, but coming back to it after a long pause meant a few updates to match today’s best practices. The first was tightening the origin path: serving from S3 with an Origin Access Control (OAC) instead of the old wide-open patterns. Locking CloudFront to the bucket and letting it request objects with signed, temporary credentials closes a door I should have closed years ago.

While I was in there, I revisited the S3 endpoint choice. The “website” endpoint is convenient for static hosting, but the REST endpoint, paired with CloudFront, gives me more predictable behavior for headers and error responses. Either path works, but the important part was being explicit and consistent, so caching doesn’t surprise me later.

Caching itself needed a refresh. I simplified behaviors to make HTML short-lived and assets long-lived, using versioned filenames to prevent users from accessing stale content. Automatic invalidations for HTML on deploy replaced my old habit of manually mashing the “Create Invalidation” button: small thing, big quality-of-life improvement.

The end result: same idea as before—CloudFront in front of S3—but with stricter access, clearer origins, and saner cache rules. It feels less like a hobby setup and more like a site I can trust to behave.

## Developer Helpers

Along the way, I also built a couple of small conveniences that made this process smoother. I am a long-time fan of zsh. It is my preferred shell. As I was issuing console commands, the repeating patterns led me to wonder, “Can I put this into a script or function?” Again, LLMs to the rescue. One of the resulting changes is a small zsh helper I call `gitshas`, which provides a quick lookup of recent commit hashes along with their messages. It’s the kind of shortcut that saves seconds each time, but over dozens of commits, it makes referencing or rolling back changes far less tedious.

The other is a lightweight GitHub Issues workflow I’ve started using as a personal to-do list. Instead of juggling sticky notes or a separate task manager, I can capture ideas and track progress right where the work lives. For a solo project like this, that’s enough — no heavy project board or elaborate labels required, just a running log of what’s next and what I have done.

These helpers don’t change the architecture, but they make the day-to-day feel more polished. It’s the difference between fighting the tools and having them stay out of the way.

## Troubleshooting Notes

No rebuild goes smoothly, and this one was no exception. Some problems were old friends, and others were brand new. LinkedIn, for instance, still throws its infamous 999 and 403 errors when automated requests try to touch its pages. S3 handed me the occasional `AccessDenied` error until I tightened up the bucket policies to match the new CloudFront setup. And OIDC, while far more secure than static credentials, punished me with cryptic errors until I got the trust relationship between GitHub and AWS nailed down. Even SSH decided to join the party, with network blocks cropping up where I least expected them.

And then there were the lessons unique to building with an LLM. ChatGPT hallucinated a configuration file for HTML-Proofer that doesn’t actually exist, and for a while, I chased my tail trying to make it work. Eventually, I learned how to spot when the tool was confidently wrong — it’s a simple rule. If by the third attempt, the LLM code fails, presume a serious logic error in the generation. In the case of the HTML-Proofer, the LLM advised me to create a config file for library operations. This library does not have such a config file. However, a user suggested this in a support forum. The LLM ran with that as if the library had implemented this. That experience turned into one of the more valuable takeaways of the whole project: AI can accelerate the work, but it still needs a human in the loop to keep it honest.

## Wrapping Up

This project started as a way to dust off an old blog, but it turned into much more than that. I modernized the pipeline, tightened the infrastructure, and discovered tools in the Jekyll ecosystem that make publishing less fragile and more reliable. Just as importantly, I learned how to work alongside an LLM: when to lean on it for speed, and when to step back and question its output.

The result is a blog that’s easier to maintain, more secure, and a little more polished than it was the first time around. I can spend my energy on writing instead of wrestling with builds, deployments, and broken links. That’s the real win here — moving from a neglected project to something that feels alive again.

I’m indifferent whether this blog will draw a lot of readers, and that’s fine. For me, it’s enough that the process of writing and publishing feels like progress rather than friction. It reconnects me with what I love about technology, creativity, publishing, and access. And with the right balance of automation, infrastructure, and a skeptical eye on AI, I’m set up to keep it that way.
