# AxeOS Fleet Manager v1.6.7 - Quality of Life, New Theme, Smarter Live View

A focused follow-up to v1.6.1 that polishes the recent UI overhaul, adds a fourth automation, and brings real fixes for newer firmware. If you're on v1.6.1, this brings everything from v1.6.2 through v1.6.7 in one update.

## ✨ Highlights since v1.6.1

### Aurora - a second dark theme
Solar Light has been retired in favor of **Aurora**: cyan + magenta + amber on deep midnight navy. It's a synthwave/aurora-borealis vibe, completely distinct from Neon Vault but built with the same care - every component, chart, modal, and sparkline updates consistently.

### Flap Recovery automation
Some boards enter an unstable offline/online cycle that a simple restart usually clears. The new **Flap Recovery** automation watches recovery events and, if a device flaps more than N times within a window you configure, automatically restarts it once it's reachable again - never on the first hiccup, never in a loop (built-in cooldown).

### Device export / import
Back up your entire device list - IPs, nicknames, labels, custom icons, custom order - to a JSON file with one click, and restore it on a fresh install. No more renaming and re-labelling every time you update the extension. New icons live in the device controls bar; unreachable IPs are kept as placeholders so their metadata applies the moment they come back online.

### Custom device icons
Click the icon on any device card to pick from 10 options (axe, chip, CPU, server, rocket, flame, bolt, diamond, pickaxe, star), or reset to default. Per-device and persistent.

### Better Live Difficulty
The chart now reflects the device's true session best even when the live stream hasn't captured a high share yet:
- A dashed reference line at the device's `bestSessionDiff`, with a label
- The Y axis auto-extends to include it
- Live mode seeds an initial point at the current session best so it's visible from the start
- Buffer doubled to 600 points

### Block badge and history modals
The trophy counter now sits as a small circular badge at the bottom-left of the icon (no more squashing). The **Blocks Found** modal gives each block its own card with the achieved difficulty highlighted. The **Uptime History** modal got the same treatment: colored left border by status (red while offline, green once recovered), OFFLINE/RECOVERED badges, separate Offline/Back time columns, and downtime duration in a clean pill on the right.

### BitAxe Supra support
The newer Supra firmware only exposes the current hashrate (no `hashRate_1h` etc.). The 1h and 24h averages now fall back to a rolling average computed locally from the dashboard's own sample buffer (sized for one hour of history), so Supra devices populate properly after a few minutes of dashboard uptime.

### Label system, fully fixed
The label popup got its CSS back (it had been lost in the v1.4 redesign): visible color picker with checkmark on the selection, ✕ delete on each existing label, solid background, and a clear close button. Custom label filter chips in the device header are now properly colored pills.

## 🔧 Other improvements

- Help guide refreshed with new sections (Live Monitoring, Blocks & Uptime) and updated content throughout
- Pool Manager now shows offline devices with a red border and disabled checkbox instead of hiding them
- Live logs, Live Difficulty, Restart, and Settings show a clear toast when used on an offline device
- Sparkline mini-charts now persist across page reloads, redraw immediately on theme change or °C/°F toggle, and have a dynamic up/down/flat arrow next to "1h avg"
- Chart hover tooltips now align correctly at every font-scale setting
- Applying a pool through the Pool Manager refreshes device details in real time, whether or not "Restart device" is checked
- Theme dropdown no longer shows an empty category label

## 🐛 Critical fixes

- **v1.6.5**: the OFFLINE pill no longer persists on a card after the device comes back online
- **v1.6.5**: the Fleet Hashrate and Live Difficulty charts now have identical heights
- **v1.6.6 hotfix**: chart cards no longer grow vertically without bound when hovering (was caused by a flex layout conflict introduced in v1.6.5)

## Install

1. Download `axe-fleet-manager-v1.6.7.zip` below and unzip it
2. Go to `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder
4. If you already had an older version installed: remove it first, install v1.6.7, then in the device controls click the **import** icon to restore your fleet from a JSON backup. Otherwise, open the dashboard and follow the setup wizard.

## Notes

- Works with BitAxe (including Supra) and NerdQAxe devices running AxeOS / ESP-Miner firmware on your local network
- Everything runs locally - no accounts, no servers, no telemetry
- The live monitoring features require the browser to be open

Full per-version detail in [CHANGELOG.md](CHANGELOG.md).
