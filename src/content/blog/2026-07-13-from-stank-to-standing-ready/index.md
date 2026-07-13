---
title: "From Stank to Standing Ready — Welcome Home, Dear Resume"
pubDate: 2026-07-13T00:00:00.000Z
description: "After fourteen years as a Google Doc, my resume has finally moved home—wired into my blog with a pipeline that enforces the quarterly update discipline I knew I should have had all along."
image: ./2026-07-13-eakins-writing-master.webp
alt: Thomas Eakins painting of Benjamin Eakins seated at a desk, writing with a quill pen
caption: Thomas Eakins, "The Writing Master," 1882. Benjamin Eakins, professional penman. His resume presumably had aligned bullets.
tags:
  - career
  - workflow
  - ai
  - personal
  - claude-code
---

I've finally and properly integrated [my resume](https://kyle.skrinak.com/resume/) into my professional website. After fourteen years as a Google Doc, it now lives on my blog, where a pipeline I built with Claude's help manages it. GDocs styling controls are somewhat acceptable, but only at a steep time cost, and even all these years later, they still lack reasonable typographic control. I wanted easy and consistent formatting. I wanted to generate resume variations tailored to specific opportunities, while keeping a default version always live on the site. And I wanted an MVP application to manage the whole thing—something I couldn't have named a decade ago, and couldn't have built if I had. The time and skills it demanded sat outside my reach until the tools changed.

The motivator behind the move reaches back further than this year. I've listened to [Manager Tools](https://www.manager-tools.com/) since the early days of podcasting—among the first management-focused shows in the medium—and their [Career Tools](https://www.manager-tools.com/podcasts/career-tools) spinoff made their resume guidance canonical: one page, measurable accomplishments, active voice, reviewed quarterly, never left to gather dust. I absorbed that doctrine over a decade. I believed it. I just never built the system to make it stick.

Until this year, the gap between belief and action was the story of my resume. I knew what I should do. I agreed with the guidance. The Google Doc version history tells what actually happened: clusters of edits around organizational upheaval and anxiety, and long silences in between, a document that I only updated when uncertainty arrived. I was reactive rather than proactive. I maintained my resume the way most people do—when I had to, not when I should.

When Career Tools launched their "What Your Resume Says" series to critique real submissions, I sent mine. [1] Their large audience made my evisceration an epic spectacle. They anonymized the resume by giving it a character name—Ike Godsey from The Waltons—and removing contact details, but if you'd seen it, it would have been visually recognizable as mine. I'd submitted it believing I'd nailed their guidance—absorbed the doctrine, applied it, done solid work.

I was wrong on all counts.

I'm not a graphic designer, though I work in the graphic arts industry. I've always preferred to get things done rather than get stuck in the details that slow projects down—so I lean on the designers and technicians around me for precision work. By 2013, I'd also watched typography standards erode so far that I'd convinced myself such details no longer mattered. A resume in Times New Roman, a few formatting inconsistencies—these felt like relics of a more precious era. I submitted mine with that mindset: pragmatic, if not polished.

The Career Tools hosts didn't see pragmatism. They saw my list of responsibilities rather than my accomplishments. Pronouns in "we" when they needed to see what *I* had done. An objective statement about "the nexus of design and technology," two wasted lines that one host said existed only for his amusement. No revenue figures, no headcount managed, nothing measurable. And a closing line: "You can find samples here on the internet." One host said he'd stop reading halfway down.

The diagnosis that stuck hardest: if a thing is measurable and you didn't measure it, the reader assumes you didn't do it.

I rewrote the resume in six days, because the critique was stinging and accurate. The "we" problem was real. The absent measurements were real. The former voice of Career Tools who wrote many of the casts helped me refine it on the side—diametrically opposed to the public lampooning, her help was direct and kind. By June 2013, Duke hired me. The shredding had worked. The doctrine was right. I knew it then, and I believed it for the next thirteen years.

But I didn't act on it.

The gap between belief and action closed because the tools became available and cheap. Since September 2025, I've been [rebuilding my entire blog infrastructure](https://kyle.skrinak.com/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/) with AI assistance—[migrating from Jekyll to Astro](https://kyle.skrinak.com/posts/2026-02-02-fun-at-scale/), [automating deployment](https://kyle.skrinak.com/posts/2026-01-01-ai-assisted-modernization/), rethinking how content flows through the system. The resume pipeline is the latest iteration of that same pattern: taking something I knew I should maintain and building scheduled mechanisms that trigger my action.

The pipeline pulls the resume from a single Markdown source and renders it as a web page with screen-optimized styling. It generates similar print-optimized styling for the print-to-PDF version. The content review process ensures that the final output is a single PDF page. The real flywheel is the new quarterly discipline: every three months, I will update the source with new achievements, new or refined metrics, skills, and certifications earned—the stuff that typically happens in a productive working quarter. The system doesn't automate the writing; it automates the *schedule*. I don't have to remember to review. The calendar does. Separately, I can manually invoke the creation of resume variants, different versions tailored to specific opportunities, while the default stays locked on the site. All from a single source, never forked. And the system verifies every update against the Manager Tools rubric that should have guided me all along: one page, measurable claims, active voice. Because the source lives in version control with a changelog, the record of what changed and why stays legible forever.

The thirteen-year gap between knowing better and doing better closed when I finally built a system much closer to my needs than I had previously thought possible. It wasn't because my willpower improved, nor was it because the doctrine changed. The arithmetic changed. The tools exist now. They're cheap and accessible. And they made it rational to do what I should have been doing all along.

The resume now updates on schedule because my automation will remind me to start the quarterly update. I remain in full control of my resume ownership. That's my design, but the real test is what happens in the next quarter—whether the variants actually serve when opportunities arrive, and whether I will finally achieve what I have put off for so long. The machinery is standing ready; the question is whether I will use it well. Stay tuned, dear reader.

A resume that lives under my full control, and in an environment that is entirely mine, removes previously blocking or demotivating aspects. It stops being drudgery. I have fully integrated it into my professional presence — accessible on demand. Previously, it sat in a digital drawer — accessible but at a considerable cost. This integration enforces my quarterly review. The architecture supports my goals. My repo issues will remind me to update my latest professional achievements. The system ensures I'm not stuffing garbage in. The machinery waits on me to keep the resume moving forward.

More importantly, this is less about the automating pipeline and more about my blind spots, the gaps between my resume editing and how the professional world will read it. These gaps are highly individualistic. For some, it's a coach; others lean on peer review, mentor check-ins, and public accountability. The point is less about what I built; it's more about coming to know that my blind spots are clouding my self-assessment and then, whatever it takes, building a response as individualistic as you are.

## Notes

[1] Manager Tools, "What Your Resume Says – Chapter 3," Career Tools podcast, January 2013. https://www.manager-tools.com/2013/01/what-your-resume-says-chapter-3
