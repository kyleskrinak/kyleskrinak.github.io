---
title: Drupal 8 Multisite documentation
pubDate: 2017-05-26T00:00:00.000Z
categories: []
tags:
  - Multisite
comments: true
image: ../../assets/images/drupal_logo.png
alt: "Drupal logo"
source: jekyll
description: '{:.no_toc}'
---



## Summary
{:.no_toc}

In order to better understand what adopting Drupal 8 multisite means, I have reviewed the code base for Drupal 8.3.2 for all references related to 'multisite' or multi-site' in the comments of the Drupal code.

* Conceptually, Drupal 8 multisite seems identical to Drupal 7's model, though there are noteworthy differences in how the docroot structure is different.
  * We could continue with our git repo-based module and sites workflow?
* I'm unclear what a composer workflow for multisite will look like.
* JS/PHP library management in Drupal 8?

## Table of Contents
{:.no_toc}
* TOC
{:toc}

## from the README.txt in docroot 

_Note: I have based this documentation on Drupal 8.3.x INSTALL.txt. I essentially changed the passive voice verbs to active._

A single Drupal installation can host several Drupal-powered sites, each with its own individual configuration.

For this to work you need the file sites/sites.php to exist. Make a copy of the example.sites.php file:

<pre>$ cp sites/example.sites.php sites/sites.php</pre>

You create additional site configurations in subdirectories within the 'sites' directory. You must include a 'settings.php' file, in each subdirectory which specifies the configuration settings. The easiest way to create additional sites is to copy file 'default.settings.php' from the 'sites/default' directory into the new site directory with file name 'settings.php' and modify as appropriate. You copy the new directory name from the site's URL. The configuration for www.example.com will be in 'sites/example.com/settings.php' (note that you'll omit 'www.' if users can access your site at http://example.com/).

<pre>$ cp sites/default/defaults.settings.php sites/example.com/settings.php</pre>

Sites do not have to have a different domain. You can also use subdomains and subdirectories for Drupal sites. For example, you may define example.com, sub.example.com, and sub.example.com/site3 as independent Drupal sites. The setup for a configuration such as this would look like the following:

<ul>
  <li>sites/default/settings.php </li>
  <li>sites/example.com/settings.php </li>
  <li>sites/sub.example.com/settings.php </li>
  <li>sites/sub.example.com.site3/settings.php</li>
</ul>

When searching for a site configuration (for example www.sub.example.com/site3), Drupal will search for configuration files in the following order, using the first configuration it finds:

<ul>
  <li>sites/www.sub.example.com.site3/settings.php </li>
  <li>sites/sub.example.com.site3/settings.php </li>
  <li>sites/example.com.site3/settings.php </li>
  <li>sites/www.sub.example.com/settings.php </li>
  <li>sites/sub.example.com/settings.php </li>
  <li>sites/example.com/settings.php </li>
  <li>sites/default/settings.php</li>
</ul>

If you are installing on a non-standard port, the port number is treated as the deepest subdomain. For example: http://www.example.com:8080/ could be loaded from sites/8080.www.example.com/. The port number will be removed according to the pattern above if no port-specific configuration is found, just like a real subdomain.

Each site configuration can have its own site-specific modules and themes in addition to those installed in the standard 'modules' and 'themes' directories. To use site-specific modules or themes, simply create a 'modules' or 'themes' directory within the site configuration directory. For example, if sub.example.com has a custom theme and a custom module that should not be accessible to other sites, the setup would look like this:

<ul>
  <li>sites/sub.example.com/ </li>
  <li>settings.php </li>
  <li>themes/custom_theme </li>
  <li>modules/custom_module</li>
</ul>

For more information about multiple virtual hosts or the configuration settings, consult https://www.drupal.org/documentation/install/multi-site

## Sites, Theme, Module, and Profile locations

Do not mix downloaded or custom modules and themes with Drupal's core modules and themes. Drupal's modules and themes are located in the /core/modules and /core/themes directories, while the modules and themes you add to Drupal are normally placed in the /modules and /themes directories. If you run a multisite installation, you can also place modules and themes in the site-specific directories -- see the Multisite Configuration section, below.

### from the modules/README.txt file

In multisite configurations, modules found in this directory are available to all sites. You may also put modules in the sites/all/modules directory, and the versions in sites/all/modules will take precedence over versions of the same module that are here. Alternatively, the sites/your_site_name/modules directory pattern may be used to restrict modules to a specific site instance.

### from the themes/README.txt file

In multisite configurations, themes found in this directory are available to all sites. You may also put themes in the sites/all/themes directory, and the versions in sites/all/themes will take precedence over versions of the same themes that are here. Alternatively, the sites/your_site_name/themes directory pattern may be used to restrict themes to a specific site instance.

### from the profiles/README.txt file

In multisite configurations, installation profiles found in this directory _(docroot/profiles)_ are available to all sites during their initial site installation.

### from the sites/example.sites.php file

Configuration file for multi-site support and directory aliasing feature.

This file is required for multi-site support and also allows you to define a set of aliases that map hostnames, ports, and pathnames to configuration directories in the sites directory. These aliases are loaded prior to scanning for directories, and they are exempt from the normal discovery rules. See default.settings.php to view how Drupal discovers the configuration directory when no alias is found.

Aliases are useful on development servers, where the domain name may not be the same as the domain of the live server. Since Drupal stores file paths in the database (files, system table, etc.) this will ensure the paths are correct when the site is deployed to a live server.

To activate this feature, copy and rename it such that its path plus filename is 'sites/sites.php'.


## Code references to multisite

* `core/lib/Drupal/Core/DrupalKernel.php`, line 363, findSitePath to determine site's base directory
* `core/lib/Drupal/Core/Extension/ExtensionDiscovery.php`, line 176, determine site's "parent" for finding global extensions
* `core/lib/Drupal/Core/Updater/Module.php`, line 20, for determining installation directory for modules in multisite contexts
* `core/lib/Drupal/Core/Updater/Theme.php`, line 12, same as above
* `core/modules/editor/src/Form/EditorImageDialog.php`, line 210, for creating valid file paths in multisite contexts
* `core/modules/file/file.module`, 
  * line 995, same as above
  * line 1253, same as above for file link creation
* `core/modules/filter/filter.module`, line 778, for creating valid file paths in multisite contexts
* `core/modules/image/src/Plugin/Field/FieldFormatter/ImageFormatter.php`, line 209, for creating valid file paths in multisite contexts
* `example.gitignore`, line 25, "ignore multisite environment"
* `modules/README.txt`, line 29, multisite information, added above
* `profiles/README.txt`, line 21, same as above
* `sites/default/default.services.yml`, line 29, setting the cookie_domain variable.
* `sites/default/default.settings.php`, 
  * line 13, commented instructions on selection rules for site discovery
  * line 709, commented instructions on setting the 'trusted_host_patterns' variable
* `sites/example.sites.php`, This file is now essential for multisite. Worth reading entire file.
