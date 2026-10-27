---
title: Kyle Skrinak — Resume
# The name line: the resume's h1, so the first line of the PDF, .docx and .txt.
# `title` above feeds the /resume/ page's <title> and social-card titles only.
name: Kyle Skrinak
# The role sentence is NOT repeated here — resumeMetaDescription() prefixes
# current_role.title. This field carries only the career summary.
description: "Platform operations, web technology leadership, and team management from Gilead Sciences to Duke University."
contactEmail: kyle.skrinak@gmail.com
contactWebsite: https://kyle.skrinak.com
contactLinkedin: https://www.linkedin.com/in/kyleskrinak/
contactAddress: "Apex, NC"
current_role:
  title: Senior Manager, Digital Experience Platform Operations
  employer: Gilead Sciences
  # The About page links the employer name to this URL.
  employer_url: https://www.gilead.com/
  location: Raleigh, NC
  start_date: 2022-06-01
skills_inventory:
  last_reviewed: 2026-07-06
  categories:
    - name: Leadership & Team Development
      id: leadership
      skills:
        - Technical Leadership
        - Team Management
        - Vendor Management
        - Contractor Leadership
        - Delegation Frameworks
        - Cross-Functional Alignment
        - Stakeholder Management
        - Mentoring
    - name: Platform Operations
      id: platform-ops
      skills:
        - Site Reliability
        - Incident Management
        - Production Operations
        - Change Management
        - Release Management
        - Service Delivery
        - Operational Governance
        - Runbook Development
    - name: Cloud & Infrastructure
      id: cloud-infrastructure
      skills:
        - Microsoft Azure
        - Amazon Web Services (AWS)
        - AKS
        - ECS
        - Cloud Architecture
        - Infrastructure Modernization
        - SSL Certificate Management
        - DNS Management
    - name: DevOps & Automation
      id: devops-automation
      skills:
        - Azure DevOps
        - CI/CD
        - Git
        - Infrastructure as Code
        - Terraform
        - Automation Design
        - Workflow Optimization
        - Deployment Engineering
    - name: Cost Optimization & FinOps
      id: cost-optimization
      skills:
        - FinOps
        - Azure Cost Management
        - Reserved Instances
        - Resource Optimization
        - Cloud Financial Governance
        - Capacity Planning
        - Cost Reporting
    - name: Search & Content Platforms
      id: search-content-platforms
      skills:
        - Sitecore
        - Solr
        - SolrCloud
        - Content Delivery Platforms
        - Search Architecture
        - CMS Operations
    - name: Security & Compliance
      id: security-compliance
      skills:
        - Security Reviews
        - Risk Assessment
        - Compliance Governance
        - Crown Jewels Assessments
        - Privacy Controls
        - Audit Support
        - Certificate Governance
    - name: Documentation & Process Excellence
      id: documentation-process
      skills:
        - Technical Documentation
        - SOP Development
        - Knowledge Management
        - Process Improvement
        - Governance Frameworks
        - Operational Standards
    - name: AI & Productivity Enablement
      id: ai-productivity
      skills:
        - Microsoft Copilot
        - AI Adoption
        - Prompt Engineering
        - AIOps
        - Process Automation
        - Productivity Engineering
education:
  items:
    - degree: Master of Science, Information Technology
      degree_abbr: M.S. I.T.
      institution: Rochester Institute of Technology
      location: Rochester, NY
      years: "1998 – 2001"
      render: true
    - degree: Bachelor of Fine Arts, Illustration
      degree_abbr: B.F.A., Illustration
      institution: University of the Arts
      location: Philadelphia, PA
      years: "1980 – 1984"
      render: true
