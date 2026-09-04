import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  richTextToMarkdown,
  richTextToPlainText,
  plainTextTitle,
  plainTextDescription,
  plainTextCaption,
  extractTags,
  fenceFor,
  inlineCodeSpan,
  safeHttpUrl,
  escapeMarkdownText,
  slugifyStr,
  parseArgs,
} from '../../scripts/migrate-notion-post.mjs';

/** Build a minimal Notion rich-text token. */
const rt = (text, { bold, italic, code, href } = {}) => ({
  plain_text: text,
  href: href ?? null,
  annotations: { bold: !!bold, italic: !!italic, code: !!code },
});

describe('escapeMarkdownText', () => {
  it('escapes CommonMark inline special characters', () => {
    assert.equal(escapeMarkdownText('*bold* _em_ `code` [x] <tag> \\n'),
      '\\*bold\\* \\_em\\_ \\`code\\` \\[x\\] \\<tag\\> \\\\n');
  });

  it('leaves ordinary text untouched', () => {
    assert.equal(escapeMarkdownText('Rugged Rosaries are nice.'), 'Rugged Rosaries are nice.');
  });
});

describe('richTextToMarkdown', () => {
  it('renders unannotated plain text as-is', () => {
    assert.equal(richTextToMarkdown([rt('hello world')]), 'hello world');
  });

  it('wraps bold and italic text', () => {
    assert.equal(richTextToMarkdown([rt('bold', { bold: true })]), '**bold**');
    assert.equal(richTextToMarkdown([rt('italic', { italic: true })]), '*italic*');
  });

  it('escapes literal emphasis markers in unannotated text so they stay literal', () => {
    // A Notion author who typed a literal asterisk/underscore (not real
    // Notion bold/italic formatting) must not have it reinterpreted as
    // Markdown emphasis by the renderer.
    assert.equal(richTextToMarkdown([rt('*not bold* and _not italic_')]),
      '\\*not bold\\* and \\_not italic\\_');
  });

  it('escapes angle brackets so literal text is not parsed as raw HTML', () => {
    const out = richTextToMarkdown([rt('<b>hi</b>')]);
    // No bare `<` or `>` survives unescaped (the escape set covers the
    // characters that open/close a tag, not every character a tag can
    // contain, so the slash in a closing tag stays as-is).
    assert.doesNotMatch(out, /(?<!\\)[<>]/);
    assert.equal(out, '\\<b\\>hi\\</b\\>');
  });

  it('escapes a literal backslash', () => {
    assert.equal(richTextToMarkdown([rt('C:\\path')]), 'C:\\\\path');
  });

  it('wraps inline code spans without escaping their content as Markdown', () => {
    // Code-span content is literal per CommonMark — markdown-significant
    // characters inside it must NOT also be backslash-escaped.
    assert.equal(richTextToMarkdown([rt('*a* _b_', { code: true })]), '`*a* _b_`');
  });

  it('renders a safe http(s) link with the destination in angle brackets', () => {
    const out = richTextToMarkdown([rt('site', { href: 'https://example.com/' })]);
    assert.equal(out, '[site](<https://example.com/>)');
  });

  it('drops the link wrapper for a non-http(s) href, keeping the escaped text', () => {
    const out = richTextToMarkdown([rt('*click*', { href: 'javascript:alert(1)' })]);
    assert.equal(out, '\\*click\\*');
  });

  it('escapes a literal "]" in link text so it cannot close the link-text slot early', () => {
    const out = richTextToMarkdown([rt('a[b]c', { href: 'https://example.com/' })]);
    assert.equal(out, '[a\\[b\\]c](<https://example.com/>)');
  });

  it('wraps a link destination containing ")" so it does not truncate the destination', () => {
    const out = richTextToMarkdown([rt('wiki', { href: 'https://en.wikipedia.org/wiki/Foo_(bar)' })]);
    assert.equal(out, '[wiki](<https://en.wikipedia.org/wiki/Foo_(bar)>)');
  });

  it('wraps a link destination containing whitespace', () => {
    const out = richTextToMarkdown([rt('doc', { href: 'https://example.com/a b' })]);
    // URL() normalizes the space to %20, so no literal whitespace remains,
    // but the destination is still wrapped defensively.
    assert.match(out, /^\[doc\]\(<https:\/\/example\.com\/a%20b>\)$/);
  });

  it('concatenates multiple rich-text tokens', () => {
    const out = richTextToMarkdown([rt('a '), rt('b', { bold: true }), rt(' c')]);
    assert.equal(out, 'a **b** c');
  });

  it('returns an empty string for null/undefined rich text', () => {
    assert.equal(richTextToMarkdown(null), '');
    assert.equal(richTextToMarkdown(undefined), '');
  });
});

describe('richTextToPlainText', () => {
  it('joins plain_text with no Markdown applied, even for annotated/linked tokens', () => {
    const out = richTextToPlainText([
      rt('*a* '),
      rt('b', { bold: true, href: 'https://example.com/' }),
    ]);
    assert.equal(out, '*a* b');
  });
});

