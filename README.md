# qrate plugin registry

This repository is the reviewed source for qrate's official plugin catalog. Each
`plugins/<distribution-id>.json` record identifies a public plugin repository and pins its release
package by URL, byte size, and SHA-256.

The published catalog is static:

- `https://qrate.dvnl.work/plugins/catalog.json`
- `https://qrate.dvnl.work/plugins/catalog.json.sig`

qrate verifies the Ed25519 signature before it parses the catalog. An official listing means that
maintainers reviewed the record and exact release package. It does not guarantee that third-party
code is harmless.

## Submit a plugin

1. Start from [qrate-plugin-template](https://github.com/devnull03/qrate-plugin-template).
2. Publish a versioned ZIP and checksum as GitHub Release assets.
3. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SCHEMA.md](SCHEMA.md).
4. Add or update one JSON record under `plugins/`.
5. Open a pull request. An issue alone cannot publish a listing.

Run the same checks as CI:

```sh
npm ci
npm run check
npm run validate:artifacts
```

Artifact validation downloads and inspects every listed release. It never executes plugin Lua.
