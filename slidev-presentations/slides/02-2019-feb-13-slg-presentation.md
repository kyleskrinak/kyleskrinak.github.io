---
theme: default
title: 2019-Feb-13 SLG Presentation
subtitle: Trinity’s presentation to the Security Liaison’s Group on Hardening and Unanticipated Affects
transition: slide
layout: cover
---

### From F to B
###### in Mozilla’s Observatory Security Report

The **Trinity Technology Services** system administrators implement changes to Varnish to dramatically improve our Drupal website’s security.

* Kyle Skrinak
* David Palmer
* Blaine Ott

https://people.duke.edu/~kds38/presentations/2019-Feb-SLG.html
---
### The Problem

* ITSO sends TTS NetSparker report
* We break out the Drupal Security Kit module
* We create a test configuration and ask for another scan
* NetSparker is now busy, ITSO recommends Observatory
---
#### Mozilla Observatory

![Observatory conducts an audit](/assets/images/19-02-09-observatory-open.gif)

* https://observatory.mozilla.com
---
#### Original website results

![Observatory results for one of our websites](/assets/images/19-02-09-LM-testresults.png) 
---
#### Eureka!

Why have MySQL + PHP do something apache can do?

Why have apache do something that varnish can do?
---
#### Our First Attempt

```
### TTS Apache Hardening  
set resp.http.X-XSS-Protection = "1; mode=block";  
set resp.http.Strict-Transport-Security= "max-age=31536000; includeSubDomains";  
set resp.http.X-Content-Type-Options = "nosniff";  
```
---
### Oops

![Lack of careful planning](/assets/images/dock-break.gif "Lack of careful planning")

We inadvertently blocked fourth-level domains
---
##### Info pages for HSTS configuration options

* A link to Mozilla’s [HTTP Strict Transport Security](https://infosec.mozilla.org/guidelines/web_security#http-strict-transport-security "link to HSTS page") information page.
---
![Mozilla URL screenshot](/assets/images/mozilla-hsts-page.png "Mozilla URL screenshot") 
---
* A link to Redhat’s [HSTS configuration](https://access.redhat.com/solutions/1220063 "Redhat page on HSTS config") page.
---
![RHEL URL screenshot](/assets/images/RHEL-Apache.png "RHEL URL screenshot") 
---
##### Questions?
