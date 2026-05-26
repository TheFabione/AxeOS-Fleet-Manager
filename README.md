# ⛏ AxeOS Fleet Manager

**Manage and monitor your entire BitAxe & NerdQAxe SHA-256 mining fleet from one Chrome extension.**

Scan your local network, watch hashrate and difficulty in real time, stream live device logs, catch the moment you solve a block, switch pools across multiple devices at once, and automate routine maintenance - all without opening a single device web page.

![Version](https://img.shields.io/badge/version-1.6.1-C8F73A) ![Manifest](https://img.shields.io/badge/Manifest-V3-blue) ![Devices](https://img.shields.io/badge/devices-BitAxe%20%7C%20NerdQAxe-8B5CF6)

---

## Why?

Running more than one BitAxe or NerdQAxe quickly becomes tedious - each device has its own web page, its own login session, and its own settings. Changing a pool on five miners means five tabs, five forms, five restarts.

AxeOS Fleet Manager pulls every device into a single dashboard. One place to see everything, one place to change everything.

---

## Features

### Monitoring
- **Auto-discovery** - scan your subnet to find every device, or add them manually by IP
- **Live device cards** - three view modes (Minimal, Balanced, Detailed) let you choose how much each card shows, from a compact name-and-hashrate strip up to a full readout with a live hashrate sparkline, efficiency (J/TH), power, pool, and share counts
- **Live logs** - open a real-time log console for any device, streamed over WebSocket, with pause, clear, and smart auto-scroll
- **Live difficulty** - stream the real per-share difficulty of a device and watch every share land in real time
- **Fleet overview** - total hashrate, accepted/rejected shares, power draw, average temperature, and best difficulty at a glance
- **Fleet Hashrate chart** - interactive history with hover tooltips, online/offline counts, and block-found markers
- **Uptime monitor** - a persistent status bar that tracks which devices go offline and when they recover, with full timestamped history

### Block detection
- **Catch your blocks** - when a device solves a block you get a celebration with confetti and the details, including the **actual difficulty your miner reached** to find it
- **Block history** - every block is saved behind the navbar trophy, with an unread-style counter and markers on the hashrate chart

### Control
- **Pool Manager** - save unlimited pool profiles per coin; apply to multiple devices in one click with a live progress bar and per-device status icons
- **Pool import/export** - back up your saved pools to a JSON file and restore them anywhere
- **Smart URL parsing** - paste `stratum+tcp://host:port` and the host and port are split automatically
- **Worker suffixes** - device names are appended to your wallet automatically (`wallet.devicename`)
- **Per-device settings** - fan control, frequency, voltage, and pool configuration
- **Separate fallback coin** - your backup pool can mine a different coin than your primary

### Automations
- **Watchdog** - auto-restart any device stuck at 0 GH/s past a timeout you set
- **Overheat Protection** - auto-restart devices that cross a temperature limit
- **Pool Rotation** - cycle selected devices through multiple pools on a schedule
- Every action is logged, and all settings save instantly

### Organization & Accessibility
- **Custom labels** - up to two colored tags per device, usable as filters
- **Sorting** - by hashrate, difficulty, temperature, uptime, name, or IP, plus drag-and-drop custom order with a lock
- **Two finished themes** - **Neon Vault** (dark) and **Solar Light** (light)
- **°C / °F toggle** and **font scaling** for comfortable viewing
- **Built-in User Guide** - full documentation inside the dashboard

---

## Installation

1. Download the latest `axe-fleet-manager-vX.X.X.zip` from the [Releases](../../releases) page and unzip it.
2. Open `chrome://extensions` in Chrome (or any Chromium browser).
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked** and select the unzipped folder.
5. Click the extension icon, open the dashboard, and follow the setup wizard.

> Requires devices running AxeOS / ESP-Miner firmware reachable on your local network.

---

## Getting Started

When you first open the dashboard, a short setup wizard walks you through finding your devices.

**Finding your subnet:** your subnet is the first three parts of a device's IP address.
- **Windows** - open Command Prompt, type `ipconfig`, look at the IPv4 Address.
- **macOS** - System Settings → Network → look for your IP Address.
- If a device is at `192.168.1.42`, your subnet is `192.168.1`.

Enter that, scan, and your devices appear. Rename them, tag them, and you're ready to manage pools and automations.

---

## How It Works

AxeOS devices protect write operations (changing pools, restarting) with a session cookie to prevent CSRF attacks. A browser extension runs on its own origin and can't send that cookie cross-site, which is why naive approaches return `401 Unauthorized`.

AxeOS Fleet Manager solves this by briefly opening the device's own page in a background tab and running the request from inside that page's context - same-origin, with the session cookie attached automatically. The tab opens and closes in a flash; you just see the action succeed. Read-only monitoring uses ordinary direct requests.

The same technique powers live streaming: an insecure `ws://` WebSocket can't be opened from the extension's secure origin, so live logs and live difficulty run the WebSocket inside the device's own page and relay each line back to the dashboard - exactly how the device's own web UI streams its logs.

The extension is built on **Manifest V3** with a service worker for network scanning and reads, and all write and streaming actions routed through the tab-injection mechanism. No external runtime dependencies.

---

## Supported Devices

- **BitAxe** (all AxeOS models)
- **NerdQAxe / NerdQAxe++**

> Notes: NerdQAxe firmware has deprecated automatic fan control, so the extension exposes manual fan speed only for those devices. BitAxe firmware does not expose a 24-hour hashrate average, so its cards fall back to the 1-hour average.

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

- [CHANGELOG](CHANGELOG.md) - full version history
- [FEATURES](FEATURES.md) - complete feature and architecture reference
- In-app User Guide - click the **?** icon in the top bar

---

*AxeOS Fleet Manager is an independent, open-source tool and is not affiliated with the BitAxe or NerdQAxe projects.*
