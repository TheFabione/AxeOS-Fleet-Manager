# AxeOS Fleet Manager

Chrome / Chromium Manifest V3 extension that monitors and manages a fleet of BitAxe and NerdQAxe SHA-256 miners on the local network. Plain HTML, CSS and JavaScript: no framework, no bundler, no npm dependencies, no build step for development. The folder itself is the extension (load it with **Load unpacked** on `chrome://extensions`).

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest. **The `version` here is the single source of truth for the version number.** |
| `background.js` | Service worker: network scan, device reads, writes through a hidden device tab, WebSocket sessions (live log, live shares) and the share collector. |
| `dashboard.html` / `.css` / `.js` | The app. The dashboard tab is the engine: it polls miners, draws charts, detects blocks, sends alerts and runs automations. |
| `popup.html` / `popup.js` | Toolbar popup with quick stats. |
| `themes.css` | Four themes as CSS custom properties (`circuit`, `daylight`, `neon-vault`, `aurora`). |
| `pool-catalog.json` | Bundled pool directory. |
| `scripts/build-release.mjs` | Checks the project and builds the release zip. |
| `CHANGELOG.md`, `README.md`, `FEATURES.md`, `RELEASE_vX_Y_Z.md` | User documentation and release notes. |
| `docs/screenshots/` | Images used by the README. |

## How the extension talks to miners

- **Reads** (`/api/system/info`) are plain `fetch` calls from the service worker.
- **Writes** (PATCH `/api/system`, POST restart) need the device's session cookie, so `background.js` opens the device page in a hidden tab and runs `fetch` inside it with `chrome.scripting.executeScript({ world: 'MAIN' })`. A network error on restart counts as success.
- **WebSockets** (`ws://<ip>/api/ws`) can't be opened from the extension's secure origin, so they run in a script injected into the device's own page (isolated world, so `chrome.runtime.sendMessage` can relay lines back as `WS_LOG_EVENT`).
- **Share collector**: one minimized window, one tab per online miner, each holding a WebSocket and relaying submitted shares above `prefs.shareMin`. State in `chrome.storage.session` (`collector`). The dashboard re-sends the miner list on every refresh.
- The service worker can stop at any time: never keep state in its globals; use `chrome.storage.session` or `chrome.storage.local`.

## Firmware differences (easy to break)

- **NerdQAxe** resets settings it doesn't receive. Any PATCH must start from the current settings filtered through `NERD_WRITABLE` (see `readNerdSettings` / `buildPoolPatch` / `writeFreqVolt`). Fan field: `manualFanSpeed`; automatic fan is deprecated.
- **BitAxe** uses lowercase fan fields (`autofanspeed`, `manualfanspeed`) and gets pool-only patches with `stratumExtranonceSubscribe` / `stratumSuggestedDifficulty`.
- Field names vary between firmware versions; always read them through the `D` accessors in `dashboard.js` instead of touching device objects directly.
- BitAxe Supra has no 1h/24h hashrate fields: the dashboard averages its own samples.

## Conventions

- Vanilla JS, `'use strict'`, `async`/`await`. No new dependencies or CDNs (Google Fonts is the only external request).
- CSP is `script-src 'self'`: no inline scripts or inline event handlers.
- Escape every user- or device-provided string with `esc()` before it goes into HTML.
- Colours only through theme tokens (`var(--accent)`, `--ok`, `--bad`, …), never hard-coded in components.
- UI copy is English, sentence case, plain words. The in-app guide (`GUIDE_SECTIONS` in `dashboard.js`) must describe any user-visible change.
- New stored settings need a default: `prefs` and `AUTO_DEFAULTS` are merged with what's stored, so a new key appears for existing users only if it has a default.
- **Adding an automation** touches four places in `dashboard.js`: `AUTO_DEFAULTS`, the engine in `runAutomations()`, the `AUTOMATIONS` registry (card, fields, status) and `AUTO_GROUPS`. Tag its log lines with `'auto'`. Add it to the guide, `CHANGELOG.md`, `README.md` and `FEATURES.md`.
- Never send writes to real miners while testing unless the maintainer asks: they restart hardware.

## Checking your work

```bash
node scripts/build-release.mjs --check   # JSON validity, syntax of every script, version consistency
```

There is no automated UI test suite. For UI changes, load the folder unpacked in Chrome and exercise the feature; say clearly what could not be verified without real miners.

## Versions and releases

- Semantic versioning: patch = fixes, minor = new features, major = breaking changes or storage migrations that can't be undone.
- `/prepare-release <version>` bumps the version and drafts the changelog entry, README badge and release notes. The maintainer reviews them.
- `/release` checks, builds `dist/`, commits, tags `vX.Y.Z`, pushes and publishes the GitHub release with the zip attached.
- `dist/` is build output and is git-ignored. Never commit zips.
- Never force-push, never move or delete a published tag, never rewrite history on the main branch.
- Details for humans: `docs/RELEASING.md`.
