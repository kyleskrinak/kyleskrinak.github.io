import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { buildResumeDocx, readDocxParagraphs, verifyResumeDocx } from '../../scripts/lib/resume-docx.mjs';

const layout = (overrides = {}) => ({
	font: 'Times New Roman',
	fontSize: 11,
	lineHeight: 13.42,
	spaceBefore: 0,
	indent: 0,
	align: 'left',
	...overrides,
});
const run = (text, { bold = false, underline = false, href = null } = {}) => ({ text, bold, underline, href });

// The block list extractResumeBlocks would read from a small print page.
const BLOCKS = [
	{ kind: 'name', runs: [run('Kyle Skrinak')], layout: layout({ fontSize: 14.3, align: 'center' }) },
	{
		kind: 'contact',
		items: [
			[run('kyle@example.com', { href: 'mailto:kyle@example.com' })],
			[run('Apex, NC')],
			[run('kyle.skrinak.com', { href: 'https://kyle.skrinak.com/' })],
		],
		separators: ['', ' | ', ' | '],
		layout: layout({ spaceBefore: 4, align: 'center' }),
	},
	{
		kind: 'heading',
		runs: [run('Senior Manager, IT', { bold: true, underline: true }), run(', Duke University | 2019–2022')],
		layout: layout({ spaceBefore: 9 }),
	},
	{ kind: 'paragraph', runs: [run('Led a team of eight & more <engineers>.')], layout: layout({ spaceBefore: 1.65 }) },
	{
		kind: 'bullet',
		runs: [run('Cut '), run('hosting', { bold: true }), run(' costs 24%.')],
		layout: layout({ spaceBefore: 0.88, indent: 15.4 }),
	},
];

const MARGINS = { top: 28.8, right: 28.8, bottom: 28.8, left: 28.8 };

async function documentXml(buffer) {
	return (await JSZip.loadAsync(buffer)).file('word/document.xml').async('string');
}

describe('buildResumeDocx', () => {
	it('reads back to the blocks it was written from', async () => {
		const buffer = await buildResumeDocx(BLOCKS, { margins: MARGINS });
		assert.deepEqual(await verifyResumeDocx(BLOCKS, buffer), []);
	});

	it('writes bullets as list items, links as hyperlinks, and bold and underline as run properties', async () => {
		const paragraphs = await readDocxParagraphs(await buildResumeDocx(BLOCKS, { margins: MARGINS }));
		assert.deepEqual(
			paragraphs.map(p => p.bullet),
			[false, false, false, false, true],
		);
		assert.deepEqual(paragraphs[1].runs, [
			run('kyle@example.com', { href: 'mailto:kyle@example.com' }),
			run(' | Apex, NC | '),
			run('kyle.skrinak.com', { href: 'https://kyle.skrinak.com/' }),
		]);
		assert.deepEqual(paragraphs[2].runs, BLOCKS[2].runs);
		assert.deepEqual(paragraphs[3].runs, BLOCKS[3].runs);
	});

	it('sets a letter page with the print margins, in twips', async () => {
		const xml = await documentXml(await buildResumeDocx(BLOCKS, { margins: MARGINS }));
		assert.match(xml, /<w:pgSz\b[^>]*w:w="12240"[^>]*w:h="15840"/);
		const pgMar = /<w:pgMar\b[^>]*>/.exec(xml)[0];
		for (const side of ['top', 'right', 'bottom', 'left']) assert.match(pgMar, new RegExp(`w:${side}="576"`));
	});

	it('copies each block’s exact line height and space above', async () => {
		const xml = await documentXml(await buildResumeDocx(BLOCKS, { margins: MARGINS }));
		const spacing = [...xml.matchAll(/<w:spacing\b[^>]*>/g)].map(([tag]) => tag);
		assert.equal(spacing.length, BLOCKS.length);
		for (const tag of spacing) {
			assert.match(tag, /w:line="268"/);
			assert.match(tag, /w:lineRule="exact"/);
		}
		assert.match(spacing[2], /w:before="180"/);
	});

	it('names the resume’s owner as the title and author', async () => {
		const zip = await JSZip.loadAsync(await buildResumeDocx(BLOCKS, { margins: MARGINS }));
		const core = await zip.file('docProps/core.xml').async('string');
		assert.match(core, /<dc:title>Kyle Skrinak<\/dc:title>/);
		assert.match(core, /<dc:creator>Kyle Skrinak<\/dc:creator>/);
		assert.match(core, /<cp:lastModifiedBy>Kyle Skrinak<\/cp:lastModifiedBy>/);
	});

	it('throws on blocks without a name', async () => {
		await assert.rejects(buildResumeDocx(BLOCKS.slice(1), { margins: MARGINS }), /no name block/);
	});
});

describe('verifyResumeDocx', () => {
	it('fails a .docx that dropped text', async () => {
		const buffer = await buildResumeDocx(BLOCKS, { margins: MARGINS });
		const zip = await JSZip.loadAsync(buffer);
		const xml = await zip.file('word/document.xml').async('string');
		zip.file('word/document.xml', xml.replace('Apex, NC', 'Apex'));
		const tampered = await zip.generateAsync({ type: 'nodebuffer' });
		const [problem] = await verifyResumeDocx(BLOCKS, tampered);
		assert.match(problem, /\.docx does not read back/);
		assert.match(problem, /block 1/);
	});

	it('fails a .docx that lost a bold run', async () => {
		const buffer = await buildResumeDocx(BLOCKS, { margins: MARGINS });
		const zip = await JSZip.loadAsync(buffer);
		const xml = await zip.file('word/document.xml').async('string');
		zip.file('word/document.xml', xml.replace(/<w:b\/>/g, '<w:b w:val="false"/>'));
		const tampered = await zip.generateAsync({ type: 'nodebuffer' });
		assert.match((await verifyResumeDocx(BLOCKS, tampered))[0], /block 2/);
	});

	it('reports a file that is not a .docx', async () => {
		assert.deepEqual(
			(await verifyResumeDocx(BLOCKS, Buffer.from('not a zip'))).map(p => p.split(':')[0]),
			['.docx could not be read back'],
		);
	});
});
