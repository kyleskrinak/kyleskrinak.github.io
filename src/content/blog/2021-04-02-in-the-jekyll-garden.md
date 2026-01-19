---
title: In the Jekyll garden
pubDate: 2021-04-02T00:00:00.000Z
categories: []
image: ../../assets/images/21-04-02-jekyll-garden.jpg
alt: "21 04 02 jekyll garden"
source: jekyll
description: Continuing my research on a static website workflow, I'm spinning up a new personal website as an excuse to try building...
---


Continuing my research on a static website workflow, I'm spinning up a new personal website as an excuse to try building a new Jekyll-based static website. Doing so reveals the rough edges. 

How so?

I'm trying a new Jekyll theme, <a href="https://mmistakes.github.io/jekyll-theme-basically-basic/">Basically Basic</a>, made by the same developer, <a href="https://github.com/mmistakes">Michael Rose</a>, for the <a href="https://mmistakes.github.io/minimal-mistakes/">Minimal Mistakes</a> theme that I use for my professional website. He's done excellent work supporting and maintaining with his Minimal Mistakes theme, so I'm comfortable with his new theme as a starting point.

I'm on a Windows 10 21H1, using WSL2 and Ubuntu 18.04 LTS. In that virtualized OS I am using rbenv to manage my Ruby versions. Already, expecting a non-information technologist to build or configure such an environment is a concern. I suppose a docker image may help? Digression: writing this motivated me to upgrade Ubuntu to 20.04. Thanks to this <a href="https://alessio.franceschelli.me/posts/windows/wsl2-upgrade/">careful description</a> of the process, I did so without interrupting my post-upgrade environment, which is no small engineering feet.

Noted I used <a href="https://stackoverflow.com/a/25735388/479709">this method</a> to copy the 18.04 image export to my OneDrive as a remote backup. It enabled a PowerShell progress bar on the copy transfer process.

With those details out of the way, my first step was to cd to my desired disk location and create a new Jekyll website

`jekyll new recipes`

If you've been through my website, that premise shouldn't surprise you. I then `cd recipes` to snap in the Basically Basic theme, using the <a href="https://github.com/mmistakes/jekyll-theme-basically-basic#ruby-gem-method">Ruby Gem Method</a> to install the theme and gem requirements.

Great! Ready to go, right? Not so fast. Welcome to Ruby. My first attempt at a server run is met with failure. The ffi gem is incompatible with… something. I don't know whether Ruby 3.0.0 or Jekyll 4.2. To fix this failure I must backport ffi to version 1.14.2.

I run `bundle exec jekyll serve --livereload` and I'm met with this error.

`/home/figgles/gems/gems/jekyll-4.2.0/lib/jekyll/commands/serve/servlet.rb:3:in 'require': cannot load such file -- webrick (LoadError)`

This is a <a href="https://github.com/jekyll/jekyll/issues/8523">known Ruby 3.0.0 bug</a>. I fixed it with this:

`bundle add webrick`

> <strong>Whoops!</strong> I run `bundle exec jekyll serve --livereload` and I'm met with a ffi library error. However, I cannot replicate the error after updating my OS. If you do experience this, you can run the following:  
> Update the Gemlock.file to `ffi (1.14.2)`  
> `bundle remove ffi`  
> `bundle add ffi --version=1.14.2`

Finally, I can successfully launch my local compiled website and begin making edits. Since I am an information technologist, that's fine. These convolutions, however, make recommending this approach more problematic, especially for non-IT users, such as researchers or faculty.

