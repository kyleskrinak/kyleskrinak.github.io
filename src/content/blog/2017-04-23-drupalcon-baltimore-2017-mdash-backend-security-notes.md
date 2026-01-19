---
title: DrupalCon Baltimore 2017 — Backend Security notes
pubDate: 2017-04-23T00:00:00.000Z
categories: []
tags:
  - Drupalcon Baltimore 2017
comments: true
image: ../../assets/images/drupal_logo.png
alt: "Drupal logo"
source: jekyll
description: See the <a href="https://security.duke.edu/">Duke University IT Security Office</a> for comprehensive security standards...
---


See the <a href="https://security.duke.edu/">Duke University IT Security Office</a> for comprehensive security standards documentation.

1. Physical aspects:
* Access-controlled server rooms
* Authorized physical access only
* Log all access as required by data
1. Network aspects:
* Appropriate Host-based access controls, i.e., firewall, port control, access lists)
* Require secure remote access, using VPN or SSH
* Encrypt all authentication traffic
* Log all network-based server access
* Third-party Vendor requirements
* Avoid authentication trust relationships
1. Operating system
* Login prompts to remind users regarding prohibition of unauthorized access, lack of privacy for its users, last access time stamp
* Disconnect inactive logins
* Strip banner and error messages regarding system information
* Mitigate announced vulnerabilities within a reasonable time-frame (same for applications)
* Install anti-virus for periodical full storage scan
* Approved OS’s only
* Disable host web browsers that do not receive automatic browser updates
* Routine scheduled downtime to mitigate vulnerabilities
* Device reporting on the above configuration for department review
1. Data
* Protected data heightens access requirements
1. Application
* Ensure development tools, code samples, and the like, are removed in production
* Vendors must incorporate security in the initial design phase
* Develop on non-production servers only
* Use de-identified data for development and testing
* The principal of least privilege: apps only access what they must.
* Username password credentials must not be stored in the program source code
* Hash passwords, 3DES minimum
* Publicly-accessible apps must not execute OS shell commands or pass non-admin user input to the shell
* Remove commented code from production apps
* Disable path traversal and directory browsing
* Leverage Drupal’s input validation mechanism for all input data. Sanitizing input alone is insufficient.
* Authenticate all credential data
* Robots.txt can unwittingly provide path data, do not rely on it
* Periodically review Drupal and OWASP requirements
1. User and accounts
* Use Shib for Drupal user management.
* Do not share user accounts. One person per account.
* Regularly review user membership per site
* Revoke user access within one business day for exited employees
* Remove accounts inactive for 3 months
* Admin users must change passwords every 180 days
* Use the principal of least-privilege regarding account access. Do not require an admin account for site backup
* Encourage MFA
* Vendors must have guest NetID accounts, managed by their departments
1. Tools we use:
* Fail2Ban
* Splunk
* Ansible
* Tivoli
* Autofs
* Shibboleth
* Composer (D8)

