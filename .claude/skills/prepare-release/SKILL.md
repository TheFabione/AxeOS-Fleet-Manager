---
name: prepare-release
description: Prepare a new AxeOS Fleet Manager version - bump manifest.json, write the CHANGELOG entry, update the README badge and links, update FEATURES.md and draft the RELEASE notes from the changes since the last tag. Use before /release.
argument-hint: "[version, e.g. 2.4.0]"
disable-model-invocation: true
allowed-tools:
  - "Bash(git status*)"
  - "Bash(git log*)"
  - "Bash(git diff*)"
  - "Bash(git describe*)"
  - "Bash(git tag -l*)"
  - "Bash(node scripts/build-release.mjs --check)"
---

Prepare version **$ARGUMENTS** of AxeOS Fleet Manager. Read `CLAUDE.md` first if you haven't.

## 1. Work out what changed

- Find the last release tag: `git describe --tags --abbrev=0` (if there are no tags, use the newest `## vX.Y.Z` heading in `CHANGELOG.md`).
- Read `git log <tag>..HEAD --oneline`, `git diff <tag> --stat` and the diffs of the source files, plus any uncommitted changes from `git status` and `git diff`.
- If no version was given, propose one from the changes (patch = fixes only, minor = new features, major = breaking changes) and ask the maintainer to confirm before editing anything.
- The new version must be higher than the current `version` in `manifest.json` and must not exist as a tag (`git tag -l v<version>`).

## 2. Edit the files

1. `manifest.json`: set `"version"` to the new version. Nothing else holds the version in code.
2. `CHANGELOG.md`: add `## v<version> - <short title> (<Month YYYY>)` as the **first** version entry, right under the intro paragraph and milestones line. Follow the style of the entries below it: grouped `###` sections, bold feature names, user-facing language, defaults in brackets, and a note when existing settings migrate. Don't invent changes that aren't in the diff.
3. `README.md`: update the version badge (`version-<version>-F2B544`), add the new release notes to the "Release notes:" line and to the Documentation list, and update the feature lists if features were added or renamed.
4. `FEATURES.md`: update the version in the title and describe new or changed features in the matching section.
5. Create `RELEASE_v<version with underscores>.md` (for 2.4.0: `RELEASE_v2_4_0.md`). Copy the structure of the newest existing `RELEASE_v*.md`: a title line, a short intro, emoji section headings, an **Install** section, then exactly this checksum block (the build script fills it in):

   ````markdown
   SHA-256 of `axe-fleet-manager-v<version>.zip`:

   ```
   SHA256_PLACEHOLDER
   ```
   ````

   End with the line pointing to `CHANGELOG.md`.
6. If the in-app guide (`GUIDE_SECTIONS` in `dashboard.js`) doesn't describe a user-visible change yet, update it.

## 3. Check

Run `node scripts/build-release.mjs --check` and fix everything it reports.

## 4. Hand over

Do **not** commit, tag or push. Show the maintainer:
- the new version and the release title,
- the CHANGELOG entry as written,
- the list of files you changed,

then tell them to review the text and run `/release` when it reads right.
