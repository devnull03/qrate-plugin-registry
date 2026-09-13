# Registry schemas

The JSON Schemas in `schemas/` define three separate documents:

- `package.schema.json` defines the `qrate-plugin.json` file at the root of a release ZIP.
- `listing.schema.json` defines one reviewed source record in `plugins/`.
- `catalog.schema.json` defines the generated document consumed by qrate and the website.

Each document uses schema version 1. A listing keeps release history in `releases`. Publication
selects the greatest semantic version as `current`; it does not copy the full history into the
catalog.

Distribution IDs are stable reverse-domain-style identifiers. They must not change when a
repository, display name, or publisher changes. Release asset URLs must belong to the listing's
GitHub repository and must point to an explicit `.zip` asset.

The current qrate plugin API version is 2. The only optional permission is `net`.
