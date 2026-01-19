---
theme: default
title: 2019 DrupalCon Drupal 8 Multisite
subtitle: My presentation to the DrupalCon 2019 Higher Ed Summit
transition: slide
layout: cover
---

### Our DevOps Approach to Multisite and Drupal 8

----

##### A high-level overview   
of how we’re using DevOps to
###### pimp our stack
---
#### Kyle Skrinak, I.T. Manager 
Web Development and Systems Administration  
https://people.duke.edu/~kds38  
_(nom de cyber: @screenack)_

----

###### Trinity College of Arts & Sciences _at_
##### Duke University

----

###### This presentation:
http://bit.ly/DC19-HES
---
### Meet the team

----

* Two Drupal website designers and developers
* Two Symfony custom application developers
* Three sysadmins, including one Drupal lead
* Host 380 websites, including 108 Drupal websites 
* Highly normalized platform — branding, features, and content
* Support third-party developed websites
* Plus a bevy of other web and sysadmin-related support
* We maintain an excellent support reputation
---
### Current Infrastructure

----

* Duke OIT provided VM’s
* RHEL7
* MySQL > MariaDB
* PHP’s aggressive EoL change
* Shibboleth SSO
* Third-party integrations: e.g., Qualtrics forms and Box for storage
* 108 websites on a clustered server pair
* A varnish and a pound load balancer.
* A staging and production server per website
---
### Our Drupal 7 workflow

----

* Ansible pulls Drupal core updates from d.o.
* Three git repos for code
  * Global
    1. Our **sites/all** _(contrib modules, themes, and libraries)_ repo
    1. **Trinity-level theme** _(Omega-based)_ repo at sites/all/themes
  * per website
    1. **Website repo** _(theme, modules, libraries)_ in the  
      `sites/\<sitename>` directory
*  `drush`, `git` and `ansible` to manage our stack cluster
---
### What of Sleeping Dogs?

----

* Our mature workflow serves our customers and ourselves well… 
* …but it fails us, moving forward
* Shifting external requirements continue to mount
  * Web accessibility and responsive design
  * Our security posture
  * Integrate CI/CD and QA 
  * Increasingly rapid stack updates
---
### Enter DevOps

----

##### What is DevOps?

* To radically yet _seamlessly_ change our workflow
* Rethink roles, rules, interactions, expectations
* Stay current with tool and paradigm shifts
* Learning from our peers and contributing back
* Maintain and improve our service reputation
---
### Has DevOps Helped Us?

----

#### Yes.

> _“Achieving extraordinary results  
> from ordinary people.”_
---
### DevOps? 

----

#### You’re Soaking in It

* Bi-weekly DevOps meeting
  * New concerns and opportunities 
  * New tools 
  * Paradigm shifts
  * Changing individual roles
* Refactor our distribution and workflow
* Cross-discipline training
* Presentations on new proposals and tech
---
### Why multisite?

----

* Misleading FUD on multisite
* Stable
* n-factor reduction in duplicate stack code
* Faster and inexpensive code updates
---
### Preparing for Drupal 8

----

* Confirm continued D.O. support for multisite past 9.x
  * Yep: https://www.drupal.org/project/drupal/issues/2306013 
* Confirm our understanding of Drupal 8 multisite
  * Yep: https://people.duke.edu/~kds38/drupal/drupal-8-multisite-documentation/ **BUT**
* `composer` replaces `drush` for managing Drupal
* A “pure” composer-based workflow conflicts with
  * Managing the individual website instances
  * JavaScript library dependency resolution
---
### How, then?

----

#### Distribution reference

* Maintain a “reference” D8 installation for managing core, based on the Drupal Project composer template
  * https://github.com/drupal-composer/drupal-project
* Run `composer update` against the reference
  * If there are updates, this will also update the `composer.lock` file
* Commit the `composer.lock` file updates to the core git repo
---
#### Core and Code Deployment

----

##### Switch from `ansible` to `GitLab CE CI/CD`

* The value of recent GitLab updates
* Trigger deployment updates from the GitLab UI.

>
> Oops… NoOps!
>
---
#### Core and Code Deployment

----

##### Use a GitLab’s CI/CD to 
* `composer install` with the updated lock file to distributed D8 cores.
  * Far less expensive than `composer update` on all cores.
* Run QA tests as part of a build process
  * (Still in development)
* Consistently run deployment scripts
* Deploy website code to our staging and production servers
---
#### Core and Website Updates

----

##### Run a `pipeline` on targeted servers

* For all child sites:
  * Move website to maintenance mode 
  * Database and code backup for all child websites
* Pull composer.lock file
* Composer install (core only)
* For all child sites:
  * Drupal database update
  * Cache rebuild
* Reapply permissions on core or website directories only
---
### GitLab CI/CD Demo

----

[Link](https://www.youtube.com/embed/_3wf9p9v5ik)
---
### Features and Benefits

----

* Eliminates need for manual deployment
* “True” push-button deployment for our devs
* Consistent deployment execution
* Consistent state restoration
* Easy access to deployment logs by all
---
### Hindsight = 20/20

----

* Base our distribution on Acquia’s Lightning distribution
  * https://github.com/acquia/lightning
* Build an installation profile
---
### What’s Next?

----

* Library management: big hairy eyeball
* Implement varnish and pound for D8
* Build and maintain our own installation profile
* Trigger deployments with commit tags
* Improve integration of website-level configuration management
* Backport what we can to our D7 workflow
---
### Questions?

----

> ?
---
### Thank You!

----

> !
