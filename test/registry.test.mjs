import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertValid,
  buildCatalog,
  latestRelease,
  licenseMatches,
  validateRecords,
  validators,
} from '../scripts/lib.mjs';

const listing = () => ({
  schema: 1,
  id: 'org.example.plugin',
  name: 'Example',
  summary: 'Checks example values.',
  description: 'A test plugin.',
  categories: ['quality'],
  license: 'MIT',
  publisher: 'example',
  repository: 'https://github.com/example/plugin',
  screenshots: [],
  featured: false,
  releases: [
    {
      version: '1.0.0',
      api_version: 1,
      permissions: [],
      published_at: '2026-01-01T00:00:00Z',
      release_url: 'https://github.com/example/plugin/releases/tag/v1.0.0',
      artifact_url: 'https://github.com/example/plugin/releases/download/v1.0.0/plugin.zip',
      sha256: 'a'.repeat(64),
      bytes: 100,
      status: 'active',
    },
  ],
});

test('listing and generated catalog satisfy their schemas', async () => {
  const checks = await validators();
  const record = listing();
  assertValid(checks.listing, record, 'listing');
  const catalog = buildCatalog(
    [{ file: 'org.example.plugin.json', record }],
    'abc123',
    '2026-01-02T00:00:00Z',
  );
  assertValid(checks.catalog, catalog, 'catalog');
  assert.equal(catalog.plugins[0].current.version, '1.0.0');
  assert.equal('releases' in catalog.plugins[0], false);
});

test('latest release uses semantic version components', () => {
  assert.equal(
    latestRelease([
      { version: '1.9.0' },
      { version: '1.10.0' },
      { version: '2.0.0' },
      { version: '2.0.0-beta.1' },
    ]).version,
    '2.0.0',
  );
});

test('records reject duplicate repository and release identity', async () => {
  const first = listing();
  const second = listing();
  second.id = 'org.example.other';
  await assert.rejects(
    validateRecords([
      { file: 'org.example.plugin.json', record: first },
      { file: 'org.example.other.json', record: second },
    ]),
    /repository is already listed/,
  );
});

test('revoked releases require a reason', async () => {
  const record = listing();
  record.releases[0].status = 'revoked';
  await assert.rejects(
    validateRecords([{ file: 'org.example.plugin.json', record }]),
    /needs a reason/,
  );
});

test('license checks distinguish the two BSD variants', () => {
  const common = 'Redistribution and use. This software is provided by the copyright holders.';
  assert.equal(licenseMatches('BSD-2-Clause', common), true);
  assert.equal(licenseMatches('BSD-2-Clause', `${common} Neither the name may be used.`), false);
  assert.equal(licenseMatches('BSD-3-Clause', `${common} Neither the name may be used.`), true);
});
