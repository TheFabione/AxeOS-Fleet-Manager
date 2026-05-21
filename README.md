# ⛏ AxeOS Fleet Manager

**Manage and monitor your entire BitAxe & NerdQAxe SHA-256 mining fleet from one Chrome extension.**

Scan your local network, watch hashrate and difficulty in real time, switch pools across multiple devices at once, and automate routine maintenance — all without opening a single device web page.

![Version](https://img.shields.io/badge/version-1.0.11-06B6D4) ![Manifest](https://img.shields.io/badge/Manifest-V3-blue) ![Devices](https://img.shields.io/badge/devices-BitAxe%20%7C%20NerdQAxe-f7931a)

---

## Why?

Running more than one BitAxe or NerdQAxe quickly becomes tedious — each device has its own web page, its own login session, and its own settings. Changing a pool on five miners means five tabs, five forms, five restarts.

AxeOS Fleet Manager pulls every device into a single dashboard. One place to see everything, one place to change everything.

---

## Features

### Monitoring
- **Auto-discovery** — scan your subnet to find every device, or add them manually by IP
- **Live dashboard** — hashrate, best difficulty, and temperature front-and-center on each device card; expand for full details (power, fan, shares, firmware, voltages, uptime, WiFi)
- **Fleet overview** — total hashrate, accepted/rejected shares, power draw, average temperature, and best difficulty at a glance
- **Fleet Hashrate chart** — interactive history with hover tooltips and online/offline device counts
- **Live Difficulty chart** — a real-time, fluctuating view of the difficulty your devices produce each interval, with gradient fills, highlighted peaks, and a per-device toggle

### Control
- **Pool Manager** — save unlimited pool profiles per coin; apply to multiple devices in one click with a live progress bar and per-device status icons
- **Smart URL parsing** — paste `stratum+tcp://host:port` and the host and port are split automatically
- **Worker suffixes** — device names are appended to your wallet automatically (`wallet.devicename`)
- **Per-device settings** — fan control, frequency, voltage, and pool configuration
- **Separate fallback coin** — your backup pool can mine a different coin than your primary

### Automations
- **Watchdog** — auto-restart any device stuck at 0 GH/s past a timeout you set
- **Overheat Protection** — auto-restart devices that cross a temperature limit
- **Pool Rotation** — cycle selected devices through multiple pools on a schedule
- Every action is logged, and all settings save instantly

### Organization & Accessibility
- **Custom labels** — up to two colored tags per device, usable as filters
- **Sorting** — by hashrate, difficulty, temperature, uptime, name, or IP, plus drag-and-drop custom order with a lock
- **6 themes** — 3 dark (Tech Midnight, Slate Neon, Material Dark) and 3 light (Cloud Cyan, Silk Violet, Paper Teal)
- **°C / °F toggle** and **font scaling** for comfortable viewing
- **Built-in User Guide** — full documentation inside the dashboard

---

## Installation

1. Download the latest `axe-fleet-manager-vX.X.X.zip` from the [Releases](../../releases) page and unzip it.
2. Open `chrome://extensions` in Chrome (or any Chromium browser).
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked** and select the unzipped folder.
5. Click the extension icon, open the dashboard, and follow the setup wizard.

> Requires devices running AxeOS firmware reachable on your local network.

---

## Getting Started

When you first open the dashboard, a short setup wizard walks you through finding your devices.

**Finding your subnet:** your subnet is the first three parts of a device's IP address.
- **Windows** — open Command Prompt, type `ipconfig`, look at the IPv4 Address.
- **macOS** — System Settings → Network → look for your IP Address.
- If a device is at `192.168.1.42`, your subnet is `192.168.1`.

Enter that, scan, and your devices appear. Rename them, tag them, and you're ready to manage pools and automations.

---

## How It Works

AxeOS devices protect write operations (changing pools, restarting) with a session cookie to prevent CSRF attacks. A browser extension runs on its own origin and can't send that cookie cross-site, which is why naive approaches return `401 Unauthorized`.

AxeOS Fleet Manager solves this by briefly opening the device's own page in a background tab and running the request from inside that page's context — same-origin, with the session cookie attached automatically. The tab opens and closes in a flash; you just see the action succeed. Read-only monitoring uses ordinary direct requests.

The extension is built on **Manifest V3** with a service worker for network scanning and reads, and all write actions routed through the tab-injection mechanism. No external runtime dependencies.

---

## Supported Devices

- **BitAxe** (all AxeOS models)
- **NerdQAxe / NerdQAxe++**

> Note: NerdQAxe firmware has deprecated automatic fan control, so the extension exposes manual fan speed only for those devices.

---

## Privacy

Everything runs locally. The extension talks only to your devices on your LAN and stores all settings in your browser's local storage. No telemetry, no external servers, no ads.

---

## Support Development

If this tool saves you time, donations are welcome via the heart icon in the dashboard:

- **BTC** · **BCH** · **DGB** · **LTC**

Each address has a one-click copy button in the app.

---

## Documentation

- [CHANGELOG](CHANGELOG.md) — full version history
- [FEATURES](FEATURES.md) — complete feature and architecture reference
- In-app User Guide — click the **?** icon in the top bar

---

*AxeOS Fleet Manager is an independent, open-source tool and is not affiliated with the BitAxe or NerdQAxe projects.*
