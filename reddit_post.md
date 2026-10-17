Title: I got tired of managing my BitAxes in separate tabs so I built a Chrome extension to run the whole fleet

---

So this started as a personal annoyance. I've got a few BitAxes and a couple NerdQAxes going and every time I wanted to check on them or swap a pool I'd end up with like 6 tabs open, logging into each one, changing the same settings over and over. Restarting them one by one. It drove me nuts.

I couldn't find anything that did exactly what I wanted so I ended up building it myself. It's a Chrome extension (Manifest V3) that scans your local network, finds all your AxeOS devices, and throws them into one dashboard.

What it does so far:

- Auto-scans your subnet and finds every BitAxe/NerdQAxe, or you can just punch in IPs manually
- One dashboard for hashrate, temps, best diff, shares, power, all of it
- Pool manager where you save pool configs and push them to multiple devices at once (it auto-appends the worker name so you don't have to)
- A couple of charts - one for fleet hashrate over time, and one I'm kind of proud of that shows live difficulty being produced. it actually fluctuates in real time so you sit there watching it like an idiot waiting for a big share lol
- Automations: auto-reboot if a device flatlines at 0 GH/s, overheat protection, and scheduled pool rotation
- Custom labels, sorting, light/dark themes, F/C toggle, the usual quality of life stuff

The annoying part to figure out was that AxeOS blocks write requests from outside the device page (CSRF protection, returns 401). Took me way too long to crack but I got it working by running the requests through the device's own page context in a hidden tab. So pool changes and restarts actually work, not just monitoring.

Everything runs locally. It only talks to your devices on your LAN, nothing gets sent anywhere, no accounts, no tracking. It's open source.

It's still rough around the edges and I've been fixing bugs as I find them (the difficulty chart fought me for a few versions) but it's stable now and I'm using it daily for my own gear.

Happy to hear what features people would want. If you run more than one axe give it a shot and let me know if it breaks on your setup - especially curious about people with bigger fleets than mine.

[link]
