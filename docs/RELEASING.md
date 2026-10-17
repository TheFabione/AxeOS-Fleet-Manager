# Releasing a new version

A release is a commit, an annotated tag `vX.Y.Z` and a GitHub release with `axe-fleet-manager-vX.Y.Z.zip` and `SHA256SUMS.txt` attached.

## What you need

- **git**, with push access to this repository
- **GitHub CLI** (`gh`), logged in once with `gh auth login`
- **Node.js 18 or newer**, for `scripts/build-release.mjs` (no `npm install` needed)

## With Claude Code

From the repository folder, start Claude Code and run:

1. `/prepare-release 2.4.0`. Claude reads the changes since the last tag, bumps `manifest.json`, writes the `CHANGELOG.md` entry, updates the README badge and links and `FEATURES.md`, and drafts `RELEASE_v2_4_0.md`. Nothing is committed. Review the text.
2. `/release`. Claude checks everything, builds `dist/`, shows what will be committed, then commits, tags, pushes and publishes the release. It asks for your approval before the commit, the push and the release. Use `/release --draft` to publish a draft you can review on GitHub first.

Both commands are defined in `.claude/skills/`; project rules for Claude are in `CLAUDE.md`.

## By hand

```bash
# 1. Edit manifest.json (version), CHANGELOG.md, README.md (badge), FEATURES.md
#    and create RELEASE_vX_Y_Z.md with the checksum block (copy the newest one).

# 2. Check and build
node scripts/build-release.mjs --check
node scripts/build-release.mjs            # writes dist/ and fills in the checksum

# 3. Commit, tag, push
git add -A
git commit -m "vX.Y.Z: <title>"
git tag -a vX.Y.Z -m "AxeOS Fleet Manager vX.Y.Z"
git push origin HEAD
git push origin vX.Y.Z

# 4. Publish
gh release create vX.Y.Z dist/axe-fleet-manager-vX.Y.Z.zip dist/SHA256SUMS.txt \
  --verify-tag --title "AxeOS Fleet Manager vX.Y.Z - <title>" --notes-file dist/RELEASE_NOTES.md
```

## What the build script checks

- `manifest.json` and `pool-catalog.json` are valid JSON
- `background.js`, `dashboard.js` and `popup.js` pass `node --check`
- the three icons exist
- `CHANGELOG.md` has a `## vX.Y.Z` entry, the README badge shows `X.Y.Z`, and `RELEASE_vX_Y_Z.md` exists

The zip is reproducible: files are added in a fixed order with a fixed timestamp, so building the same sources twice gives the same SHA-256. Anyone can rebuild it from the tag and compare the checksum.

## Version numbers

- **Patch** (2.3.1): fixes only.
- **Minor** (2.4.0): new features; existing settings keep working.
- **Major** (3.0.0): breaking changes, or a storage change that can't be rolled back.

Never move or delete a published tag. If a release is broken, publish a new patch version.
