---
title: "The Cathedral and the Kludge"
pubDate: 2026-07-11T00:00:00.000Z
description: "Two websites, two deaths, and what thirty years in electronic media finally made clear: nothing on the web is permanent — some things are merely kept."
image: ./2026-07-11-homer-breezing-up.webp
alt: Winslow Homer painting of a small sailboat heeling under full sail, a man and three boys aboard on open water
caption: Winslow Homer, "Breezing Up (A Fair Wind)," 1876. The boat that finished was the one its sailor never stopped maintaining.
tags:
  - maintenance
  - permanence
  - personal
---

Over the past six months, I've received over 50 emails from GoDaddy. Each one announces the retirement of another service tied to a website I built years ago for a business associate, Mike, someone I came to consider a friend over time as well. His site still runs, technically. But his web presence is decaying in pieces. At the rate I'm writing this blog post, his site might cease to exist before I finish writing and posting it. When he started the site back in 2001, he bought every product-adjacent domain he could find, some 50 in all. Those are the ones sending most of the notices now. Most of it is Drupal, still serving the content. One corner isn't: a catalog lookup running on Classic ASP, old enough now that it half-works. A user can still drill down through make, model, and part, but the catalog listing that should follow never renders. However, none of this is my problem anymore. It's not a clean decommission. It's attrition.

These GoDaddy notices have been accelerating. I've received them for years, back to when I was the site's admin, and for years the invoices were paid and closed. That stopped last year. The notices turned from warnings into YOUR SERVICES WILL BE CANCELED. And they have been. The gears are grinding to a halt.

Mike was salt of the earth, my parents' generation to the bone. He'd hand you an obnoxious political opinion and a warm question about your life in the same breath, and I came to enjoy both. The site business was quick and routine: a domain renewal, an email that wouldn't send. His obnoxious political emails placed him on a few denied lists, and he demanded this be "fixed." The rest of the call was longer and friendlier, two men comparing notes on where they'd gotten to. I'd become his IT guy, and I honor my commitments, so I always answered. But I was tired. Tired of being the help desk for his iPhone, tired in the way that obligation wears on you when it never lets up. He called me one last time, a couple of months before he died. I didn't call back. There's always time, right? I assumed wrongly.

I've been here before. Service stoppage is a normal part of web operations, but the unplanned cessation of a website is something else. It reminds me of another abrupt end: a different website, a different owner, a different environment, a different audience.

---

In the 2010s, I ran web hosting for Duke's undergraduate school. Most of our work was on the websites that promote the undergraduate departments. The more interesting projects, and potentially cumbersome, were the professors with their own academic sites and with "academic latitude," all the latitude an academic institution grants a scholar's work.

One of them, an emeritus professor, had built something remarkable: a collection of interactive cybertexts, begun in 2001, that grew year after year into an archive of more than 11,000 works, with readers around the world. The word "cyber" has been worn smooth by overuse, bolted onto anything that touches a computer, but Aarseth meant something precise by it in 1997: a text in which the medium itself does mechanical work, where the reader's traversal alters what the text becomes. A Spanish virtual library had sought him out, its founder inviting him to lecture and to advise. By any measure, he stood at the vanguard. He'd seen what the early web could do for scholarship before most of his colleagues thought to ask the question.

He was, by every account including mine, brilliant and charming, a man I held and hold in high regard. The vagaries of his website's gears were not important to him but, rather, what it produced. He could see the cathedral in its entirety: its scope, its scholarship, its reach. He couldn't see the masonry holding it up, and nothing in his considerable intelligence told him the masonry was there. That gap is the whole of it. Not that he was foolish, but that the command and the blindness lived in one man without friction.

