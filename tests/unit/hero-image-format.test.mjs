// This file imports a .ts module directly, which no other test in tests/unit/
// does. `npm run test:unit` is a plain `node --test tests/unit/*.test.mjs`, so
// that import is resolved by Node's native TypeScript type stripping rather than
// by a build step. It needs Node 22.18+ or 24 — package.json engines require
// >=22.22.2 and CI runs 24, so both are covered — but on an older 22.x the
// failure is an unresolved import that takes down the *whole* suite, not just
// this file. Anything here that would need more than type erasure (enums,
// namespaces, decorators, or importing a .ts that uses them) does not work, and
// heroImageFormat.ts is written to stay inside that limit.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assetExtension,
  heroFormatIssues,
  HERO_REJECTED_FORMATS,
  OG_IMAGE_FORMATS,
} from '../../src/utils/heroImageFormat.ts';

// The value a schema actually sees: image() has not resolved yet, so it is an
// internal placeholder string ending in the source path.
const placeholder = ref => `__ASTRO_IMAGE_${ref}`;

describe('assetExtension', () => {
  it('reads the extension off an unresolved image() placeholder', () => {
    assert.equal(assetExtension(placeholder('./hero.webp')), 'webp');
    assert.equal(assetExtension(placeholder('./hero.svg')), 'svg');
  });

  it('reads the extension off resolved ImageMetadata', () => {
    assert.equal(assetExtension({ src: '/_astro/hero.Bq7x1a.webp' }), 'webp');
  });

  it('ignores a query string', () => {
    assert.equal(assetExtension('/_astro/hero.webp?v=2'), 'webp');
  });

  it('is case-insensitive', () => {
    assert.equal(assetExtension('./HERO.SVG'), 'svg');
  });

  // The regression that matters: if Astro ever changes the placeholder to a
  // shape with no trailing extension, this must report "cannot tell" rather
  // than "not an SVG", which would silently disable the guard.
  it('returns null for a shape it cannot read an extension from', () => {
    assert.equal(assetExtension(placeholder('{"src":"./hero.svg"}')), null);
    assert.equal(assetExtension(''), null);
    assert.equal(assetExtension(undefined), null);
    assert.equal(assetExtension(42), null);
  });
});

describe('heroFormatIssues: image', () => {
  it('has nothing to say when no image is set', () => {
    assert.deepEqual(heroFormatIssues({}), []);
  });

  it('rejects an SVG hero', () => {
    const issues = heroFormatIssues({ image: placeholder('./hero.svg') });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].field, 'image');
    assert.match(issues[0].message, /must not be SVG/);
  });

  // Sharp re-encodes the hero to WebP regardless, so every raster is fine here.
  // Only the vector case is excluded — the message must not imply otherwise.
  it('accepts any raster hero, including ones ogImage would refuse', () => {
    for (const ext of ['webp', 'jpg', 'jpeg', 'png', 'gif', 'avif', 'tiff']) {
      assert.deepEqual(
        heroFormatIssues({ image: placeholder(`./hero.${ext}`) }),
        [],
        `expected .${ext} hero to pass`
      );
    }
  });

  it('rejects exactly the formats it names', () => {
    assert.deepEqual([...HERO_REJECTED_FORMATS], ['svg']);
  });
});

describe('heroFormatIssues: ogImage', () => {
  // Served to scrapers verbatim, so this one is a real allowlist.
  it('accepts every format it advertises', () => {
    for (const ext of OG_IMAGE_FORMATS) {
      assert.deepEqual(
        heroFormatIssues({ ogImage: placeholder(`./card.${ext}`) }),
        [],
        `expected .${ext} ogImage to pass`
      );
    }
  });

  it('rejects formats scrapers cannot render, not just SVG', () => {
    for (const ext of ['svg', 'avif', 'tiff', 'bmp']) {
      const issues = heroFormatIssues({ ogImage: placeholder(`./card.${ext}`) });
      assert.equal(issues.length, 1, `expected .${ext} ogImage to fail`);
      assert.equal(issues[0].field, 'ogImage');
      assert.match(issues[0].message, new RegExp(`not ${ext}`));
    }
  });

  it('names the allowlist it enforces', () => {
    const issues = heroFormatIssues({ ogImage: placeholder('./card.tiff') });
    for (const ext of OG_IMAGE_FORMATS) {
      assert.match(issues[0].message, new RegExp(`\\b${ext}\\b`));
    }
  });
});

describe('heroFormatIssues: both fields', () => {
  it('reports every offending field, not just the first', () => {
    const issues = heroFormatIssues({
      image: placeholder('./hero.svg'),
      ogImage: placeholder('./card.svg'),
    });
    assert.deepEqual(
      issues.map(i => i.field),
      ['image', 'ogImage']
    );
  });

  it('fails loudly when a reference shape is unreadable', () => {
    for (const field of ['image', 'ogImage']) {
      const issues = heroFormatIssues({ [field]: placeholder('{"src":"./x.svg"}') });
      assert.equal(issues.length, 1);
      assert.match(issues[0].message, /could not read a file extension/);
      assert.match(issues[0].message, /heroImageFormat\.ts/);
    }
  });
});
