# AxeOS Fleet Manager — Changelog

## v1.0.0 — Release (March 2026)
- Removed auto-fan option for NerdQAxe (deprecated in firmware; manual speed only)
- Offline device cards now show a subtle red tint matching the active theme
- Added copy buttons for each donation address
- Created changelog and features documentation

## v0.99.3
- **Font scale fix**: Switched from CSS `font-size` to `zoom` — now actually scales all UI elements when pressing Aa+
- **NerdQAxe auto-fan**: Clarified that auto-fan is deprecated in NerdQAxe firmware (AFC removed). Extension now sends `manualFanSpeed: 100` and shows an informational note

## v0.99.2
- **BitAxe fan fix (manual speed)**: Fixed field name — BitAxe firmware expects `manualfanspeed` (lowercase), not `fanSpeed`
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
- **CSRF 401 fix — Tab Injection**: All write operations (PATCH, restart, identify) now use `chrome.scripting.executeScript` to inject fetch calls into a background tab opened to the device. This runs same-origin with the device's session cookie, bypassing the CSRF protection that blocked direct cross-origin requests from the extension
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
