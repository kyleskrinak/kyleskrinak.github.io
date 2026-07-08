import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTypography } from '../../scripts/lib/resume-render.mjs';

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
