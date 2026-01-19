---
title: DrupalCon Nashville 2018 -- Higher Education Summit Notes
author: Kyle Skrinak
pubDatetime: 2018-04-07T00:00:00Z
featured: false
draft: false
tags:
  - Drupalcon Nashville 2018
description: "I will be leading two sessions at the DrupalCon Higher Education Summit on Monday, April 8th, 2018, and I&rsquo;m using ..."
---


I will be leading two sessions at the [DrupalCon Higher Education Summit](https://events.drupal.org/nashville2018/higher-ed-summit) on Monday, April 8th, 2018, and I&rsquo;m using this post for my preparation notes.

You can find all the virtual directory for all the Higher Education Summit Session notes [here](https://drive.google.com/drive/folders/1uaFfgSob8VHlIpvb1WNMi_UdYdrYXwTA).  

**Note:** these agenda items are not hard-and-fast discussion items. Depending on session attendees and details I cannot anticipate, these discussions tend to grow a life of their own. I find that nearly always, the actual discussion turns out far better than I anticipate. *Caveat lector.*
{: .notice--info}

## Session 1; 11:20 AM &ndash; 12:20 PM
### Continuous Integration / Continuous Development Strategies

#### Agenda

* **Spread out and speak up**
* **Volunteers for note-keeping**  
*(Google docs allows for multiple authors. The more the merrier)*  
[Link to the session notes](https://docs.google.com/document/d/13P7qKfvLm9QsjFzSsqyOobgSbnktAPNZlLXAkxgbmk8/edit?usp=sharing)
* **Introductions**   
Tell us your name, title, what you do, and your efforts at CI/CD so far?
* What is Continuous Integration / Continuous Development (CI/CD)? What is it NOT?
    * Continuous integration is the integration of code commits with building, testing and deploying these commits. (1)
* **What are the tools and components of CI/CD?** What are you using? (1) 
    * Gitlab-ci, Jenkins, Circle-CI, Travis, git-commit hooks
    * Ansible, Git workflow, dev vm or docker, task runners, package managers, repositories
    * Functional testing, Behat testing, coding standards, linting, static analysis
    * Deploy, pipelines, stages and tasks
At Duke's Trinity School of Arts &amp; Sciences, we're using [gitlab-ci](https://about.gitlab.com/features/gitlab-ci-cd/). We have used Jenkins, we still have a 2-year old Jenkins server, but we prefer gitlab-ci.
* How long have you been using CI/CD?
* What benefits have you seen because of your adoption?  
    * Improving quality, consistency and process speed
How would you like to extend your CI/CD adoption?
* What are some blockers or obstacles to implementation?
* Examples or potential CI/CD workflows
* Examples of shared CI/CD resources
    * (1) [CI/CD session](https://www.youtube.com/watch?v=DysbTwsl5SA) from last year's Dublin conference.
    * (2) [DrupalCon Vienna 2017: Automatic Drupal Updates using Visual Regression & Continuous Integration](https://youtu.be/vSkOeYO7Ycw)

## Session 2; 1:30 AM &ndash; 2:30 PM
### Web Accessibility, led by Joel Crawford-Smith

Led by my fellow Dukie, [Joel,](https://joelcrawfordsmith.com/) with whom we collaborate frequently. Looking forward to his session.

You can find his session notes [here](https://docs.google.com/document/d/1xOq9NTtG8qaSjdmymFplZR0RCtQ4usgELM5MvHUYgjQ/edit?usp=sharing)

## Session 3; 2:30 AM &ndash; 3:30 PM
### Holistic DevOps &amp; Drupal Security

* **Spread out and speak up**
* **Volunteers for note-keeping**  
*(Google docs allows for multiple authors. The more the merrier)*  
[Link to the session notes](https://docs.google.com/document/d/1GWCl21mqbPx7eHkRdz7uPzQR6kGyRJD8ADjpd7DUMSc/edit?usp=sharing)
* **Introductions**   
Tell us your name, title, what you do, and your efforts at security so far?
* Why “Holistic?” 
* **What are the tools and means of Security?** What are you using?  
This is a multi-pronged front:
    * Policy and Governance
    * Identity, membership and SSO
    * CI/CD
    * Firewall
    * OS
    * Stack
    * Third-party integrations, events, faculty profiles, courses
    * Third-party vendor-built websites
    * Drupal
    * Scanning, such as NetSparker
* How have your efforts evolved over the years?
    * Compare and contrast your response between Drupalgeddon and Drupalgeddon II
* What benefits have you seen because of your efforts?  
How would you like to extend or enhance your security?
* What are some blockers or obstacles to enhancing or extending?
* Examples or potential security workflows
* Examples of shared security resources
    * [DrupalCon Dublin 2016: Drupal Security: There is a Mini-DrupalGeddon - YouTube](https://www.youtube.com/watch?v=ej8yiPHota4)
