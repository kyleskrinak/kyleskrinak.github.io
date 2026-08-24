---
title: "From Big Kibble to Indie Feed"
pubDate: 2026-08-24T00:00:00.000Z
description: "I went looking for what engagement might mean for a personal blog and found a fifteen-year-old movement that had been answering the question the whole time."
image: ./2026-08-24-cole-architects-dream.webp
alt: "Thomas Cole painting of an architect reclining on a column capital amid his drawings, looking out over Gothic, Greek, Roman and Egyptian buildings"
caption: "Thomas Cole, <em>The Architect's Dream</em>, 1840. Ithiel Town commissioned it, then refused to pay for it."
tags:
  - social-media
  - indieweb
  - web-development
  - ai
  - personal
published: true
---

> Sexy Lexy

So a virtual acquaintance responded on a thread on X started by a young female content producer, or at least how the content presents its author. Ugh. I don't want to get moralistic here, rather, my point is, why did X feature this on *my* feed? We can safely presume that X wagers that I'll see the same thing he did and feel its tug for my attention. No. I'm done with all this. I'll confess that despite my contrarian nature (No "F's" given on sports, for example), social media can and does hijack my attention. I don't want to live like this. Control my attention, and you feed my soul, my direction, my temperament.

---

As all five of you faithful followers know, I restarted my blog roughly this time last year. You can read about it restarting [here](https://kyle.skrinak.com/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/) and [here](https://kyle.skrinak.com/posts/2026-02-02-fun-at-scale/). Then, as time rolled on, I was able to improve my blog at a clip I'd never managed before, thanks to ChatGPT, GitHub, and then Claude. No, I don't mean content creation. That is mine. I mean the Jekyll-to-Astro migration, the GitHub Actions pipeline, the Playwright visual regression suite, the webmention implementation, among other infrastructure implementations. I now had something workable that I lacked for years.

"Sexy Lexy" was the last straw, but I had something better, though I didn't know that then. I had hopped from Facebook to Twitter to Instagram and finally to Substack. I was hoping Substack would be more long-form, and while it is, it is essentially a home for writers or famous people looking for a convenient place to post their content for a subscription fee. That’s great, but that’s not what I’m looking for. I’m a DevOps guy. I can build my own. I’m in control. As I started blogging again, I asked a question about what engagement might mean for my own blog. I wasn't looking for anything big, but I didn't want to be a voice in the wilderness, either.

I'm writing to get stuff off my chest and keep my IP mine. So I researched what that would mean, and Claude answered, "Indie Web." As I started to dig, the more I saw, the more I liked.

---

Every platform I've used made the same bargain. Bring your writing here, we'll bring the audience, and in exchange we own the room. As the old saying goes, when something is “free,” YOU’RE the commodity. These platforms are rented land, and the rent is your attention. The Indie Web flips this. Your site is your room. Comments arrive as webmentions, other people's sites pinging yours instead of a zombie third-party comment box. Readers find you through RSS or a webring. I used RSS until Google retired Google Reader in 2013 and tried a few replacements. However, social platforms were coming into their stride, and my RSS focus wavered.

The movement has a founding grievance. Yahoo shut down GeoCities in 2009, and millions of personal sites went with it, which taught a generation of people what it costs to build on other people’s infrastructure. A year later, two web developers, Aaron Parecki and Tantek Çelik, left a conference in Portland impatient with talk and wanting to build. Çelik had spent years on open standards and microformats, while Parecki had spent years on tools for personal websites. Between them, they had the standards knowledge to build an alternative rather than argue about one. The first IndieWebCamp met in June 2011. They've been at it since, unglamorously, while I spent more than a decade in the third-party corporate social media world.

I was excited to see a movement that echoed my frustration and one that rekindled an old preference as well. Others, frustrated by seeing their attention commodified and gamed, had developed a parallel system without the wired distractions. The posts either merit my attention or not. None of this was hidden. I wasn't looking. I mean, I was distracted, after all. It's like the warmth and comfort of visiting the house I grew up in, only in this analogy, I can safely go back inside and pick up where I left off.

Two casual weeks. That's what it took to go from reading about the Indie Web to being on it. Webmentions implemented to the specification. An h-card, a small block of markup in my footer with class names other sites parse to know my name and photo when my site pings theirs, and nobody grants it to me. RSS that actually validates. Fifteen years ago this would have been a season's work.

The Indie Web has opinions about weight. There's a club for sites under 512KB, a number that means different things depending on when you learned this trade. Frameworks have improved enormously since I started, and each arrives carrying its own baggage, most of which ships to the reader whether the reader needs it or not. Measuring my own site told me what I'd been sending strangers. Deciding what stays is the work.

What surprised me was how much of the Indie Web runs on people. The webring meant emailing a stranger and waiting to be let in, a transaction with no algorithm anywhere near it. Webmentions only work if the other end implemented them too. There's no growth team, no onboarding funnel, no notification when someone new joins. The whole thing operates at the speed of individuals doing optional work, which is either its fatal flaw or the entire point.

---

Thanks to this year's process, I now know what these tools are. The risks are real, and I'm no glossy optimist. The ethics of how these systems get built. The environmental cost: energy and water at a scale nobody advertises; the land and the resources consumed to keep the data centers running. I agree with Pope Leo XIV, whose first encyclical, *Magnifica Humanitas*, addresses the safeguarding of the human person in the age of artificial intelligence.[1] Leo describes a colonialism that has added data to what it already takes: health records and genetic profiles harvested from regions without the standing to object, so that whoever holds the information can decide whose needs count. There's more to say there than I'll say here.

The critique of attention capture is a critique of the unwitting, which would be a comfortable place to stand if I could claim it. I can't. Naming a thing has never yet excused me from resisting it. I don't believe the current AI paradigm is sustainable. Leo's question isn't whether to use these tools but what gets built with them, which is the only question I can actually answer from where I sit.

What the Indie Web lacks is the machinery that makes it hard to close a feed. Nothing here is built to hold me. And yet the reading has been better than I anticipated.

## Notes

[1] Leo XIV, *Magnifica Humanitas*, signed 15 May 2026 on the 135th anniversary of Leo XIII's *Rerum Novarum*, released 25 May 2026. https://www.vatican.va/content/leo-xiv/en/encyclicals/documents/20260515-magnifica-humanitas.html
