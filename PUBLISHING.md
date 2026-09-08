# Publishing the catalog

Merges to protected `main` run the publication workflow in the `catalog-production` environment.
That environment must require maintainer approval.

Configure these repository settings:

- Environment secret `CATALOG_SIGNING_KEY`: base64-encoded PKCS#8 DER for the Ed25519 private key.
- Repository variable `QRATE_PLUGIN_CATALOG_PUBLIC_KEY`: base64url JWK `x` value for the matching
  public key. Use the same public value in qrate release builds and site builds.
- Optional environment secret `SITE_DEPLOY_HOOK`: Cloudflare deploy-hook URL for the qrate site.
- GitHub Pages source: GitHub Actions.

The workflow validates every record and package again, builds deterministic ordered JSON, signs the
exact bytes, writes status metadata, and deploys `dist/`. The private key must never be committed,
printed, or provided to pull-request jobs.

For key rotation, add support for a new key ID to qrate and the site before publication switches
keys. For an emergency revocation, add the signed revocation record through an approved pull request
and run the publication workflow. Never rewrite catalog history.
