import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function publishCloudflare({
  token = process.env.CLOUDFLARE_API_TOKEN,
  account = process.env.CLOUDFLARE_ACCOUNT_ID,
  namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID,
  request = fetch,
  read = readFile,
} = {}) {
  if (!token || !account || !namespace) {
    throw new Error(
      'CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_KV_NAMESPACE_ID are required',
    );
  }

  const signature = JSON.parse(await read(new URL('../dist/catalog.json.sig', import.meta.url)));
  const version = signature.sha256;
  if (!/^[a-f0-9]{64}$/.test(version)) throw new Error('catalog signature has an invalid SHA-256');

  async function put(key, body) {
    const url =
      `https://api.cloudflare.com/client/v4/accounts/${account}` +
      `/storage/kv/namespaces/${namespace}/values/${encodeURIComponent(key)}`;
    const response = await request(url, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      body,
    });
    if (!response.ok) {
      throw new Error(`Cloudflare rejected ${key}: HTTP ${response.status} ${await response.text()}`);
    }
  }

  const files = [
    [`catalog:${version}:json`, new URL('../dist/catalog.json', import.meta.url)],
    [`catalog:${version}:signature`, new URL('../dist/catalog.json.sig', import.meta.url)],
    [`catalog:${version}:status`, new URL('../dist/status.json', import.meta.url)],
    ['schema:catalog', new URL('../schemas/catalog.schema.json', import.meta.url)],
    ['schema:listing', new URL('../schemas/listing.schema.json', import.meta.url)],
    ['schema:package', new URL('../schemas/package.schema.json', import.meta.url)],
  ];
  await Promise.all(files.map(async ([key, file]) => put(key, await read(file))));
  await put('current', version);
  return version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Published catalog ${await publishCloudflare()} to Cloudflare KV`);
}
