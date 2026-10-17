# AxeOS Fleet Manager - Features & Architecture (v2.3.0)

## Overview

AxeOS Fleet Manager is a Manifest V3 extension for Chrome and Chromium browsers that monitors and manages a fleet of BitAxe and NerdQAxe SHA-256 miners on the local network. The dashboard tab is the engine: it polls every device, draws the charts, detects blocks, sends alerts and runs the automations. The service worker handles network reads and routes writes and live streams through the device's own page.

---

## User-Facing Features

### Layout
- **Side rail** with four sections: Fleet, Pools, Automations, History. Guide, Settings and Support sit at the bottom. Below 760 px the rail becomes a bottom tab bar.
- **Top bar**: section title, sync state ("Updated 4s ago", amber when stale), device search, blocks trophy with unseen counter, refresh, and **Add devices**.
- **Add devices popover**: subnet scan (254 addresses, 25 in parallel) and add-by-IP.

### Fleet view
- **Fleet hashrate**: large condensed readout (GH/s, TH/s or PH/s), 1h and 24h averages.
- **Chart tabs**:
  - *Hashrate*: fleet history (360 samples) with hover tooltip (time, value, online/offline counts), gold block-found markers, red ticks where devices were offline.
  - *Share difficulty*: every share that beat a session best, at its exact difficulty, detected when `bestSessionDiff` rises between refreshes (a rise in `bestDiff` is marked as a new best ever). Log scale, lollipop markers rising from the pool floor, reference lines for pool difficulty, session best, best ever and network difficulty (Block). Tooltip shows how far a share was from a block. Time range 1h / 24h / 7d / all; per-device colours and hit counts. With one device selected, **Stream live shares** plots every submitted share in real time on the same scale.
    - **Minimum difficulty** (`prefs.shareMin`): hides shares below the level and draws it as a reference line; parses `500K`, `1M`, `2.5G`; shows the expected shares per hour at that level (`hashrate·3600 / (max(min, poolDiff)·2³²)` summed over online miners).
    - **Share recording** (`prefs.shareCollect`): the service worker keeps one minimized window with a tab per online miner on its own page and injects a script that holds `ws://<miner>/api/ws` open, reconnects with back-off, parses `diff X of Y` / `diff X/Y`, and relays only submitted shares (X ≥ Y) at or above the minimum. State lives in `chrome.storage.session` (`collector`); the dashboard re-syncs the miner list on every refresh; the window closes with the dashboard. Stored in `shareHits` (last 5,000); a collected share matching a later session best is upgraded instead of duplicated.
- **Stat tiles**: Online (with average uptime), Power (with fleet J/TH), Energy cost per day (click to set price; monthly estimate in tooltip), Average temp (with hottest device), Shares (with reject rate), Best difficulty (with best session).
- **Health strip**: online ring, one segment per device, scrolling ticker of recent outages, **Downtime** shortcut.

### Device list
- **Densities**: Compact (one row), Standard (hashrate, 1h avg with trend, best and session difficulty, chip temp bar, fan), Detailed (adds one-hour sparkline with hover, power, efficiency, share counts).
- **Card actions**: live log, settings, restart, and a ⋯ menu with rename, labels, icon, open device web page, identify (BitAxe only), copy IP, remove.
- **Rename** by double-clicking the name. Allowed characters `[a-zA-Z0-9 _-]` because the name becomes the pool worker suffix.
- **Labels**: up to two per device (10 characters, 8 colours); they become filter chips.
- **Icons**: ten per-device icons, default by type.
- **Details panel**: uptime, pool difficulty, frequency, voltage, board and VR temps, ASIC, firmware, Wi-Fi, last answer, worker.
- **Offline cards** are dimmed and show how long the device has been down.
- **Search** (`/`) across name, IP, hostname, model, pool and labels. **Filters**: All, BitAxe, NerdQAxe, Offline, and labels.
- **Sorting**: custom order (drag and drop, lockable), hashrate, best difficulty, temperature, efficiency, uptime, name, IP, with direction toggle.
- **Select mode**: checkboxes on cards and a floating bar to select all, apply a pool, restart or remove the selection.
- **Import / export** of the device list (IPs, nicknames, labels, icons, custom order). Unreachable IPs are kept as placeholders so names and labels apply once they answer.

