'use strict';
const $ = (id) => document.getElementById(id);
const THEMES = ['circuit', 'daylight', 'neon-vault', 'aurora'];
const hr = (d) => d.hashRate || d.currentHashrate || 0;
function hrParts(gh) {
  if (gh >= 1e6) return [(gh / 1e6).toFixed(2), 'PH/s'];
  if (gh >= 1000) return [(gh / 1000).toFixed(2), 'TH/s'];
  return [gh.toFixed(gh >= 100 ? 1 : 2), 'GH/s'];
}
function diff(d) {
  if (!d) return '--';
  for (const [v, s] of [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'K']]) if (d >= v) return (d / v).toFixed(1) + s;
  return d.toFixed(0);
}
function ago(ts) { const s = Math.round((Date.now() - ts) / 1000); if (s < 60) return s + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; return Math.round(s / 3600) + 'h ago'; }
function name(d, nicks) { return nicks[d._ip] || d.hostname || d.deviceModel || d.ASICModel || d._ip; }

async function openDashboard() {
  const url = chrome.runtime.getURL('dashboard.html');
  const [tab] = await chrome.tabs.query({ url });
  if (tab) { await chrome.tabs.update(tab.id, { active: true }); await chrome.windows.update(tab.windowId, { focused: true }); }
  else await chrome.tabs.create({ url });
  window.close();
}

async function render() {
  const r = await chrome.storage.local.get(['devices', 'theme', 'deviceNicknames', 'lastRefresh', 'prefs']);
  if (THEMES.includes(r.theme)) document.documentElement.dataset.theme = r.theme;
  let nicks = {}; try { nicks = typeof r.deviceNicknames === 'string' ? JSON.parse(r.deviceNicknames) : (r.deviceNicknames || {}); } catch {}
  const devs = (r.devices || []).filter((d) => d && d._ip);
  const on = devs.filter((d) => !d._offline);
  const [v, u] = hrParts(on.reduce((s, d) => s + hr(d), 0));
  $('hr').textContent = devs.length ? v : '--'; $('unit').textContent = u;
  $('on').textContent = `${on.length}/${devs.length}`;
  const w = on.reduce((s, d) => s + (d.power || 0), 0);
  $('pw').textContent = w >= 1000 ? (w / 1000).toFixed(2) + ' kW' : Math.round(w) + ' W';
  $('bd').textContent = diff(Math.max(0, ...devs.map((d) => d.bestDiff || 0)));
  const poll = (r.prefs && r.prefs.pollSec) || 10;
  const fresh = r.lastRefresh && Date.now() - r.lastRefresh < poll * 3000;
  $('dot').className = 'dot ' + (fresh ? (on.length === devs.length ? 'live' : 'warn') : '');
  $('ago').textContent = r.lastRefresh ? (fresh ? ago(r.lastRefresh) : 'dashboard closed') : '--';
  const list = $('list');
  if (!devs.length) { list.innerHTML = '<p class="empty">No devices yet. Open the dashboard to scan your network.</p>'; }
  else {
    const sorted = [...devs].sort((a, b) => (a._offline - b._offline) || hr(b) - hr(a));
    list.replaceChildren(...sorted.map((d) => {
      const row = document.createElement('div'); row.className = 'dev' + (d._offline ? ' off' : '');
      const [hv, hu] = hrParts(hr(d));
      row.innerHTML = '<span class="d"></span><span class="n"></span><span class="v"></span>';
      row.querySelector('.n').textContent = name(d, nicks);
      row.querySelector('.v').textContent = d._offline ? 'offline' : `${hv} ${hu}`;
      return row;
    }));
  }
  $('ver').textContent = 'v' + chrome.runtime.getManifest().version + (devs.length && !fresh ? ' · open the dashboard for live data' : '');
}

$('open').addEventListener('click', openDashboard);
render();
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.devices || changes.lastRefresh)) render(); });
