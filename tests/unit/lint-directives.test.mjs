import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkContent } from '../../scripts/lint-directives.mjs';

const withFrontmatter = body => `---\ntitle: Test\n---\n\n${body}`;

describe('checkContent', () => {
  it('flags digit:digit in prose', () => {
    const hits = checkContent(withFrontmatter('The bus leaves at 12:30 sharp.'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 5);
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

  it('flags 4-space-indented list continuation paragraphs (not code)', () => {
    const hits = checkContent(withFrontmatter('1.  Item\n\n    Continuation at 12:30 here.'));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 7);
  });

  it('skips blockquote-indented code', () => {
    const hits = checkContent(withFrontmatter('>      Regenerating: 1 file(s) changed at 2021-01-16 11:59:14'));
    assert.deepEqual(hits, []);
  });

  it('flags directive-like colons in ordinary blockquote text', () => {
    const hits = checkContent(withFrontmatter('> 7:30 AM: drive to mechanic.'));
    assert.equal(hits.length, 1);
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

  it('flags a directive-like colon inside a link label', () => {
    assert.equal(
      checkContent(withFrontmatter('[Hebrews 12:6-7](https://example.com/)')).length,
      1
    );
  });

  it('does not flag colon followed by space', () => {
    assert.deepEqual(checkContent(withFrontmatter('Note: this is fine.')), []);
  });

  it('does not flag the allowed cards container directive', () => {
    assert.deepEqual(checkContent(withFrontmatter(':::cards{.float-right}\ntext\n:::')), []);
  });

  it('flags a container directive not in the allowlist', () => {
    const hits = checkContent(withFrontmatter(':::warning\ntext\n:::'));
    assert.equal(hits.length, 1);
  });

  it('flags a leaf directive', () => {
    assert.equal(checkContent(withFrontmatter('::youtube[title]')).length, 1);
  });

  it('flags a directive nested inside an allowed cards container', () => {
    const hits = checkContent(withFrontmatter(':::cards\nleaves at 12:30\n:::'));
    assert.equal(hits.length, 1);
  });

  it('does not flag colons in markdown link destinations', () => {
    assert.deepEqual(checkContent(withFrontmatter('[song](spotify:track:abc123)')), []);
  });

  it('does not flag bare URLs', () => {
    assert.deepEqual(checkContent(withFrontmatter('See https://example.com/a:b for details.')), []);
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

  describe('mdx', () => {
    const mdx = body => checkContent(withFrontmatter(body), { mdx: true });

    it('does not flag an MDX import with a colon in the module specifier', () => {
      assert.deepEqual(mdx('import { Image } from "astro:assets";'), []);
    });

    it('does not flag colons inside JSX attribute values', () => {
      assert.deepEqual(mdx('<Image src={img} alt="finished at 12:30" />'), []);
    });

    it('flags directive-like colons in prose between JSX', () => {
      assert.equal(mdx('<Aside />\n\nThe race started at 7:30 sharp.').length, 1);
    });

    it('reports malformed MDX as a lint error instead of crashing', () => {
      const hits = mdx('<figure>\n  unclosed at 12:30');
      assert.equal(hits.length, 1);
      assert.match(hits[0].text, /parse error/);
    });
  });
});