### Pools
- **Saved pools** with coin badge, optional Solo / Pooled tag (chosen in the editor, inherited from the directory, or suggested when the address matches a directory entry), host:port, TLS flag, wallet, and a live count of miners currently pointed at each pool. Filter by coin when more than one coin is saved.
- **Pool editor**: 16 SHA-256 coins, paste a full `stratum+tcp://` or `stratum+ssl://` URL and host, port and TLS are filled in.
- **Apply to devices**: coin, primary pool, optional fallback (any coin), device picker (offline devices disabled), optional restart; per-device status (Queued / Applying / Done / Failed) and a progress bar. Worker suffix appended automatically.
- **Use** on a saved pool fills the Apply form. Import / export as JSON; duplicates skipped.
- **Pool directory**: bundled `pool-catalog.json` of well-known pools (coin, host, port, solo/pooled, fee, region, user hint, website, note). Filter by coin and search; **Add** opens the editor pre-filled and reuses a saved wallet of the same coin. Optional update source (https JSON, same format) fetched daily and on demand; entries are validated (host characters, port range, known coin) and a newer built-in list wins over an older download.

### Device settings dialog
- **Overview**: full readout of the device's reported values.
- **Fan**: BitAxe automatic or manual; NerdQAxe manual only.
- **Frequency & voltage** with suggested values when the firmware provides them.
- **Pool**: primary and fallback pool for this one device, applied with a restart.
- Footer: Identify (BitAxe), open Web UI, Remove, Restart.

### Automations
Eleven automations in one grid of equal cards (category, description, setting chips, miner count, live status). Each opens a settings dialog with an explanation, fields and a miner picker. They run from the dashboard tab, save on every change, tag their log entries, and can raise desktop alerts. A summary shows how many are on and when the last action happened; recent actions are listed below the grid.
- **Watchdog**: restart after N minutes at 0 GH/s (default 5).
- **Hashrate drop**: more than N% below normal (firmware `expectedHashrate`, else 1h average) for M minutes; restart or alert; cooldown.
- **Shares stalled**: restart when accepted + rejected counters don't move for N minutes while hashrate > 0; effective wait = max(N min, 10 × poolDifficulty·2³² / hashrate); handles counter resets; cooldown.
- **Back to primary pool**: restart after N minutes with `isUsingFallbackStratum` set.
- **Flap recovery**: after N drops within a window, restart once stable and reachable for 15 s; then a cooldown.
- **Reject rate**: rejected / (accepted + rejected) over a rolling window, at least 20 shares; restart or alert; cooldown.
- **Overheat protection**: restart above a chip-temperature limit (default 68 °C, edited in °C or °F), then a cooldown; warns when the limit is at or above the ~70 °C firmware cut-off.
- **Heat slowdown** (id `vrProtect`): watches chip (`asicTemp`, else `temp`) and/or VR (`vrTemp`), selectable; trigger on chip ≥ chip limit (default 67 °C) or VR ≥ VR limit (default 80 °C), or ~0 GH/s within 5 min of chip ≥ limit − 4° or VR ≥ limit − 8° (firmware cut-off); lowers `frequency`/`asicfrequency` by a step, then `coreVoltage` (modes: frequency then voltage, frequency only, both); floors; snaps to `frequencyOptions`/`voltageOptions`; optional restart; per-miner original values in `autoState.vr`, manual restore or stepwise raise after N cool hours; NerdQAxe patch includes the writable whitelist.
- **Quiet hours**: fixed fan speed inside a time window (crossing midnight supported); previous fan mode and speed saved per miner in `autoState` and restored afterwards; heat safety limit with 5° hysteresis.
- **Daily restart**: once per day at a set time, 4 s apart, 30-minute grace window.
- **Pool rotation**: cycle devices through two or more saved pools every N hours; shows time to next switch.

### History
- **Activity**: timestamped log (500 entries), duplicates collapsed with a ×N counter, level filter, clear.
- **Downtime**: every outage with start, recovery and duration; totals; clear recovered entries.
- **Blocks found**: device, coin, pool, time and the difficulty reached.
- **Block celebration** dialog with confetti (skipped with reduced motion).

### Live log
- Real-time WebSocket stream of the device log, ANSI codes stripped.
- Line filter, pause that buffers and replays on resume, save to `.txt`, clear.
- Colour coding: errors, warnings, shares, system messages.

### Settings
- **Themes**: Circuit (default), Daylight (light), Neon Vault, Aurora.
- **Text size** (100 %, 112 %, 125 %) via a root rem scale.
- **Temperature unit** °C / °F.
- **Refresh interval**: 5, 7, 10, 15, 30 or 60 seconds.
- **Electricity price** and currency for the energy tile.
- **Desktop alerts**: offline / back online, block found, automation restarts. **Toolbar badge** toggle.
- **Full backup / restore**, **clear chart history**, **rerun the tour**.

### Popup
Fleet hashrate, online count, power, best difficulty, per-device list (offline first), freshness indicator, and **Open dashboard**, which focuses an existing dashboard tab.

