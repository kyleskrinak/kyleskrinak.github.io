# Jekyll Reveal.js to Slidev Migration Notes

**Date:** 2026-01-19
**Total Presentations Migrated:** 8

## Overview

This document provides details about the migration of Jekyll Reveal.js presentations to Slidev format.

## Conversion Details

### 8 Presentations Successfully Migrated

1. **bundle test**
   - File: `01-bundle-test.md`
   - Date: N/A

2. **2019-Feb-13 SLG Presentation**
   - File: `02-2019-feb-13-slg-presentation.md`
   - Date: N/A

3. **2019 DrupalCon Drupal 8 Multisite**
   - File: `03-2019-drupalcon-drupal-8-multisite.md`
   - Date: N/A

4. **How to Manage Departmental Faculty and Staff Data**
   - File: `04-tts-profile-mgmt.md`
   - Date: N/A

5. **Introduction to Drupal**
   - File: `05-drupal-intro.md`
   - Date: N/A

6. **Drupal Multisite on a Dime**
- **Theme:** Duke University
   - File: `06-drupal-multisite-on-a-dime.md`
   - Date: 2020-12-03 15:21 -0500

7. **DrupalCon 2022 Code+ Presentation**
- **Theme:** Duke University
   - File: `07-code-presentation.md`
   - Date: 2022-04-06 15:21 -0500

8. **What I did at DrupalCon 2022**
- **Theme:** Duke University
   - File: `08-wohd.md`
   - Date: 2022-05-03 15:21 -0500

## Conversion Process

The following transformations were applied to each presentation:

### Front Matter Changes
- Added Slidev-compatible YAML front matter
- Preserved title and subtitle (from excerpt)
- Added theme specification (default or duke)
- Configured transition and layout settings

### Content Transformations
- **Slide Separators:** Triple newlines (\n\n\n) to Slidev separators (---)
- **Heading Levels:** Increased by 2 levels (# to ###, ## to ####, etc.)
- **HTML Entities:** Converted to UTF-8 characters (e.g., &mdash; to em-dash)
- **Jekyll Variables:** Removed {{ site.baseurl }} references
- **Reveal.js Markup:** Removed Reveal.js-specific HTML comments and fragment indicators
- **Speaker Notes:** Converted Note: sections to HTML comments
- **Whitespace Cleanup:** Normalized excessive blank lines

### Image Path Handling
- Jekyll image paths using {{ site.baseurl }}/assets/images/ have been preserved
- For Slidev, ensure images are accessible from the public folder
- You may need to adjust image paths based on your Slidev deployment

## Duke Theme Presentations

Found 3 presentations configured for Duke theme:

- 06-drupal-multisite-on-a-dime.md: Drupal Multisite on a Dime
- 07-code-presentation.md: DrupalCon 2022 Code+ Presentation
- 08-wohd.md: What I did at DrupalCon 2022

These presentations have theme: duke set in their front matter.

## Next Steps

1. **Review Presentations:** Open each generated file and verify the content conversion
2. **Check Image Paths:** Ensure all image references are correct for Slidev
3. **Test Rendering:** Run Slidev and test each presentation
4. **Customize Styling:** Update themes and layouts as needed
5. **Verify Links:** Check that all links and references work correctly
6. **Update Configuration:** Adjust Slidev config if additional customization is needed

## File Structure

```
slidev-presentations/slides/
├── 01-bundle-test.md
├── 02-2019-feb-13-slg-presentation.md
├── 03-2019-drupalcon-drupal-8-multisite.md
├── 04-tts-profile-mgmt.md
├── 05-drupal-intro.md
├── 06-drupal-multisite-on-a-dime.md
├── 07-code-presentation.md
├── 08-wohd.md
├── MIGRATION_SUMMARY.txt
└── MIGRATION_NOTES.md
```

## Troubleshooting

### Images Not Loading
- Ensure image files are in the correct location relative to Slidev's public folder
- Update image paths from {{ site.baseurl }}/assets/images/ to /images/ or appropriate relative path

### Heading Sizes Look Wrong
- This is expected due to the +2 heading level conversion
- Slidev uses different heading hierarchy than Reveal.js
- You may need to use HTML or custom CSS to adjust sizes

### Speaker Notes Not Showing
- Slidev handles speaker notes differently than Reveal.js
- Check Slidev documentation for proper speaker note syntax
- Converted notes are in HTML comment format for reference

## Resources

- [Slidev Documentation](https://sli.dev/)
- [Slidev Theme Guide](https://sli.dev/guide/install#install-additional-theme)
- [Markdown Guide for Slidev](https://sli.dev/guide/syntax.html)

