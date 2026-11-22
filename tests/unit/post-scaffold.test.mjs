import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as prettier from 'prettier';
import {
  todayEasternDate,
  writePostIndex,
  PRETTIER_CONFIG_PATH,
} from '../../scripts/lib/post-scaffold.mjs';
import { richTextToMarkdown } from '../../scripts/migrate-notion-post.mjs';

describe('todayEasternDate', () => {
  it('returns the Eastern day when UTC has already reached the next day (EST)', () => {
    assert.equal(todayEasternDate(new Date('2026-11-22T01:30:00Z')), '2026-11-21');
  });

  it('rolls over at Eastern midnight, 05:00 UTC, under EST', () => {
    assert.equal(todayEasternDate(new Date('2026-11-22T04:59:59Z')), '2026-11-21');
    assert.equal(todayEasternDate(new Date('2026-11-22T05:00:00Z')), '2026-11-22');
  });

  it('rolls over at Eastern midnight, 04:00 UTC, under EDT', () => {
    assert.equal(todayEasternDate(new Date('2026-07-04T03:59:59Z')), '2026-07-03');
    assert.equal(todayEasternDate(new Date('2026-07-04T04:00:00Z')), '2026-07-04');
  });

  it('zero-pads the month and day', () => {
    assert.equal(todayEasternDate(new Date('2026-01-05T17:00:00Z')), '2026-01-05');
  });
});

describe('writePostIndex', () => {
  let dir;
  after(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  const text = (plain_text, extra = {}) => ({ plain_text, annotations: {}, ...extra });

  it('writes a post that passes the repo Prettier check (format:check)', async () => {
    dir = await mkdtemp(join(tmpdir(), 'post-scaffold-'));
    // The migration script's own Markdown: an italic run, a link with
    // angle-bracketed destination, a URL that holds `)`, and literal
    // Markdown characters that escapeMarkdownText() escapes.
    const paragraph = richTextToMarkdown([
      text('See '),
      text('this', { annotations: { italic: true } }),
      text(', '),
      text('IndieWeb', { href: 'https://indieweb.org/' }),
      text(', '),
      text('a wiki page', { href: 'https://en.wikipedia.org/wiki/Mercury_(planet)' }),
      text(', and a literal *star* <tag> [cite].'),
    ]);
    const indexPath = await writePostIndex(
      dir,
      'title: T\ndraft: true\n',
      `\n${paragraph}\n\n- one\n\n- two\n`
    );

    const written = await readFile(indexPath, 'utf8');
    const options = await prettier.resolveConfig(indexPath, { config: PRETTIER_CONFIG_PATH });
    assert.equal(await prettier.check(written, { ...options, filepath: indexPath }), true);

    assert.match(written, /See _this_, /);
    assert.match(written, /\[IndieWeb\]\(https:\/\/indieweb\.org\/\)/);
    assert.match(written, /\[a wiki page\]\(<https:\/\/en\.wikipedia\.org\/wiki\/Mercury_\(planet\)>\)/);
    assert.match(written, /a literal \\\*star\\\* \\<tag\\> \\\[cite\\\]\./);
  });
});
