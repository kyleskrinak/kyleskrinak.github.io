# Presentation HTML Implementation Guide

## Overview
Static HTML presentations stored in `public/presentations/` that display in fullscreen mode with slide navigation.

## Working Pattern (code-presentation.html)

### Key Success Factors

**1. CSS Visibility Control**
- Slides are `display: none` by default
- Only active slides show with `display: flex`
- NO fallback rules forcing first slide visibility (e.g., `.slide:first-child { display: flex !important; }`)
- Conflicting CSS rules break the active state management

```css
.slide {
    display: none;
    flex-direction: column;
    justify-content: center;
}

.slide.active {
    display: flex;  /* Simple, no !important needed if no conflicts */
}
```

**2. JavaScript State Management**
- Use simple forEach loop to manage active class
- Clear separation: add active to current, remove from others
- Initialize state on page load with `showSlide()`

```javascript
function showSlide() {
    slides.forEach((slide, index) => {
        if (index === currentSlide) {
            slide.classList.add('active');
        } else {
            slide.classList.remove('active');
        }
    });
}
```

**3. HTML Structure**
- Wrap all slides in a container (`.slides-wrapper`)
- Each slide is a `<section class="slide">`
- Slide content in `<div class="slide-content">`
- Slide number indicator for UX

```html
<div class="slides-wrapper">
    <section class="slide">
        <div class="slide-content">
            <!-- Your content -->
        </div>
        <div class="slide-number">1 / 42</div>
    </section>
    <!-- More slides... -->
</div>
```

### Navigation Controls

```javascript
function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    showSlide();
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    showSlide();
}
```

Supports:
- Click buttons: "← Previous" and "Next →"
- Keyboard: Arrow Right/Left for navigation, Space to advance
- Progress bar at top shows position

### What NOT to Do

❌ **Don't force first slide visibility with CSS**
```css
/* BAD - breaks active state */
.slide:first-child { display: flex !important; }
```

❌ **Don't use complex state management**
```javascript
/* BAD - too many null checks and conditions */
if (slides[currentSlide]) {
    slides[currentSlide].classList.remove('active');
}
```

❌ **Don't mix display methods** (some hidden with display:none, some with visibility:hidden, etc.)

## File Locations & Linking

**Presentation File Path**: `public/presentations/[id].html`

**Link from Detail Page** (`src/pages/presentations/[id].astro`):
```javascript
const htmlFile = linkWithBase(`/presentations/${id}.html`);
```

⚠️ **Critical**: Use `linkWithBase()` helper for BASE_URL compatibility on staging (`/astro-blog/`) and production (`/`)

**Link to Home**: Use relative path in presentation HTML:
```html
<a href="../../index.html" class="home-link">← Home</a>
```

## Content Types That Work

✅ Text, headings, lists
✅ Images (`<img>` tags) - tested with SVG workflows
✅ Embedded videos (`<iframe>` - Warpwire, YouTube)
✅ Code blocks (`<pre>/<code>`)
✅ Tables with proper styling
✅ Links (internal and external)

All standard HTML content renders properly with the default slide styling (purple gradient background, white text).

## Testing Checklist

- [ ] First slide displays on page load
- [ ] Click "Next" button advances slides
- [ ] Click "Previous" button goes back
- [ ] Arrow Right/Left keyboard navigation works
- [ ] Space key advances slides
- [ ] All 42 slides display correctly
- [ ] Images load (check paths are absolute)
- [ ] Videos load (iframes render)
- [ ] Progress bar at top updates as you navigate
- [ ] Home button works (check relative path)
- [ ] Fullscreen button works

## BASE_URL Deployment Issue (Resolved)

**Problem**: Links worked on localhost but returned 404 on GitHub Pages staging (`/astro-blog/`)

**Solution**: Use `linkWithBase()` in the Astro route that generates presentation detail pages:

```javascript
// src/pages/presentations/[id].astro
const htmlFile = linkWithBase(`/presentations/${id}.html`);
```

This ensures the HTML file URL is `/astro-blog/presentations/code-presentation.html` on staging and `/presentations/code-presentation.html` on production.

**Test Verification**: The `tests/link-validation.spec.ts` test "presentation detail pages load with valid links" navigates to the actual HTML file and verifies 200 status.

## Common Mistakes to Avoid

1. **CSS Specificity Wars** - Let CSS be simple, don't fight it with !important rules
2. **Forgotten linkWithBase()** - Always use it in presentation routes for subpath deployments
3. **Hardcoded paths in HTML** - Use relative paths for home link, absolute for images/videos
4. **Image path issues** - Images should use absolute paths like `/assets/images/Code+/Code+Workflow-1.svg`
5. **Overcomplicating JavaScript** - Simple forEach loop is sufficient, no need for complex state tracking
