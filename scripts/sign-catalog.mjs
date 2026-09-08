import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const encoded = process.env.CATALOG_SIGNING_KEY;
if (!encoded) throw new Error('CATALOG_SIGNING_KEY is not configured');
const key = createPrivateKey({
  key: Buffer.from(encoded, 'base64'),
  format: 'der',
  type: 'pkcs8',
});
if (key.asymmetricKeyType !== 'ed25519') throw new Error('catalog signing key must be Ed25519');
const expectedPublicKey = process.env.QRATE_PLUGIN_CATALOG_PUBLIC_KEY;
if (!expectedPublicKey) throw new Error('QRATE_PLUGIN_CATALOG_PUBLIC_KEY is not configured');
const actualPublicKey = createPublicKey(key).export({ format: 'jwk' }).x;
if (actualPublicKey !== expectedPublicKey) {
  throw new Error('catalog signing key does not match QRATE_PLUGIN_CATALOG_PUBLIC_KEY');
}

const bytes = await readFile(new URL('../dist/catalog.json', import.meta.url));
const signature = {
  schema: 1,
  key_id: 'qrate-plugin-catalog-1',
  algorithm: 'Ed25519',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  signature_base64: sign(null, bytes, key).toString('base64'),
};
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/catalog.json.sig', import.meta.url), `${JSON.stringify(signature, null, 2)}\n`);
await writeFile(
  new URL('../dist/status.json', import.meta.url),
  `${JSON.stringify({
    schema: 1,
    generated_at: new Date().toISOString(),
    source_commit: process.env.GITHUB_SHA ?? 'uncommitted',
    key_id: signature.key_id,
    catalog_sha256: signature.sha256,
  }, null, 2)}\n`,
);
console.log(`Signed dist/catalog.json with ${signature.key_id}`);
