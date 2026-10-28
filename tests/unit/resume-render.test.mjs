import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	normalizeTypography,
	countLineBoxes,
	findWrappedLines,
} from '../../scripts/lib/resume-render.mjs';

describe('normalizeTypography', () => {
	it('normalizes smartypants quotes to straight quotes', () => {
		assert.equal(
			normalizeTypography('\u201CSmart\u201D \u2018quotes\u2019 and it\u2019s'),
			'"Smart" \'quotes\' and it\'s',
		);
	});

	it('preserves dash, ellipsis, and whitespace normalization', () => {
		assert.equal(
			normalizeTypography('alpha\u2013beta\u2014gamma\u2026\n\nnext'),
			'alpha-beta-gamma... next',
		);
	});
});

// Fragments as getClientRects reports them for a bullet's text nodes: tops and
// heights differ within one line when a run is bold, linked, or set in another
// face, so equal tops can't identify a line.
describe('countLineBoxes', () => {
	it('counts fragments with differing tops on one line as one line', () => {
		assert.equal(
			countLineBoxes([
				{ top: 100, bottom: 116 },
				{ top: 99, bottom: 117 },
				{ top: 101, bottom: 115 },
			]),
			1,
		);
	});

	it('counts a short raised fragment on the same line as one line', () => {
		assert.equal(
			countLineBoxes([
				{ top: 97, bottom: 105 },
				{ top: 100, bottom: 116 },
			]),
			1,
		);
	});

	it('counts a wrapped bullet as two lines regardless of fragment order', () => {
		assert.equal(
			countLineBoxes([
				{ top: 117, bottom: 133 },
				{ top: 100, bottom: 116 },
				{ top: 101, bottom: 115 },
			]),
			2,
		);
	});

	it('counts no fragments as zero lines', () => {
		assert.equal(countLineBoxes([]), 0);
	});
});

describe('findWrappedLines', () => {
	it('returns only the bullets and admin lines that span more than one line, with their counts', () => {
		assert.deepEqual(
			findWrappedLines([
				{ text: 'Fits', rects: [{ top: 100, bottom: 116 }] },
				{
					text: 'Wraps',
					rects: [
						{ top: 120, bottom: 136 },
						{ top: 137, bottom: 153 },
					],
				},
			]),
			[{ text: 'Wraps', lines: 2 }],
		);
	});
});
