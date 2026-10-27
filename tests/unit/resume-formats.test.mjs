import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import {
	CONTACT_SEPARATOR,
	buildResumeText,
	extractResumeBlocks,
	mergeRuns,
	outputPaths,
	parseFormats,
	parseResumeText,
	verifyBlocksCoverPage,
	verifyResumeText,
} from '../../scripts/lib/resume-formats.mjs';

const PRINT_FIXTURE = `
	<html>
		<head></head>
		<body>
			<header class="resume-header">
				<h1>Kyle Skrinak</h1>
				<div class="contact-info">
					<span><a href="mailto:kyle@example.com">kyle@example.com</a></span>
					<span data-before='" | "'>Apex, NC</span>
					<span data-before='" | "'><a href="https://kyle.skrinak.com">kyle.skrinak.com</a></span>
				</div>
			</header>
			<article class="resume-content">
				<h2 id="senior-manager-it"><strong style="text-decoration-line: underline">Senior Manager, IT</strong>, Duke University | 2019–2022</h2>
				<p>Led a   team of
					eight engineers.</p>
				<ul>
					<li>Cut <strong> hosting</strong> costs 24%, by right-sizing.</li>
					<li>Shipped the 2.0 launch.</li>
				</ul>
			</article>
		</body>
	</html>
`;

