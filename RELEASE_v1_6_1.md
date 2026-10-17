# AxeOS Fleet Manager v1.6.1 - Live Monitoring, New Look, Smart Cards

This is a huge release. Since v1.0.11 the extension has gained real-time WebSocket streaming, full block detection, an uptime monitor, a complete visual redesign, and configurable card layouts - while staying a zero-backend, install-and-go Chrome extension for your BitAxe and NerdQAxe fleet.

If you're upgrading from v1.0.11, here's everything that's new.

## ⚡ Real-time WebSocket streaming

**Live device logs** - Hit the 📜 button on any device card to open a real-time log console, streamed straight from the miner. Pause, clear, and smart auto-scroll included. Because the extension page can't open an insecure `ws://` connection directly, the WebSocket runs inside the device's own page (the same way the AxeOS web UI does it) and relays each line back - so it just works, on both device types.

**Live difficulty** - The difficulty chart now has a ⚡ Live mode. Pick a single device and watch the real difficulty of every share land in real time, one point at a time. Most shares cluster near the pool target, and every so often a big one spikes - it's oddly addictive. Works on both BitAxe (`diff X of Y`) and NerdQAxe (`diff X/Y`) log formats.

## 🏆 Block detection

When one of your devices solves a block, you get a celebration - confetti, the device, the coin, the pool, and the **actual difficulty your miner reached** to find it (its session best, which is the difficulty of the winning share - not the pool target). Every block is saved to a persistent history behind the navbar trophy, which carries an unread-style counter that clears when you open it. Block moments are also marked on the Fleet Hashrate chart.

## 📊 Uptime monitor

A persistent status bar under the navbar tracks fleet health at a glance: a health ring showing how many devices are online, per-device status segments, and a right-to-left ticker of recent offline/recovery events. Open the full history for timestamped downtime with durations. Everything persists across restarts.

## 🎨 Neon Vault - a complete visual overhaul

The whole interface was redesigned with a vibrant modern-crypto aesthetic: new typography (Syne, Sora, Space Mono), bigger interactive charts, and a punchier layout. The theme list was trimmed to two carefully finished options - **Neon Vault** (dark) and **Solar Light** (light) - and the extension has a new matching icon.

The device cards, uptime bar, and block celebration were each given a ground-up redesign in v1.6.0.

## 🃏 Three card view modes (new in v1.6.1)

A toggle in the device controls switches the level of detail, and your choice is remembered:

- **Minimal** - name, current hashrate, best difficulty. Compact, for large fleets.
- **Balanced** - adds 1h average, session difficulty, temperature, and fan.
- **Detailed** - adds a live hashrate sparkline, power, efficiency (J/TH), connected pool, and accepted/rejected shares.

All card tools stay available in every mode.

## 🛠 Other improvements

- **Pool import/export** - back up your saved pools to a JSON file and restore them anywhere (duplicates are skipped)
- **24h hashrate on BitAxe** - these devices don't expose a 24h field, so the card now falls back to the 1h average instead of showing 0
- Colored activity-log badges, properly styled Pool Manager buttons, aligned checkboxes, and many layout fixes
- Resilient polling that no longer logs "message channel closed" noise when the service worker restarts

## Install

1. Download `axe-fleet-manager-v1.6.1.zip` below and unzip it
2. Go to `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder
4. Open the dashboard, enter your subnet (e.g. `192.168.1`), and scan

## Notes

- Works with BitAxe and NerdQAxe devices running AxeOS / ESP-Miner firmware on your local network
- Everything runs locally in your browser - no accounts, no servers, no telemetry
- Live monitoring requires the browser to be open; this is a desk companion, not a 24/7 headless watchdog

Full details in [CHANGELOG.md](CHANGELOG.md).