### Keyboard
`/` search · `R` refresh · `1`-`4` sections · `?` guide · `Esc` close dialogs and menus.

---

## Under-the-Hood / Technical Features

### Same-origin writes via tab injection
AxeOS protects writes (PATCH settings, POST restart) with a session cookie. The extension origin cannot send it cross-site, so for every write the service worker:
1. Opens a hidden tab to `http://<device>/`
2. Waits for it to finish loading (handling a page that is already complete), which establishes the session
3. Runs `fetch()` inside the page with `chrome.scripting.executeScript({ world: 'MAIN' })`, so the request is same-origin with the cookie attached
4. Returns the result and closes the tab

A network error on restart counts as success, because the device drops the connection immediately.

### Live WebSocket relay
An insecure `ws://` socket can't be opened from the extension's secure origin. For live logs and live shares the worker opens the device page in a hidden tab and injects a script in the isolated world that opens `ws://<device>/api/ws` and relays each message to the dashboard with `chrome.runtime.sendMessage`. Sessions (`logs`, `diff`) are stored in `chrome.storage.session` with the owning dashboard tab, so they survive service-worker restarts and are cleaned up when either tab closes.

### Device-specific API handling
- **BitAxe pool PATCH**: pool fields only, plus `stratumExtranonceSubscribe`, `stratumSuggestedDifficulty`; fallback defaults to the primary pool.
- **NerdQAxe pool PATCH**: reads current settings, keeps only whitelisted writable fields, overrides pool fields; uses `stratumEnonceSubscribe` / `stratumTLS`. Used by both the Pool manager and Pool rotation.
- **Fan**: BitAxe `autofanspeed` + `manualfanspeed`; NerdQAxe `manualFanSpeed` (auto-fan deprecated in firmware).
- **Blocks**: BitAxe `blockFound` flag (dismissed after detection); NerdQAxe `totalFoundBlocks` counter. The first poll after load is a baseline and never triggers a celebration.
- **Averages**: firmware 1h / 24h fields when present, otherwise a local rolling average sized for one hour at the current refresh interval (BitAxe Supra).

### Architecture
- **manifest.json**: MV3, permissions `storage`, `scripting`, `tabs`, `notifications`; host permission `http://*/*`; `minimum_chrome_version` 116.
- **background.js**: service worker. Scan, device reads, tab-injected writes, WebSocket session management, notification click handling. Async handlers throughout; no state in globals.
- **dashboard.html / .css / .js**: the app. Native `<dialog>` (light-dismiss with a click-outside fallback where `closedby` is unsupported), `popover` menus and toasts, container-friendly responsive grid, canvas charts with DPR scaling and `ResizeObserver` redraws.
- **themes.css**: four themes as CSS custom properties (surfaces, text, accent, type colours, status colours, chart colours, series palette).
- **popup.html / popup.js**: quick stats read from storage.
- **pool-catalog.json**: the bundled pool directory.

### Storage (`chrome.storage.local`)
- `devices`, `savedPools`, `logs`, `lastSubnet`, `lastRefresh`
- `theme`, `uiVersion`, `tempUnit`, `prefs` (`pollSec`, `kwhPrice`, `currency`, `notifyOffline`, `notifyBlock`, `notifyAuto`, `badge`, `textScale`)
- `deviceNicknames`, `deviceLabels`, `deviceIcons`, `expandedCards`
- `sortField`, `sortAsc`, `customOrder`, `sortLocked`, `cardViewMode`, `activeView`, `chartTab`
- `hashrateHistory`, `diffHistory`, `deviceHrHistory`, `shareHits` (up to 2000), `diffRangeH`
- `poolCatalog` (downloaded directory, when an update source is set; the URL lives in `prefs.catalogUrl`)
- `autoConfig`, `poolRotationState`, `autoState` (quiet-hours fan state, daily-restart bookkeeping, VR-overheat original frequency/voltage)
- `blockHistory`, `uptimeEvents`, `tutorialDone`

On install the worker only fills in missing defaults; it never overwrites existing data. `chrome.storage.session` holds `wsSessions`.

### Performance
- In-place card updates on each refresh; full re-render only when the visible set changes.
- A refresh guard prevents overlapping polls.
- Signature checks skip re-rendering the health strip, pool list and automation pickers when nothing changed.
- Canvas charts in fixed-height wrappers; redraws batched with `requestAnimationFrame`.

### Security and privacy
- CSP `script-src 'self'; object-src 'self'`; no inline scripts.
- All user text escaped before it reaches HTML; imported files validated.
- Talks only to devices on your LAN. Google Fonts is the only external request. No telemetry.
