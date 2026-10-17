# AxeOS Fleet Manager v2.2.0 - Shares Stalled and VR Overheat

Two new automations for problems a Watchdog restart can't see or can't fix. Eleven automations in total.

## ⚡ Shares stalled

Sometimes a miner keeps hashing normally but stops sending shares to the pool; a restart clears it. **Shares stalled** watches the accepted and rejected counters and restarts a miner whose counters stop moving while it still reports hashrate.

- Default: no shares for 10 minutes, then at most one restart every 30 minutes
- The wait is never shorter than **10× the expected time between shares** at the current pool difficulty and hashrate, so a high pool difficulty can't cause a false restart
- The card shows the slowest expected share interval across your miners, and how long a stalled miner has been silent

## 🌡 VR overheat

When the voltage regulator gets too hot, the firmware drops the miner to 0 GH/s to cool it down. It comes back, heats up again, and loops. Restarting doesn't help; running slower does.

- Triggers when the VR temperature passes your limit (default 80 °C), or when the miner drops to ~0 GH/s shortly after its VR ran close to it
- Lowers **frequency** one step at a time (default 25 MHz); with the default mode, **core voltage** (10 mV steps) only once frequency reaches its floor. "Frequency only" and "Both together" are also available
- Floors for both (default 400 MHz, 1050 mV), a wait between steps (default 15 min) and an optional restart to apply
- Remembers each miner's **original frequency and voltage**: restore them with one click in the dialog, or let the automation raise them back step by step after the VR has stayed cool for the hours you choose
- Alerts you if a miner is still too hot at the lowest settings, so you know it's a cooling problem

## Install

1. Download `axe-fleet-manager-v2.2.0.zip` below and unzip it
2. **Updating:** replace the files in the folder you originally loaded, then press reload on `chrome://extensions` (loading from a new folder starts with empty storage). **New install:** enable Developer mode, click **Load unpacked** and select the folder

SHA-256 of `axe-fleet-manager-v2.2.0.zip`:

```
03895bb4eec1cd22765f4a5df7db9fa4d063707bb8cea4d409cd298ffbf5cd2d
```

Coming from 1.x? See the [v2.1.1 release notes](RELEASE_v2_1_1.md) for everything in the 2.x redesign. Full per-version detail in [CHANGELOG.md](CHANGELOG.md).
