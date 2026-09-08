import { buildCatalog, loadRecords, sourceCommit, validateRecords, validators, assertValid, writeCatalog } from './lib.mjs';

const records = await loadRecords();
await validateRecords(records);
const catalog = buildCatalog(records, sourceCommit());
assertValid((await validators()).catalog, catalog, 'catalog.json');
const bytes = await writeCatalog(catalog);
console.log(`Built dist/catalog.json (${bytes.byteLength} bytes, ${catalog.plugins.length} plugins)`);