describe('plainTextTitle', () => {
  const page = title => ({ properties: { Name: { title } } });

  it('collapses internal whitespace/newlines to single spaces', () => {
    const title = page([{ plain_text: 'Line one\nLine  two' }]);
    assert.equal(plainTextTitle(title), 'Line one Line two');
  });

  it('trims leading/trailing whitespace', () => {
    const title = page([{ plain_text: '  Spaced Title  ' }]);
    assert.equal(plainTextTitle(title), 'Spaced Title');
  });

  it('returns an empty string when the title property is missing', () => {
    assert.equal(plainTextTitle({ properties: {} }), '');
  });
});

describe('plainTextDescription', () => {
  it('collapses whitespace/trims, like plainTextTitle', () => {
    const page = { properties: { Description: { rich_text: [{ plain_text: '  A summary\nacross lines  ' }] } } };
    assert.equal(plainTextDescription(page), 'A summary across lines');
  });

  it('returns an empty string when the property is missing', () => {
    assert.equal(plainTextDescription({ properties: {} }), '');
  });
});

describe('plainTextCaption', () => {
  it('collapses whitespace/trims, like plainTextTitle', () => {
    const page = { properties: { Caption: { rich_text: [{ plain_text: '  Photo by A. Uthor  ' }] } } };
    assert.equal(plainTextCaption(page), 'Photo by A. Uthor');
  });

  it('returns an empty string when the property is missing', () => {
    assert.equal(plainTextCaption({ properties: {} }), '');
  });

  it('returns an empty string for a whitespace-only property, not a non-empty string', () => {
    // content.config.ts declares caption with .min(1) — callers must treat
    // this the same as "missing" and omit the frontmatter key, or the
    // Astro build fails on an empty string.
    const page = { properties: { Caption: { rich_text: [{ plain_text: '   \n  ' }] } } };
    assert.equal(plainTextCaption(page), '');
  });
});

describe('extractTags', () => {
  it('maps multi_select options to trimmed name strings', () => {
    const page = { properties: { Tags: { multi_select: [{ name: ' react ' }, { name: 'astro' }] } } };
    assert.deepEqual(extractTags(page), ['react', 'astro']);
  });

  it('returns an empty array when the property is missing', () => {
    assert.deepEqual(extractTags({ properties: {} }), []);
  });
});

describe('fenceFor', () => {
  it('uses the minimum 3-backtick fence for code with no backticks', () => {
    assert.equal(fenceFor('const x = 1;'), '```');
  });

  it('uses a 4-backtick fence when the code contains a run of 3', () => {
    assert.equal(fenceFor('a ``` b'), '````');
  });

  it('uses a fence one longer than the longest backtick run', () => {
    assert.equal(fenceFor('a `````` b `` c'), '`'.repeat(7));
  });
});

describe('inlineCodeSpan', () => {
  it('wraps plain content in single backticks', () => {
    assert.equal(inlineCodeSpan('foo'), '`foo`');
  });

  it('uses a double-backtick fence when the content contains a single backtick', () => {
    assert.equal(inlineCodeSpan('a`b'), '``a`b``');
  });

  it('pads with a space when the content starts with a backtick', () => {
    assert.equal(inlineCodeSpan('`x'), '`` `x ``');
  });

  it('pads with a space when the content ends with a backtick', () => {
    assert.equal(inlineCodeSpan('x`'), '`` x` ``');
  });

  it('pads with a space when the content starts or ends with whitespace', () => {
    // Padding is added on top of the content's own whitespace, not merged
    // with it — a CommonMark parser strips exactly one padding space from
    // each side, leaving the original content (including its own space)
    // intact.
    assert.equal(inlineCodeSpan(' x'), '`  x `');
    assert.equal(inlineCodeSpan('x '), '` x  `');
  });

  it('does not pad ordinary content with no leading/trailing backtick or space', () => {
    assert.equal(inlineCodeSpan('x + y'), '`x + y`');
  });
});

describe('safeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    assert.equal(safeHttpUrl('https://example.com/'), 'https://example.com/');
    assert.equal(safeHttpUrl('http://example.com/'), 'http://example.com/');
  });

  it('rejects javascript: and data: URLs', () => {
    assert.equal(safeHttpUrl('javascript:alert(1)'), null);
    assert.equal(safeHttpUrl('data:text/html,<script>alert(1)</script>'), null);
  });

  it('rejects malformed URLs', () => {
    assert.equal(safeHttpUrl('not a url'), null);
  });
});

describe('slugifyStr', () => {
  it('lowercases and hyphenates ASCII titles', () => {
    assert.equal(slugifyStr('Why I Recommend Rugged Rosaries'), 'why-i-recommend-rugged-rosaries');
  });
});

describe('parseArgs', () => {
  it('recognizes --dry-run', () => {
    assert.deepEqual(parseArgs(['--dry-run']), { dryRun: true });
  });

  it('defaults dryRun to false with no flags', () => {
    assert.deepEqual(parseArgs([]), { dryRun: false });
  });

  it('throws on an unknown flag', () => {
    assert.throws(() => parseArgs(['--bogus']), /Unknown flag/);
  });
});
