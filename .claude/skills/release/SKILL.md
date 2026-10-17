---
name: release
description: Publish the current AxeOS Fleet Manager version to GitHub - run the checks, build the release zip, commit, tag, push and create the GitHub release with the zip and checksum attached. Pass --draft to create a draft release.
argument-hint: "[--draft]"
disable-model-invocation: true
allowed-tools:
  - "Bash(git status*)"
  - "Bash(git log*)"
  - "Bash(git diff*)"
  - "Bash(git branch*)"
  - "Bash(git remote*)"
  - "Bash(git fetch*)"
  - "Bash(git tag -l*)"
  - "Bash(git ls-remote*)"
  - "Bash(git rev-parse*)"
  - "Bash(gh auth status*)"
  - "Bash(gh release view*)"
  - "Bash(gh repo view*)"
  - "Bash(node scripts/build-release.mjs*)"
  - "Bash(node --version)"
---

Publish the version in `manifest.json` as a GitHub release. Arguments: `$ARGUMENTS` (`--draft` = create the release as a draft). Read `CLAUDE.md` first if you haven't.

Stop and explain at the first failed check. Never force-push, never move, delete or recreate a tag that already exists on the remote, never rewrite history.

## 1. Preconditions

- `git rev-parse --is-inside-work-tree` succeeds and `git remote get-url origin` points to GitHub.
- `gh auth status` shows a logged-in account. If not, stop and tell the maintainer to run `gh auth login` in their own terminal (it is interactive), then run `/release` again.
- `node --version` works (Node 18 or newer). If Node isn't installed, stop and say so: the build script needs it.
- Note the current branch (`git branch --show-current`). If it isn't the repository's default branch (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`), ask before continuing.
- `git fetch origin`, then check the branch isn't behind its upstream (`git status -sb`). If it is behind or has diverged, stop and ask how to proceed; don't pull or rebase on your own.

## 2. Version

- Read `version` from `manifest.json`; the tag will be `v<version>`.
- If `git tag -l v<version>` or `git ls-remote --tags origin v<version>` finds the tag, stop: this version is already released. Suggest `/prepare-release` with a new version.

## 3. Check and build

Run `node scripts/build-release.mjs`. It checks the project, then writes:
- `dist/axe-fleet-manager-v<version>.zip` (reproducible: same sources, same SHA-256),
- `dist/SHA256SUMS.txt`,
- the checksum into `RELEASE_v<version>.md`,
- `dist/RELEASE_NOTES.md`, the release body with links made absolute.

If it reports problems, stop and list them (offer to fix them, or to run `/prepare-release` if the CHANGELOG, badge or release notes are missing).

## 4. Review what will be committed

- `git status` and `git diff --stat`. `dist/` must not appear (it's in `.gitignore`).
- Look for anything that shouldn't be published: zips, `.env` or credential files, editor folders, files unrelated to the extension. If you find any, stop and ask.
- Show the maintainer the file list, the version and the CHANGELOG heading, then commit:

```bash
git add -A
git commit -m "v<version>: <title from the CHANGELOG heading>" -m "<two or three lines summarising the CHANGELOG entry>"
```

If there is nothing to commit (everything was committed already), continue.

## 5. Tag and push

```bash
git tag -a v<version> -m "AxeOS Fleet Manager v<version>"
git push origin HEAD
git push origin v<version>
```

## 6. Publish the release

```bash
gh release create v<version> \
  dist/axe-fleet-manager-v<version>.zip dist/SHA256SUMS.txt \
  --verify-tag \
  --title "AxeOS Fleet Manager v<version> - <title from the CHANGELOG heading>" \
  --notes-file dist/RELEASE_NOTES.md
```

Add `--draft` if `$ARGUMENTS` contains `--draft`.

## 7. Confirm

- `gh release view v<version> --json url,isDraft,assets` must list `axe-fleet-manager-v<version>.zip` and `SHA256SUMS.txt`.
- Report the release URL and the SHA-256.
- If anything failed after the push, report exactly which steps finished (commit, tag, push, release) and what is left. Don't try to undo pushed commits or tags.
