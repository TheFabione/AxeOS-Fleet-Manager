# AxeOS Fleet Manager - Changelog

Every release of AxeOS Fleet Manager, newest first.

**Milestones:** v2.1 pool directory and nine automations · v2.0 complete redesign · v1.6 card view modes and Neon Vault/Aurora themes · v1.5 uptime monitor · v1.4 Neon Vault UI · v1.3 live difficulty · v1.2 live logs · v1.1 block detection · v1.0 first stable release

## v2.3.0 - Heat Slowdown, Share Minimum, Share Recording (October 2026)

### Heat slowdown (was VR overheat)
- The automation now watches the **chip temperature** as well as the voltage regulator. The firmware stops hashing when the chip passes about 70 °C, then starts again once it cools, which loops on a hot miner; the automation steps the miner down before that.
- New **Watch** setting: chip and VR (default), chip only, VR only. New **Chip limit** (default 67 °C) next to the VR limit (80 °C).
- The thermal cut-off is also recognised from the chip: a drop to ~0 GH/s within 5 minutes of the chip running within 4 °C of its limit triggers a step.
- Raising settings back after a cool period now requires both sensors to stay at least 5 degrees under their limits.
- Existing configurations pick up the new settings automatically; your other values are kept.

### Overheat protection
- Default limit lowered from 75 °C to 68 °C, under the firmware cut-off. A limit at or above 70 °C shows a warning on the card, because it would never trigger.

### Share difficulty chart
- **Minimum difficulty**: a new button next to the time range hides every share under a level you choose (`1M`, `500K`, `2.5G`…), with quick picks and a dashed "Your minimum" line on the chart.
- **Record every share above the minimum**: session bests alone get rare once miners have run for a while. With this on, the dashboard reads each miner's log as it happens and plots every submitted share at or above the minimum, not only new session bests. The miners' pages open in one minimized browser window (one tab per miner, same origin, like the live log); connections reconnect after reboots, the window closes with the dashboard, and the list follows miners going on and offline. Only shares the miner actually submits (at or above the pool target) are recorded.
- The popover estimates how many shares an hour the fleet will find at the chosen level, and warns when that would overflow the history.
- Share history now keeps the last 5,000 entries (was 2,000). A share already recorded by the collector is upgraded to "session best" or "best ever" instead of being added twice.
- Reference labels are drawn above the points, so dense charts stay readable.

### Repository
- `CLAUDE.md` with project rules for Claude Code, plus two project skills: `/prepare-release` (bump the version and draft the changelog, README badge and release notes) and `/release` (check, build, commit, tag, push and publish the GitHub release).
- `scripts/build-release.mjs`: checks the project and builds a reproducible release zip with its SHA-256, using only Node.js.
- `docs/RELEASING.md` describes the release process; `.gitignore` keeps `dist/` out of the repository.

## v2.2.0 - Shares Stalled and VR Overheat Automations (October 2026)

Eleven automations now.

- **New: Shares stalled** - restarts a miner that keeps reporting hashrate but whose accepted and rejected share counters stop moving for the set time (default 10 min), a state a restart clears. The wait is never shorter than 10× the expected time between shares at the current pool difficulty and hashrate, so a high pool difficulty can't cause a false restart. Counter resets after a reboot are handled; cooldown between restarts.
- **New: VR overheat** - protects against the voltage-regulator thermal cut-off loop, where the miner drops to 0 GH/s to cool, comes back and overheats again. A Watchdog restart doesn't fix that; running slower does.
  - Triggers when the VR temperature passes your limit (default 80 °C), or when the miner drops to ~0 GH/s within 5 minutes of its VR running close to the limit.
  - Lowers frequency one step (default 25 MHz); in the default "Frequency, then voltage" mode the core voltage (default 10 mV steps) is lowered only once frequency reaches its floor. "Frequency only" and "Both together" modes are available.
  - Floors for frequency (default 400 MHz) and voltage (default 1050 mV); snaps to the firmware's frequency/voltage options when it reports them; alerts you once if the miner is still too hot at the floor.
  - Wait time between steps (default 15 min), optional restart to apply (on by default).
  - Remembers each miner's original frequency and voltage: **Restore original settings** in the dialog, or let it raise them back one step at a time after the VR has stayed cool for a number of hours (off by default).
  - NerdQAxe changes send the full writable settings so nothing else is reset.
- Number fields in automation dialogs are wider (four-digit voltages were cut off).

