# AxeOS Fleet Manager v1.0.11 — Automations, Live Difficulty & Polish

The first stable release of AxeOS Fleet Manager is here, plus eleven rounds of refinements. Manage your entire BitAxe and NerdQAxe SHA-256 mining fleet from a single Chrome extension — scan your network, monitor hashrates and difficulty in real time, switch pools across devices, and automate maintenance.

This release consolidates everything from the initial **v1.0** through **v1.0.11**.

---

## Highlights

- **Automations engine** — Watchdog auto-reboot, overheat protection, and scheduled pool rotation
- **Live Difficulty chart** — a real-time, fluctuating view of the mining work your devices produce, fully interactive
- **Automatic CSRF handling** — write operations (pool changes, restarts) work seamlessly via the device's own session
- **6 hand-picked themes** — 3 dark, 3 light
- **In-app User Guide** — full documentation built into the dashboard

---

## What's New (v1.0 → v1.0.11)

### Automations (v1.0.1 – v1.0.2)
- **Watchdog (Auto-Reboot)**: Automatically restarts any device stuck at 0 GH/s for a configurable timeout (default 5 minutes), per-device.
- **Overheat Protection**: Restarts devices that exceed a temperature threshold (default 75°C), per-device.
- **Pool Rotation**: Cycles selected devices through a set of saved pools at a configurable interval (in hours). Rotation state persists across reloads.
- **Auto-save**: Every automation setting saves instantly — no save button to forget.
- **Live status indicators** and **activity logging** for every automation action.
- Panel lives on the left, stacked under Pools, with a clean card-based two-column layout.

### Live Difficulty Chart (v1.0.3, v1.0.10 – v1.0.11)
- Brand-new second chart in a **swipeable carousel** alongside Fleet Hashrate (navigate with the arrows or dots).
- Plots the **difficulty produced per interval** — calculated from new shares submitted × pool difficulty — so it fluctuates in real time and spikes when a device has a productive window.
- **Gradient area fill** and **highlighted peaks** for an at-a-glance read of mining output.
- **Fully interactive**: hover for a crosshair, highlighted points, and a tooltip showing total difficulty plus a per-device breakdown (or pool difficulty in single-device view).
- **Per-device toggle**: view all devices at once (color-coded) or focus on a single one.
- Fleet Hashrate chart is now taller and more responsive to changes.

### Themes (v1.0.4)
Replaced the old theme set with six carefully designed options:
- **Dark**: Tech Midnight (cyan/navy), Slate Neon (purple/charcoal), Material Dark (muted purple/teal)
- **Light**: Cloud Cyan, Silk Violet, Paper Teal — each a complement to its dark counterpart
- Default theme is now Tech Midnight.

### User Guide (v1.0.2)
- New help button in the top bar opens an in-app guide with sidebar navigation.
- Sections: Getting Started, Device Cards, Pool Manager, Device Settings, Automations, Top Bar Controls.

### Quality-of-life
- **Subnet help tooltip** in onboarding and the scan popover, explaining what a subnet is and how to find yours (v1.0.5 – v1.0.6).
- **Donation copy buttons** for each address; updated LTC and DGB wallets (v1.0, v1.0.3).
- **Offline cards** now show a subtle red tint matching the active theme (v1.0).
- **Chart history persistence** — graphs survive page reloads (carried through this series).

---

## Bug Fixes

- **Live Difficulty was blank** — fixed a missing `diffHistory` variable declaration that broke the chart and stalled the device dropdown until reload (v1.0.9). Also fixed a canvas-sizing issue caused by hidden slides having zero dimensions (v1.0.6), and an internal variable-shadowing bug in the chart renderer (v1.0.4).
- **Pool coin selection reset to Bitcoin** while adding a pool whenever the background refreshed — the dropdown now preserves your choice (v1.0.11, building on v0.99.2).
- **Extension failed to load** for users upgrading from older versions: a stored theme that no longer existed left the UI unstyled and unclickable. Theme is now validated with a safe fallback, and the entire init sequence is hardened so a single failure can't break the dashboard (v1.0.7 – v1.0.8).
- **Duplicate tooltip** on the subnet help icon (native + custom) — now a single styled tooltip (v1.0.6).
- **User Guide layout** — content no longer collapses below the navigation; the two-pane layout renders correctly (v1.0.3).
- **Saved pools list** — fixed scrolling when more than two pools are saved, without shrinking the apply section below (v1.0.3).
- **NerdQAxe auto-fan** — removed from the UI for NerdQAxe, since it's deprecated in firmware; manual speed control remains (v1.0).

---

## Installation

1. Download and unzip `axe-fleet-manager-v1.0.11.zip`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. Open the extension and follow the setup wizard to scan for your devices.

> **Upgrading from a pre-1.0.7 build?** This release auto-corrects the stored-theme issue that previously broke the dashboard — no need to clear data or reinstall.

---

## Notes

- Works with BitAxe and NerdQAxe devices running AxeOS firmware on your local network.
- The Live Difficulty chart needs two poll cycles (about 30 seconds) before it starts plotting.
- If you find this tool useful, donation addresses (BTC, BCH, DGB, LTC) are available via the heart icon in the top bar.
