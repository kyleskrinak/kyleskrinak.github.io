---
title: Jekyll, Hugo, and Me
author: Kyle Skrinak
pubDatetime: 2021-01-16T00:00:00Z
featured: false
draft: false
description: "The battle for a better static website generator"
---


I've been using <a href="https://jekyllrb.com/">Jekyll</a> for the blog that you're currently reading for several years now. There is much to love in static websites for my professional and personal musings. My employer offers free static website hosting, and as a manager, I can use my blog pages for commonly-asked-for content or information. The theme I use, <a href="https://github.com/mmistakes/minimal-mistakes">"Minimal Mistakes"</a> is a well-developed and maintained Jekyll theme that incorporates much of what a modern website should &mdash; if not must &mdash; have, such as device responsiveness, web accessibility, and other modern web goodness. I can also use <a href="https://www.markdownguide.org/">Markdown</a> for my writing, with the <a href="https://neovim.io/">Neovim</a> editor. Also, using the `--livereload` option in `jekyll serve`, I can see my content updates in my browser, in full display context, when I save my markdown.

## If all is well, what's the rub? 

### Maintenance

Jekyll runs on <a href="https://www.ruby-lang.org/">Ruby</a>. Unless you're a Ruby developer, the occasional visit to a ruby compilation brings a lot of left feet to the dance. Ruby has two environment managers, <a href="https://github.com/rbenv/rbenv">rbenv</a> (which I use), and <a href="https://rvm.io/">rvm</a>. Ruby uses <a href="https://rubygems.org/">gems</a> for libraries, logic, and object encapsulation, and the environments work to manage dependencies. That's all nice, but when you simply want to blog, ensuring you're up to date with your environment becomes a big, hairy, fugly ball of "what just happened?" At work, we use Ruby version 1.9.3 to compile SASS to CSS. Yes, we're working on that update. It won't come soon enough. Supporting such an old version, however, comes at a high cost.

I like to keep my code reasonably current. I check for updates from the theme's author, as well as ruby and gem updates. If I spent even half my day in Ruby, I'm sure I'd be fine with this standard maintenance. But I don't. I'm usually in mainstream office-type applications. I'm a manager, after all. 

### Slow server content updating

<a href="https://jekyllrb.com/news/2018/01/02/jekyll-3-7-0-released/">Livereload</a> is great, but, *until recently,* the round-trip from file-save to Jekyll-reloaded web page was in the 10 - 20 second range. I was in the 4 - 6 second range on my Mac-brew managed ruby system years ago. (FYI &mdash; I tried natively compiling Ruby and gems in Windows and it is a royal PITA. It's possible but not worth my time.) I saw the drop in performance when I switched to Windows 10 some years ago, using the new WSL service. Seeing my content in context is important to me. A few months ago, I upgraded my WSL to WSL2 and saw improved performance, now in the 5 - 10 second range. Better, but still annoying for my temperament and preferences.

### There's gotta be something better

We're seeing increasing interest in static websites. This also means more options in everyone's favorite frameworks or languages. Python has <a href="https://blog.getpelican.com/">Pelican</a> and others, Node has <a href="https://hexo.io/">Hexo</a>, and, not wanting to be left uninvited to the dance, even PHP has <a href="https://sculpin.io/">Sculpin</a>. At the DrupalCon Nashville 2018 conference, I had the pleasure of attending <a href="https://stevefrancia.com/">Steve Francia's</a> <a href="https://youtu.be/EJo9tPXGPo8">keynote</a>. While there was a lot of good stuff in that keynote, he mentioned his work on the Go programming language at Google, and unsurprisingly, on the Go-based static website generator <a href="https://gohugo.io/">Hugo</a>. Given my favorable impression of Francia and his work, I was curious to check out Hugo.

My initial impression was, well, wow. Hugo has markdown, was painless to install (I used linuxbrew on WSL2) and most importantly, Hugo is fast. Shockingly fast. My simple "hello world" website renders in under a second, heck in under 100 milliseconds. It's nuts. So what happens with more content? I'm assured Hugo scales quite well and retains its blazing speed. I also took full advantage of a new CI/CD system in GitLab where a push to the specified git repository branch publishes pages on their service but that's another topic.

Smitten with this performance, I started to dig into Hugo as a new publishing platform for this blog. I soon discovered that the Hugo theme world is still lagging behind Jekyll's. Using GitHub's star rating method, the most popular Hugo theme, which includes Disqus support, is 1/7th that the rating of my current Jekyll theme. Additionally, the features and display of the better supported Hugo themes are missing aspects of my Jekyll configuration that aren't trivial to give up.

### Here we are, again

Dejectedly, I spun up the old (current) environment blog environment. I see Ruby has a 3.x major release out. I update and things break. *Here we are again.* I completely uninstall and reinstall ruby, rbenv, and gems. Then I see Jekyll and my theme doesn't play well with Ruby 3.0.0 so I set my environment to use Ruby 2.7.2, which fixes the problem. *More of the same ol', same ol'.* Then I get `jekyll serve` to launch and, wait, *what?* Jekyll is now generating my page and site updates in under a second? At some point in the past few months, someone, somewhere, made some adjustments, and now my Jekyll system is, while not as fast as Hugo, it is fast enough, and I can keep all of my customizations for this blog.

Here are the stats as I update this page:

>      Regenerating: 1 file(s) changed at 2021-01-16 11:59:14
>                    _posts/2021-01-16-jekyll-hugo-and-me.md
>       Jekyll Feed: Generating feed for posts
>                    ...done in 0.7113945 seconds.

I noticed that I have updated the Jekyll Gemfile requirement from 3.4 to 3.7 as a version minimum. Perhaps this accounts for the dramatic speed increase? Or Microsoft has implemented some architecture changes to WSL2 that is helping? Or both? Or something else? Whatever the reason, I'll take it.

It looks like this blog will be on Jekyll for a little while longer.
