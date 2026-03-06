# AxeOS Fleet Manager — Features & Architecture

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

### Pool Management
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

### Themes & Accessibility
- **10 color themes**: 5 dark (Midnight Orange, Cyber Green, Deep Purple, Crimson Night, Arctic Blue) + 5 light (Clean Amber, Mint Fresh, Soft Lavender, Paper Rose, Sky Slate)
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
- **themes.css**: 10 theme definitions using CSS custom properties
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
- **Content Security Policy**: `script-src 'self'; object-src 'self'` — no inline scripts
- **No external dependencies**: All code is self-contained (fonts loaded from Google CDN only)
- **Input sanitization**: `esc()` function for all user-provided text in HTML
- **Character validation**: Device names restricted to `[a-zA-Z0-9 _-]` to prevent worker name issues with mining pools
