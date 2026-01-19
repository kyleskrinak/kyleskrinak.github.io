---
title: Interactive Features Test Page
author: Kyle Skrinak
permalink: /test-features/
toc: true
excerpt: Comprehensive test page for validating all interactive features of the Minimal Mistakes theme.
image: /assets/images/181008-butter.JPG
tags:
  - "testing"
  - "playwright"
  - "automation"
---


This page contains all interactive features for automated testing. It is excluded from production builds and sitemaps.

**Features tested on this page:**
- Navigation menu (desktop & mobile hamburger)
- Table of Contents with Gumshoe scroll highlighting
- Smooth scroll animations
- Heading anchors
- Code copy buttons (when implemented)
- Social share buttons (Twitter, Facebook, LinkedIn)
- Author profile sidebar
- Read time indicator
- Category and tag links
- Related posts section

**Note:** Lightbox/image gallery functionality has been removed from this theme fork as it's not used in posts.

## Section 1: Introduction

This is the first section with enough content to demonstrate smooth scrolling behavior. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

## Section 2: Code Blocks

Testing code block rendering and copy button functionality (when implemented):

```javascript
// Test JavaScript code block
function testFunction() {
  const message = "Hello, World!";
  console.log(message);
  return message;
}

// More code to make it substantial
const result = testFunction();
console.log(result);
```

```python
# Test Python code block
def test_function():
    message = "Hello, World!"
    print(message)
    return message

result = test_function()
print(result)
```

### Section 2.1: Nested Heading

This is a nested heading to test TOC hierarchy.

## Section 3: Long Content for Scrolling

This section contains substantial content to ensure smooth scroll and Gumshoe TOC highlighting work properly.

### Subsection 4.1

Paragraph 1: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

Paragraph 2: Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

### Subsection 4.2

Paragraph 3: Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Paragraph 4: Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

### Subsection 4.3

Paragraph 5: Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

Paragraph 6: Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?

## Section 5: Anchor Links

Testing heading anchor functionality. These headings should have clickable anchor links.

### Subsection 5.1: First Anchor

Content for first anchor section.

### Subsection 5.2: Second Anchor

Content for second anchor section.

### Subsection 5.3: Third Anchor

Content for third anchor section.

## Section 6: Navigation Test

This section helps ensure the page has enough content to properly test:
- Smooth scroll behavior across long distances
- Gumshoe TOC highlighting as user scrolls
- Navigation menu behavior (visible at top)

Additional filler content to extend page length:

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris.

Fusce nec tellus sed augue semper porta. Mauris massa. Vestibulum lacinia arcu eget nulla. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.

## Section 7: Final Section

This is the final section to ensure TOC has sufficient entries for Gumshoe highlighting to be meaningful.

The test suite should verify:
1. Navigation menu displays correctly on desktop
2. Navigation overflow menu (hamburger) works on mobile
3. TOC highlights the active section during scroll
4. Smooth scroll animates when clicking TOC links
5. Image lightbox opens on image click
6. Code blocks are rendered properly (copy button when implemented)
7. Heading anchors are clickable and scroll to correct position

End of test page content.
