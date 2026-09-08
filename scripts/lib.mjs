import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import Ajv2020 from 'ajv/dist/2020.js';
import yauzl from 'yauzl';

export const ROOT = new URL('../', import.meta.url);
export const MAX_PACKAGE_BYTES = 100 * 1024 * 1024;
export const MAX_EXPANDED_BYTES = 500 * 1024 * 1024;
export const MAX_PACKAGE_FILES = 10_000;

const openZip = promisify(yauzl.fromBuffer);
const LICENSE_MARKERS = {
  'Apache-2.0': ['apache license', 'version 2.0'],
  'BSD-2-Clause': ['redistribution and use', 'two clauses'],
  'BSD-3-Clause': ['redistribution and use', 'neither the name'],
  'CC-BY-4.0': ['creative commons attribution 4.0'],
  'GPL-3.0-only': ['gnu general public license', 'version 3'],
  'GPL-3.0-or-later': ['gnu general public license', 'version 3'],
  'LGPL-3.0-only': ['gnu lesser general public license', 'version 3'],
  'LGPL-3.0-or-later': ['gnu lesser general public license', 'version 3'],
  MIT: ['permission is hereby granted', 'the software is provided "as is"'],
  Unlicense: ['this is free and unencumbered software released into the public domain'],
  Zlib: ['this software is provided \'as-is\'', 'permission is granted to anyone'],
};

const json = async (relative) =>
  JSON.parse(await readFile(new URL(relative, ROOT), 'utf8'));

