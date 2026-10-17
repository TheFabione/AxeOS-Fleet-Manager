# AxeOS Fleet Manager v2.3.0 - Heat Slowdown, Share Minimum, Share Recording

Two changes driven by how miners behave after a few days of running: they hit the firmware's chip cut-off, and new session bests become rare.

## 🌡 Heat slowdown now watches the chip too

The firmware stops hashing when the **chip passes about 70 °C**, not only when the voltage regulator gets too hot, and starts again once it cools. On a hot miner that becomes a loop.

The automation formerly called **VR overheat** is now **Heat slowdown** and watches both sensors:

- **Chip limit** (default 67 °C, a few degrees under the cut-off) and **VR limit** (default 80 °C)
- **Watch**: chip and VR, chip only, or VR only
- Recognises the cut-off itself: a drop to ~0 GH/s shortly after the chip or the VR ran close to its limit
- Same stepping as before: frequency first, voltage once frequency reaches its floor, with floors, a wait between steps and one-click restore of the original settings

Your existing settings are kept and the chip limit is added automatically.

**Overheat protection** (the restart automation) now defaults to 68 °C, and warns when its limit is at or above 70 °C, where it could never trigger.

## 📈 Share difficulty: minimum and recording

The chart plots shares that beat a session best. That's busy right after a restart and sparse after a few days, because every new session best has to beat the last one.

- **Minimum difficulty**: a new button next to the time range. Type `1M`, `500K`, `2.5G` or pick a preset; everything below is hidden and the level is drawn on the chart.
- **Record every share above the minimum**: the dashboard reads each miner's log as it happens and plots **every submitted share** at or above your minimum, not only new session bests. The miners' pages open in one minimized browser window, the same way the live log works; connections come back after reboots and the window closes with the dashboard.
- The popover estimates how many shares an hour your fleet will find at the level you pick. The chart keeps the last 5,000.

## 🛠 For contributors

The repository now includes `CLAUDE.md` and two Claude Code skills: `/prepare-release` drafts the version bump, changelog and release notes, and `/release` checks the project, builds a reproducible zip with its checksum, then commits, tags, pushes and publishes the GitHub release. The build script (`scripts/build-release.mjs`) needs only Node.js. See [docs/RELEASING.md](docs/RELEASING.md).

## Install

1. Download `axe-fleet-manager-v2.3.0.zip` below and unzip it
2. **Updating:** replace the files in the folder you originally loaded, then press reload on `chrome://extensions` (loading from a new folder starts with empty storage). **New install:** enable Developer mode, click **Load unpacked** and select the folder

SHA-256 of `axe-fleet-manager-v2.3.0.zip`:

```
235feb37ea7de0314754ea7e47d0edb34a53bcca9fd9a5ce11c33846c5b32439
```

Coming from 1.x? See the [v2.1.1 release notes](RELEASE_v2_1_1.md) for everything in the 2.x redesign. Full per-version detail in [CHANGELOG.md](CHANGELOG.md).
