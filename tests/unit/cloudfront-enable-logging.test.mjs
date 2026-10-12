// infra/cloudfront/enable-logging.sh edits the production distribution, so its
// AWS-free parts are pinned here: the .Logging transform, the backstop that
// refuses an update touching anything else, the log delivery grant, a failed
// read stopping the script, agreement with config/registry.mjs, input
// validation, argument parsing that stops before any AWS call, and the
// confirmation prompt. Sourcing the script defines its functions without
// running main. The config below is synthetic; a real one carries the
// certificate ARN and account ID.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigRegistry } from '../../config/registry.mjs';

const SCRIPT = join(process.cwd(), 'infra/cloudfront/enable-logging.sh');

const NEVER_LOGGED = { Enabled: false, IncludeCookies: false, Bucket: '', Prefix: '' };
const CONFIG = {
	CallerReference: 'synthetic',
	Aliases: { Quantity: 1, Items: ['example.com'] },
	Comment: '',
	Enabled: true,
	PriceClass: 'PriceClass_100',
	DefaultCacheBehavior: { TargetOriginId: 'origin', ViewerProtocolPolicy: 'redirect-to-https' },
	Logging: NEVER_LOGGED,
};

// The script reads these from the environment; a developer's shell must not
// change what the tests see.
const BASE_ENV = Object.fromEntries(
	Object.entries(process.env).filter(([k]) => !['LOG_BUCKET', 'LOG_PREFIX', 'LOG_RETENTION_DAYS'].includes(k)),
);

