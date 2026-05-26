# AxeOS Fleet Manager - Changelog

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
- Streamlined to two beautifully finished themes: **Neon Vault** (dark) and **Solar Light** (light)
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


## v1.0.3 – v1.0.11 - Charts & Stability (March–April 2026)
- **Chart carousel**: Fleet Hashrate and Difficulty Monitor in a swipeable carousel with arrows and dots
- Difficulty chart reworked to show per-interval difficulty with gradient fill and peak markers
- Subnet help tooltip on the scan field
- Theme handling hardened (validation, fallback) and several rendering fixes
- Various stability fixes to chart history tracking and the coin selector

## v1.0.2 - UX Improvements (March 2026)
- **Automations panel moved to left**: Now stacked below Pools trigger for consistency (features on the left)
- **Removed emojis from automation titles**: SVG icons instead, matching Pool Manager style
- **Card-based automation layout**: Two-column grid with Watchdog and Overheat side by side, Pool Rotation full-width below
- **Auto-save**: All automation changes save instantly on toggle/input - no more hidden "Save" button
- **Intro text**: Explains auto-save behavior at the top of the panel
- **User Guide**: New question-mark button in the topbar opens a comprehensive guide with sidebar navigation. Sections: Getting Started, Device Cards, Pool Manager, Device Settings, Automations, Top Bar Controls

## v1.0.1 - Automations (March 2026)
- **Automations panel**: New slide-in panel on the right side (mirror of Pool Manager on left)
- **Watchdog (Auto-Reboot)**: Automatically restarts devices stuck at 0 GH/s for a configurable time (default 5 minutes). Per-device selection.
- **Overheat Protection**: Automatically restarts devices when temperature exceeds a configurable threshold (default 75°C). Per-device selection.
- **Pool Rotation**: Automatically switches between selected saved pools at regular intervals (configurable hours). Supports per-device selection and any number of pools in rotation.
- **Automation logging**: All automation actions logged with distinctive icons (🐕 watchdog, 🌡 overheat, 🔄 rotation)
- **Status indicators**: Each automation shows real-time status (active/warning/disabled)
- **Persistent state**: Automation settings and pool rotation state survive page reloads
- **Toggle switches**: Clean on/off toggles for each automation

## v1.0.0 - Release (March 2026)
- Removed auto-fan option for NerdQAxe (deprecated in firmware; manual speed only)
- Offline device cards now show a subtle red tint matching the active theme
- Added copy buttons for each donation address
- Created changelog and features documentation

## v0.99.3
- **Font scale fix**: Switched from CSS `font-size` to `zoom` - now actually scales all UI elements when pressing Aa+
- **NerdQAxe auto-fan**: Clarified that auto-fan is deprecated in NerdQAxe firmware (AFC removed). Extension now sends `manualFanSpeed: 100` and shows an informational note

## v0.99.2
- **BitAxe fan fix (manual speed)**: Fixed field name - BitAxe firmware expects `manualfanspeed` (lowercase), not `fanSpeed`
- **NerdQAxe auto-fan**: Separated logic per device type for correct field handling
- **Rename/label icons**: Replaced small emoji with proper SVG icons (pen + tag) at 15-16px, much more visible
- **Settings modal pool URL parsing**: Stratum URL fields now auto-strip `stratum+tcp://` and extract port on blur
- **Separate fallback coin**: Pool manager now allows choosing a different coin for the fallback pool
- **Pool list compressed to 2**: Saved pools collapse after 2 entries (was 3)
- **Coin dropdown reset fix**: Pool manager state preserved across dashboard refreshes
- **°C / °F toggle**: New topbar button to switch temperature units across the entire dashboard
- **Font scale (Aa+)**: New topbar button to enlarge all dashboard text
- **Donate button more visible**: Increased opacity, added border and red heart icon

## v0.99.1
- **Tutorial scan feedback**: Added animated spinner during network scan in tutorial, plus a device list showing all discovered devices
- **New tutorial step**: "Organize with Labels" explaining the label system
- **Label popup fix**: Popup now opens as a centered fixed modal with backdrop, no longer hidden behind other cards
- **Saved pools collapsible**: Lists with 3+ pools auto-collapse with gradient fade and "Show all" toggle
- **Chart history persistence**: Hashrate chart data saved to storage, survives page reloads
- **Rename/label icons larger**: Increased from 11px to 14px with better opacity

## v0.99.0
- **Removed Debug API button** and modal
- **Removed Update tab** from device settings (OTA via official channels)
- **Device type icon in cards**: SVG chip (BitAxe, orange) or board (NerdQAxe, blue) next to device name
- **Custom labels**: Up to 2 colored labels per device (8 colors, 10 char max), with label-based filtering
- **Chart online/offline tracking**: Tooltip shows device count; offline events logged automatically
- **Pool apply progress bar**: Visual progress + per-device status icons (⏳ → ✅/❌)
- **Fan settings fix**: Added `manualFanSpeed` for NerdQAxe, `frequency` alias for mining settings

