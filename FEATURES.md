# AxeOS Fleet Manager - Features & Architecture

## Overview

AxeOS Fleet Manager is a Chrome extension for managing fleets of BitAxe and NerdQAxe SHA-256 cryptocurrency mining devices from a single dashboard. It communicates with devices over the local network via their REST APIs.

---

## User-Facing Features

### Device Discovery & Management
- **Network scanner**: Scans a /24 subnet to auto-discover mining devices
- **Manual IP add**: Add devices individually by IP address
- **Device type detection**: Automatically identifies BitAxe vs NerdQAxe from firmware response
- **Device renaming**: Custom nicknames per device (used as worker suffix in pool configs)
- **Device removal**: Remove devices from the dashboard
- **Custom colored labels**: Up to 2 labels per device (8 colors, 10 char max) for organization
- **Label-based filtering**: Filter device view by label, type (BitAxe/NerdQAxe), or show all

### Dashboard & Monitoring
- **Real-time device cards**: Current hashrate (GH/s), best difficulty, temperature as hero stats
- **Secondary stats**: 1h average, 24h average, session best visible on each card
- **Expandable details**: Power, fan, shares, ASIC model, firmware, pool info, voltages, uptime, WiFi RSSI
- **Fleet overview row**: Total devices, accepted/rejected shares, total power, average temp, uptime, best diff
- **Interactive hashrate chart**: Canvas-rendered with hover tooltips showing TH/s, timestamp, and online/offline device count
- **Chart history persistence**: Hashrate data saved to storage, survives page reloads
- **Offline detection**: Devices going offline are logged and cards show a red-tinted visual indicator
- **In-place card updates**: Refresh updates values without re-rendering cards (no flash/animation replay)

### Live Streaming (WebSocket)
- **Live device logs**: Real-time log console per device (📜 button), streamed over WebSocket with pause, clear, ANSI cleanup, and smart auto-scroll
- **Live difficulty**: Stream the real per-share difficulty of a selected device and plot every share as it lands; supports both BitAxe (`diff X of Y`) and NerdQAxe (`diff X/Y`) log formats
- Streaming runs inside the device's own page (tab injection) and relays lines back, because an insecure `ws://` connection can't be opened from the extension's secure origin

### Block Detection
- **Block celebration**: Confetti modal when a device solves a block, showing the device, coin, pool, and the actual achieved difficulty (session best - the difficulty of the winning share)
- **Block history**: Persistent list behind the navbar trophy with an unread-style counter; block moments are also marked on the Fleet Hashrate chart
- Detection baselines state on first poll so reloads never re-trigger old celebrations

### Uptime Monitor
- Persistent status bar under the navbar: fleet-health ring, per-device status segments, and a right-to-left ticker of offline/recovery events
- Full timestamped downtime history with durations, persisted across restarts

### Card View Modes
- **Minimal / Balanced / Detailed** toggle controls how much each card shows; Detailed includes a live hashrate sparkline. Selection is persisted

### Pool Management
- **Import / export** saved pools as a JSON file (duplicates skipped on import)
- **Saved pool profiles**: Store unlimited pool configurations organized by coin
- **16 SHA-256 coins**: BTC, BCH, BSV, XEC, DGB, SYS, NMC, ELA, PPC, HTR, FB, LCC, QUAI, AUR, DGC, Other
- **Smart URL parsing**: Pasting `stratum+tcp://host:port` auto-strips protocol and extracts port
- **Worker suffix auto-append**: Wallet address gets `.devicename` appended automatically
- **Separate fallback coin**: Primary and fallback pools can mine different coins
- **Apply to multiple devices**: Select specific devices, apply pool config with one click
- **Progress bar & status icons**: Visual feedback during pool application (⏳ → ✅/❌ per device)
- **Restart after apply**: Optional auto-restart after configuration
- **Collapsible pool list**: Lists with 3+ pools auto-collapse with "Show all" toggle
- **State preservation**: Pool manager selections survive dashboard auto-refresh

### Device Settings (per device)
- **General tab**: Full device info grid (24 fields)
- **Fan control**: BitAxe: auto + manual speed. NerdQAxe: manual speed only (auto-fan deprecated in firmware)
- **Mining settings**: Frequency (MHz) and voltage (mV) adjustment
- **Pool settings**: Primary + fallback pool with smart URL parsing
- **Device identify**: Flash device LED via API
- **Device restart**: Restart with confirmation

### Automations
- **Watchdog (Auto-Reboot)**: Monitors selected devices; if hashrate stays at 0 GH/s for X minutes (configurable, default 5), automatically sends restart command. Tracks zero-hashrate duration per device.
- **Overheat Protection**: Monitors selected devices; if ASIC/board temperature exceeds a configurable threshold (default 75°C), automatically restarts the device to cool down.
- **Pool Rotation**: Switches selected devices between a set of saved pools at regular intervals (configurable in hours). Maintains rotation state per device across page reloads. Requires at least 2 pools selected.
- **Per-device selection**: Each automation can target specific devices independently
- **Toggle switches**: Enable/disable each automation independently
- **Status indicators**: Real-time feedback showing automation state and any active warnings
- **Automation logging**: All actions logged with distinctive emoji prefixes (🐕, 🌡, 🔄)