## v2.1.1 - Pool Type Tags (October 2026)
- **Solo / Pooled tag for your own pools**: the pool editor has a new optional **Type** choice (Not set, Solo, Pooled) with a one-line explanation of each. The tag appears next to the pool name in Saved pools, just like in the Pool directory.
- Pools added from the directory keep their type automatically.
- When you type an address that matches a pool in the directory, its type is suggested (only if you haven't picked one).
- Existing saved pools show no tag until you edit them and choose a type.
- The type is kept in pool export / import and in full backups.

## v2.1.0 - Pool Directory, New Automations, Real Share Difficulty (October 2026)

### Pool directory
- **Pools → Pool directory**: a ready-made list of well-known pools for BitAxe and NerdQAxe (BTC solo pools such as Public Pool, Solo CKPool US/EU/AU, AtlasPool, Noderunners, bitaxe.de, SoloPool.eu, Braiins Solo; pooled OCEAN and Braiins Pool; SHA-256 altcoin pools for BCH, DGB, XEC and PPC). Filter by coin, search, and press **Add**: the pool editor opens with host and port filled in, and your wallet is reused from another saved pool of the same coin.
- **Updatable list**: the list ships with the extension (`pool-catalog.json`). Point **Update source** at your own hosted JSON (for example a raw GitHub link) and it is checked once a day and whenever you press **Update list**. A newer built-in list takes precedence over an older downloaded one. Entries are validated before use.

### Automations
- **Redesigned view**: one grid of identical cards (3 columns on desktop, 2 on tablets, 1 on phones). Each card shows its category, a short description, the key settings as chips, the number of miners and a live status line. Switch on from the card; click it to open the settings dialog with an explanation, the fields and the miner picker.
- **Summary** of how many automations are on and when the last action happened, plus **Recent automation actions** at the bottom.
- **New: Hashrate drop** - restart, or alert only, when a miner runs more than N% below its normal hashrate (firmware expected hashrate, or 1h average) for a sustained period. Cooldown between actions.
- **New: Back to primary pool** - restarts a miner that has been on its fallback pool too long, so it reconnects to the primary (uses `isUsingFallbackStratum`, AxeOS 2.x).
- **New: Reject rate** - alert or restart when rejected shares exceed a percentage over a rolling window (at least 20 shares; counters resetting after a reboot are handled).
- **New: Quiet hours** - fixed lower fan speed during a time window (overnight windows supported), then each miner's own fan setting is restored. A chip over the safety limit gets its normal fan back immediately and returns to quiet after cooling 5 degrees. Miners already too warm are not quietened. State survives reloads.
- **New: Daily restart** - restarts the chosen miners once a day at a set time, one every few seconds; skipped (not run late) if the dashboard wasn't open within 30 minutes of that time.
- "Alert me only" actions always reach you: a desktop notification in the background, a message in front.

### Share difficulty chart, rebuilt
- **Real values instead of an average**: the old chart plotted accepted shares × pool difficulty per refresh, so a big hit counted like any other share and never stood out. The chart now records every share that beats a miner's session best (detected when `bestSessionDiff` rises between refreshes) at its **exact difficulty**. A new all-time best is a gold dot.
- **Logarithmic scale**, so 10K and 5G shares are both readable.
- **Reference lines**: pool floor, session best, best ever and the **Block** line (network difficulty). Lines with the same value share one label.
- **Tooltips** show the device, time and how far the share was from a block ("0.0033% of a block · 30,238× short").
- **Time range**: last hour, 24 hours, 7 days or all time. Colour legend per device with hit counts.
- **Live streaming** uses the same scale: every share as a dot at its real difficulty, filling the chart from the left; the last 30 minutes stay in view.
- Share hits are stored (up to 2000) and cleared with **Clear chart history**.

### Other
- Activity log entries made by automations are tagged, so they can be listed separately.
- Guide updated for the directory, the new automations and the new chart.

## v2.0.0 - Complete Redesign (September 2026)

A ground-up rework of the interface and a round of reliability fixes. All data from 1.x carries over.

### New interface
- **App shell with four sections**: Fleet, Pools, Automations and History in a side rail, with Guide, Settings and Support at the bottom. On narrow screens the rail becomes a bottom tab bar.
- **Fleet view**: a large fleet-hashrate readout with 1h and 24h averages, a tabbed chart (Hashrate / Share difficulty) instead of the carousel, six stat tiles, the health strip, and the device list.
- **New default theme "Circuit"** (graphite and signal amber) and a light theme **"Daylight"**. Neon Vault and Aurora are kept and remapped to the new design tokens. Upgrading from 1.x switches once to Circuit; pick another theme in Settings.
- **Archivo** variable typeface with condensed numerals for dense readings; monospace for IPs and logs.
- **Native `<dialog>`s** everywhere (light-dismiss with a fallback for older engines), popovers for menus, toasts instead of `alert()` / `confirm()`.
- **Device cards**: densities renamed to Compact (one row per device), Standard and Detailed. A single ⋯ menu per card holds rename, labels, icon, open web page, identify (BitAxe), copy IP and remove. Double-click a name to rename it. Offline cards show how long the device has been down.
- **Settings dialog** (side rail) replaces the scattered top-bar toggles: theme, text size, °C/°F, refresh interval, electricity price, alerts, backup.
- **Setup tour** rewritten, with scanning built into the second step.
- **User guide** rewritten for the new layout.

### New features
- **Device search** (press `/`) across name, IP, model, pool and labels, plus an **Offline** filter chip.
- **Select mode** with a bulk bar: apply a pool to, restart, or remove several devices at once.
- **Energy cost** per day (and per month in the tooltip) from your electricity price and currency, and **fleet efficiency** in J/TH. New **Efficiency** sort.
- **Desktop notifications** when the dashboard is in the background: device offline / back online, block found, automation restarts (each optional). Clicking one focuses the dashboard.
- **Toolbar badge**: online count in green, or offline count in red, with a live tooltip.
- **Full backup and restore** of devices, names, labels, icons, pools, automations and settings in one JSON file.
- **Configurable refresh interval** (5 s to 1 min, default 10 s).
- **Live log**: line filter, pause that keeps collecting and replays on resume, save to `.txt`, colour-coded errors / warnings / shares.
- **Hashrate chart** marks moments when devices were offline; axis labels adapt to the data range and show seconds on short spans.
- **Pools**: "Use" button fills the Apply form, live count of miners currently on each saved pool, per-device status in the Apply list.
- **Activity log** level filter (All / Actions / Warnings / Errors) and a clear button; downtime history can be cleared.
- **Keyboard shortcuts**: `/` search, `R` refresh, `1`-`4` switch sections, `?` guide.
- **Popup** redesigned: fleet hashrate, online count, power, best difficulty and a per-device list. "Open dashboard" focuses an existing dashboard tab instead of opening a duplicate.

### Fixed
- **Data loss on update**: the service worker's `onInstalled` handler reset storage on every update and reload, wiping the device list. It now only fills in missing defaults and never overwrites existing data.
- **Flap Recovery settings were not saved**: they were read after the save call. Fixed.
- **Overheat Protection restart loop**: a device in a hot room could be restarted every poll. It now waits a configurable cooldown (default 10 min) between restarts of the same device. The limit is shown and edited in your chosen temperature unit.
- **Pool Rotation on NerdQAxe** now sends the full writable settings like the Pool Manager does, so other settings are not reset.
- Deleting a saved pool also removes it from Pool Rotation.
- Removing a device now also cleans its nickname, labels, icon, sparkline history, custom-order slot and automation selections.
- Automation device lists no longer drop offline devices from the selection when saving.
- Live difficulty chart's time labels in live mode used the wrong series.
- Text scaling uses a root rem scale instead of `body.style.zoom`, so canvases, popovers and hit targets stay aligned.
- Charts sit in fixed-height wrappers and cannot grow unbounded.
- WebSocket session tabs are tracked in `chrome.storage.session` (the service worker can be stopped at any time) and are closed when the dashboard tab that opened them goes away.
- Waiting for a device tab now also handles a page that finished loading before the listener attached.
- Imported device placeholders no longer produce a "back online" message the first time they answer.

### Technical
- Manifest `2.0.0`, new `notifications` permission, `minimum_chrome_version` 116. Chrome asks to re-enable the extension after updating because of the new permission.
- Service worker message handlers are `async`/`await` throughout.

## v1.6.8 - Final 1.x Build (2026)
- The last 1.x version and the starting point for the v2 redesign. Its changes compared with v1.6.7 were not recorded in this changelog.

## v1.6.7 - Theme Picker Polish (May 2026)
- The theme dropdown no longer shows an empty "Light" group; if all available themes are in a single group, options are listed directly without category labels
- Sparkline mini-charts in device cards now redraw immediately when you switch themes, instead of waiting for the next refresh to pick up the new colors

## v1.6.6 - Hotfix (May 2026)
- **Fixed**: critical bug where hovering over the Fleet Hashrate or Live Difficulty chart caused the chart to grow vertically without bound, eventually filling the screen. Caused by a flex layout conflict with the explicit canvas height; the chart card now uses a stable `min-height` strategy with single-line headers.

## v1.6.5 - Supra Firmware Support, New Theme (May 2026)
- **New theme: Aurora** - replaces Solar Light with a second fully designed dark theme. Cyan + magenta + amber on deep midnight navy, distinctly different from Neon Vault while equally polished.
- **BitAxe Supra firmware support**: the newer Supra firmware only exposes the current hashrate (no `hashRate_1h`/`_10m`/`_1m` fields). The card's 1h and 24h averages now fall back to a rolling average computed locally from the dashboard's own sample buffer, which is now sized for one hour of history.
- **Fixed**: the OFFLINE pill could persist on a card after the device came back online. The in-place updater now manages the pill dynamically.
- **Fixed**: the Fleet Hashrate and Live Difficulty charts now have identical heights (the Live Difficulty header was wrapping to a second line on tighter widths).

## v1.6.4 - Flap Recovery, Device Import/Export, Better Live Difficulty (May 2026)
- **New automation: Flap Recovery**. Some boards enter an unstable offline/online cycle. The new automation watches recovery events and, if a device flaps more than N times within a configurable window, automatically restarts it once the device is reachable again. Cooldown prevents repeated triggering.
- **Export and import devices**: back up the entire device list (IPs, nicknames, labels, custom icons, custom order) to a JSON file and restore it on a fresh install in one click. New icons in the device controls area. Unreachable IPs are kept as placeholders so their names and labels apply once they come back online.
- **Live Difficulty chart now reflects the device's real session best**, even when the live stream hasn't captured a high share yet:
  - A dashed reference line at the device's current `bestSessionDiff` value, with a label
  - The chart's Y axis auto-expands to include this reference
  - Live mode seeds an initial point at the current session best so it's visible from the start
  - Buffer increased from 300 to 600 points for longer history

## v1.6.3 - Badge & Modal Polish (May 2026)
- **Block counter badge** redesigned: smaller, positioned at the bottom-left of the trophy icon (no longer deforming it), with a theme-consistent circular background and a subtle glow.
- **Blocks Found modal** redesigned: each block is now a card with a colored left border by device type, a trophy icon, the difficulty highlighted in a dedicated box, and a discreet timestamp + pool footer.
- **Uptime History modal** redesigned: colored left border (red while still offline, green when recovered), status badge ("OFFLINE" / "RECOVERED"), Offline / Back times in clean labelled columns, and the downtime duration in a pill on the right. No more cramped text rows.

## v1.6.2 - Many Fixes & Quality of Life (May 2026)
- **Label system fully redesigned**: the label popup now has a solid background, a visible color picker (with a checkmark on the selected color), an obvious ✕ delete button on each existing label, and a clear Done button to close. Custom label filter chips in the device header are now clean colored pills.
- **Custom device icons**: click the icon on any device card to choose from 10 icons (axe, chip, CPU, server, rocket, flame, bolt, diamond, pickaxe, star). Choice is per-device and persistent.
- **Help guide fully refreshed**: new sections for Live Monitoring (logs + live difficulty) and Blocks & Uptime, updated card and pool manager content, removed obsolete references.
- **Three offline-device improvements**:
  - **Pool Manager** now shows offline devices with a red border and disabled checkbox instead of hiding them
  - Live logs, Live Difficulty, Restart and Settings now show a clear toast notification when targeting an offline device, instead of silently failing
  - The OFFLINE pill on cards is now managed dynamically (preliminary, fully fixed in v1.6.5)
- **Fixed**: chart hover positions were off when font scaling was enabled. Hover now uses `getBoundingClientRect` adjusted for the zoom factor, so it works at any font size.
- **Fixed**: sparkline mini-charts disappeared until next refresh when toggling °C/°F. They now redraw immediately on any card re-render.
- **Detail sparkline persistence**: per-device hashrate history is now saved to local storage, so the mini-charts are populated immediately after a reload instead of starting empty.
- **Detail sparkline wider**: the canvas now extends almost to the best-diff column, with a slightly higher resolution for crispness.
- **Dynamic 1h trend arrow**: the arrow next to "1h avg" now reflects reality - ▲ green when current is above the 1h average, ▼ red when below, ▬ grey when within 2%.
- **Pool details refresh in real time**: applying a pool through the Pool Manager now triggers a device refresh whether or not "Restart device" is checked, so the new pool details appear without reloading the page.

## v1.6.1 - Card View Modes (May 2026)
- **Three card view modes**: A new toggle in the device controls switches between Minimal, Balanced, and Detailed layouts. Your choice is remembered across sessions.
  - **Minimal**: device name, current hashrate, best difficulty - compact cards for large fleets
  - **Balanced** (default): adds 1h average, session difficulty, temperature (with bar) and fan speed
  - **Detailed**: adds a live hashrate fluctuation sparkline, power, efficiency (J/TH), connected pool, and accepted/rejected shares
- All card tools (open, live logs, settings, restart) remain available in every mode
- Smaller device-name font so long names no longer get truncated

## v1.6.0 - Triple Redesign (May 2026)
- **Device cards fully redesigned**: a new information hierarchy that works equally well on both device types. The hashrate is the hero, with a temperature bar, power, efficiency (J/TH) and fan in a clean stats strip. Type-colored accents and a subtle glow aura.
- **Uptime monitor redesigned**: the strip under the navbar is now a proper status bar with a fleet-health ring, per-device status segments, and clean event pills.
- **Block celebration redesigned**: animated radial burst behind the trophy, shining gradient title, and the achieved difficulty shown as the hero number.

## v1.5.5 - Polish (May 2026)
- Block markers on the hashrate chart now align exactly to the data point (and the hover tooltip)
- Uptime ticker no longer restarts its scroll on every refresh

## v1.5.4 - Stability & Identity (May 2026)
- **Fixed**: the block celebration no longer reappears on every dashboard reload (state is now baselined on first poll)
- New extension icon matching the Neon Vault look
- Pool Manager "Show all" now stays expanded across refreshes

## v1.5.3 - Block Accuracy (May 2026)
- Block difficulty now shows the **actual difficulty the miner reached** to solve the block (session best), not the pool target
- Trophy badge behaves like a notification - clears when you open the block history
- Block-found moments are highlighted on the Fleet Hashrate chart
- Pool Manager edit/delete buttons and coin tabs are now properly styled

## v1.5.2 - Uptime Ticker (May 2026)
- Offline events now scroll right-to-left as a continuous ticker (pauses on hover)

## v1.5.1 - Quiet Console (May 2026)
- Eliminated the benign "message channel closed" errors that could appear in the console; polling is now resilient to service-worker restarts

## v1.5.0 - Uptime Monitor (May 2026)
- **New: persistent uptime monitor** under the navbar - tracks which devices go offline and when they return, with full timestamped history
- NerdQAxe cards now show their hashrate in violet to match their accent

## v1.4.4 - Card Details (May 2026)
- Card top border is now color-coded by device type (lime for BitAxe, violet for NerdQAxe; red when offline)
- **Fixed**: 24h hashrate showing 0 on BitAxe - these devices don't expose a 24h field, so we now fall back to the 1h average
- Device-type badges are perfectly centered

## v1.4.3 - Layout Polish (May 2026)
- Rebuilt the donate button so the icon and label no longer overflow
- More breathing room across the navbar

## v1.4.2 - Log & Tutorial Fixes (May 2026)
- Activity log entries now have colored level badges (info / success / action / warn / error)
- Hidden the empty interactive box on informational tutorial steps
- Device checkboxes aligned with names in automations

## v1.4.1 - Pool Import/Export (May 2026)
- **New: export and import saved pools** as a JSON file (duplicates are skipped on import)
- Fixed the tutorial spinner spinning its label text
- Fixed the activity log widget not closing
- Aligned device checkboxes in the Pool Manager

## v1.4.0 - Neon Vault UI (May 2026)
- **Complete visual overhaul** with a vibrant modern-crypto aesthetic
- New typography: Syne (display), Sora (body), Space Mono (data)
- Two finished themes: **Neon Vault** (dark) and **Solar Light** (light) [Solar Light replaced by Aurora in v1.6.5]
- Larger, punchier charts and cards throughout

## v1.3.1 - Multi-Device Live Difficulty (May 2026)
- Fixed live difficulty streaming on NerdQAxe (its log format uses `diff X/Y` rather than BitAxe's `diff X of Y`)

## v1.3.0 - Live Difficulty (May 2026)
- **New: live difficulty mode** on the difficulty chart - stream the real per-share difficulty of a selected device over WebSocket and watch every share land in real time

## v1.2.1 - Live Logs Reliability (May 2026)
- Live logs now stream reliably by running the WebSocket inside the device's own page (the same approach the device's web UI uses), fixing the immediate disconnects

## v1.2.0 - Live Logs (May 2026)
- **New: live device logs** - a 📜 button on each card opens a real-time log console streamed over WebSocket, with pause, clear, and smart auto-scroll

## v1.1.0 - Block Found (May 2026)
- **New: block detection** - when a device solves a block, a celebration appears with confetti and the block details
- Navbar trophy button with a counter and full block history (persisted)

## v1.0.0 - v1.0.11 - First Stable Series (early 2026)
The first stable release and eleven rounds of refinements, published together as v1.0.11. v1.0.3 to v1.0.11 shipped in March-April 2026.

### v1.0.11
- Fixed: the coin selector in the Add Pool form reset to Bitcoin whenever the background refreshed; your choice is now preserved (building on a first fix in v0.99.2)

### v1.0.10 - v1.0.11 - Interactive Live Difficulty
- The Live Difficulty chart became fully interactive: crosshair on hover, highlighted points, and a tooltip with the total difficulty plus a per-device breakdown (or the pool difficulty in single-device view)
- Per-device toggle: all devices at once (colour-coded) or a single one
- Fleet Hashrate chart made taller and more responsive to changes

### v1.0.9
- Fixed: the Live Difficulty chart was blank and the device dropdown stalled until reload (missing `diffHistory` declaration)

### v1.0.7 - v1.0.8
- Fixed: the extension failed to load for users upgrading from older versions - a stored theme that no longer existed left the UI unstyled and unclickable. The theme is now validated with a safe fallback, and the whole init sequence is hardened so a single failure can't break the dashboard

### v1.0.5 - v1.0.6
- Subnet help tooltip in onboarding and the scan popover, explaining what a subnet is and how to find yours
- Fixed (v1.0.6): duplicate tooltip (native + custom) on the subnet help icon
- Fixed (v1.0.6): canvas sizing when a carousel slide was hidden and had zero dimensions

### v1.0.4 - Six Themes
- Replaced the old theme set with six designed options. Dark: Tech Midnight (cyan/navy), Slate Neon (purple/charcoal), Material Dark (muted purple/teal). Light: Cloud Cyan, Silk Violet, Paper Teal
- Default theme set to Tech Midnight
- Fixed an internal variable-shadowing bug in the chart renderer

### v1.0.3 - Live Difficulty Chart
- **New: Live Difficulty chart** in a swipeable carousel alongside Fleet Hashrate (arrows and dots)
- Plots the difficulty produced per interval (new shares × pool difficulty), with gradient area fill and highlighted peaks
- Fixed: User Guide content collapsing below the navigation
- Fixed: saved pools list scrolling when more than two pools are saved, without shrinking the apply section
- Updated LTC and DGB donation wallets

### v1.0.2 - User Guide
- **New: in-app User Guide** from a help button in the top bar, with sidebar navigation: Getting Started, Device Cards, Pool Manager, Device Settings, Automations, Top Bar Controls

### v1.0.1 - v1.0.2 - Automations
- **Watchdog (auto-reboot)**: restarts any device stuck at 0 GH/s past a configurable timeout (default 5 minutes), per device
- **Overheat protection**: restarts devices above a temperature threshold (default 75 °C), per device
- **Pool rotation**: cycles selected devices through saved pools at an interval in hours; rotation state persists across reloads
- Settings save instantly, with live status indicators and activity logging for every action
- Automations panel stacked under Pools in a two-column card layout

### v1.0.0 - First Stable Release
- Scan the local network for BitAxe and NerdQAxe devices and monitor hashrate and difficulty in real time
- Switch pools across several devices at once
- **Automatic CSRF handling**: writes (pool changes, restarts) run through the device's own session, so they work without 401 errors
- Chart history persists across page reloads
- Donation addresses with one-click copy buttons
- Offline cards get a subtle red tint matching the active theme
- NerdQAxe: automatic fan control removed from the UI (deprecated in firmware); manual speed remains

## Pre-1.0 (v0.99.x)
- Development builds before the first stable release. v0.99.2 included a first fix for the pool coin selector resetting during background refreshes