A founder of [Long Now](https://longnow.org/) has a name for the type. The optimist, who resents maintenance and resists it, preferring the world of ideals to the drudgery of constant upkeep. Our culture remembers the people who begin great works, the pyramid-builders, the founders, and forgets the maintainers who keep them standing. The Professor was that optimist. He could hold the whole cathedral in his mind and feel no pull toward the masonry, because the ideal is where he lived and the upkeep was someone else's problem. By the site's unnatural end, it became my drudgery.

The site had no custodian. Someone versed in Perl had helped him build it, then the two parted ways, and the programmer who understood its inner workings went with them. It ran on aging code on an aging foundation, and by 2017 that foundation had run out of road. Web hosting is a constant race to stay a step ahead of bad actors, and the site had fallen too far behind to defend. The dean asked me to find out how far. That was my work the spring it came down: not blocking a collection, counting what it cost to keep one alive.

It survived, after a fashion. Saving it meant one of two things: an expensive refactoring that amounted to starting anew, or stripping out the interactive parts, running a simple scraper over the output, and losing its dynamism. The refactoring quotes came back well outside anyone's budget, so the scraper won. The dynamic machinery that had made it feel like the future in 2001 was the very thing that had to go. It endured by holding still. What lived was the husk that no longer moved.

Like a tombstone, his site now carries an immutable memorial to all this. Someone who loved the work and the professor wrote it after he died, and it tells the spring of 2017 as a thing done to him: a collection blocked for reasons it leaves pointedly unexplained, the word vulnerability sitting in skeptical quotes. I was there. I was the one tallying the cost. The memorial remembers a persecution. What happened was an accounting.

I carry something for him too, distinct from what I carry for Mike. The Professor called nearly every day while I was weighing the cost, pleading with me to keep the site up. I told him it was no longer secure, no longer reliable. Yet he called the next day again. And again. That is how I came to know him. The guilt is smaller and a different kind: not that I failed him, but that of all the hands that had touched his life's work, mine were the hands on it at the end.

---

I keep both men in mind as I write this reflection. Two sites at opposite ends of every axis. Mike's was commercial, a catalog and a storefront. The Professor's was scholarly, an archive of interactive texts. Mike's ran on the old static web and asked nothing of the future. The Professor's was built on the promise that the web would move, and move you. They fail differently, too. Mike's is dying of neglect, a Potemkin facade with the catalog gone dark behind it. The Professor's still stands, every text in place, but stuffed and mounted, the live thing that made it worth visiting scraped out and the pose kept.

Only one of them was ever asked to last. The Professor wanted his life's work to outlive him and asked too late, at the tail end, when granting it would have cost more than building it did. Mike never asked at all. His site is one of those towns inside the Chornobyl ring, the kettle still on the stove, the calendar still on the wall, nobody coming back. Two different roads. One ends in a museum, the other in an empty lot.


I've had my fingers on thousands of sites. We spin them up, they serve their purpose, they get redesigned or retired, and the orphaned ones go quiet without anyone marking it. (For the record, I delight in decommissioning websites and electronic cleanup on Aisle 7.) None of it ever touched me. These two did, and I think the difference is mostly where I'm standing now. The decay was always running, under every site I've built, the long-gone ones and the ones still up this morning, mine included. Permanence was never something those sites had. It was only ever something someone might have paid for, once, at the start, and almost no one does, because in the daily work you are never thinking about the end. You are thinking about the launch, the bug, the renewal, the next call. In my productive years, I'd have read all this and moved on to the next ticket. It takes some age to look up from the work, notice what was always true, and count the cost.

---

Mike managed his site from a desk. The Professor built his from a desk. I'm walking, thinking aloud, getting my thoughts reflected back through a probabilistic engine, which may be where we arrive at what all of this means.

The tradition runs long, from Socrates to this traversed trail, thinking while moving, and the shape of reflection changes when you're not seated. Ideas surface differently. The ground keeps moving beneath your feet. I'm thinking about the two deaths, the two sites, what they share and refuse to share, and as I think it aloud, something else surfaces.

And I'm standing at the edge of a career where I've had my fingers on thousands of sites that have come and gone. The ones that lasted—the few that have—are the ones someone decided to keep alive. Not the ones built to last, but the ones kept. Kept the way a boat at sea is kept, by someone who never stops tending it. And I realize: permanence in electronic media is bleeding. It always has been. And yet at the tail end people hope for it anyway, ask for it anyway, count on free magic to extend it just a little further. An irrational hope, knowing what we know about the medium.

I remember a podcast, Econ Talk, with Russ Roberts and Stewart Brand, and the thing it kept circling back to was maintenance. Brand's case is that a 1968 solo race around the world came down to it: the sailor who won was the one who never stopped tending his boat, and the one who hoped for the best died out there. The episode sent me looking, and that's how I found the rest of Brand's work, the Long Now Foundation, the 10,000-year clock built into a mountain, the digital dark age. But it was the maintenance argument that caught me, because maintenance was exactly what both sites lost. The person doing the keeping walked away, or died.

That thought landed differently because I'm moving, because I'm saying it aloud to Claude's voice mode, because the thinking is happening in real time, not after the fact. And it led me to build something small. Not a solution. A gesture. A PDF pipeline into my Astro blog, so when I die and my esoteric knowledge dies with me, the archive persists without it. A practice, really, a way of kicking these ideas around by making something concrete. I'm not solving the problem of ephemera. I'm acknowledging it, and building one small thing that might outlast me without needing me to maintain it.

As an aside, there's a tension I can't quite resolve, but I'm naming it regardless. Here I am building a machine to preserve myself, to fix what I've made so it outlasts me, while a serious case runs the other way: that being forgotten is its own good, that a life is richer for the parts left unrecorded, unfixed, allowed to fade.[1] The still versus the living thing again. I'm not sure my preserving instinct is the virtue I've assumed it is. Maybe it's just the condition of working now, building while the ground moves, trying to make something last in a medium designed for disposal. Maybe both.

---

We demand free magic. Permanence without cost, durability without maintenance, the impossible without the labor underneath. What we get instead is kludges, incongruent amalgams held together by one or two people with skills nobody else has, working despite themselves, a finger-snap away from collapse. The epitome of the ephemeral artifact: built to last forever, designed to last a season, destined to vanish the moment the person keeping it alive stops.

I built a small thing. A PDF pipeline into my Astro blog, so when I die, the archive persists without needing me to maintain it.[2] Not a solution to the problem of impermanence. A gesture. A way of thinking about what permanence actually takes, and acknowledging I can't provide it at scale. I can only do this one small thing and leave it here.

What it means to arrive at this point, near the end of a long vocation, is to finally see clearly what was always true. It took thirty years in electronic media to see this. Only now is the ephemerality clear enough to name.

---

### Notes

[1] Lowry Pressly makes the counter-case in *The Right to Oblivion: Privacy and the Good Life*, discussed on EconTalk, ["Let Me Be Forgotten,"](https://www.econtalk.org/let-me-be-forgotten-with-lowry-pressly/) August 4, 2025. Pressly argues that something is lost when a life is frozen into information, the fixed record standing in for the living, changing thing.

[2] My gesture toward a long-term archive of my blog: this [PDF archive](/blog-archive.pdf).