## v0.9.0 (pre-release, internal "v1.4")
- **Card redesign**: Hero layout with hashrate (GH/s), best diff, temperature as primary stats
- **Secondary stats row**: 1h Avg, 24h Avg, Session Best visible without expanding
- **Expand bug fix**: Added `align-items: start` to device grid so cards expand independently
- **Scan bar → topbar icon**: Network scan moved to popover dropdown behind 🔍 icon
- **Sort lock button**: Padlock icon to freeze custom device order
- **"Donate" text**: Added label next to heart icon
- **Tutorial interactive setup**: Scan/add devices directly from tutorial wizard

## v0.8.0 (pre-release, internal "v1.0/CSRF fix")
- **CSRF 401 fix - Tab Injection**: All write operations (PATCH, restart, identify) now use `chrome.scripting.executeScript` to inject fetch calls into a background tab opened to the device. This runs same-origin with the device's session cookie, bypassing the CSRF protection that blocked direct cross-origin requests from the extension
- **Permissions**: Added `scripting` and `tabs` to manifest for tab injection
- **Background.js simplified**: Only handles read-only operations (scan, info); all writes go through DEVICE_WRITE tab injection handler

## v0.7.0 (pre-release, internal "v1.3.1 pool fix")
- **Pool apply rewrite**: GET-then-merge-then-PATCH for NerdQAxe (preserves voltage/frequency settings); minimal payload for BitAxe
- **Device-specific field names**: NerdQAxe uses `stratumEnonceSubscribe`, BitAxe uses `stratumExtranonceSubscribe`
- **Read-only field removal**: NerdQAxe PATCH strips 30+ read-only fields before sending
- **Restart with body**: POST `/api/system/restart` with `{}` body
- **Worker suffix auto-append**: Pool manager adds device name to wallet address (e.g., `wallet.devicename`)
- **Smart URL parsing**: `stratum+tcp://host:port` auto-stripped and port extracted

## v0.6.0 (pre-release, internal "v1.3.1")
- **Device sorting**: 7 sort criteria (hashrate, best diff, uptime, IP, name, temp, custom)
- **Drag-and-drop reorder**: Manual device card ordering in custom sort mode
- **2-column pool device list**: Grid layout with type-specific icons in pool manager
- **Color-representative theme icons**: Emoji icons matching each theme's accent color
- **CSP fix**: Extracted inline popup script to external `popup.js` (Manifest V3 compliance)

## v0.5.0 (pre-release, internal "v1.3")
- **Single-page layout**: Replaced tab navigation with unified dashboard
- **Floating activity log**: Chat-bubble FAB with unread badge, slide-up log panel
- **Slide-in pool panel**: Left-side slide panel for pool management
- **Interactive hashrate chart**: Canvas chart with hover tooltips, crosshair, dynamic Y-axis
- **Device dashboard links**: 🌐 button opens device's local web UI
- **Expanded state persistence**: Device card expand/collapse survives page reload
- **Fallback pool dropdown**: Select fallback from saved pools
- **New logo**: Custom SVG axe-cross diamond mark
- **First-run tutorial**: 5-step setup wizard with dots navigation
- **Smooth animations**: Card entrance, panel slide, fade-in transitions

## v0.4.0 (pre-release, internal "v1.2")
- **Manual IP input**: Add devices by IP address without scanning
- **10-theme system**: 5 dark (Midnight Orange, Cyber Green, Deep Purple, Crimson Night, Arctic Blue) + 5 light (Clean Amber, Mint Fresh, Soft Lavender, Paper Rose, Sky Slate)
- **SHA-256 coin list**: 16 coins including BTC, BCH, BSV, XEC, DGB, SYS, NMC, and more
- **Theme persistence**: Selected theme saved and restored

## v0.3.0 (pre-release, internal "v1.1")
- **Device settings modal**: Tabbed interface (General, Fan, Mining, Pool, Update)
- **Fan control**: Auto/manual speed slider
- **Mining settings**: Frequency and voltage adjustment
- **Pool settings**: Primary + fallback pool configuration
- **OTA updates**: GitHub auto-update (NerdQAxe), manual firmware/web UI upload
- **Device identify**: Flash LED via API
- **Device remove**: Remove from dashboard
- **Activity log**: Timestamped log with level badges

## v0.2.0 (pre-release, internal "v1.0")
- **Network scanner**: Subnet-based device discovery (192.168.x.0/24)
- **Device cards**: Hashrate, temperature, power, fan, best diff display
- **Pool manager**: Save, edit, delete mining pool configurations
- **Background service worker**: API communication layer
- **Extension popup**: Quick stats (device count, total hashrate) with dashboard link
- **Manifest V3**: Chrome extension with `storage` and `host_permissions`
