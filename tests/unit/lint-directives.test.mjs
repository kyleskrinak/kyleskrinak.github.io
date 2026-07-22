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
});
