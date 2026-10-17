# AxeOS Fleet Manager v2.1.1 - Complete Redesign, Pool Directory, Nine Automations

The biggest update so far. Version 2 rebuilds the whole interface from scratch, fixes a 1.x bug that could wipe your device list on update, and adds a ready-made pool directory, five new automations and a share difficulty chart that finally shows your big hits. If you're on v1.6.7 or v1.6.8, this brings everything from v2.0.0 through v2.1.1 in one update.

## ⚠️ Before you update

Chrome keeps an unpacked extension's data per folder.

- **To keep your devices, pools and settings:** replace the files inside the folder you originally loaded, then press reload on `chrome://extensions`.
- **If you load v2.1.1 from a new folder**, Chrome installs a second copy with empty storage. Export your devices and pools from your 1.x version first (the export buttons in the device toolbar and in the Pool Manager), then import them in the new copy.
- Chrome asks you to re-enable the extension once, because v2 adds the `notifications` permission.
- Requires **Chrome 116** or later (or any Chromium browser of the same age).

## 🎨 A new interface

- **Four sections** in a side rail: Fleet, Pools, Automations and History, with Guide, Settings and Support at the bottom. On phones and narrow windows the rail becomes a bottom tab bar.
- **Fleet view**: a large fleet hashrate readout with 1h and 24h averages, a Hashrate / Share difficulty chart, six stat tiles (online and uptime, power and J/TH, energy cost per day, temperatures, shares and reject rate, best difficulty) and the health strip.
- **Device cards** in three densities: Compact rows for big fleets, Standard cards, or Detailed cards with a one-hour sparkline. One ⋯ menu per card for rename, labels, icon, web page, identify, copy IP and remove. Offline cards show how long they've been down.
- **New default theme "Circuit"** and a light theme **"Daylight"**. Neon Vault and Aurora are still there. Upgrading switches you to Circuit once; pick another in Settings.
- **Settings** in one place: theme, text size, °C/°F, refresh interval (5 s to 1 min), electricity price, desktop alerts, toolbar badge, full backup.
- Rewritten setup tour and in-app guide.

## 🏊 Pool directory

- **Pools → Pool directory** lists well-known pools for BitAxe and NerdQAxe: Public Pool, Solo CKPool (US/EU/AU), AtlasPool, Noderunners, bitaxe.de, SoloPool.eu and Braiins Solo for BTC solo mining; OCEAN and Braiins Pool for pooled mining; and SHA-256 altcoin pools for BCH, DGB, XEC and PPC.
- **Add** opens the pool editor with the address filled in. If you already saved a pool for that coin, your wallet is filled in too.
- **Keeps itself current**: point *Update source* at a JSON file you host (a raw GitHub link works) and the list is checked once a day and whenever you press *Update list*. The file format is the bundled `pool-catalog.json`.
- **Solo / Pooled tags** for your own pools too, chosen in the pool editor, inherited from the directory, or suggested when the address matches a known pool.

## 🤖 Nine automations

Redesigned as one grid of identical cards. Each card shows its key settings, how many miners it watches and a live status; click it for the settings dialog. Recent automation actions are listed underneath.

- **Watchdog** - restart a miner stuck at 0 GH/s
- **Hashrate drop** *(new)* - restart or alert when a miner runs well below its normal hashrate for a while
- **Back to primary pool** *(new)* - restart a miner stuck on its fallback pool so it reconnects to the primary
- **Flap recovery** - restart a board that keeps dropping offline and coming back
- **Reject rate** *(new)* - alert or restart when too many shares are rejected over a rolling window
- **Overheat protection** - now with a cooldown, so a hot room can't cause a restart loop
- **Quiet hours** *(new)* - lower fans at night and restore each miner's own setting in the morning, with a heat safety limit
- **Daily restart** *(new)* - restart chosen miners once a day at a set time
- **Pool rotation** - move miners through two or more saved pools on a schedule

## 📈 Share difficulty, rebuilt

The old chart plotted *accepted shares × pool difficulty* per refresh, so a 5G share counted the same as any other and never stood out. The new chart records every share that beats a miner's **session best**, at its **exact difficulty**:

- Logarithmic scale, so 10K and 5G shares are both readable
- Gold dot for a new best ever
- Reference lines for the pool floor, session best, best ever and the **block** line (network difficulty)
- Hover a dot to see how far it was from a block
- Time range: last hour, 24 hours, 7 days or all time
- **Stream live shares** for one miner shows every single share on the same scale

## ✨ Also new

- **Device search** (press `/`) and an Offline filter
- **Select mode** with a bulk bar: apply a pool, restart or remove several miners at once
- **Energy cost** per day and fleet efficiency in J/TH
- **Desktop notifications** when the dashboard is in the background: offline / back online, block found, automation actions
- **Toolbar badge** with the online count, or the offline count in red
- **Full backup and restore** of devices, names, labels, icons, pools, automations and settings
- **Live log**: filter, pause without losing lines, save to `.txt`, colour-coded lines
- **Keyboard shortcuts**: `/` search, `R` refresh, `1`-`4` sections, `?` guide
- **Redesigned popup** with fleet hashrate and a device list; "Open dashboard" focuses the tab you already have open

## 🐛 Important fixes

- **Data loss on update**: the 1.x service worker reset storage every time the extension was updated or reloaded, wiping the device list. v2 only fills in missing defaults and never overwrites your data.
- **Flap recovery settings could fail to save** in the last 1.x builds (they were read after the save). Fixed.
- **Pool rotation on NerdQAxe** now sends the full writable settings, so other settings aren't reset.
- Removing a device now also removes its name, labels, icon, history and automation selections.
- Live stream tabs are cleaned up when the dashboard closes, and survive the service worker being stopped.
- Text size no longer uses `zoom`, so charts and menus stay aligned at every size.

## Install

1. Download `axe-fleet-manager-v2.1.1.zip` below and unzip it
2. Go to `chrome://extensions` and enable **Developer mode**
3. Updating? Read **Before you update** above. New install: click **Load unpacked**, select the unzipped folder, open the dashboard and follow the tour

SHA-256 of `axe-fleet-manager-v2.1.1.zip`:

```
06e1816242fdb50cacca9f41fdf60b38313b130f81587f2ec42f97364ce3b7eb
```

## Notes

- Works with BitAxe (including Supra) and NerdQAxe devices running AxeOS / ESP-Miner firmware on your local network
- Charts, alerts and automations run while the dashboard tab is open; pin it
- Everything runs locally. Besides your miners, the extension only loads Google Fonts and, if you set one, your pool directory source

Full per-version detail in [CHANGELOG.md](CHANGELOG.md).
