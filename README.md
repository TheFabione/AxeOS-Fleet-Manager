AxeOS Fleet Manager v1.0.0 - Initial Release 🚀



Welcome to the first official release of \*\*AxeOS Fleet Manager\*\*! 



This browser extension (compatible with Chrome, Edge, and Firefox) provides a clean, unified dashboard to monitor and manage your local fleet of Bitaxe and NerdQAxe miners directly from your browser. Everything runs 100% locally on your network.



\### 🎉 Key Features in v1.0.0



\*\*Discovery \& Dashboard\*\*

\*   \*\*Auto-Discovery:\*\* Scan your /24 subnet to instantly find mining devices.

\*   \*\*Live Metrics:\*\* Real-time device cards showing current hashrate, temperatures, 1h/24h averages, power draw, and accepted/rejected shares.

\*   \*\*Interactive Chart:\*\* Fleet-wide hashrate graph that persists data across page reloads.

\*   \*\*Customization:\*\* Assign custom nicknames and colored labels to keep your test rigs and production boards organized.



\*\*Pool \& Device Management\*\*

\*   \*\*Pool Manager:\*\* Save configurations for up to 16 SHA256 coins, complete with smart URL parsing and automatic `.devicename` worker suffixes.

\*   \*\*Bulk Apply:\*\* Push pool settings to multiple devices at once with optional auto-restart.

\*   \*\*Hardware Tweaks:\*\* Adjust fan speeds, core voltage (mV), and frequency (MHz) per device.



\*\*UI \& Accessibility\*\*

\*   \*\*10 Color Themes:\*\* Includes 5 dark themes (Midnight Orange, Cyber Green, etc.) and 5 light themes.

\*   \*\*Sorting:\*\* Sort your fleet by hashrate, temperature, or use the drag-and-drop custom order feature (with lock).

\*   \*\*First-Run Wizard:\*\* An interactive 6-step setup guide to get you started smoothly.



\### 🔒 Privacy \& Architecture

\*   \*\*Zero Tracking:\*\* No analytics, no telemetry, and no external servers. Data is saved strictly via `chrome.storage.local`.

\*   \*\*Network Handling:\*\* Implements a custom hidden-tab injection method to safely bypass CSRF restrictions, allowing direct communication with the devices' REST APIs over local HTTP.



\### 📦 Installation

1\. Download the source code or the packaged `.zip` extension.

2\. Load it into your browser via the Extensions Developer Mode (`chrome://extensions/`).

3\. (Store links will be added here once approved by Google/Mozilla/Microsoft).



\*Thank you for supporting the project! Feel free to open an issue if you encounter bugs or have feature requests.\*



