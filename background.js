// ════════════════════════════════════════════════════════════
// AxeOS Fleet Manager — service worker (v2)
// Reads go straight to the device API. Writes and WebSocket streams run
// inside the device's own page (hidden tab) so the session cookie and the
// insecure ws:// connection work, exactly as the device web UI does it.
// The worker can be stopped at any moment, so nothing important lives in
// globals: WS session tabs and the share collector are tracked in
// chrome.storage.session.
// ════════════════════════════════════════════════════════════

const DEFAULTS = {
  devices: [], savedPools: [], logs: [], theme: 'circuit', tutorialDone: false,
  expandedCards: '[]', sortField: 'custom', sortAsc: false, customOrder: '[]', deviceNicknames: '{}'
};

// Only fill in what is missing. v1 wrote the defaults on EVERY update and
// reload, which silently wiped the fleet; never overwrite user data here.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install' && reason !== 'update') return;
  const have = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const missing = {};
  for (const [k, v] of Object.entries(DEFAULTS)) if (have[k] === undefined) missing[k] = v;
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    SCAN_NETWORK: () => scanNetwork(msg.subnet),
    FETCH_DEVICE_INFO: () => fetchDeviceInfo(msg.ip),
    GET_SYSTEM_SETTINGS: () => fetchDeviceInfo(msg.ip).then((d) => d || { error: 'Device not reachable' }),
    DEVICE_WRITE: () => deviceWrite(msg.ip, msg.method, msg.endpoint, msg.data),
    START_WS_LOGS: () => startWsSession(msg.ip, msg.session || 'logs', sender.tab?.id),
    STOP_WS_LOGS: () => stopWsSession(msg.session || 'logs').then(() => ({ ok: true })),
    COLLECT_SHARES: () => ensureCollector(Array.isArray(msg.ips) ? msg.ips : [], +msg.min || 0, sender.tab?.id),
    STOP_COLLECT: () => stopCollector().then(() => ({ ok: true })),
  };
  const h = handlers[msg?.type];
  if (!h) return false; // not ours (e.g. WS_LOG_EVENT relays go to the dashboard)
  h().then(sendResponse, (e) => sendResponse(msg.type === 'FETCH_DEVICE_INFO' ? null : { error: e?.message || String(e) }));
  return true;
});

// ─── Reads ───
async function fetchWithTimeout(url, opts = {}, timeout = 5000) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), timeout);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(id); }
}
async function fetchDeviceInfo(ip) {
  try {
    const r = await fetchWithTimeout(`http://${ip}/api/system/info`, {}, 3000);
    if (!r.ok) return null;
    const d = await r.json();
    d._ip = ip; d._lastSeen = Date.now();
    return d;
  } catch { return null; }
}
async function scanNetwork(subnet) {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(String(subnet || ''))) return [];
  const found = [], batch = 25;
  for (let s = 1; s <= 254; s += batch) {
    const jobs = [];
    for (let i = s; i < Math.min(s + batch, 255); i++) {
      jobs.push(fetchDeviceInfo(`${subnet}.${i}`).then((d) => { if (d && (d.ASICModel || d.asicModel || d.deviceModel)) found.push(d); }));
    }
    await Promise.all(jobs);
  }
  return found;
}

// ─── Hidden device tab helpers ───
async function openDeviceTab(ip) {
  const tab = await chrome.tabs.create({ url: `http://${ip}/`, active: false });
  await waitForTabComplete(tab.id, 12000);
  return tab.id;
}
function waitForTabComplete(tabId, timeout) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err) => {
      if (done) return; done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      err ? reject(err) : resolve();
    };
    const timer = setTimeout(() => finish(new Error('Tab open timeout')), timeout);
    const onUpdated = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    const onRemoved = (id) => { if (id === tabId) finish(new Error('Tab closed')); };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    // The page may already be loaded by the time the listener is attached
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') finish(); }).catch(() => finish(new Error('Tab closed')));
  });
}
async function closeTab(tabId) { try { await chrome.tabs.remove(tabId); } catch { /* already gone */ } }

