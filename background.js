chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    devices:[], savedPools:[], logs:[], settings:{pollInterval:15000},
    theme:'midnight-orange', tutorialDone:false, expandedCards:'[]',
    sortField:'custom', sortAsc:false, customOrder:'[]', deviceNicknames:'{}'
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const h = {
    SCAN_NETWORK: () => scanNetwork(msg.subnet).then(sendResponse),
    FETCH_DEVICE_INFO: () => fetchDeviceInfo(msg.ip).then(sendResponse).catch(()=>sendResponse(null)),
    GET_SYSTEM_SETTINGS: () => fetchDeviceInfo(msg.ip).then(sendResponse).catch(e=>sendResponse({error:e.message})),
    DEVICE_WRITE: () => deviceWrite(msg.ip, msg.method, msg.endpoint, msg.data).then(sendResponse).catch(e=>sendResponse({error:e.message})),
  };
  if(h[msg.type]){ h[msg.type](); return true; }
});

// ─── Simple fetch with timeout (read-only, no auth needed) ───
async function fetchWithTimeout(url, opts={}, timeout=5000) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(url, {...opts, signal:c.signal}); clearTimeout(id); return r; }
  catch(e) { clearTimeout(id); throw e; }
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
  const found = [];
  const bs = 25;
  for (let s = 1; s <= 254; s += bs) {
    const p = [];
    for (let i = s; i < Math.min(s + bs, 255); i++) {
      const ip = `${subnet}.${i}`;
      p.push(fetchDeviceInfo(ip).then(d => {
        if (d && (d.ASICModel || d.asicModel || d.deviceModel)) found.push(d);
      }).catch(() => {}));
    }
    await Promise.all(p);
  }
  return found;
}

// ════════════════════════════════════════════════════════════
// TAB INJECTION — the ONLY way to bypass CSRF on these devices
// ════════════════════════════════════════════════════════════
// Why: Extension pages are chrome-extension:// origin.
// Device is http://192.168.x.x origin.
// Cross-origin + Access-Control-Allow-Origin: * = browser blocks cookies.
// GM_xmlhttpRequest bypasses CORS entirely (that's why Tampermonkey works).
// Our solution: open a tab to the device, inject code that runs same-origin fetch.
// Same-origin fetch sends cookies automatically. Problem solved.
// ════════════════════════════════════════════════════════════

async function deviceWrite(ip, method, endpoint, data) {
  let tabId = null;
  try {
    // Step 1: Open hidden tab to device root (creates session cookie)
    tabId = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tab open timeout')), 12000);
      chrome.tabs.create({ url: `http://${ip}/`, active: false }, (tab) => {
        if (chrome.runtime.lastError) { clearTimeout(timeout); return reject(new Error(chrome.runtime.lastError.message)); }
        function onUpdated(id, info) {
          if (id === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            clearTimeout(timeout);
            resolve(tab.id);
          }
        }
        chrome.tabs.onUpdated.addListener(onUpdated);
      });
    });

    // Small delay for cookie to be set
    await new Promise(r => setTimeout(r, 500));

    // Step 2: Inject fetch into the tab (runs same-origin with cookies)
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (apiEndpoint, fetchMethod, payload) => {
        return new Promise(async (resolve) => {
          try {
            const opts = { method: fetchMethod === 'POST_BINARY' ? 'POST' : fetchMethod };
            if (fetchMethod === 'POST_BINARY' && payload) {
              // Convert base64 to binary for OTA upload
              const binary = atob(payload);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              opts.headers = { 'Content-Type': 'application/octet-stream' };
              opts.body = bytes.buffer;
            } else {
              opts.headers = { 'Content-Type': 'application/json' };
              if (payload !== null && payload !== undefined) {
                opts.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
              }
            }
            const r = await fetch(apiEndpoint, opts);
            const text = await r.text();
            resolve({ ok: r.ok, status: r.status, body: text });
          } catch(e) {
            // For restart: network error means device is rebooting = success
            resolve({ ok: true, status: 0, body: 'device_disconnected', networkError: true });
          }
        });
      },
      args: [endpoint, method, data],
      world: 'MAIN'  // Run in the page's JS context (same origin)
    });

    // Step 3: Close tab
    try { chrome.tabs.remove(tabId); } catch(e) {}

    // Step 4: Process result
    const res = result.result;
    if (!res) throw new Error('No result from injected script');
    if (res.networkError) return { ok: true, restarting: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 200)}`);
    try { return JSON.parse(res.body); } catch { return { ok: true, raw: res.body }; }

  } catch(e) {
    if (tabId) try { chrome.tabs.remove(tabId); } catch(x) {}
    throw e;
  }
}