### Themes & Accessibility
- **Two themes**: Neon Vault (dark, default) and Solar Light (light), with typography Syne (display), Sora (body), Space Mono (data)
- **Temperature units**: Toggle °C / °F across entire dashboard
- **Font scaling**: Zoom toggle (100% / 115%) for accessibility
- **Theme persistence**: Selection saved and restored

### Sorting & Organization
- **7 sort criteria**: Hashrate, Best Diff, Uptime, IP Address, Name, Temperature, Custom
- **Ascending/descending toggle**
- **Drag-and-drop reorder**: Manual card positioning in custom sort mode
- **Sort lock**: Padlock button freezes custom order (disables drag-and-drop and sort changes)
- **Order persistence**: Custom order saved to storage

### First-Run Tutorial
- **Interactive setup wizard**: 6-step guided setup
- **Step 1**: Welcome screen
- **Step 2**: Network scan with inline subnet input, spinner, and discovered device list
- **Step 3**: Rename devices explanation
- **Step 4**: Label system explanation
- **Step 5**: Pool manager overview
- **Step 6**: Ready confirmation

### User Guide
- **In-app documentation**: Comprehensive guide accessible from the topbar (? icon)
- **Sidebar navigation**: 6 sections covering all features
- **Sections**: Getting Started, Device Cards, Pool Manager, Device Settings, Automations, Top Bar Controls
- **Responsive**: Two-pane layout on desktop, stacked on mobile

### Other UI
- **Extension popup**: Quick device count and total hashrate, one-click dashboard open
- **Floating activity log**: Chat-bubble FAB with unread badge, timestamped entries with level badges
- **Donate modal**: BTC, BCH, DGB, LTC addresses with copy-to-clipboard buttons
- **Scan popover**: Compact dropdown in topbar (replaces full scan bar)

---

## Under-the-Hood / Technical Features

### CSRF Bypass via Tab Injection
The most critical technical feature. Device firmware requires session cookies for write operations (PATCH, POST restart). The extension's service worker has a separate cookie jar and cannot send these cookies cross-origin.

**Solution**: For every write operation, the background script:
1. Opens a hidden tab to the device's web UI (`http://192.168.x.x/`)
2. Waits for the page to load (which creates the session cookie)
3. Uses `chrome.scripting.executeScript` with `world: 'MAIN'` to inject a `fetch()` call inside the device page's JavaScript context
4. The injected fetch runs same-origin, so cookies are sent automatically
5. The result is returned to the extension and the tab is closed

This is functionally equivalent to how Tampermonkey's `GM_xmlhttpRequest` bypasses CORS.

### Device-Specific API Handling
- **BitAxe PATCH**: Sends only pool-related fields + `stratumExtranonceSubscribe`, `stratumSuggestedDifficulty`
- **NerdQAxe PATCH**: Extracts writable fields from current settings via whitelist, then overrides pool fields. Uses `stratumEnonceSubscribe` (different field name from BitAxe)
- **Fan control**: BitAxe uses `autofanspeed` + `manualfanspeed` (lowercase). NerdQAxe uses `autofanspeed` + `manualFanSpeed` (camelCase). Auto-fan is deprecated on NerdQAxe firmware
- **Restart**: POST `/api/system/restart` with `{}` body. Network errors treated as success (device drops connection immediately)

### Architecture
- **manifest.json**: Manifest V3 with `storage`, `scripting`, `tabs` permissions + `http://*/*` host permission
- **background.js** (service worker): Handles read-only operations (scan, device info) and tab injection for writes
- **dashboard.js**: All UI logic, state management, and write API wrappers
- **dashboard.html**: Single-page layout with modals
- **dashboard.css**: Component styles with CSS custom properties for theming
- **themes.css**: 2 theme definitions using CSS custom properties
- **popup.html/js**: Extension popup with quick stats

### Storage
All state persisted to `chrome.storage.local`:
- `devices`: Array of device objects with full API response data
- `savedPools`: Array of pool configurations
- `logs`: Activity log entries (max 500)
- `theme`: Current theme ID
- `deviceNicknames`: JSON map of IP → custom name
- `deviceLabels`: JSON map of IP → label array [{text, color}]
- `sortField`, `sortAsc`, `customOrder`, `sortLocked`: Sort preferences
- `expandedCards`: Set of IPs with open detail panels
- `hashrateHistory`: Array of {time, value, online, offline} for chart
- `tempUnit`: "C" or "F"
- `fontScale`: 1 or 1.15
- `tutorialDone`: Boolean
- `lastSubnet`: Last scanned subnet

### Performance
- **In-place card updates**: `updateCardsInPlace()` updates DOM values without rebuilding cards during refresh
- **Batched network scan**: 25 concurrent requests per batch
- **15-second polling interval**: Auto-refresh with state preservation
- **CSS Grid with `align-items: start`**: Cards expand independently without affecting neighbors
- **Canvas chart**: Hardware-accelerated rendering with DPI awareness

### Security
- **Content Security Policy**: `script-src 'self'; object-src 'self'` - no inline scripts
- **No external dependencies**: All code is self-contained (fonts loaded from Google CDN only)
- **Input sanitization**: `esc()` function for all user-provided text in HTML
- **Character validation**: Device names restricted to `[a-zA-Z0-9 _-]` to prevent worker name issues with mining pools