// ─── Writes (same-origin fetch inside the device page) ───
async function deviceWrite(ip, method, endpoint, data) {
  let tabId = null;
  try {
    tabId = await openDeviceTab(ip);
    await new Promise((r) => setTimeout(r, 500)); // let the session cookie settle
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [endpoint, method, data ?? null],
      func: async (apiEndpoint, fetchMethod, payload) => {
        try {
          const opts = { method: fetchMethod === 'POST_BINARY' ? 'POST' : fetchMethod };
          if (fetchMethod === 'POST_BINARY' && payload) {
            const bin = atob(payload); const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            opts.headers = { 'Content-Type': 'application/octet-stream' }; opts.body = bytes.buffer;
          } else {
            opts.headers = { 'Content-Type': 'application/json' };
            if (payload !== null && payload !== undefined) opts.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
          }
          const r = await fetch(apiEndpoint, opts);
          return { ok: r.ok, status: r.status, body: await r.text() };
        } catch (e) {
          // A restart drops the connection immediately: treat as success
          return { ok: true, status: 0, body: 'device_disconnected', networkError: true };
        }
      }
    });
    const res = result?.result;
    if (!res) throw new Error('No result from the device page');
    if (res.networkError) return { ok: true, restarting: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${String(res.body).slice(0, 200)}`);
    try { return JSON.parse(res.body); } catch { return { ok: true, raw: res.body }; }
  } finally {
    if (tabId !== null) closeTab(tabId);
  }
}

// ─── Live WebSocket relay ───
// Session map { sessionId: { tabId, ownerTabId } } persisted in session storage
async function getSessions() { return (await chrome.storage.session.get('wsSessions')).wsSessions || {}; }
async function setSessions(s) { await chrome.storage.session.set({ wsSessions: s }); }

async function startWsSession(ip, sessionId, ownerTabId) {
  await stopWsSession(sessionId);
  const tabId = await openDeviceTab(ip);
  const sessions = await getSessions();
  sessions[sessionId] = { tabId, ownerTabId: ownerTabId ?? null, ip };
  await setSessions(sessions);
  await new Promise((r) => setTimeout(r, 400));
  // ISOLATED world keeps chrome.runtime available for relaying lines back
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [ip, sessionId],
    func: (deviceIp, sid) => {
      const send = (m) => { try { chrome.runtime.sendMessage({ type: 'WS_LOG_EVENT', ip: deviceIp, session: sid, ...m }).catch(() => {}); } catch (e) { /* extension reloaded */ } };
      try {
        if (window.__axeLogWS) { try { window.__axeLogWS.close(); } catch (e) {} }
        const ws = new WebSocket('ws://' + deviceIp + '/api/ws');
        ws.binaryType = 'arraybuffer';
        window.__axeLogWS = ws;
        ws.onopen = () => send({ event: 'open' });
        ws.onmessage = (ev) => {
          let t = '';
          try { t = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data); } catch (e) { t = ''; }
          if (t) send({ event: 'data', line: t });
        };
        ws.onerror = () => send({ event: 'error' });
        ws.onclose = (e) => send({ event: 'close', code: e.code });
      } catch (err) { send({ event: 'error', msg: err.message }); }
    }
  });
  return { ok: true };
}
async function stopWsSession(sessionId) {
  const sessions = await getSessions();
  const s = sessions[sessionId];
  if (!s) return;
  delete sessions[sessionId];
  await setSessions(sessions);
  await closeTab(s.tabId);
}

// Clean up when a stream tab is closed by hand, or when the dashboard that
// owns a stream goes away (so hidden device tabs never linger)
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const sessions = await getSessions();
  let changed = false;
  for (const [sid, s] of Object.entries(sessions)) {
    if (s.tabId === tabId) { delete sessions[sid]; changed = true; }
    else if (s.ownerTabId === tabId) { delete sessions[sid]; changed = true; closeTab(s.tabId); }
  }
  if (changed) await setSessions(sessions);
  const col = await getCollector();
  if (col) {
    if (col.ownerTabId === tabId) await stopCollector();
    else {
      const ip = Object.keys(col.tabs).find((k) => col.tabs[k].id === tabId);
      if (ip) { delete col.tabs[ip]; await setCollector(col); } // re-opened on the next refresh
    }
  }
});
chrome.windows.onRemoved.addListener(async (windowId) => {
  const col = await getCollector();
  if (col && col.windowId === windowId) await setCollector(null);
});

// Clicking a notification brings the dashboard forward
chrome.notifications?.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  const url = chrome.runtime.getURL('dashboard.html');
  const [tab] = await chrome.tabs.query({ url });
  if (tab) { await chrome.tabs.update(tab.id, { active: true }); await chrome.windows.update(tab.windowId, { focused: true }); }
  else await chrome.tabs.create({ url });
});


// ─── Share collector ───
// Records every share at or above a difficulty threshold, for every miner the
// dashboard asks for. AxeOS has no share history API; the only per-share data
// is the device log. Each miner gets a tab on its own page (same origin, like
// the live log) inside one minimized window, and a small script there keeps a
// WebSocket open, reconnects after reboots, and relays qualifying shares.
async function getCollector() { return (await chrome.storage.session.get('collector')).collector || null; }
async function setCollector(c) { if (c) await chrome.storage.session.set({ collector: c }); else await chrome.storage.session.remove('collector'); }

function collectorScript(deviceIp, min) {
  window.__axeCollectMin = min;
  if (window.__axeCollect) return 'updated';
  window.__axeCollect = true;
  const send = (m) => { try { chrome.runtime.sendMessage({ type: 'WS_LOG_EVENT', ip: deviceIp, session: 'collect', ...m }).catch(() => {}); } catch (e) { /* extension reloaded */ } };
  // BitAxe: "diff 1234.5 of 512"   NerdQAxe: "diff 1234.5/512"
  const re = /diff\s+([\d.]+)\s*(?:of\s+|\/)([\d.]+)/i;
  let tries = 0;
  const connect = () => {
    let ws;
    try { ws = new WebSocket('ws://' + deviceIp + '/api/ws'); } catch (e) { setTimeout(connect, 15000); return; }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { tries = 0; send({ event: 'open' }); };
    ws.onmessage = (ev) => {
      let t = '';
      try { t = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data); } catch (e) { return; }
      for (const line of t.split(/\r?\n/)) {
        const m = line.match(re); if (!m) continue;
        const diff = parseFloat(m[1]), target = parseFloat(m[2]);
        // Only shares the miner actually submits (at or above the pool target)
        if (diff > 0 && diff >= target && diff >= window.__axeCollectMin) send({ event: 'share', diff, target });
      }
    };
    ws.onclose = (e) => { send({ event: 'close', code: e.code }); setTimeout(connect, Math.min(60000, 5000 * ++tries)); };
  };
  connect();
  return 'started';
}
async function injectCollector(tabId, ip, min) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, args: [ip, min], func: collectorScript });
  if (!r || !r.result) throw new Error('Could not start on the device page');
}
async function stopCollector() {
  const col = await getCollector();
  await setCollector(null);
  if (col) { try { await chrome.windows.remove(col.windowId); } catch { /* already closed */ } }
}
let collectorQueue = Promise.resolve();
function ensureCollector(ips, min, ownerTabId) {
  // Calls arrive on every refresh; run them one at a time
  const run = () => syncCollector(ips, min, ownerTabId);
  collectorQueue = collectorQueue.then(run, run);
  return collectorQueue;
}
async function syncCollector(ips, min, ownerTabId) {
  ips = [...new Set(ips.filter((ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)))];
  if (!ips.length) { await stopCollector(); return { ok: true, streaming: [] }; }
  let col = await getCollector();
  let liveTabs = null;
  if (col) {
    try { liveTabs = new Set((await chrome.windows.get(col.windowId, { populate: true })).tabs.map((t) => t.id)); }
    catch { col = null; }
  }
  const now = Date.now();
  if (!col) {
    // The window starts with the first miner's page in it
    const win = await chrome.windows.create({ url: `http://${ips[0]}/`, state: 'minimized' });
    col = { windowId: win.id, tabs: {}, failed: {}, ownerTabId: ownerTabId ?? null, min };
    liveTabs = new Set(win.tabs.map((t) => t.id));
    col.tabs[ips[0]] = { id: win.tabs[0].id, fresh: true };
  }
  col.ownerTabId = ownerTabId ?? col.ownerTabId;
  col.failed = col.failed || {};
  // Forget tabs that were closed; tabs of miners that left the list are closed
  // only after the new ones exist, so the window never empties itself midway
  const toClose = [];
  for (const [ip, t] of Object.entries(col.tabs)) {
    if (!liveTabs.has(t.id)) delete col.tabs[ip];
    else if (!ips.includes(ip)) { delete col.tabs[ip]; toClose.push(t.id); }
  }
  const minChanged = col.min !== min;
  col.min = min;
  const jobs = ips.map(async (ip) => {
    const cur = col.tabs[ip];
    if (cur && !cur.fresh) { if (minChanged) { try { await injectCollector(cur.id, ip, min); } catch {} } return; }
    if (!cur && col.failed[ip] && now - col.failed[ip] < 120000) return; // back off after a failure
    let tabId = cur ? cur.id : null;
    try {
      if (!tabId) tabId = (await chrome.tabs.create({ windowId: col.windowId, url: `http://${ip}/`, active: false })).id;
      await waitForTabComplete(tabId, 12000);
      await injectCollector(tabId, ip, min);
      col.tabs[ip] = { id: tabId };
      delete col.failed[ip];
    } catch {
      col.failed[ip] = now; delete col.tabs[ip];
      if (tabId) toClose.push(tabId);
    }
  });
  await Promise.all(jobs);
  if (!Object.keys(col.tabs).length) {
    await setCollector(null);
    try { await chrome.windows.remove(col.windowId); } catch { /* already closed */ }
    return { ok: false, streaming: [], error: 'No miner page could be opened' };
  }
  for (const id of toClose) { try { await chrome.tabs.remove(id); } catch { /* gone */ } }
  await setCollector(col);
  return { ok: true, streaming: Object.keys(col.tabs) };
}
