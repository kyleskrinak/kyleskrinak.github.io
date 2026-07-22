import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkContent } from '../../scripts/lint-directives.mjs';

const withFrontmatter = body => `---\ntitle: Test\n---\n\n${body}`;

describe('checkContent', () => {
  it('flags digit:digit in prose', () => {
    const hits = checkContent(withFrontmatter('The bus leaves at 12:30 sharp.'));
    assert.equal(hits.length, 1);
  });

  it('flags digit:digit in a heading', () => {
    const hits = checkContent(withFrontmatter('## Session 1; 11:20 AM'));
    assert.equal(hits.length, 1);
  });

  it('skips fenced code blocks', () => {
    const hits = checkContent(withFrontmatter('```\nstart: 12:30\n```'));
    assert.deepEqual(hits, []);
  });

  it('skips 4-space-indented code', () => {
    const hits = checkContent(withFrontmatter('    start: 12:30'));
    assert.deepEqual(hits, []);
  });

  it('skips blockquote-indented code', () => {
    const hits = checkContent(withFrontmatter('>      Regenerating: 1 file(s) changed at 2021-01-16 11:59:14'));
    assert.deepEqual(hits, []);
  });

  it('skips inline code spans', () => {
    const hits = checkContent(withFrontmatter('Use the `12:30` timestamp format.'));
    assert.deepEqual(hits, []);
  });

  it('lints a file without frontmatter starting from line 1', () => {
    const hits = checkContent('The bus leaves at 12:30 sharp.');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 1);
  });

  it('does not flag an already-escaped colon', () => {
    const hits = checkContent(withFrontmatter('The bus leaves at 12\\:30 sharp.'));
    assert.deepEqual(hits, []);
  });

  it('flags the colon in a literal backslash-digit sequence', () => {
    const hits = checkContent(withFrontmatter('The path is \\1:30 in the log.'));
    assert.equal(hits.length, 1);
  });

  it('flags letter:letter (word:like)', () => {
    assert.equal(checkContent(withFrontmatter('a word:like this')).length, 1);
  });

  it('flags letter:digit (verse:30)', () => {
    assert.equal(checkContent(withFrontmatter('verse:30 here')).length, 1);
  });

  it('flags digit:letter (12:t30)', () => {
    assert.equal(checkContent(withFrontmatter('a 12:t30 x')).length, 1);
  });

  it('does not flag colon followed by space', () => {
    assert.deepEqual(checkContent(withFrontmatter('Note: this is fine.')), []);
  });

  it('does not flag directive fence lines', () => {
    assert.deepEqual(checkContent(withFrontmatter(':::cards{.float-right}\ntext\n:::')), []);
  });

  it('does not flag colons in markdown link destinations', () => {
    assert.deepEqual(checkContent(withFrontmatter('[song](spotify:track:abc123)')), []);
  });

  it('does not flag colons inside raw HTML tags', () => {
    assert.deepEqual(checkContent(withFrontmatter('<div style="margin: 0;padding:1rem">x</div>')), []);
  });

  it('does not flag escaped letter colon', () => {
    assert.deepEqual(checkContent(withFrontmatter('a word\\:like this')), []);
  });

  it('does not flag CSS pseudo-classes inside a <style> block', () => {
    assert.deepEqual(
      checkContent(withFrontmatter('<style>\n.notice a:hover {\n  color: red;\n}\n</style>')),
      []
    );
  });

  it('does not flag an MDX import with a colon in the module specifier', () => {
    assert.deepEqual(
      checkContent(withFrontmatter('import { Image } from "astro:assets";')),
      []
    );
  });

  it('skips fenced code inside a blockquote', () => {
    assert.deepEqual(checkContent(withFrontmatter('> ```\n> start: 12:30\n> ```')), []);
  });

  it('skips fences indented 1-3 spaces', () => {
    assert.deepEqual(checkContent(withFrontmatter('  ```\n  start: 12:30\n  ```')), []);
  });

  it('reports unclosed frontmatter instead of silently skipping the file', () => {
    const hits = checkContent('---\ntitle: Test\nno closing delimiter, 12:30 here');
    assert.equal(hits.length, 1);
    assert.match(hits[0].text, /unclosed frontmatter/);
  });
});