changelog:
  - date: 2026-07-03
    entry: Initial migration from Google Doc snapshot
  - date: 2026-07-06
    entry: >-
      Migration complete — this file is the canonical resume source. The web
      page (/resume/), the print route (/resume/print/), and the
      build-generated PDF all render from it; the Google Doc is retired as a
      source and is no longer maintained.
  - date: 2026-07-06
    entry: Populated skills inventory (9 categories), certifications, and education metadata
  - date: 2026-07-06
    entry: >-
      Phase B — facet tagging: added <!-- f: … --> comments to all 10 bullets and 5 scope
      paragraphs; wired remark-facets plugin; migrated remark/rehype plugins to unified()
      processor in astro.config.ts.
  - date: 2026-10-05
    entry: >-
      Restored current_role, skills_inventory, education, and this change log.
      Commit dc8069e removed all four while moving certifications to
      scripts/data/certifications.json; only the certifications move was
      intended. Certifications stay in that file.
  - date: 2026-10-25
    entry: >-
      Removed certifications from the repo: Manager Tools puts none on a
      resume, tailored variants included. scripts/data/certifications.json and
      the variant builder's certification section are gone.
  - date: 2026-10-27
    entry: >-
      Manager Tools revision: retitled current_role; split Duke into three
      roles; rewrote the Gilead scope paragraph and bullets to lead with
      results, adding the Sectigo and SolrCloud bullets; added a Hachette
      scope paragraph; rewrote the Skrinak Creative scope paragraph and the
      Skrinak Creative, Litho and Hachette bullets; tightened The Stat Store
      paragraph; dropped the M.S. honors line and restored the Manager, IT
      bullet on 80+ concurrent projects in its place. In print, the name and the admin
      line's bold segments now set in Arial Bold, the admin-line bold at
      10.5pt (Kyle's exception to the 11pt floor), and the render gate now
      covers admin lines as well as bullets.
---

<!-- current-role -->

Lead a team of 12 offshore IT contractors supporting static, LAMP, .NET, and Sitecore CMS platforms for ~200 highly visible, policy-sensitive pharmaceutical websites. Own platform operations and the standard operating procedures for deployment, monitoring, disaster recovery, and change management, partnering with Architecture, Development, Security, and Cloud DevOps. Govern a deployment calendar averaging 30 releases per week across UAT and production. Continuously harden the platform against ~1,400 reported CVEs across ~30 domains built by a mix of agencies and contractors, using an AI agent on an automated weekly pipeline to find exposures before outside notification. <!-- f: leadership, platform-ops, security -->

- Cut Azure hosting run-rate 28.7% (~$328K/year) by retiring legacy infrastructure, right-sizing, and reserving capacity. <!-- f: cost, platform-ops -->
- Maintained ~99.99% availability across ~200 production websites by monitoring the stack ahead of issues. <!-- f: platform-ops, delivery -->
- Migrated ~800 certificates to Sectigo on time against a 3-week deadline by coordinating cloud and application teams. <!-- f: security, delivery -->
- Moved ~30 websites off a legacy EC2 environment to containerized AWS ECS/Fargate on schedule. <!-- f: platform-ops, delivery -->
- Eliminated Sitecore search's single point of failure with clustered SolrCloud on AKS, load-tested to 500 users. <!-- f: platform-ops -->

## Senior Manager, Web Development

**Duke University, Office of IT** — Durham, NC | November 2021 – May 2022

Led a consolidated team of 8 Drupal developers after Duke realigned web development into central IT. Ran two platforms: a self-serve, headless, containerized Drupal distribution and out-of-the-box Drupal with a highly customized theme. <!-- f: leadership, web-dev -->

## Manager, IT

**Duke University, Trinity Technology Services** — Durham, NC | January 2016 – October 2021

Managed a team of up to 7 developers and IT analysts supporting 150+ department, program, and administrative websites for Trinity College of Arts & Sciences across Drupal, PHP, DevOps, and VM-based infrastructure. <!-- f: leadership, web-dev -->

- Cut site launch time from 4 months to 1 week by standardizing accessible, responsive builds with automated deployment. <!-- f: web-dev, delivery -->
- Maintained zero team turnover across 9 years at Duke through consistent one-on-ones and clear delivery expectations. <!-- f: leadership -->
- Co-chaired Duke's annual cross-campus TechExpo in 2017 and 2018, setting its registration record in 2018. <!-- f: leadership -->
- Directed 80+ concurrent projects annually using cloud collaboration and code-sharing platforms. <!-- f: leadership, delivery -->

## Team Lead

**Duke University, Trinity Technology Services** — Durham, NC | July 2013 – December 2015

Led two Drupal developers and a programmer supporting Trinity College of Arts & Sciences websites. <!-- f: leadership, web-dev -->

- Migrated 100+ Trinity websites from Apostrophe CMS to Drupal, using drush and git for repeatable builds. <!-- f: web-dev, delivery -->

## Co-Owner and Technologist

**Skrinak Creative, Inc.** — Apex, NC | January 2001 – July 2013

Co-owned a two-person print and web creative agency with $150K–$200K in annual revenue and an average of 15 B2B clients. Built and hosted client sites on LAMP and .NET, from UI and theme development to server administration. <!-- f: web-dev, creative -->

- Cut typical project delivery time from 3–6 months to 4–6 weeks by adopting Drupal and WordPress for client builds. <!-- f: web-dev, delivery -->
- Cut validation errors on acquired sites from 200+ per page to under 10 by implementing a QA process. <!-- f: web-dev -->

## Manager, Pre-press Department

**Litho Industries** — Durham, NC | June 1994 – January 2001

Managed the Pre-press department for a $26M/year commercial printer, with duties including design and oversight of web services. <!-- f: creative, leadership -->

- Cut production material costs ~50% by leading the conversion from film to digital plate imaging. <!-- f: cost, creative -->

## Desktop Publishing Manager

**Hachette-Filipacchi Media** — New York, NY | September 1988 – June 1994

Started as Typesetter on Elle Decor, the workflow conversion's pilot title. Earned promotion to Desktop Publishing Manager, directing two page builders at Elle, then managing desktop publishing for all titles with their editors and art directors. <!-- f: creative, leadership -->

- Delivered a $1.5M workflow conversion for 450+ staff at Elle, Car and Driver, and Road & Track on time and on budget. <!-- f: leadership, creative -->

## Supervisor

**The Stat Store** — New York, NY | September 1984 – September 1988

Supervised a 30-person graphic arts shop. <!-- f: creative, leadership -->

<!-- education -->
