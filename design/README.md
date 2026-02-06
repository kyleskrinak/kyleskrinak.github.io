# Design Assets

This directory contains graphic source files and design assets for the blog.

## Purpose

Store original design files that should be version-controlled but not exposed on the live website. These files are automatically excluded from the Astro build process.

## Organization

Suggested structure:
- `logos/` - Logo source files (PSD, AI, Sketch, Figma exports)
- `graphics/` - Hero images, banners, and other graphic sources
- `icons/` - Icon source files
- `screenshots/` - Project screenshots and mockups

## Usage

1. Add source files to appropriate subdirectories
2. Export production-ready assets to `public/` or `src/assets/` as needed
3. Keep source files organized with descriptive names

## Note

Files in this directory are NOT included in the website build. Only files in `public/` or imported from `src/` appear on the live site.