// Source the script and run `body`. Returns { status, stdout, stderr }.
function bash(body, env = {}) {
	const r = spawnSync('bash', ['-c', `source "$1"\n${body}`, 'bash', SCRIPT], {
		encoding: 'utf8',
		env: { ...BASE_ENV, ...env },
	});
	return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Run the script as a command.
function run(args, env = {}) {
	const r = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env: { ...BASE_ENV, ...env } });
	return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function withFiles(files, fn) {
	const dir = mkdtempSync(join(tmpdir(), 'cf-logging-'));
	try {
		for (const [name, value] of Object.entries(files)) {
			writeFileSync(join(dir, name), JSON.stringify(value));
		}
		return fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe('enable-logging.sh', () => {
	it('defines functions without running anything when sourced', () => {
		const r = bash('true');
		assert.equal(r.status, 0, r.stderr);
		assert.equal(r.stdout, '');
	});

	it('sets .Logging to the dedicated bucket and prefix and leaves every other field alone', () => {
		withFiles({ 'before.json': CONFIG }, dir => {
			const r = bash(`with_logging "$(desired_logging_json)" < "${dir}/before.json"`);
			assert.equal(r.status, 0, r.stderr);
			const after = JSON.parse(r.stdout);
			assert.deepEqual(after.Logging, {
				Enabled: true,
				IncludeCookies: false,
				Bucket: 'kyle-skrinak-com-cf-logs.s3.amazonaws.com',
				Prefix: 'kyle.skrinak.com/',
			});
			assert.deepEqual({ ...after, Logging: null }, { ...CONFIG, Logging: null });
		});
	});

	it('returns the original config when enabled and then disabled', () => {
		withFiles({ 'before.json': CONFIG }, dir => {
			const r = bash(
				`with_logging "$(desired_logging_json)" < "${dir}/before.json" | with_logging "$(disabled_logging_json)"`,
			);
			assert.equal(r.status, 0, r.stderr);
			assert.deepEqual(JSON.parse(r.stdout), CONFIG);
		});
	});

	// The registry documents the live setup; the script's defaults create it.
	it('matches the registry entry for distribution, bucket, prefix, region and retention', () => {
		const reg = ConfigRegistry.deployment['main-aws'].accessLogging;
		const r = bash(
			'jq -n --arg d "$DISTRIBUTION_ID" --arg r "$BUCKET_REGION" --arg t "$LOG_RETENTION_DAYS" --argjson l "$(desired_logging_json)" \'{d: $d, r: $r, t: $t, l: $l}\'',
		);
		assert.equal(r.status, 0, r.stderr);
		const got = JSON.parse(r.stdout);
		assert.deepEqual(
			{ distributionId: got.d, bucket: got.l.Bucket, prefix: got.l.Prefix, region: got.r, retentionDays: Number(got.t) },
			{
				distributionId: reg.distributionId,
				bucket: `${reg.bucket}.s3.amazonaws.com`,
				prefix: reg.prefix,
				region: reg.region,
				retentionDays: reg.retentionDays,
			},
		);
	});

	it('honors LOG_BUCKET and LOG_PREFIX overrides', () => {
		const r = bash('desired_logging_json', { LOG_BUCKET: 'other-bucket', LOG_PREFIX: 'p/' });
		assert.equal(r.status, 0, r.stderr);
		assert.deepEqual(JSON.parse(r.stdout), {
			Enabled: true,
			IncludeCookies: false,
			Bucket: 'other-bucket.s3.amazonaws.com',
			Prefix: 'p/',
		});
	});

	it('backstop accepts a change to .Logging alone', () => {
		withFiles({ 'a.json': CONFIG, 'b.json': { ...CONFIG, Logging: { ...NEVER_LOGGED, Enabled: true } } }, dir => {
			assert.equal(bash(`only_logging_differs "${dir}/a.json" "${dir}/b.json"`).status, 0);
		});
	});

	it('backstop rejects a change outside .Logging', () => {
		withFiles({ 'a.json': CONFIG, 'b.json': { ...CONFIG, Comment: 'tampered' } }, dir => {
			assert.notEqual(bash(`only_logging_differs "${dir}/a.json" "${dir}/b.json"`).status, 0);
		});
	});

	it('does not count a delivery grant narrower than FULL_CONTROL', () => {
		const ID = 'c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d0';
		const acl = { Owner: { ID: 'owner' }, Grants: [{ Grantee: { Type: 'CanonicalUser', ID }, Permission: 'READ' }] };
		withFiles({ 'acl.json': acl }, dir => {
			const r = bash(`delivery_grant_count < "${dir}/acl.json"`);
			assert.equal(r.status, 0, r.stderr);
			assert.equal(r.stdout.trim(), '0');
		});
	});

	// Two failed reads print two empty strings, which compare equal.
	it('backstop rejects when jq fails', () => {
		withFiles({ 'a.json': CONFIG }, dir => {
			assert.notEqual(bash(`jq() { return 5; }; only_logging_differs "${dir}/a.json" "${dir}/a.json"`).status, 0);
		});
	});

	it('adds the delivery grant to an ACL and keeps the existing grants', () => {
		const ID = 'c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d0';
		const acl = {
			Owner: { ID: 'owner' },
			Grants: [{ Grantee: { Type: 'CanonicalUser', ID: 'owner' }, Permission: 'FULL_CONTROL' }],
		};
		withFiles({ 'acl.json': acl }, dir => {
			const r = bash(`with_delivery_grant < "${dir}/acl.json"`);
			assert.equal(r.status, 0, r.stderr);
			assert.deepEqual(JSON.parse(r.stdout), {
				Owner: acl.Owner,
				Grants: [...acl.Grants, { Grantee: { Type: 'CanonicalUser', ID }, Permission: 'FULL_CONTROL' }],
			});
			const before = bash(`delivery_grant_count < "${dir}/acl.json"`);
			const after = bash(`with_delivery_grant < "${dir}/acl.json" | delivery_grant_count`);
			assert.equal(before.stdout.trim(), '0');
			assert.equal(after.stdout.trim(), '1');
		});
	});

	// A stub `aws` that fails like a denied call. Bash turns set -e off inside
	// $(...), so a check that does not exit explicitly would print a gap here.
	it('stops on a failed ACL read instead of reporting the grant absent', () => {
		const dir = mkdtempSync(join(tmpdir(), 'cf-logging-'));
		try {
			const stub = join(dir, 'aws');
			writeFileSync(stub, '#!/bin/sh\necho "An error occurred (AccessDenied) when calling the GetBucketAcl operation" >&2\nexit 254\n', {
				mode: 0o755,
			});
			const r = bash('set -euo pipefail; r=$(check_delivery_grant); echo "REPORTED: $r"', {
				PATH: `${dir}:${process.env.PATH}`,
			});
			assert.notEqual(r.status, 0);
			assert.doesNotMatch(r.stdout, /REPORTED/);
			assert.match(r.stderr, /get-bucket-acl on kyle-skrinak-com-cf-logs failed:.*AccessDenied/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	for (const [name, env, message] of [
		['a non-numeric retention', { LOG_RETENTION_DAYS: 'abc' }, /LOG_RETENTION_DAYS must be a positive integer/],
		['a zero retention', { LOG_RETENTION_DAYS: '0' }, /LOG_RETENTION_DAYS must be at least 1/],
		['a dotted bucket name', { LOG_BUCKET: 'logs.example' }, /not a valid dot-free S3 bucket name/],
		['an uppercase bucket name', { LOG_BUCKET: 'Logs' }, /not a valid dot-free S3 bucket name/],
		['a prefix without a trailing slash', { LOG_PREFIX: 'logs' }, /LOG_PREFIX must end with '\/'/],
	]) {
		it(`rejects ${name}`, () => {
			const r = bash('validate_settings', env);
			assert.equal(r.status, 1);
			assert.match(r.stderr, message);
		});
	}

	// These exit during argument parsing, before validate_settings or any AWS call.
	it('prints usage for --help', () => {
		const r = run(['--help']);
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /--disable/);
	});

	it('rejects an unknown argument', () => {
		const r = run(['--bogus']);
		assert.equal(r.status, 2);
		assert.match(r.stderr, /unknown argument: --bogus/);
	});

	it('rejects conflicting modes', () => {
		const r = run(['--apply', '--disable']);
		assert.equal(r.status, 2);
		assert.match(r.stderr, /--apply and --disable cannot be combined/);
	});

	it('refuses to change the distribution without a terminal or --yes', () => {
		const r = bash('confirm "go?"; echo PROCEEDED');
		assert.equal(r.status, 1);
		assert.doesNotMatch(r.stdout, /PROCEEDED/);
		assert.match(r.stderr, /Re-run with --yes/);
	});

	it('proceeds without a prompt under --yes', () => {
		const r = bash('ASSUME_YES=1; confirm "go?"; echo PROCEEDED');
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /PROCEEDED/);
	});
});
