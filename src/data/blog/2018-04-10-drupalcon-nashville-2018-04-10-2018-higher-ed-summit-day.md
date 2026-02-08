---
title: DrupalCon Nashville 2018 -- 04-10-2018 Tuesday
author: Kyle Skrinak
pubDatetime: 2018-04-10T00:00:00Z
featured: false
draft: false
tags:
  - Drupalcon Nashville 2018
description: "* New in 8.5"
---


## Dries Keynote

### TL;DR: Back to roots
* New in 8.5
  * Media and content moderation
  * Stable upgrade path to D8
  * Simplified site building
  * API-first focus
* User facing changes to better address poor installation experience for new users who wish to try Drupal
* CMI changes, composer changes, removing it as a requirement, but make it a best practice, longer period between updates
* Improving non-technical perception of Drupal

## Vendor visits

* **Pantheon** 
    * After several failed starts, I met with a chief-something or other, which led to a discussion with Josh Koenig, Co-founder, and John Sepassi, Platform Sales Rep. We discussed our multi-site workflow and some advantages with the Pantheon workflow. This includes full use of a CDN and performance analysis tools.
    * Of course there’s much to like in Pantheon’s offerings. With Drupal 7, their value proposition was less attractive, since we’ve done so well with standing up multisite on our own servers. Drupal 8’s adoption of modern CI/CD changes this dynamic, as we’re learning. However, the cost for Pantheon is significant, so much so that I remain “only looking.”
* **Kanopi Studios** -- They popped up on my radar via a LinkedIn message. They are an agency that helps with website builds.
* **Kwall** -- an agency that helps with website builds. They were located off-site at a coffee shop about a half-mile from the convention. Met with Alex Reed and Kevin Wall, discussed the nature of higher ed website projects and requirements.

## [Horizontal DevOps ~ Scale your team and tools across projects.](https://events.drupal.org/nashville2018/sessions/horizontal-devops)

* We often think of DevOps in a super siloed context (eg one project at a time), but having an organizational DevOps plan/strategy and some cross project standardization is really how you benefit. This talk is about the business value of horizontal DevOps across people and projects.
  * This makes sense for groups with varying hosting and stack configuration requirements
  * Circle CI dependency

### Some guidances 
* Use Semantic versioning
* Package managers for distros
* Keep documentation current
* Define or share your release workflow for every tool


## [Getting closer to your customer: Using Drupal in the last mile](https://events.drupal.org/nashville2018.html)

* How to better align the back and front end of development
* Using the tour module to provide user tips to sites
* Low value for us, given our distribution and support model, but smart for bespoke site design

## [Integration of Drupal Coding standards with Git hooks](https://events.drupal.org/nashville2018/sessions/integration-drupal-coding-standards-github-hooks)

* Using for running standard checks when committing code 
* Client and Server side hooks
  * Client
    * pre-commit
    * Prepare-commit-msg
    * commit-msg
    * post-commit
    * post-checkout
    * Pre-rebase
    * post-merge
  * Server
    * Pre-receive
    * Update
    * Post-receive
  * Demo shows a simple PHP code linting before committing 

## [Power up Drupal 8 with integrations: Cornell University showcase](https://events.drupal.org/nashville2018/sessions/power-drupal-8-integrations-cornell-university-showcase)

* With ambitious goals and an aggressive timeline, IT@Cornell architected and built a centralized repository for discovering and applying to educational and extra-curricular opportunities. By leveraging the strongest traits of each platform, we delivered a multifaceted solution that uses Drupal 8 as the front end, Salesforce as a backend, and other technologies as data feeds for the information displayed to the end users.
