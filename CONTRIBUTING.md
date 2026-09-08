# Contributing a listing

Plugin code stays in the author's repository. This repository reviews metadata and immutable
release bytes.

## New listing

- Use a stable distribution ID that you control.
- Keep the source repository public.
- Include `qrate-plugin.json`, the entry file, README, and a root license file in the ZIP.
- Use one accepted SPDX license: Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC-BY-4.0,
  GPL-3.0-only, GPL-3.0-or-later, LGPL-3.0-only, LGPL-3.0-or-later, MIT, Unlicense, or Zlib.
- Publish a versioned GitHub Release asset. Do not use GitHub's generated source archive.
- Add `plugins/<distribution-id>.json` and run the local checks.

Maintainers review publisher identity, source, permissions, license, package contents, and support
information. They can request changes or decline a listing. A listing is not a security warranty.

## New version

Append the release to the existing record. Do not replace an old release asset or change its pinned
hash. Permission increases require explicit review. Keep old reviewed assets available.

## Transfer, removal, and appeal

A publisher transfer requires confirmation from the existing and proposed owners. Maintainers can
remove abandoned listings from discovery while retaining audit history. Open an issue to appeal a
non-security moderation decision. Report compromised releases privately as described in
[SECURITY.md](SECURITY.md).
