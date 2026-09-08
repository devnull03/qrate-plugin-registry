import { loadRecords, validateArtifact, validateRecords, writeReport } from './lib.mjs';

const records = await loadRecords();
await validateRecords(records);
const report = ['## qrate plugin registry validation', '', `Validated ${records.length} listing(s).`];

if (process.argv.includes('--artifacts')) {
  let releases = 0;
  for (const { file, record } of records) {
    for (const release of record.releases) {
      await validateArtifact(record, release);
      releases += 1;
      report.push(`- ✓ ${file} ${release.version}`);
    }
  }
  report.splice(3, 0, `Downloaded and inspected ${releases} release package(s).`, '');
}

await writeReport(report);
console.log(report.join('\n'));