export async function validators() {
  const [packageSchema, listingSchema, catalogSchema] = await Promise.all([
    json('schemas/package.schema.json'),
    json('schemas/listing.schema.json'),
    json('schemas/catalog.schema.json'),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat('date-time', {
    type: 'string',
    validate: (value) => !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value),
  });
  ajv.addSchema(packageSchema);
  ajv.addSchema(listingSchema);
  return {
    package: ajv.getSchema(packageSchema.$id),
    listing: ajv.getSchema(listingSchema.$id),
    catalog: ajv.compile(catalogSchema),
  };
}

export function assertValid(validate, value, label) {
  if (validate(value)) return;
  const details = validate.errors
    .map((error) => `${error.instancePath || '/'} ${error.message}`)
    .join('; ');
  throw new Error(`${label}: ${details}`);
}

export async function loadRecords() {
  const directory = new URL('../plugins/', import.meta.url);
  let names;
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const records = [];
  for (const name of names.filter((name) => name.endsWith('.json')).sort()) {
    const record = JSON.parse(await readFile(new URL(name, directory), 'utf8'));
    records.push({ file: name, record });
  }
  return records;
}

const normalizedRepository = (value) => value.toLowerCase().replace(/\/+$/, '');

export async function validateRecords(records) {
  const validate = (await validators()).listing;
  const ids = new Set();
  const repositories = new Set();
  const artifacts = new Set();
  for (const { file, record } of records) {
    assertValid(validate, record, file);
    if (file !== `${record.id}.json`) throw new Error(`${file}: filename must match plugin ID`);
    if (ids.has(record.id)) throw new Error(`${file}: duplicate plugin ID ${record.id}`);
    ids.add(record.id);
    const repository = normalizedRepository(record.repository);
    if (repositories.has(repository)) throw new Error(`${file}: repository is already listed`);
    repositories.add(repository);
    const versions = new Set();
    for (const release of record.releases) {
      if (versions.has(release.version)) throw new Error(`${file}: duplicate version ${release.version}`);
      versions.add(release.version);
      if (artifacts.has(release.artifact_url)) throw new Error(`${file}: release asset is already listed`);
      artifacts.add(release.artifact_url);
      if (!release.release_url.toLowerCase().startsWith(`${repository}/releases/tag/`)) {
        throw new Error(`${file}: release URL does not belong to repository`);
      }
      if (!release.artifact_url.toLowerCase().startsWith(`${repository}/releases/download/`)) {
        throw new Error(`${file}: artifact URL does not belong to repository`);
      }
      if (release.status === 'revoked' && !release.revocation_reason) {
        throw new Error(`${file}: revoked version ${release.version} needs a reason`);
      }
      if (release.status === 'active' && release.revocation_reason) {
        throw new Error(`${file}: active version ${release.version} has a revocation reason`);
      }
    }
  }
}

const versionParts = (version) =>
  version.split(/[+-]/, 1)[0].split('.').map(Number);

export function latestRelease(releases) {
  return [...releases].sort((left, right) => {
    const a = versionParts(left.version);
    const b = versionParts(right.version);
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  }).at(-1);
}

export function buildCatalog(records, sourceCommit, generatedAt = new Date().toISOString()) {
  return {
    schema: 1,
    generated_at: generatedAt,
    source_commit: sourceCommit,
    plugins: records
      .map(({ record }) => {
        const { schema: _schema, releases, ...metadata } = record;
        return { ...metadata, current: latestRelease(releases) };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function sourceCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'uncommitted';
  }
}

export async function writeCatalog(catalog) {
  const output = new URL('../dist/', import.meta.url);
  await mkdir(output, { recursive: true });
  await cp(new URL('../schemas/', import.meta.url), new URL('schemas/', output), {
    recursive: true,
  });
  const bytes = `${JSON.stringify(catalog, null, 2)}\n`;
  await writeFile(new URL('catalog.json', output), bytes);
  return Buffer.from(bytes);
}

export async function download(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
    throw new Error('artifact must be an HTTPS github.com release asset');
  }
  const response = await fetch(parsed, {
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
    headers: { 'user-agent': 'qrate-plugin-registry-validator' },
  });
  if (!response.ok) throw new Error(`artifact returned HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_PACKAGE_BYTES) throw new Error('artifact is too large');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > MAX_PACKAGE_BYTES) throw new Error('artifact is too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const zipEntries = (zip) =>
  new Promise((resolve, reject) => {
    const entries = [];
    zip.on('entry', (entry) => {
      entries.push(entry);
      zip.readEntry();
    });
    zip.on('end', () => resolve(entries));
    zip.on('error', reject);
    zip.readEntry();
  });

const readEntry = (zip, entry, limit = 1024 * 1024) =>
  new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      const chunks = [];
      let bytes = 0;
      stream.on('data', (chunk) => {
        bytes += chunk.byteLength;
        if (bytes > limit) stream.destroy(new Error(`${entry.fileName} is too large`));
        else chunks.push(chunk);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });

export async function inspectPackage(buffer) {
  if (buffer.byteLength > MAX_PACKAGE_BYTES) throw new Error('artifact is too large');
  const zip = await openZip(buffer, {
    lazyEntries: true,
    decodeStrings: true,
    validateEntrySizes: true,
    autoClose: false,
  });
  try {
    const entries = await zipEntries(zip);
    if (entries.length > MAX_PACKAGE_FILES) throw new Error('package has too many files');
    const names = new Set();
    let expanded = 0;
    for (const entry of entries) {
      const name = entry.fileName.replaceAll('\\', '/');
      const parts = name.endsWith('/') ? name.slice(0, -1).split('/') : name.split('/');
      if (
        name.startsWith('/') ||
        /^[A-Za-z]:/.test(name) ||
        parts.some((part) => part === '..' || part === '')
      ) {
        throw new Error(`unsafe package path: ${entry.fileName}`);
      }
      if (names.has(name)) throw new Error(`duplicate package path: ${name}`);
      names.add(name);
      const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
      if ((mode & 0o170000) === 0o120000) throw new Error(`symbolic link in package: ${name}`);
      expanded += entry.uncompressedSize;
      if (expanded > MAX_EXPANDED_BYTES) throw new Error('package expands too large');
    }
    const manifestEntry = entries.find((entry) => entry.fileName === 'qrate-plugin.json');
    if (!manifestEntry) throw new Error('package has no root qrate-plugin.json');
    const licenseEntry = entries.find((entry) => /^LICENSE(?:[.-].*)?$/i.test(entry.fileName));
    if (!licenseEntry) throw new Error('package has no root license file');
    const manifest = JSON.parse((await readEntry(zip, manifestEntry)).toString('utf8'));
    assertValid((await validators()).package, manifest, 'qrate-plugin.json');
    if (!names.has(manifest.entry)) throw new Error(`package entry does not exist: ${manifest.entry}`);
    const license = (await readEntry(zip, licenseEntry)).toString('utf8').toLowerCase();
    const markers = LICENSE_MARKERS[manifest.license];
    if (!markers.every((marker) => license.includes(marker))) {
      throw new Error(`license text does not match ${manifest.license}`);
    }
    return manifest;
  } finally {
    zip.close();
  }
}

export async function validateArtifact(record, release) {
  const bytes = await download(release.artifact_url);
  if (bytes.byteLength !== release.bytes) throw new Error('artifact size does not match listing');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== release.sha256) throw new Error('artifact SHA-256 does not match listing');
  const manifest = await inspectPackage(bytes);
  for (const field of ['id', 'name', 'license']) {
    if (manifest[field] !== record[field]) throw new Error(`package ${field} does not match listing`);
  }
  for (const field of ['version', 'api_version']) {
    if (manifest[field] !== release[field]) throw new Error(`package ${field} does not match release`);
  }
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(release.permissions)) {
    throw new Error('package permissions do not match release');
  }
}

export async function writeReport(lines) {
  const report = `${lines.join('\n')}\n`;
  await writeFile(new URL('../validation-report.md', import.meta.url), report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, report, { flag: 'a' });
  }
}
