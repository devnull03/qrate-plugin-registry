import assert from 'node:assert/strict';
import test from 'node:test';
import { publishCloudflare } from '../scripts/publish-cloudflare.mjs';

test('uploads a complete version before it changes the current pointer', async () => {
  const sha256 = 'a'.repeat(64);
  const writes = [];
  const read = async (url) =>
    url.pathname.endsWith('catalog.json.sig')
      ? Buffer.from(JSON.stringify({ sha256 }))
      : Buffer.from(url.pathname);
  const request = async (url, options) => {
    writes.push({
      key: decodeURIComponent(url.split('/').at(-1)),
      body: Buffer.from(options.body).toString(),
    });
    return new Response(null, { status: 200 });
  };

  assert.equal(
    await publishCloudflare({
      token: 'test',
      account: 'account',
      namespace: 'namespace',
      request,
      read,
    }),
    sha256,
  );
  assert.equal(writes.at(-1).key, 'current');
  assert.equal(writes.at(-1).body, sha256);
  assert.deepEqual(
    new Set(writes.slice(0, -1).map(({ key }) => key)),
    new Set([
      `catalog:${sha256}:json`,
      `catalog:${sha256}:signature`,
      `catalog:${sha256}:status`,
      'schema:catalog',
      'schema:listing',
      'schema:package',
    ]),
  );
});
