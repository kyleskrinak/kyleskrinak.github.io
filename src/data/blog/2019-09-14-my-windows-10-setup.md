---
title: My Windows 10 Setup
author: Kyle Skrinak
pubDatetime: 2019-09-14T00:00:00Z
featured: false
draft: false
description: "Why Windows and how I like my default Windows 10 configured"
---


## The Platform Nomad

Every four years, Duke University personnel receive a “device refresh,” i.e., a new desktop or laptop device. To celebrate my fourth year at Duke, I switched from a MacBook to a Lenovo Yoga laptop. Though I remain an admirer of the life and achievements of Steve Jobs, my opinion on Apple products have greatly and progressively diminished since his passing. 

As predicted by [Jim Collins - Good to Great](https://www.jimcollins.com/article_topics/articles/good-to-great.html) book, Job’s market-savvy, charismatic, technical and culturally prescient leadership is a difficult – if not impossible – act to follow. I have long admired Apple’s manufacturing and parts specifications. However, I have a diametric opinion of their technical, marketing, and pricing strategy.
At the time of my refresh, Apple had just rolled out an “innovation,” a thin touch bar between the laptop’s monitor and keyboard. This input interface was more gimmick than innovation. Ironically, Apple placed this on their higher-end laptops. I wasn’t alone in my disappointment at this inclusion. Put another way; the bloom was off the Job’s rose. Compounding my decision is Apple’s increasing focus on iOS over MacOS. Apple has positioned iOS as a consuming OS, not a creative one. What’s the point in investing in an OS that is losing research and development focus? Apple’s great at novice interfaces, which is moot for my purposes.

Meanwhile, I liked what recent and unprecedented changes Microsoft was offering. Windows Subsystem for Linux, while not as well integrated as the Terminal console is on Mac, has far superior from previous options. I liked Windows 10 well enough, though, my experience is with the enterprise edition, free of the garbage applications many tell me that Microsoft includes in the consumer editions. I do despise gratuitously added software, regardless of the platform. I value being proficient on Windows, Mac, or Linux. However, as a manager, and being that I spend most of my time in the Microsoft Office Suite of applications, the best platform for me is Windows.

After all that, I acknowledge that a remaining problem with Windows is its progressively sluggish performance over time. This degradation is a shared problem across platforms, but decidedly so on Windows. To address this, here are my steps to re-image a Windows device.

All of which reminds me: time to update my vimrc configuration file. Or should I switch to [Neovim](https://neovim.io/?) [Visual Studio Code](https://code.visualstudio.com/?) or [GNU Emacs.](https://www.gnu.org/software/emacs/?)

## My Windows Configuration

  1. Image machine with the Duke enterprise license standard image
  1. Enable my user account with correct privileges 
  1. Uninstall any MS Office via add/remove programs UI. (Part of the TTS image.)
  1. Run [Windows Update](https://windowsupdate.microsoft.com)
      * This can take several restarts
  1. Install [1Password](https://1password.com/)
  1. Install [Chocolatey](https://chocolatey.org/install) using cmd.exe, installation page found <a href="https://chocolatey.org/install">here</a>.
      * `Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))`
  1. Restart after chocolatey package install. 
  1. Install chocolatey script for my applications
  1. Enable Hyper-V
      * `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All`
  1. Enable [Windows Subsystem for Linux (WSL)](https://docs.microsoft.com/en-us/windows/wsl/install-win10)
      * `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux`
  1. Establish [Microsoft OneDrive](https://onedrive.live.com) user configuration
  1. Install [Microsoft/Terminal: The new Windows Terminal](https://github.com/Microsoft/Terminal) and [Ubuntu](https://www.ubuntu.com/) from the [Online Microsoft Store](https://www.microsoft.com/en-us/store)
      * Use either `cmd.exe` or `powershell` to run the `ubuntu` command to create your user account for the ubuntu instance. Afterwards, you’ll be able to access the `ubuntu` shell profile within `Windows Terminal`, now my favorite Windows shell.
  1. Install [Homebrew on Linux](https://docs.brew.sh/Homebrew-on-Linux) into WSL
      * Install ssh keys
        * fix the perms on the new keys:
          * `cd ~/.ssh`
          *  `chmod 700 .`
          *  `chmod 600 *`
          *  `chmod 644 *.pub`
      * `sudo apt-get update && sudo apt-get install build-essential binutils file openssl libssl-dev`  
         *(brew won't install without this, see this <a href="https://github.com/Homebrew/linuxbrew-core/issues/13596">link</a>)*
      * `sh -c "$(curl -fsSL https://raw.githubusercontent.com/Linuxbrew/install/master/install.sh)"`
      * It is import to add the linuxbrew path to profile for this to work
      * Helpful cleanup commands:
        * `sudo apt autoremove`
	* `echo 'eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)' >>~/.profile`
        * `eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)`
        * `brew install gcc`
  1. Install zsh
      * Install [Oh My Zsh - a delightful &amp; open source framework for Zsh](https://ohmyz.sh/)
        * use `brew install zsh` before running the oh-my-zsh script. 
        * Add the path for $(which zsh) to /etc/shells. 
        * Let the OMZ script configure your zsh as default shell.
      * `sh -c "$(curl -fsSL https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh)"`
      * Further zsh customizations
        * plugins = git, ssh-agent and vi-mode
        * add zstyle configurations for ssh-agent:
        * zstyle :omz:plugins:ssh-agent agent-forwarding on
        * zstyle :omz:plugins:ssh-agent identities key1 key2
        * You must add `export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH` to the beginning of your .zshrc file.
  1. Install vimfiles
      * [GitHub - kyleskrinak/vim-files-2.0: My vim configuration files](https://github.com/kyleskrinak/vim-files-2.0)
      * I might be migrating to NeoVim. I like the configuration setup better. Stay tuned.
        * New repo: [GitHub - kyleskrinak/neovim: My neovim configuration files](https://github.com/kyleskrinak/neovim)
	* Neovim conf files go here: `%USERPROFILE%\AppData\Local\nvim`
  1. Load [AutoHotkey](https://www.autohotkey.com/) autoscripts
      * At shell:startup
  1. Use Windows Hello for device authentication
     1. Enable fingerprint scanner
         * [Enable fingerprint and PIN for Windows 10](https://www.addictivetips.com/windows-tips/enable-fingerprint-and-pin-login-windows-10-1803/)