// Computed styles for the linkedom page, which has no CSS engine: bold for
// strong and b, everything else from the element's style attribute. A
// ::before's content comes from data-before, in the quoted form Chromium
// returns; the fixture's contact spans carry what resume.css prints.
function computedStyle(el, pseudo) {
	if (pseudo === '::before') return { content: el.getAttribute('data-before') ?? 'none' };
	const style = {
		display: 'block',
		fontFamily: '"Times New Roman", serif',
		fontSize: '14.6667px',
		lineHeight: '17.8933px',
		fontWeight: ['STRONG', 'B'].includes(el.tagName) ? '700' : '400',
		textAlign: 'start',
		textDecorationLine: 'none',
	};
	for (const declaration of (el.getAttribute('style') ?? '').split(';')) {
		const [property, value] = declaration.split(':').map(s => s.trim());
		if (property) style[property.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
	}
	return style;
}

// Runs extractResumeBlocks from its source text inside a vm context, the way
// page.evaluate sends it to Chromium, so a helper it used from module scope
// would throw here as it would in a real render. The result crosses back as
// JSON, as page.evaluate returns it. data-rect="left top bottom" (CSS px)
// stands in for layout, which linkedom does not compute.
function extract(html = PRINT_FIXTURE) {
	const { document, window } = parseHTML(html);
	for (const el of document.querySelectorAll('[data-rect]')) {
		const [left, top, bottom] = el.getAttribute('data-rect').split(' ').map(Number);
		el.getBoundingClientRect = () => ({ left, top, bottom, right: left, width: 0, height: bottom - top });
	}
	const context = createContext({
		document,
		window,
		console,
		getComputedStyle: computedStyle,
		NodeFilter: { SHOW_TEXT: 4 },
	});
	const result = new Script(`(${extractResumeBlocks.toString()})()`).runInContext(context);
	return JSON.parse(JSON.stringify(result));
}

const plain = text => ({ text, bold: false, underline: false, href: null });

describe('extractResumeBlocks', () => {
	it('reads the name, contact items, headings, paragraphs and bullets in order', () => {
		const { blocks } = extract();
		assert.deepEqual(
			blocks.map(block => block.kind),
			['name', 'contact', 'heading', 'paragraph', 'bullet', 'bullet'],
		);
		assert.deepEqual(blocks[0].runs, [plain('Kyle Skrinak')]);
		assert.deepEqual(blocks[1].items, [
			[{ text: 'kyle@example.com', bold: false, underline: false, href: 'mailto:kyle@example.com' }],
			[plain('Apex, NC')],
			[{ text: 'kyle.skrinak.com', bold: false, underline: false, href: 'https://kyle.skrinak.com' }],
		]);
		assert.deepEqual(blocks[1].separators, ['', CONTACT_SEPARATOR, CONTACT_SEPARATOR]);
	});

	it('carries bold and an ancestor underline into the runs', () => {
		const [, , heading] = extract().blocks;
		assert.deepEqual(heading.runs, [
			{ text: 'Senior Manager, IT', bold: true, underline: true, href: null },
			plain(', Duke University | 2019–2022'),
		]);
	});

	it('carries a face and size only where a run departs from its block', () => {
		const html = PRINT_FIXTURE.replace(
			'<strong style="text-decoration-line: underline">',
			'<strong style="text-decoration-line: underline; font-family: Arial, sans-serif; font-size: 14px">',
		);
		const [, , heading] = extract(html).blocks;
		assert.deepEqual(heading.runs, [
			{ text: 'Senior Manager, IT', bold: true, underline: true, href: null, font: 'Arial', fontSize: 10.5 },
			plain(', Duke University | 2019–2022'),
		]);
	});

	it('keeps neighbouring runs apart when only their face or size differs', () => {
		const html = PRINT_FIXTURE.replace(
			'<li>Shipped the 2.0 launch.</li>',
			'<li>Shipped <span style="font-family: Arial, sans-serif">the</span><span style="font-size: 14px"> 2.0</span> launch.</li>',
		);
		assert.deepEqual(extract(html).blocks[5].runs, [
			plain('Shipped '),
			{ ...plain('the'), font: 'Arial' },
			{ ...plain(' 2.0'), fontSize: 10.5 },
			plain(' launch.'),
		]);
	});

	it('merges neighbouring runs that print alike', () => {
		const html = PRINT_FIXTURE.replace(
			'<li>Shipped the 2.0 launch.</li>',
			'<li>Shipped <span>the</span> <span style="font-family: Arial, sans-serif">2.0</span><span style="font-family: Arial, sans-serif"> launch</span>.</li>',
		);
		assert.deepEqual(extract(html).blocks[5].runs, [
			plain('Shipped the '),
			{ ...plain('2.0 launch'), font: 'Arial' },
			plain('.'),
		]);
	});

	it('carries no face for a run whose family list starts with its block\'s face', () => {
		const html = PRINT_FIXTURE.replace(
			'<li>Shipped the 2.0 launch.</li>',
			'<li>Shipped <span style="font-family: \'Times New Roman\', Times, serif">the</span> 2.0 launch.</li>',
		);
		assert.deepEqual(extract(html).blocks[5].runs, [plain('Shipped the 2.0 launch.')]);
	});

	it('collapses whitespace within and across runs and trims the block', () => {
		const { blocks } = extract();
		assert.deepEqual(blocks[3].runs, [plain('Led a team of eight engineers.')]);
		assert.deepEqual(blocks[4].runs, [
			plain('Cut '),
			{ text: 'hosting', bold: true, underline: false, href: null },
			plain(' costs 24%, by right-sizing.'),
		]);
	});

	it('keeps a no-break space, which prints', () => {
		const { blocks } = extract(PRINT_FIXTURE.replace('2.0 launch', '2.0\u00a0launch'));
		assert.equal(blocks[5].runs[0].text, 'Shipped the 2.0\u00a0launch.');
	});

	it('accounts for every printed character', () => {
		assert.deepEqual(verifyBlocksCoverPage(extract()), []);
	});

	it('skips display:none elements', () => {
		const html = PRINT_FIXTURE.replace('<span data-before=\'" | "\'>Apex', '<span data-before=\'" | "\' style="display: none">Apex').replace(
			'<li>Shipped',
			'<li style="display: none">Shipped',
		);
		const { blocks } = extract(html);
		assert.equal(blocks[1].items.length, 2);
		assert.deepEqual(
			blocks.map(block => block.kind),
			['name', 'contact', 'heading', 'paragraph', 'bullet'],
		);
	});

	it('throws on an inline element the writers cannot carry', () => {
		const html = PRINT_FIXTURE.replace('Shipped the 2.0 launch.', 'Shipped the <em>2.0</em> launch.');
		assert.throws(() => extract(html), /Unsupported <em> inside a resume <li>/);
	});

	it('throws on a content element the writers cannot carry', () => {
		const html = PRINT_FIXTURE.replace('<p>Led', '<table><tr><td>x</td></tr></table><p>Led');
		assert.throws(() => extract(html), /Unsupported <table> in \.resume-content/);
	});

	it('measures layout in points from the page', () => {
		const html = PRINT_FIXTURE.replace('<header class="resume-header">', '<header class="resume-header" data-rect="40 0 60">')
			.replace('<h1>', '<h1 data-rect="40 0 20" style="text-align: center">')
			.replace('<div class="contact-info">', '<div class="contact-info" data-rect="40 24 40">')
			.replace('<h2 id', '<h2 data-rect="40 52 70" id')
			.replace('<p>Led', '<p data-rect="40 72 90">Led')
			.replace('<li>Cut', '<li data-rect="60 92 110">Cut');
		const [name, contact, heading, paragraph, bullet] = extract(html).blocks;
		assert.deepEqual(name.layout, {
			font: 'Times New Roman',
			fontSize: 14.6667 * 0.75,
			lineHeight: 17.8933 * 0.75,
			spaceBefore: 0,
			indent: 0,
			align: 'center',
		});
		assert.equal(contact.layout.spaceBefore, 4 * 0.75);
		assert.equal(heading.layout.spaceBefore, 12 * 0.75);
		assert.equal(paragraph.layout.spaceBefore, 2 * 0.75);
		assert.equal(bullet.layout.indent, 20 * 0.75);
		assert.equal(bullet.layout.align, 'left');
	});
});

describe('verifyBlocksCoverPage', () => {
	it('reports where the blocks drop printed text', () => {
		const extracted = extract();
		extracted.blocks[3].runs[0].text = 'Led a team of engineers.';
		const [problem, ...rest] = verifyBlocksCoverPage(extracted);
		assert.equal(rest.length, 0);
		assert.match(problem, /differs from the printed page at character \d+/);
		assert.match(problem, /eightengineers/);
	});

	it('reports a printed contact separator that differs from CONTACT_SEPARATOR', () => {
		const [problem, ...rest] = verifyBlocksCoverPage(extract(PRINT_FIXTURE.replaceAll('" | "', '" · "')));
		assert.equal(rest.length, 0);
		assert.match(problem, /printed contact separators \[""," · "," · "\] differ from CONTACT_SEPARATOR/);
	});

	it('reports a contact line printed without separators', () => {
		const html = PRINT_FIXTURE.replaceAll(` data-before='" | "'`, '');
		const [problem, ...rest] = verifyBlocksCoverPage(extract(html));
		assert.equal(rest.length, 0);
		assert.match(problem, /printed contact separators \["","",""\]/);
	});

	it('reports a separator printed before the first visible item', () => {
		const html = PRINT_FIXTURE.replace('<span><a href="mailto:', '<span style="display: none"><a href="mailto:');
		const [problem] = verifyBlocksCoverPage(extract(html));
		assert.match(problem, /printed contact separators \[" \| "," \| "\]/);
	});
});

describe('mergeRuns', () => {
	it('joins neighbours that print alike and keeps the rest apart', () => {
		const bold = text => ({ text, bold: true, underline: false, href: null });
		assert.deepEqual(mergeRuns([plain('a'), plain('b'), bold('c'), bold('d'), plain('e')]), [
			plain('ab'),
			bold('cd'),
			plain('e'),
		]);
	});

	it('does not modify its input', () => {
		const runs = [plain('a'), plain('b')];
		mergeRuns(runs);
		assert.deepEqual(runs, [plain('a'), plain('b')]);
	});
});

describe('buildResumeText', () => {
	it('writes one line per block, a blank line before each heading, and bullets as "- " lines', () => {
		assert.equal(
			buildResumeText(extract().blocks),
			[
				'Kyle Skrinak',
				`kyle@example.com${CONTACT_SEPARATOR}Apex, NC${CONTACT_SEPARATOR}kyle.skrinak.com`,
				'',
				'Senior Manager, IT, Duke University | 2019–2022',
				'Led a team of eight engineers.',
				'- Cut hosting costs 24%, by right-sizing.',
				'- Shipped the 2.0 launch.',
				'',
			].join('\n'),
		);
	});
});

describe('verifyResumeText', () => {
	it('passes the text it was built from', () => {
		const { blocks } = extract();
		assert.deepEqual(verifyResumeText(blocks, buildResumeText(blocks)), []);
	});

	it('fails a paragraph the layout would read back as a bullet', () => {
		const { blocks } = extract();
		blocks[3].runs = [plain('- not a bullet')];
		const [problem] = verifyResumeText(blocks, buildResumeText(blocks));
		assert.match(problem, /\.txt does not read back/);
		assert.match(problem, /block 3/);
	});

	it('fails a contact item that holds the separator', () => {
		const { blocks } = extract();
		blocks[1].items[1] = [plain(`Apex${CONTACT_SEPARATOR}NC`)];
		assert.match(verifyResumeText(blocks, buildResumeText(blocks))[0], /block 1/);
	});

	it('fails a byte-order mark, a carriage return and a missing final newline', () => {
		const { blocks } = extract();
		const text = buildResumeText(blocks);
		assert.ok(verifyResumeText(blocks, `﻿${text}`).includes('.txt starts with a byte-order mark'));
		assert.ok(
			verifyResumeText(blocks, text.replace(/\n/g, '\r\n')).includes(
				'.txt contains a carriage return; lines must end in LF',
			),
		);
		assert.ok(verifyResumeText(blocks, text.trimEnd()).includes('.txt does not end with a newline'));
	});
});

describe('parseResumeText', () => {
	it('reads a paragraph that follows the contact line before any heading', () => {
		assert.deepEqual(parseResumeText('Name\nContact\nScope.\n\nHeading\n- Bullet\n'), [
			{ kind: 'name', text: 'Name' },
			{ kind: 'contact', items: ['Contact'] },
			{ kind: 'paragraph', text: 'Scope.' },
			{ kind: 'heading', text: 'Heading' },
			{ kind: 'bullet', text: 'Bullet' },
		]);
	});
});

describe('parseFormats', () => {
	it('returns the requested formats in canonical order, once each', () => {
		assert.deepEqual(parseFormats('txt, PDF ,docx,txt'), ['pdf', 'docx', 'txt']);
		assert.deepEqual(parseFormats('docx'), ['docx']);
	});

	it('rejects an unknown format', () => {
		assert.throws(() => parseFormats('pdf,md'), /Unknown --formats value\(s\): md/);
	});

	it('rejects an empty list', () => {
		assert.throws(() => parseFormats(' , '), /--formats is empty/);
	});
});

describe('outputPaths', () => {
	it('puts the other formats beside the PDF under its base name', () => {
		assert.deepEqual(outputPaths('dist/resume/kyle.pdf', ['pdf', 'docx', 'txt']), {
			pdf: 'dist/resume/kyle.pdf',
			docx: 'dist/resume/kyle.docx',
			txt: 'dist/resume/kyle.txt',
		});
	});

	it('names only the requested formats', () => {
		assert.deepEqual(outputPaths('/tmp/Resume.PDF', ['txt']), { txt: '/tmp/Resume.txt' });
	});

	it('rejects a path that does not end in .pdf', () => {
		assert.throws(() => outputPaths('resume.docx', ['pdf']), /--output must end in \.pdf/);
		assert.throws(() => outputPaths('resume', ['pdf']), /--output must end in \.pdf/);
	});
});
