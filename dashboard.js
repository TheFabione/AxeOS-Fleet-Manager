// ════════════════════════════════════════════════════════════
// AxeOS Fleet Manager — Dashboard v2.0.0
// The dashboard is the engine: it polls every device, runs the
// automations and renders the UI. Writes go through background.js
// (tab injection, same-origin with the device session cookie).
// ════════════════════════════════════════════════════════════
'use strict';

const APP_VERSION = chrome.runtime.getManifest().version;
const UI_VERSION = 2;

// Benign messaging races when the service worker idles/restarts
window.addEventListener('unhandledrejection', (e) => {
  const m = (e && e.reason && (e.reason.message || e.reason)) || '';
  if (typeof m === 'string' && (m.includes('message channel closed') || m.includes('Could not establish connection') || m.includes('Receiving end does not exist'))) e.preventDefault();
});

// ════════ CONSTANTS ════════
const SHA256_COINS = [
  {id:'btc',name:'Bitcoin (BTC)',symbol:'BTC'},{id:'bch',name:'Bitcoin Cash (BCH)',symbol:'BCH'},
  {id:'bsv',name:'Bitcoin SV (BSV)',symbol:'BSV'},{id:'xec',name:'eCash (XEC)',symbol:'XEC'},
  {id:'dgb',name:'DigiByte (DGB)',symbol:'DGB'},{id:'sys',name:'Syscoin (SYS)',symbol:'SYS'},
  {id:'nmc',name:'Namecoin (NMC)',symbol:'NMC'},{id:'ela',name:'Elastos (ELA)',symbol:'ELA'},
  {id:'ppc',name:'Peercoin (PPC)',symbol:'PPC'},{id:'htr',name:'Hathor (HTR)',symbol:'HTR'},
  {id:'fb',name:'Fractal Bitcoin (FB)',symbol:'FB'},{id:'lcc',name:'Litecoin Cash (LCC)',symbol:'LCC'},
  {id:'quai',name:'Quai (QUAI)',symbol:'QUAI'},{id:'aur',name:'Auroracoin (AUR)',symbol:'AUR'},
  {id:'dgc',name:'DigitalCoin (DGC)',symbol:'DGC'},{id:'other',name:'Other SHA-256',symbol:'OTHER'},
];
const THEMES = [
  {id:'circuit',   name:'Circuit',    desc:'Graphite and signal amber', sw:['#13181A','#F2B544','#8FB8FF','#4CD69E']},
  {id:'daylight',  name:'Daylight',   desc:'Light, for bright rooms',   sw:['#ECEFEE','#B8741A','#3566D6','#16925F']},
  {id:'neon-vault',name:'Neon Vault', desc:'The classic lime and violet',sw:['#0C0C0E','#C8F73A','#A78BFA','#34D399']},
  {id:'aurora',    name:'Aurora',     desc:'Navy, cyan and magenta',    sw:['#0A0E1F','#22D3EE','#F472B6','#34D399']},
];
const DEFAULT_THEME = 'circuit';
const LABEL_COLORS = ['#F7931A','#3B82F6','#10B981','#EF4444','#A855F7','#EAB308','#EC4899','#06B6D4'];
const MAX_HISTORY = 360, MAX_LOGS = 500;
const DEVICE_ICONS = {
  axe:'<rect x="3" y="5" width="14" height="10" rx="3"/><path d="M7 10h6"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/>',
  chip:'<rect x="5" y="5" width="10" height="10" rx="2"/><path d="M8 2v3M12 2v3M8 15v3M12 15v3M2 8h3M2 12h3M15 8h3M15 12h3"/>',
  cpu:'<rect x="6" y="6" width="8" height="8" rx="1"/><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M9 1v2M11 1v2M9 17v2M11 17v2M1 9h2M1 11h2M17 9h2M17 11h2"/>',
  server:'<rect x="3" y="3" width="14" height="6" rx="1"/><rect x="3" y="11" width="14" height="6" rx="1"/><circle cx="6" cy="6" r="0.8" fill="currentColor"/><circle cx="6" cy="14" r="0.8" fill="currentColor"/>',
  rocket:'<path d="M10 2c3 2 4 5 4 8l-4 4-4-4c0-3 1-6 4-8z"/><circle cx="10" cy="8" r="1.3" fill="currentColor"/><path d="M7 14l-2 4M13 14l2 4"/>',
  flame:'<path d="M10 2c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 1 2 2 2 0-2 0-4 0-6z"/>',
  bolt:'<path d="M11 2L4 11h5l-1 7 7-9h-5l1-7z"/>',
  diamond:'<path d="M5 4h10l3 4-8 9-8-9 3-4z"/><path d="M5 4l5 13M15 4l-5 13M2 8h16"/>',
  pick:'<path d="M3 17L13 7"/><path d="M8 4c3 0 6 1 8 4-3-1-5-1-8 0M12 8c0-3 1-5 4-4"/>',
  star:'<path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.5L10 15l-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>'
};
const DEVICE_ICON_ORDER = ['axe','chip','cpu','server','rocket','flame','bolt','diamond','pick','star'];
const NERD_WRITABLE = ['hostname','coreVoltage','asicfrequency','autofanspeed','manualFanSpeed','flipscreen','invertscreen',
  'stratumURL','stratumPort','stratumUser','stratumPassword','stratumEnonceSubscribe','stratumTLS',
  'fallbackStratumURL','fallbackStratumPort','fallbackStratumUser','fallbackStratumPassword','fallbackStratumEnonceSubscribe','fallbackStratumTLS'];

// ════════ STATE ════════
let devices = [], savedPools = [], activityLogs = [], hashrateHistory = [], diffHistory = [];
let prevShares = {}, uptimeEvents = [], blockHistory = [];
let prevBlockState = {}, blockStateInitialized = false, blockUnread = 0;
let deviceHrHistory = {}, deviceIcons = {}, deviceNicknames = {}, deviceLabels = {};
let expandedCards = new Set();
let cardViewMode = 'balanced';
let currentTheme = DEFAULT_THEME, tempUnit = 'C';
let sortField = 'custom', sortAsc = false, customOrder = [], sortLocked = false;
let typeFilter = 'all', labelFilter = null, searchQuery = '';
let selectMode = false, selectedIps = new Set();
let dragSrcIp = null;
let selectedCoinFilter = 'all', editingPoolId = null, settingsDeviceIp = null;
let applyInProgress = false;
let pollTimer = null, refreshing = false, lastRefresh = 0;
let logUnread = 0, logLevelFilter = 'all';
let activeView = 'fleet', chartTab = 'hashrate', historyTab = 'activity';
let diffChartRender = null, diffLiveMode = false, diffLiveIp = null, diffLivePoints = [];
let chartPoints = [];
let liveLogActiveIp = null, liveLogPaused = false, liveLogBuffer = [];
let prefs = { pollSec: 10, kwhPrice: null, currency: 'USD', notifyOffline: true, notifyBlock: true, notifyAuto: false, badge: true, textScale: 1, shareMin: 0, shareCollect: false };
const AUTO_DEFAULTS = {
  watchdog: { enabled: false, minutes: 5, devices: [] },
  hashrateDrop: { enabled: false, dropPct: 30, minutes: 10, action: 'restart', cooldownMin: 30, devices: [] },
  fallbackReturn: { enabled: false, minutes: 30, devices: [] },
  flapRecovery: { enabled: false, threshold: 3, windowMin: 10, cooldownMin: 20, devices: [] },
  rejectRate: { enabled: false, maxPct: 3, windowMin: 30, action: 'notify', cooldownMin: 60, devices: [] },
  shareStall: { enabled: false, minutes: 10, cooldownMin: 30, devices: [] },
  overheatProtect: { enabled: false, maxTemp: 68, cooldownMin: 10, devices: [] },
  vrProtect: { enabled: false, watch: 'both', maxTemp: 80, chipMaxTemp: 67, mode: 'freqThenVolt', freqStep: 25, voltStep: 10, minFreq: 400, minVolt: 1050, restart: 'yes', cooldownMin: 15, recoverHours: 0, devices: [] },
  quietHours: { enabled: false, start: '22:00', end: '07:00', fanPct: 45, safeTemp: 68, devices: [] },
  scheduledRestart: { enabled: false, time: '04:00', devices: [] },
  poolRotation: { enabled: false, hours: 24, devices: [], poolIds: [] }
};
let autoConfig = JSON.parse(JSON.stringify(AUTO_DEFAULTS));
let autoState = { sched: {}, quiet: {}, vr: {} };
let shareTrack = {}, shareStallLast = {}, vrHotSeen = {};
let hashDropSince = {}, hashDropLast = {}, fallbackSince = {}, rejSamples = {}, rejLast = {}, rejRate = {};
let shareHits = [], prevBestSeen = {}, diffLiveStart = 0;
const MAX_SHARE_HITS = 5000;
let collectorOn = false, collectorConn = {}, collectorIps = [], shareSaveTimer = 0, shareDrawAt = 0;
let poolCatalog = null;
let watchdogZeroSince = {}, poolRotationState = {}, flapLastRestart = {}, overheatLastRestart = {};

// ════════ HELPERS ════════
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const ic = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
function esc(s) { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; }
function stripTags(s) { const d = document.createElement('div'); d.innerHTML = s; return d.textContent || ''; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function cssVar(name, fallback) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; }
function seriesColors() { return cssVar('--series', '#F2B544,#8FB8FF,#4CD69E').split(',').map((s) => s.trim()); }
function withAlpha(color, a) {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color + Math.round(a * 255).toString(16).padStart(2, '0');
  return color;
}

const fmt = {
  hrParts(gh) {
    if (gh == null || isNaN(gh)) return { v: '--', u: 'GH/s' };
    if (gh >= 1e6) return { v: (gh / 1e6).toFixed(2), u: 'PH/s' };
    if (gh >= 1000) return { v: (gh / 1000).toFixed(2), u: 'TH/s' };
    return { v: gh.toFixed(gh >= 100 ? 1 : 2), u: 'GH/s' };
  },
  hr(gh) { const p = fmt.hrParts(gh); return p.v + ' ' + p.u; },
  diff(d) {
    if (!d || isNaN(d)) return '--';
    if (d >= 1e15) return (d / 1e15).toFixed(2) + 'P';
    if (d >= 1e12) return (d / 1e12).toFixed(2) + 'T';
    if (d >= 1e9) return (d / 1e9).toFixed(2) + 'G';
    if (d >= 1e6) return (d / 1e6).toFixed(2) + 'M';
    if (d >= 1e3) return (d / 1e3).toFixed(2) + 'K';
    return d.toFixed(2);
  },
  uptime(s) {
    if (!s) return '--';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
  },
  time(date) { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
  datetime(date) { return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); },
  clock(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); },
  dur(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60); if (m < 60) return m + 'm';
    const h = Math.floor(m / 60); if (h < 48) return h + 'h ' + (m % 60) + 'm';
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  },
  ago(ts) { const s = Math.round((Date.now() - ts) / 1000); if (s < 5) return 'just now'; if (s < 60) return s + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; return Math.round(s / 3600) + 'h ago'; },
  money(v) {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: prefs.currency || 'USD', maximumFractionDigits: v < 10 ? 2 : 1 }).format(v); }
    catch { return v.toFixed(2); }
  }
};
function toF(c) { return c != null ? (c * 9 / 5 + 32) : null; }
function dispTemp(c) { if (c == null) return '--'; const v = tempUnit === 'F' ? toF(c) : c; return v.toFixed(1) + '°' + tempUnit; }
function dispTempShort(c) { if (c == null) return '--'; const v = tempUnit === 'F' ? toF(c) : c; return v.toFixed(1) + '°'; }
function tempPct(t) { if (t == null) return 0; return Math.max(0, Math.min(100, ((t - 40) / 40) * 100)); }
function tempClass(t) { if (t == null) return ''; return t < 55 ? 'temp-ok' : t < 70 ? 'temp-warn' : 'temp-hot'; }
function trendOf(cur, avg) { if (!avg) return 'flat'; const d = cur - avg, th = avg * 0.02; return d > th ? 'up' : d < -th ? 'down' : 'flat'; }
const TREND_GLYPH = { up: '▲', down: '▼', flat: '▬' };

function parseStratumUrl(input) {
  let url = String(input || '').trim(), port = null;
  url = url.replace(/^stratum\+tcp:\/\//i, '').replace(/^stratum\+ssl:\/\//i, '').replace(/^stratum:\/\//i, '').replace(/^tcp:\/\//i, '');
  const m = url.match(/^(.+):(\d+)$/);
  if (m) { url = m[1]; port = parseInt(m[2]); }
  return { host: url, port };
}
function isTyping(el) { return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable); }

// ─── Device accessors (firmware field differences live here) ───
const D = {
  type(d) { const m = (d.deviceModel || d.ASICModel || d.asicModel || '').toLowerCase(); return (m.includes('nerd') || m.includes('nqaxe') || m.includes('nerdqaxe')) ? 'nerdqaxe' : 'bitaxe'; },
  name(d) { return getDisplayName(d); },
  hr(d) { return d.hashRate || d.currentHashrate || 0; },
  hr1h(d) { const f = d.hashRate_1h || d.hashrate_1h; if (f) return f; return localAvg(d); },
  hr24h(d) { const f = d.hashRate_1d || d.hashrate_1d || d.hashRate_1h || d.hashrate_1h; if (f) return f; return localAvg(d); },
  bestDiff(d) { return d.bestDiff || d.bestdiff || 0; },
  netDiff(d) { return d.networkDifficulty || d.networkdifficulty || d.network_difficulty || 0; },
  bestSession(d) { return d.bestSessionDiff || 0; },
  temp(d) { return d.temp ?? d.chipTemp ?? null; }, asicTemp(d) { return d.asicTemp ?? null; }, vrTemp(d) { return d.vrTemp ?? d.vregTemp ?? null; },
  chipTemp(d) { return D.asicTemp(d) ?? D.temp(d); },
  fanRpm(d) { return d.fanRpm || d.fanrpm || d.fan2Rpm || d.fan2rpm || 0; }, fanSpeed(d) { return d.fanSpeed ?? d.manualFanSpeed ?? d.manualfanspeed ?? null; }, autoFan(d) { return d.autofanspeed ?? d.auto_fan ?? null; },
  freq(d) { return d.frequency || d.asicfrequency || 0; }, volt(d) { return d.coreVoltage || d.voltage || d.asicvoltage || 0; }, voltActual(d) { return d.coreVoltageActual || 0; },
  power(d) { return d.power || 0; }, shares(d) { return d.sharesAccepted || 0; }, rejected(d) { return d.sharesRejected || 0; },
  uptime(d) { return d.uptimeSeconds || 0; },
  poolUrl(d) { return d.stratumURL || d.stratumurl || ''; }, poolPort(d) { return d.stratumPort || d.stratumport || ''; }, poolUser(d) { return d.stratumUser || d.stratumuser || ''; }, poolPass(d) { return d.stratumPassword || ''; }, poolDiff(d) { return d.poolDifficulty || d.stratumDifficulty || 0; },
  fbUrl(d) { return d.fallbackStratumURL || ''; }, fbPort(d) { return d.fallbackStratumPort || ''; }, fbUser(d) { return d.fallbackStratumUser || ''; }, fbPass(d) { return d.fallbackStratumPassword || ''; },
  model(d) { return d.ASICModel || d.asicModel || d.deviceModel || ''; }, board(d) { return d.boardVersion || d.boardversion || ''; }, fw(d) { return d.version || d.axeOSVersion || ''; },
  rssi(d) { return d.wifiRSSI ?? d.wifiRssi ?? null; }, freqOpts(d) { return d.frequencyOptions || null; }, voltOpts(d) { return d.voltageOptions || null; },
  blockFound(d) { return d.blockFound === true || d.blockFound === 1 || d.block_found === true || d.block_found === 1; },
  totalBlocks(d) { return d.totalFoundBlocks ?? d.foundBlocks ?? 0; },
  eff(d) { const hr = D.hr(d), p = D.power(d); if (!hr || hr < 0.01 || !p) return null; return p / (hr / 1000); },
};
function localAvg(d) {
  const h = deviceHrHistory[d._ip];
  if (h && h.length >= 3) return h.reduce((a, b) => a + b, 0) / h.length;
  return D.hr(d);
}
function hrHistoryCap() { return Math.max(60, Math.ceil(3600 / (prefs.pollSec || 10))); }
function getDisplayName(dev) {
  if (deviceNicknames[dev._ip]) return deviceNicknames[dev._ip];
  return dev.hostname || dev.deviceModel || dev.ASICModel || dev._ip || 'Unknown';
}
function getWorkerSuffix(dev) {
  const nick = deviceNicknames[dev._ip];
  if (nick) { const s = nick.replace(/[^a-zA-Z0-9]/g, ''); return s || D.type(dev); }
  const hostname = dev.hostname || '';
  if (!hostname || /[^a-zA-Z0-9._-]/.test(hostname) || hostname.includes(' ')) return D.type(dev);
  return hostname;
}
function deviceIconSvg(id) { const p = DEVICE_ICONS[id] || DEVICE_ICONS.axe; return `<svg class="i" viewBox="0 0 20 20" aria-hidden="true">${p}</svg>`; }
function deviceIconId(dev) { return (deviceIcons[dev._ip] && DEVICE_ICONS[deviceIcons[dev._ip]]) ? deviceIcons[dev._ip] : (D.type(dev) === 'nerdqaxe' ? 'chip' : 'axe'); }
function findDev(ip) { return devices.find((d) => d._ip === ip); }
function ongoingOutage(ip) { return uptimeEvents.find((e) => e.ip === ip && e.backAt === null); }

// ════════ WRITE API (via background tab injection) ════════
async function apiPatch(ip, data) {
  const r = await chrome.runtime.sendMessage({ type: 'DEVICE_WRITE', ip, method: 'PATCH', endpoint: `http://${ip}/api/system`, data });
  if (r && r.error) throw new Error(r.error);
  return r;
}
async function apiRestart(ip) {
  const r = await chrome.runtime.sendMessage({ type: 'DEVICE_WRITE', ip, method: 'POST', endpoint: `http://${ip}/api/system/restart`, data: {} });
  if (r && r.error) {
    // The device drops the connection while rebooting; that counts as success
    if (r.error.includes('disconnect') || r.error.includes('timeout') || r.error.includes('Tab')) return { ok: true };
    throw new Error(r.error);
  }
  return r || { ok: true };
}
async function apiIdentify(ip) {
  try { const r = await chrome.runtime.sendMessage({ type: 'DEVICE_WRITE', ip, method: 'POST', endpoint: `http://${ip}/api/system/identify`, data: {} }); return { ok: !(r && r.error) }; }
  catch { return { ok: false }; }
}
async function restartDevice(dev, reason, tag) {
  log('action', `Restarting <strong>${esc(D.name(dev))}</strong>${reason ? ' (' + esc(reason) + ')' : ''}`, tag);
  try {
    const r = await apiRestart(dev._ip);
    if (r && r.ok !== false) { log('success', `Restart sent to <strong>${esc(D.name(dev))}</strong>`, tag); return true; }
    log('error', `Restart failed on <strong>${esc(D.name(dev))}</strong>`, tag); return false;
  } catch (e) { log('error', `Restart failed on <strong>${esc(D.name(dev))}</strong>: ${esc(e.message)}`, tag); return false; }
}

// ════════ STORAGE ════════
const STORAGE_KEYS = ['devices','savedPools','logs','lastSubnet','theme','tutorialDone','expandedCards','sortField','sortAsc','customOrder','deviceNicknames','sortLocked','deviceLabels','hashrateHistory','diffHistory','tempUnit','fontScale','autoConfig','poolRotationState','blockHistory','uptimeEvents','cardViewMode','deviceHrHistory','deviceIcons','prefs','uiVersion','activeView','chartTab','shareHits','autoState','poolCatalog','diffRangeH'];
function parseMaybe(v, fallback) { if (v == null) return fallback; if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fallback; } } return v; }
async function loadState() {
  const r = await chrome.storage.local.get(STORAGE_KEYS);
  devices = Array.isArray(r.devices) ? r.devices.filter((d) => d && d._ip) : [];
  savedPools = Array.isArray(r.savedPools) ? r.savedPools : [];
  activityLogs = Array.isArray(r.logs) ? r.logs : [];
  if (r.lastSubnet) $('subnetInput').value = r.lastSubnet;
  if (r.theme && THEMES.some((t) => t.id === r.theme)) currentTheme = r.theme;
  expandedCards = new Set(parseMaybe(r.expandedCards, []));
  if (r.sortField) sortField = r.sortField; if (r.sortAsc !== undefined) sortAsc = !!r.sortAsc;
  customOrder = parseMaybe(r.customOrder, []);
  sortLocked = !!r.sortLocked;
  deviceNicknames = parseMaybe(r.deviceNicknames, {}) || {};
  deviceLabels = parseMaybe(r.deviceLabels, {}) || {};
  hashrateHistory = Array.isArray(r.hashrateHistory) ? r.hashrateHistory : [];
  diffHistory = Array.isArray(r.diffHistory) ? r.diffHistory.filter((e) => e && e.devices && Object.values(e.devices)[0]?.intervalDiff !== undefined) : [];
  if (r.tempUnit === 'F' || r.tempUnit === 'C') tempUnit = r.tempUnit;
  if (r.prefs) prefs = { ...prefs, ...r.prefs };
  else if (r.fontScale && r.fontScale > 1) prefs.textScale = 1.12; // migrate v1 font toggle
  if (r.autoConfig) {
    for (const k of Object.keys(autoConfig)) if (r.autoConfig[k]) autoConfig[k] = { ...autoConfig[k], ...r.autoConfig[k] };
  }
  poolRotationState = r.poolRotationState || {};
  shareHits = Array.isArray(r.shareHits) ? r.shareHits : [];
  if (r.autoState && typeof r.autoState === 'object') autoState = { sched: r.autoState.sched || {}, quiet: r.autoState.quiet || {}, vr: r.autoState.vr || {} };
  if (r.poolCatalog && Array.isArray(r.poolCatalog.pools)) poolCatalog = r.poolCatalog;
  blockHistory = Array.isArray(r.blockHistory) ? r.blockHistory : [];
  uptimeEvents = Array.isArray(r.uptimeEvents) ? r.uptimeEvents : [];
  if (['minimal', 'balanced', 'detailed'].includes(r.cardViewMode)) cardViewMode = r.cardViewMode;
  deviceHrHistory = r.deviceHrHistory || {};
  deviceIcons = r.deviceIcons || {};
  if (['fleet', 'pools', 'automations', 'history'].includes(r.activeView)) activeView = r.activeView;
  if (r.chartTab === 'diff') chartTab = 'diff';
  // One-time move to the new look for people upgrading from 1.x
  if ((r.uiVersion || 0) < UI_VERSION) {
    currentTheme = DEFAULT_THEME;
    chrome.storage.local.set({ uiVersion: UI_VERSION, theme: currentTheme });
  }
  return r;
}
function saveDevices() { chrome.storage.local.set({ devices }); }
function savePools() { chrome.storage.local.set({ savedPools }); }
function saveLogs() { chrome.storage.local.set({ logs: activityLogs.slice(-MAX_LOGS) }); }
function saveExpanded() { chrome.storage.local.set({ expandedCards: JSON.stringify([...expandedCards]) }); }
function saveSortPrefs() { chrome.storage.local.set({ sortField, sortAsc, customOrder: JSON.stringify(customOrder), sortLocked }); }
function saveNicknames() { chrome.storage.local.set({ deviceNicknames: JSON.stringify(deviceNicknames) }); }
function saveLabels() { chrome.storage.local.set({ deviceLabels: JSON.stringify(deviceLabels) }); }
function saveAutoConfig() { chrome.storage.local.set({ autoConfig, poolRotationState }); }
function saveAutoState() { chrome.storage.local.set({ autoState }); }
function savePrefs() { chrome.storage.local.set({ prefs }); }

// ════════ ACTIVITY LOG ════════
function log(level, msg, tag) {
  const last = activityLogs[activityLogs.length - 1];
  if (last && last.level === level && last.msg === msg && (Date.now() - last.time) < 10 * 60 * 1000) {
    last.count = (last.count || 1) + 1; last.time = Date.now();
    saveLogs(); refreshTopLogEntry(last); bumpUnread(); if (tag === 'auto') renderAutoRecent(); return;
  }
  const entry = { time: Date.now(), level, msg };
  if (tag) entry.tag = tag;
  activityLogs.push(entry);
  if (activityLogs.length > MAX_LOGS) activityLogs = activityLogs.slice(-MAX_LOGS);
  saveLogs();
  if (logMatchesFilter(entry)) prependLogEntry(entry);
  bumpUnread();
  if (tag === 'auto') renderAutoRecent();
}
function bumpUnread() {
  if (activeView === 'history' && historyTab === 'activity' && !document.hidden) return;
  logUnread++; updateHistoryBadge();
}
function logMatchesFilter(e) {
  if (logLevelFilter === 'all') return true;
  if (logLevelFilter === 'action') return e.level === 'action' || e.level === 'success';
  return e.level === logLevelFilter;
}
function logEntryHTML(e) {
  const cnt = e.count && e.count > 1 ? `<span class="log-count">×${e.count}</span>` : '<span></span>';
  return `<span class="log-time">${fmt.time(new Date(e.time))}</span><span class="log-badge ${e.level}">${e.level}</span><span class="log-msg">${e.msg}</span>${cnt}`;
}
function renderLogs() {
  const c = $('logContainer');
  const list = activityLogs.filter(logMatchesFilter);
  if (!list.length) { c.innerHTML = `<div class="log-empty">${activityLogs.length ? 'Nothing matches this filter.' : 'No activity yet. Scans, restarts, pool changes and automation actions show up here.'}</div>`; return; }
  c.innerHTML = list.slice().reverse().map((e) => `<div class="log-entry">${logEntryHTML(e)}</div>`).join('');
}
function prependLogEntry(e) {
  const c = $('logContainer'); if (!c) return;
  c.querySelector('.log-empty')?.remove();
  const el = document.createElement('div'); el.className = 'log-entry'; el.innerHTML = logEntryHTML(e);
  c.prepend(el);
  while (c.children.length > MAX_LOGS) c.lastChild.remove();
}
function refreshTopLogEntry(e) {
  const el = $('logContainer')?.querySelector('.log-entry'); if (!el || !logMatchesFilter(e)) return;
  el.innerHTML = logEntryHTML(e); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function updateHistoryBadge() {
  const b = $('historyBadge'); const n = logUnread + blockUnread;
  if (n > 0) { b.textContent = n > 99 ? '99+' : n; b.hidden = false; } else b.hidden = true;
}

// ════════ TOASTS ════════
function toast(msg, kind = 'info', ms = 3600) {
  const host = $('toastHost');
  const t = document.createElement('div'); t.className = 'toast toast-' + kind; t.textContent = msg; t.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  host.appendChild(t);
  // Re-show so the host sits above any open modal dialog in the top layer
  try { if (host.matches(':popover-open')) host.hidePopover(); host.showPopover(); } catch {}
  setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); if (!host.children.length) { try { host.hidePopover(); } catch {} } }, 260); }, ms);
}

// ════════ DIALOGS ════════
function openDialog(id) { const d = $(id); if (!d) return; if (!d.open) d.showModal(); }
function closeDialog(id) { const d = $(id); if (d && d.open) d.close(); }
function wireDialogs() {
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => closeDialog(b.dataset.close)));
  // Light-dismiss fallback for engines without <dialog closedby>
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    $$('dialog[closedby="any"]').forEach((dlg) => dlg.addEventListener('click', (e) => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
      if (!inside) dlg.close();
    }));
  }
}
let confirmResolver = null;
function confirmDialog(message, { title = 'Are you sure?', ok = 'Confirm', danger = false } = {}) {
  $('confirmTitle').textContent = title; $('confirmMsg').textContent = message;
  const okBtn = $('confirmOk'); okBtn.textContent = ok; okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
  openDialog('confirmModal'); setTimeout(() => okBtn.focus(), 30);
  return new Promise((resolve) => { confirmResolver = resolve; });
}
function settleConfirm(v) { if (confirmResolver) { const r = confirmResolver; confirmResolver = null; r(v); } closeDialog('confirmModal'); }

// ════════ POPOVERS ════════
function placePopover(pop, anchor, align = 'end') {
  if (!anchor) return;
  const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 6;
  let left = align === 'end' ? r.right - pw : r.left;
  left = Math.max(8, Math.min(innerWidth - pw - 8, left));
  let top = r.bottom + gap;
  if (top + ph > innerHeight - 8 && r.top - gap - ph > 8) top = r.top - gap - ph;
  top = Math.max(8, Math.min(innerHeight - ph - 8, top));
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
}
function wirePopover(popId, anchorId) {
  const pop = $(popId);
  pop.addEventListener('toggle', (e) => { if (e.newState === 'open') placePopover(pop, $(anchorId)); });
}

// ════════ NAVIGATION ════════
const VIEW_TITLES = { fleet: 'Fleet', pools: 'Pools', automations: 'Automations', history: 'History' };
function showView(v, opts = {}) {
  if (!VIEW_TITLES[v]) v = 'fleet';
  activeView = v;
  $$('.view').forEach((s) => { s.hidden = s.id !== 'view-' + v; });
  $$('.nav-item[data-nav]').forEach((b) => { if (b.dataset.nav === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $('viewTitle').textContent = VIEW_TITLES[v];
  document.title = (v === 'fleet' ? '' : VIEW_TITLES[v] + ' · ') + 'AxeOS Fleet Manager';
  chrome.storage.local.set({ activeView: v });
  if (v === 'fleet') { requestAnimationFrame(() => { drawActiveChart(); drawSparklines(); }); }
  if (v === 'pools') renderPoolManager();
  if (v === 'automations') renderAutoPanel();
  if (v === 'history') showHistoryTab(opts.tab || historyTab);
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
}
function showHistoryTab(tab) {
  historyTab = tab;
  $$('#historyTabs .seg-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.htab === tab)));
  $$('.history-panel').forEach((p) => { p.hidden = p.dataset.hpanel !== tab; });
  $('activityActions').hidden = tab !== 'activity';
  if (tab === 'activity') { renderLogs(); logUnread = 0; }
  if (tab === 'downtime') renderUptimeHistory();
  if (tab === 'blocks') { renderBlockHistory(); blockUnread = 0; updateBlockBadge(); }
  updateHistoryBadge();
}

// ════════ SCAN & POLLING ════════
function setStatus(msg, cls) { const el = $('scanStatus'); el.textContent = msg; el.className = 'status-line' + (cls ? ' ' + cls : ''); }
async function scanNetwork() {
  const subnet = $('subnetInput').value.trim().replace(/\.$/, '');
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(subnet)) { setStatus('Enter three numbers, for example 192.168.1', 'error'); return; }
  $('subnetInput').value = subnet;
  chrome.storage.local.set({ lastSubnet: subnet });
  const btn = $('scanBtn'); btn.classList.add('is-busy'); btn.disabled = true; $('scanProgress').hidden = false;
  setStatus(`Checking ${subnet}.1 to ${subnet}.254…`, 'working');
  log('action', `Scanning <strong>${esc(subnet)}.0/24</strong>`);
  try {
    const found = await chrome.runtime.sendMessage({ type: 'SCAN_NETWORK', subnet });
    if (found && found.length) {
      let added = 0;
      found.forEach((nd) => { const idx = devices.findIndex((d) => d._ip === nd._ip); if (idx >= 0) devices[idx] = { ...devices[idx], ...nd, _offline: false }; else { devices.push({ ...nd, _offline: false }); added++; } });
      saveDevices();
      setStatus(`Found ${found.length} miner${found.length === 1 ? '' : 's'}${added ? `, ${added} new` : ''}.`, 'success');
      log('success', `Scan found <strong>${found.length}</strong> device(s), ${added} new`);
      if (added && sortField === 'custom') updateCustomOrderFromDevices();
    } else { setStatus('No miners answered on that subnet. Check the numbers, or add one by IP.', 'error'); log('warn', 'Scan found no devices'); }
  } catch (err) { setStatus('Scan failed: ' + err.message, 'error'); log('error', `Scan failed: ${esc(err.message)}`); }
  btn.classList.remove('is-busy'); btn.disabled = false; $('scanProgress').hidden = true;
  renderAll();
}
async function addManualDevice(ipArg) {
  const ipInput = $('manualIpInput'); const ip = (ipArg || ipInput.value).trim();
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) { setStatus('Enter a full IP address, for example 192.168.1.50', 'error'); return false; }
  if (findDev(ip)) { setStatus(`${ip} is already in your fleet.`, 'error'); return false; }
  setStatus(`Connecting to ${ip}…`, 'working');
  try {
    const data = await chrome.runtime.sendMessage({ type: 'FETCH_DEVICE_INFO', ip });
    if (data && (data.ASICModel || data.asicModel || data.deviceModel)) {
      devices.push({ ...data, _offline: false }); saveDevices(); ipInput.value = '';
      updateCustomOrderFromDevices();
      setStatus(`Added ${D.name(data)}.`, 'success'); log('success', `Added <strong>${esc(D.name(data))}</strong> (${ip})`);
      renderAll(); return true;
    }
    setStatus(`Nothing at ${ip} answered like an AxeOS miner.`, 'error'); log('warn', `No miner at ${ip}`);
  } catch (err) { setStatus(`Can't reach ${ip}.`, 'error'); log('error', `${ip}: ${esc(err.message)}`); }
  return false;
}

async function refreshAllDevices() {
  if (!devices.length || refreshing) return;
  refreshing = true; updateSyncState();
  try {
    const ips = devices.map((d) => d._ip);
    const results = await Promise.all(ips.map((ip) => chrome.runtime.sendMessage({ type: 'FETCH_DEVICE_INFO', ip }).catch(() => null)));
    const cap = hrHistoryCap();
    results.forEach((data, i) => {
      const idx = devices.findIndex((d) => d._ip === ips[i]); if (idx < 0) return; // removed meanwhile
      const dev = devices[idx];
      if (data) {
        if (dev._offline && dev._everSeen !== false) {
          const out = ongoingOutage(dev._ip);
          log('success', `<strong>${esc(D.name(dev))}</strong> is back online${out ? ' after ' + fmt.dur(Date.now() - out.offAt) : ''}`);
          notify('offline', `${D.name(dev)} is back online`, out ? `Down for ${fmt.dur(Date.now() - out.offAt)}` : dev._ip);
          recordBackOnline(dev._ip);
        }
        devices[idx] = { ...dev, ...data, _offline: false, _everSeen: true };
        const h = (deviceHrHistory[dev._ip] = deviceHrHistory[dev._ip] || []);
        h.push(D.hr(devices[idx])); while (h.length > cap) h.shift();
      } else {
        if (!dev._offline) {
          log('warn', `<strong>${esc(D.name(dev))}</strong> went offline`);
          notify('offline', `${D.name(dev)} went offline`, `No answer from ${dev._ip}`);
          recordWentOffline(dev);
        }
        dev._offline = true;
      }
    });
    chrome.storage.local.set({ deviceHrHistory });
    lastRefresh = Date.now();
    chrome.storage.local.set({ lastRefresh });
    saveDevices();
    updateHashrateHistory();
    trackShareHits();
    syncCollector();
    renderUptimeMonitor();
    updateCardsInPlace();
    renderOverview();
    populateDiffDeviceSelect();
    if (chartTab === 'diff' && !diffLiveMode) drawDiffChart();
    if (!applyInProgress) renderApplyDevices();
    renderPoolListUsage();
    if (activeView === 'automations') refreshAutoLists();
    updateAutoStatus();
    updateActionBadge();
    try { checkBlockFound(); } catch (e) { console.error('checkBlockFound', e); }
    await runAutomations();
  } finally { refreshing = false; updateSyncState(); }
}
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (devices.length) refreshAllDevices(); }, (prefs.pollSec || 10) * 1000);
}
function updateSyncState() {
  const el = $('syncState'), txt = $('syncText');
  el.classList.remove('live', 'busy', 'warn');
  if (!devices.length) { txt.textContent = 'No devices yet'; return; }
  if (refreshing && !lastRefresh) { el.classList.add('busy'); txt.textContent = 'Connecting…'; return; }
  const off = devices.filter((d) => d._offline).length;
  const stale = lastRefresh && (Date.now() - lastRefresh) > (prefs.pollSec * 3000);
  el.classList.add(stale || off === devices.length ? 'warn' : 'live');
  txt.textContent = lastRefresh ? `Updated ${fmt.ago(lastRefresh)}` : 'Waiting for first update';
}

// ════════ HISTORY SERIES ════════
function updateHashrateHistory() {
  const on = devices.filter((d) => !d._offline);
  const total = on.reduce((s, d) => s + D.hr(d), 0);
  hashrateHistory.push({ time: Date.now(), value: total, online: on.length, offline: devices.length - on.length });
  while (hashrateHistory.length > MAX_HISTORY) hashrateHistory.shift();
  // Difficulty produced per interval = new accepted shares × pool difficulty
  const dd = {};
  on.forEach((d) => {
    const ip = d._ip, sharesNow = D.shares(d), poolDiff = D.poolDiff(d) || 1;
    let intervalDiff = 0;
    if (prevShares[ip] !== undefined) intervalDiff = Math.max(0, sharesNow - prevShares[ip]) * poolDiff;
    prevShares[ip] = sharesNow;
    dd[ip] = { intervalDiff, poolDiff, bestSession: D.bestSession(d), shares: sharesNow, name: D.name(d) };
  });
  diffHistory.push({ time: Date.now(), devices: dd });
  while (diffHistory.length > MAX_HISTORY) diffHistory.shift();
  chrome.storage.local.set({ hashrateHistory, diffHistory });
}

// ════════ CHARTS ════════
function setupCanvas(canvas) {
  const wrap = canvas.parentElement; const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return null;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  return { ctx, W, H };
}
function chartFont(size, weight = 500) { return `${weight} ${size}px Archivo, system-ui, sans-serif`; }
function emptyChartMessage(ctx, W, H, text) {
  ctx.fillStyle = cssVar('--text-3', '#888'); ctx.font = chartFont(13); ctx.textAlign = 'center'; ctx.fillText(text, W / 2, H / 2);
}
function hrAxisLabel(v, max, range) {
  // Enough decimals that neighbouring gridlines never print the same label
  const th = max >= 1000, step = (range || max) / 4 / (th ? 1000 : 1);
  const dec = Math.min(3, Math.max(0, Math.ceil(-Math.log10(step || 1)) + (step < 1 ? 0 : 0)));
  return (th ? (v / 1000).toFixed(Math.max(dec, max >= 10000 ? 1 : 2)) + ' TH' : v.toFixed(dec) + ' GH');
}
function timeLabel(ts, span) { return new Date(ts).toLocaleTimeString([], span < 15 * 60000 ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' }); }
function drawActiveChart() { if (chartTab === 'hashrate') drawHashrateChart(); else drawDiffChart(); }

let hoverHashIdx = -1;
function drawHashrateChart() {
  const canvas = $('hashrateChart'); if (!canvas || activeView !== 'fleet' || chartTab !== 'hashrate') return;
  const s = setupCanvas(canvas); if (!s) return; const { ctx, W, H } = s;
  const line = cssVar('--chart-line', '#F2B544'), fill = cssVar('--chart-fill', 'rgba(242,181,68,.2)'), grid = cssVar('--grid', '#333'), txt = cssVar('--text-3', '#777'), gold = cssVar('--gold', '#FFD66B');
  if (hashrateHistory.length < 2) { chartPoints = []; emptyChartMessage(ctx, W, H, devices.length ? 'The graph fills in after a couple of refreshes.' : 'Add devices to start charting your fleet.'); return; }
  const vals = hashrateHistory.map((h) => h.value);
  const dMin = Math.min(...vals), dMax = Math.max(...vals), range = dMax - dMin;
  const padV = range < 0.01 ? Math.max(dMax * 0.1, 0.5) : range * 0.18;
  const minV = Math.max(0, dMin - padV), maxV = dMax + padV;
  const pT = 10, pB = 24, pL = 66, pR = 10, pW = W - pL - pR, pH = H - pT - pB;
  ctx.font = chartFont(11); ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pT + (pH / 4) * i;
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pL, Math.round(y) + .5); ctx.lineTo(W - pR, Math.round(y) + .5); ctx.stroke();
    ctx.fillStyle = txt; ctx.fillText(hrAxisLabel(maxV - ((maxV - minV) / 4) * i, maxV, maxV - minV), pL - 8, y + 4);
  }
  // time axis
  ctx.textAlign = 'center';
  const t0 = hashrateHistory[0].time, t1 = hashrateHistory[hashrateHistory.length - 1].time;
  const ticks = Math.min(6, Math.max(2, Math.floor(pW / 110)));
  for (let i = 0; i <= ticks; i++) { const t = t0 + (t1 - t0) * i / ticks; const x = pL + pW * i / ticks; ctx.fillText(timeLabel(t, t1 - t0), Math.min(W - 30, Math.max(pL + 24, x)), H - 6); }
  const pts = vals.map((v, i) => ({ x: pL + (i / (vals.length - 1)) * pW, y: pT + pH - ((v - minV) / (maxV - minV)) * pH, idx: i }));
  const grad = ctx.createLinearGradient(0, pT, 0, H - pB); grad.addColorStop(0, fill); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.moveTo(pts[0].x, H - pB); pts.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.lineTo(pts[pts.length - 1].x, H - pB); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  // offline dips: mark samples where devices were offline
  ctx.fillStyle = cssVar('--bad', '#f55');
  hashrateHistory.forEach((h, i) => { if (h.offline) { ctx.globalAlpha = .55; ctx.fillRect(pts[i].x - 1, H - pB + 2, 2, 4); } });
  ctx.globalAlpha = 1;
  const last = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = line; ctx.fill();
  chartPoints = pts;
  // block-found markers
  blockHistory.forEach((b) => {
    let bi = -1, bd = Infinity;
    hashrateHistory.forEach((h, i) => { const d = Math.abs(h.time - b.time); if (d < bd) { bd = d; bi = i; } });
    if (bi < 0 || bd > 60000 || !pts[bi]) return;
    const bx = pts[bi].x;
    ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = gold; ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(bx, pT); ctx.lineTo(bx, H - pB); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.fillStyle = gold; ctx.arc(bx, pT + 4, 4, 0, Math.PI * 2); ctx.fill();
  });
  // hover crosshair
  if (hoverHashIdx >= 0 && pts[hoverHashIdx]) {
    const p = pts[hoverHashIdx];
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = line; ctx.globalAlpha = .5; ctx.beginPath(); ctx.moveTo(p.x, pT); ctx.lineTo(p.x, H - pB); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = line; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.strokeStyle = withAlpha(line, .35); ctx.lineWidth = 2; ctx.stroke();
  }
}
function initChartHover() {
  const canvas = $('hashrateChart'), tt = $('chartTooltip');
  canvas.addEventListener('pointermove', (e) => {
    if (!chartPoints.length) return;
    const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left;
    let best = null, md = Infinity; chartPoints.forEach((p) => { const dx = Math.abs(p.x - mx); if (dx < md) { md = dx; best = p; } });
    if (!best || md > 40) { tt.hidden = true; hoverHashIdx = -1; drawHashrateChart(); return; }
    const entry = hashrateHistory[best.idx]; if (!entry) return;
    const near = blockHistory.find((b) => Math.abs(b.time - entry.time) < 60000);
    tt.innerHTML = `<span class="ct-time">${fmt.datetime(new Date(entry.time))}</span><span class="ct-val">${fmt.hr(entry.value)}</span>${entry.online != null ? `<span class="ct-sub">${entry.online} online${entry.offline ? `, ${entry.offline} offline` : ''}</span>` : ''}${near ? `<span class="ct-block">Block found by ${esc(near.deviceName)}</span>` : ''}`;
    tt.hidden = false;
    const cw = canvas.clientWidth, tw = tt.offsetWidth, th = tt.offsetHeight;
    let tx = best.x - tw / 2, ty = best.y - th - 14; if (tx < 4) tx = 4; if (tx + tw > cw - 4) tx = cw - tw - 4; if (ty < 4) ty = best.y + 14;
    tt.style.left = tx + 'px'; tt.style.top = ty + 'px';
    if (hoverHashIdx !== best.idx) { hoverHashIdx = best.idx; drawHashrateChart(); }
  });
  canvas.addEventListener('pointerleave', () => { tt.hidden = true; hoverHashIdx = -1; drawHashrateChart(); });
}

// ─── Share difficulty ───
// AxeOS does not report individual shares, but it does report the session
// best. Whenever that number rises between two refreshes, a share of exactly
// that difficulty was just found. Those are the shares worth plotting: the
// big ones. Old versions plotted "shares × pool difficulty" per interval,
// which flattened every big hit into the average.
function trackShareHits() {
  const now = Date.now(); let added = 0;
  devices.forEach((d) => {
    if (d._offline) return;
    const ip = d._ip, sess = D.bestSession(d), best = D.bestDiff(d), up = D.uptime(d);
    const p = prevBestSeen[ip];
    prevBestSeen[ip] = { sess, best, up };
    if (!p) return; // first sighting is the baseline
    const restarted = (p.up && up + 30 < p.up) || sess < p.sess;
    const base = { time: now, ip, name: D.name(d), pool: D.poolDiff(d), net: D.netDiff(d) };
    const record = (diff, kind) => {
      // The collector may already have this exact share: upgrade it instead of adding a twin
      const twin = shareHits.find((x) => x.ip === ip && x.kind === 'share' && now - x.time < 10 * 60000 && Math.abs(x.diff - diff) / diff < 0.01);
      if (twin) twin.kind = kind; else shareHits.push({ ...base, diff, kind });
      added++;
    };
    if (best > p.best && p.best > 0) record(best, 'best');
    else if (!restarted && sess > p.sess && p.sess > 0) record(sess, 'session');
  });
  if (!added) return;
  if (shareHits.length > MAX_SHARE_HITS) shareHits = shareHits.slice(-MAX_SHARE_HITS);
  chrome.storage.local.set({ shareHits });
  if (chartTab === 'diff' && !diffLiveMode) drawDiffChart();
}
function diffRangeHours() { const v = $('diffRange') ? +$('diffRange').value : 24; return isNaN(v) ? 24 : v; }
function rangeLabel(h) { return h === 1 ? 'hour' : h === 24 ? '24 hours' : h === 168 ? '7 days' : 'history'; }
function diffAxisLabel(v) {
  const units = [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'K']];
  for (const [n, u] of units) if (v >= n) { const x = v / n; return (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(0) : x.toFixed(x % 1 ? 1 : 0)) + u; }
  return v.toFixed(0);
}
function pctOfBlock(diff, net) {
  if (!net || !diff) return '';
  const pct = diff / net * 100;
  const s = pct >= 1 ? pct.toFixed(1) : pct >= 0.01 ? pct.toFixed(3) : pct.toPrecision(2);
  return diff >= net ? 'Enough for a block' : `${s}% of a block · ${Math.round(net / diff).toLocaleString()}× short`;
}
function diffColorOf(ip, sel) {
  if (diffLiveMode || sel !== 'all') return cssVar('--chart-line', '#F2B544');
  const colors = seriesColors(); const i = devices.findIndex((d) => d._ip === ip);
  return colors[(i < 0 ? devices.length : i) % colors.length];
}

let hoverDiffIdx = -1;
function drawDiffChart() {
  const canvas = $('diffChart'); if (!canvas || activeView !== 'fleet' || chartTab !== 'diff') return;
  const s = setupCanvas(canvas); if (!s) return; const { ctx, W, H } = s;
  try {
    const grid = cssVar('--grid', '#333'), txt = cssVar('--text-3', '#777'), txt2 = cssVar('--text-2', '#aaa'), accent = cssVar('--chart-line', '#F2B544');
    const gold = cssVar('--gold', '#FFD66B'), bad = cssVar('--bad', '#f55'), surf = cssVar('--surface', '#111');
    const sel = $('diffChartDevice')?.value || 'all', now = Date.now();
    const scopeIps = diffLiveMode ? [diffLiveIp] : sel === 'all' ? devices.map((d) => d._ip) : [sel];
    const scope = scopeIps.map(findDev).filter(Boolean);
    let pts, t0, t1 = now;
    if (diffLiveMode) {
      pts = diffLivePoints.filter((p) => !p.isSeed).map((p) => ({ time: p.time, diff: p.val, ip: diffLiveIp, kind: 'share' }));
      t0 = Math.min(diffLiveStart || now, pts.length ? pts[0].time : now);
      if (now - t0 > 30 * 60000) { t0 = now - 30 * 60000; pts = pts.filter((p) => p.time >= t0); } // keep the last 30 min readable
      t1 = Math.max(now, t0 + 60000);
    } else {
      const h = diffRangeHours(), ipset = new Set(scopeIps);
      const minD = prefs.shareMin || 0;
      pts = shareHits.filter((x) => ipset.has(x.ip) && (!h || x.time >= now - h * 3600000) && (x.kind === 'best' || x.diff >= minD));
      t0 = h ? now - h * 3600000 : Math.min(now - 3600000, ...pts.map((p) => p.time));
    }
    // Reference levels for the devices in view
    const maxOf = (fn, list = scope) => list.reduce((m, d) => Math.max(m, fn(d) || 0), 0);
    const poolD = maxOf(D.poolDiff), sessB = maxOf(D.bestSession, scope.filter((d) => !d._offline)), bestB = maxOf(D.bestDiff), net = maxOf(D.netDiff);
    const refs = [
      net && { v: net, label: 'Block', color: bad, dash: [6, 4] },
      bestB && { v: bestB, label: 'Best ever', color: gold, dash: [4, 4] },
      sessB && { v: sessB, label: 'Session best', color: accent, dash: [2, 4] },
      !diffLiveMode && prefs.shareMin > 0 && { v: prefs.shareMin, label: 'Your minimum', color: txt2, dash: [8, 3] },
      poolD && { v: poolD, label: 'Pool', color: txt, dash: [1, 3] },
    ].filter(Boolean).reduce((acc, r) => { const twin = acc.find((x) => Math.abs(Math.log10(x.v) - Math.log10(r.v)) < 0.02); if (twin) twin.label += ' = ' + r.label; else acc.push(r); return acc; }, []);
    const vals = pts.map((p) => p.diff).concat(refs.map((r) => r.v)).filter((v) => v > 0);
    if (!vals.length) { diffChartRender = null; emptyChartMessage(ctx, W, H, devices.length ? 'Waiting for the first refresh.' : 'Add devices to see share difficulty.'); updateDiffLegend(sel, pts, scope); return; }
    let lMin = Math.floor(Math.log10(Math.max(1, Math.min(...vals))) - 0.2), lMax = Math.ceil(Math.log10(Math.max(...vals)) + 0.25);
    if (lMax - lMin < 3) lMax = lMin + 3;
    const pad = { left: 50, right: 12, top: 14, bottom: 24 }, cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
    const X = (t) => pad.left + ((t - t0) / Math.max(1, t1 - t0)) * cw;
    const Y = (v) => pad.top + ch - ((Math.log10(Math.max(v, 1)) - lMin) / (lMax - lMin)) * ch;
    // decade grid (log scale: each line is 10× the one below)
    const step = lMax - lMin > 9 ? 2 : 1;
    ctx.font = chartFont(11); ctx.textAlign = 'right'; ctx.lineWidth = 1;
    for (let e = lMin; e <= lMax; e += step) {
      const y = Math.round(Y(10 ** e)) + .5;
      ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = txt; ctx.fillText(diffAxisLabel(10 ** e), pad.left - 7, y + 4);
    }
    ctx.textAlign = 'center';
    const ticks = Math.min(6, Math.max(2, Math.floor(cw / 110)));
    for (let i = 0; i <= ticks; i++) { const t = t0 + (t1 - t0) * i / ticks; ctx.fillText(t1 - t0 > 2 * 86400000 ? new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }) : timeLabel(t, t1 - t0), Math.min(W - 30, Math.max(pad.left + 24, pad.left + cw * i / ticks)), H - 6); }
    // reference lines with non-overlapping labels
    const used = [], refLabels = [];
    refs.forEach((r) => {
      const y = Y(r.v);
      ctx.save(); ctx.setLineDash(r.dash); ctx.strokeStyle = r.color; ctx.globalAlpha = .75; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke(); ctx.restore();
      let ly = y - 5; while (used.some((u) => Math.abs(u - ly) < 13)) ly -= 13;
      if (ly < pad.top + 8) ly = y + 13;
      used.push(ly);
      refLabels.push({ ly, label: `${r.label} ${fmt.diff(r.v)}`, color: r.color });
    });
    // Labels go on top of the points (drawn at the end)
    const drawRefLabels = () => refLabels.forEach(({ ly, label, color }) => {
      ctx.font = chartFont(10.5, 650); const tw = ctx.measureText(label).width;
      ctx.fillStyle = surf; ctx.globalAlpha = .92; ctx.fillRect(W - pad.right - tw - 9, ly - 10, tw + 8, 14); ctx.globalAlpha = 1;
      ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(label, W - pad.right - 5, ly);
    });
    // points drawn as lollipops rising from the pool difficulty floor
    const baseY = poolD ? Y(poolD) : pad.top + ch;
    const stems = pts.length < 250;
    const rendered = [];
    pts.forEach((p) => {
      const x = X(p.time), y = Y(p.diff);
      const col = p.kind === 'best' ? gold : diffColorOf(p.ip, sel);
      if (stems) { ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = diffLiveMode ? .22 : .4; ctx.lineWidth = diffLiveMode ? 1 : 1.5; ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); }
      const r = p.kind === 'share' ? 2.8 : p.kind === 'best' ? 5.5 : 4.2;
      ctx.beginPath(); ctx.arc(x, y, pts.length > 800 && p.kind === 'share' ? 2 : r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      if (p.kind === 'best') { ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, Math.PI * 2); ctx.strokeStyle = withAlpha(gold, .5); ctx.lineWidth = 2; ctx.stroke(); }
      rendered.push({ x, y, p, col });
    });
    drawRefLabels();
    if (hoverDiffIdx >= 0 && rendered[hoverDiffIdx]) {
      const h = rendered[hoverDiffIdx];
      ctx.beginPath(); ctx.arc(h.x, h.y, 9, 0, Math.PI * 2); ctx.strokeStyle = withAlpha(h.col, .45); ctx.lineWidth = 2; ctx.stroke();
    }
    if (!pts.length) {
      const msg = diffLiveMode ? 'Waiting for the first share…' : prefs.shareMin > 0 ? `No share at or above ${diffShort(prefs.shareMin)} in the last ${rangeLabel(diffRangeHours())}${collectorOn ? ' yet' : ''}.` : `No share beat a session best in the last ${rangeLabel(diffRangeHours())}. The lines show where your miners stand.`;
      ctx.font = chartFont(12.5, 550); const tw = Math.min(cw - 20, ctx.measureText(msg).width);
      ctx.fillStyle = surf; ctx.globalAlpha = .88; ctx.fillRect(pad.left + cw / 2 - tw / 2 - 10, pad.top + ch / 2 - 16, tw + 20, 28); ctx.globalAlpha = 1;
      ctx.fillStyle = txt2; ctx.textAlign = 'center'; ctx.fillText(msg, pad.left + cw / 2, pad.top + ch / 2 + 3, cw - 20);
    }
    diffChartRender = { pts: rendered, net, live: diffLiveMode };
    updateDiffLegend(sel, pts, scope);
  } catch (e) { console.error('drawDiffChart', e); }
}
function updateDiffLegend(sel, pts, scope) {
  const el = $('diffLegend'); if (!el) return;
  const items = [];
  if (!diffLiveMode && sel === 'all' && scope.length > 1) {
    scope.forEach((d) => { const n = pts.filter((p) => p.ip === d._ip).length; items.push(`<span><i style="background:${diffColorOf(d._ip, sel)}"></i>${esc(D.name(d))}${n ? ` <b>${n}</b>` : ''}</span>`); });
  }
  if (!diffLiveMode) items.push(`<span><i style="background:${cssVar('--gold', '#FFD66B')}"></i>New best ever</span>`);
  if (!diffLiveMode && prefs.shareMin > 0) items.push(`<span style="color:${cssVar('--text-2', '#aaa')}"><i class="line"></i>Your minimum</span>`);
  items.push(`<span style="color:${cssVar('--bad', '#f55')}"><i class="line"></i>Block</span><span style="color:${cssVar('--text-3', '#777')}"><i class="line"></i>Pool floor</span>`);
  el.innerHTML = items.join('');
}
function initDiffChartHover() {
  const canvas = $('diffChart'), tt = $('diffChartTooltip');
  const hide = () => { tt.hidden = true; if (hoverDiffIdx !== -1) { hoverDiffIdx = -1; drawDiffChart(); } };
  canvas.addEventListener('pointermove', (e) => {
    const R = diffChartRender; if (!R || !R.pts.length) { tt.hidden = true; return; }
    const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let bi = -1, bd = Infinity;
    R.pts.forEach((q, i) => { const d = (q.x - mx) ** 2 + (q.y - my) ** 2 * 0.35; if (d < bd) { bd = d; bi = i; } });
    if (bi < 0 || bd > 22 * 22) { hide(); return; }
    const { p, x, y, col } = R.pts[bi];
    const dev = findDev(p.ip), name = dev ? D.name(dev) : (p.name || p.ip);
    const kind = p.kind === 'best' ? 'New best ever' : p.kind === 'session' ? 'New session best' : 'Share';
    tt.innerHTML = `<span class="ct-kind" style="color:${col}">${kind}</span><span class="ct-val">${fmt.diff(p.diff)}</span><span class="ct-sub">${esc(name)} · ${fmt.datetime(new Date(p.time))}</span>${(p.net || R.net) ? `<span class="ct-sub">${pctOfBlock(p.diff, p.net || R.net)}</span>` : ''}`;
    tt.hidden = false;
    const cw = canvas.clientWidth, tw = tt.offsetWidth, th = tt.offsetHeight;
    let tx = x - tw / 2, ty = y - th - 14; if (tx < 4) tx = 4; if (tx + tw > cw - 4) tx = cw - tw - 4; if (ty < 4) ty = y + 14;
    tt.style.left = tx + 'px'; tt.style.top = ty + 'px';
    if (hoverDiffIdx !== bi) { hoverDiffIdx = bi; drawDiffChart(); }
  });
  canvas.addEventListener('pointerleave', hide);
}
function setChartTab(tab) {
  chartTab = tab === 'diff' ? 'diff' : 'hashrate';
  chrome.storage.local.set({ chartTab });
  $$('.pulse .seg-btn[data-chart]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.chart === chartTab)));
  $('chartPanelHashrate').hidden = chartTab !== 'hashrate';
  $('chartPanelDiff').hidden = chartTab !== 'diff';
  requestAnimationFrame(drawActiveChart);
}
function populateDiffDeviceSelect() {
  const sel = $('diffChartDevice'); if (!sel) return;
  const val = sel.value;
  const sig = devices.map((d) => d._ip + D.name(d)).join('|');
  if (sel._sig !== sig) {
    sel._sig = sig;
    sel.innerHTML = '<option value="all">All devices</option>' + devices.map((d) => `<option value="${esc(d._ip)}">${esc(D.name(d))}</option>`).join('');
  }
  sel.value = devices.some((d) => d._ip === val) ? val : 'all';
  updateDiffLiveUI();
}

// ════════ OVERVIEW ════════
function renderOverview() {
  const on = devices.filter((d) => !d._offline);
  const totCur = on.reduce((s, d) => s + D.hr(d), 0), tot1h = on.reduce((s, d) => s + D.hr1h(d), 0), tot24h = on.reduce((s, d) => s + D.hr24h(d), 0);
  const p = fmt.hrParts(totCur);
  $('ovCurrentHR').textContent = p.v; $('ovCurrentUnit').textContent = p.u;
  $('ov1hHR').textContent = on.length ? fmt.hr(tot1h) : '--';
  $('ov24hHR').textContent = on.length ? fmt.hr(tot24h) : '--';
  $('ovDevices').textContent = `${on.length}/${devices.length}`;
  const ups = on.map((d) => D.uptime(d)).filter(Boolean);
  $('ovUptime').textContent = 'average uptime ' + (ups.length ? fmt.uptime(ups.reduce((a, b) => a + b, 0) / ups.length) : '--');
  const watts = on.reduce((s, d) => s + D.power(d), 0);
  $('ovPower').textContent = watts ? (watts >= 1000 ? (watts / 1000).toFixed(2) + ' kW' : watts.toFixed(0) + ' W') : '0 W';
  $('ovEff').textContent = totCur > 0 && watts ? (watts / (totCur / 1000)).toFixed(1) + ' J/TH fleet efficiency' : 'efficiency --';
  const kwh = watts * 24 / 1000;
  $('ovKwh').textContent = kwh.toFixed(2) + ' kWh a day';
  if (prefs.kwhPrice > 0) { $('ovCost').textContent = fmt.money(kwh * prefs.kwhPrice) + '/day'; $('ovCostStat').title = `${fmt.money(kwh * prefs.kwhPrice * 30)} a month at ${fmt.money(prefs.kwhPrice)} per kWh`; }
  else { $('ovCost').textContent = 'Set price'; $('ovCostStat').title = 'Set your electricity price in Settings'; }
  const temps = on.map((d) => ({ d, t: D.chipTemp(d) })).filter((x) => x.t != null && x.t > 0);
  $('ovAvgTemp').textContent = temps.length ? dispTempShort(temps.reduce((a, b) => a + b.t, 0) / temps.length) : '--';
  if (temps.length) { const hot = temps.reduce((a, b) => (b.t > a.t ? b : a)); $('ovMaxTemp').textContent = `hottest ${D.name(hot.d)} at ${dispTempShort(hot.t)}`; $('ovAvgTemp').className = 'stat-val ' + tempClass(hot.t); }
  else { $('ovMaxTemp').textContent = 'hottest --'; $('ovAvgTemp').className = 'stat-val'; }
  const acc = on.reduce((s, d) => s + D.shares(d), 0), rej = on.reduce((s, d) => s + D.rejected(d), 0);
  $('ovShares').textContent = acc.toLocaleString();
  $('ovRejected').textContent = `${rej.toLocaleString()} rejected${acc + rej ? ` (${(rej / (acc + rej) * 100).toFixed(2)}%)` : ''}`;
  let bd = 0, bs = 0; devices.forEach((d) => { if (D.bestDiff(d) > bd) bd = D.bestDiff(d); if (!d._offline && D.bestSession(d) > bs) bs = D.bestSession(d); });
  $('ovBestDiff').textContent = fmt.diff(bd); $('ovBestSession').textContent = 'session best ' + fmt.diff(bs);
  $('devicesCount').textContent = devices.length ? String(devices.length) : '';
  drawHashrateChart();
}

// ════════ HEALTH STRIP (uptime monitor) ════════
let uptimeSig = '';
function renderUptimeMonitor() {
  const bar = $('uptimeMonitor'); if (!bar) return;
  if (!devices.length) { bar.hidden = true; uptimeSig = ''; return; }
  bar.hidden = false;
  const total = devices.length, online = devices.filter((d) => !d._offline).length, offline = total - online;
  const recent = uptimeEvents.slice(0, 8);
  const sig = online + '|' + devices.map((d) => d._ip + (d._offline ? 0 : 1) + D.name(d)).join(',') + '|' + recent.map((e) => e.ip + e.offAt + (e.backAt || '')).join(',');
  if (sig === uptimeSig) return; uptimeSig = sig;
  bar.classList.toggle('alert', offline > 0);
  const segs = devices.map((d) => `<span class="um-seg${d._offline ? ' off' : ''}" title="${esc(D.name(d))}: ${d._offline ? 'offline' : 'online'}"></span>`).join('');
  const pills = recent.map((e) => e.backAt === null
    ? `<span class="um-pill down"><span class="d"></span><strong>${esc(e.name)}</strong> offline since <time>${fmt.clock(e.offAt)}</time></span>`
    : `<span class="um-pill"><span class="d"></span><strong>${esc(e.name)}</strong> was down ${fmt.dur(e.backAt - e.offAt)} <time>${fmt.clock(e.offAt)}</time></span>`).join('');
  bar.innerHTML = `
    <div class="um-ring" style="--pct:${Math.round(online / total * 100)}"><span>${online}/${total}</span></div>
    <div class="um-state"><strong>${offline ? `${offline} offline` : 'All devices online'}</strong><span>${uptimeEvents.length ? `${uptimeEvents.length} outage${uptimeEvents.length === 1 ? '' : 's'} recorded` : 'No outages recorded'}</span></div>
    <div class="um-segs">${segs}</div>
    <div class="um-events"><div class="um-track">${pills || '<span class="um-pill"><span class="d"></span>Stable. No downtime since monitoring began.</span>'}</div></div>
    <button class="btn sm" id="umHistoryBtn">${ic('history')}Downtime</button>`;
  $('umHistoryBtn').addEventListener('click', () => showView('history', { tab: 'downtime' }));
  requestAnimationFrame(() => {
    const wrap = bar.querySelector('.um-events'), track = bar.querySelector('.um-track');
    if (wrap && track && pills && track.scrollWidth > wrap.clientWidth) {
      track.innerHTML = track.innerHTML + track.innerHTML; track.classList.add('scroll');
      track.style.setProperty('--dur', Math.max(20, recent.length * 7) + 's');
    }
  });
}
function recordWentOffline(dev) {
  uptimeEvents.unshift({ ip: dev._ip, name: D.name(dev), offAt: Date.now(), backAt: null });
  if (uptimeEvents.length > 300) uptimeEvents.pop();
  chrome.storage.local.set({ uptimeEvents });
}
function recordBackOnline(ip) {
  const ev = uptimeEvents.find((e) => e.ip === ip && e.backAt === null);
  if (ev) ev.backAt = Date.now();
  chrome.storage.local.set({ uptimeEvents });
  checkFlapRecovery(ip);
}

// ════════ DEVICE GRID ════════
function ipToNum(ip) { const p = String(ip).split('.'); return (((+p[0]) << 24) >>> 0) + ((+p[1]) << 16) + ((+p[2]) << 8) + (+p[3]); }
function getSortedDevices(list) {
  if (sortField === 'custom') {
    if (!customOrder.length) return list;
    const om = new Map(customOrder.map((ip, i) => [ip, i]));
    return [...list].sort((a, b) => (om.get(a._ip) ?? 9999) - (om.get(b._ip) ?? 9999));
  }
  const fns = { hashrate: (d) => D.hr(d), bestdiff: (d) => D.bestDiff(d), uptime: (d) => D.uptime(d), ip: (d) => ipToNum(d._ip), name: (d) => D.name(d).toLowerCase(), temp: (d) => D.chipTemp(d) ?? 0, efficiency: (d) => D.eff(d) ?? 1e9 };
  const fn = fns[sortField]; if (!fn) return list;
  return [...list].sort((a, b) => { const va = fn(a), vb = fn(b); if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va); return sortAsc ? va - vb : vb - va; });
}
function updateCustomOrderFromDevices() {
  const known = new Set(customOrder);
  devices.forEach((d) => { if (!known.has(d._ip)) customOrder.push(d._ip); });
  customOrder = customOrder.filter((ip) => devices.some((d) => d._ip === ip));
  saveSortPrefs();
}
function filteredDevices() {
  const q = searchQuery.trim().toLowerCase();
  let list = devices.filter((d) => {
    if (typeFilter === 'offline' && !d._offline) return false;
    if ((typeFilter === 'bitaxe' || typeFilter === 'nerdqaxe') && D.type(d) !== typeFilter) return false;
    if (labelFilter && !(deviceLabels[d._ip] || []).some((l) => l.text === labelFilter)) return false;
    if (q) {
      const hay = [D.name(d), d._ip, d.hostname, D.model(d), D.poolUrl(d), ...(deviceLabels[d._ip] || []).map((l) => l.text)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return getSortedDevices(list);
}
let renderedIps = '';
function renderDevices() {
  const grid = $('deviceGrid');
  grid.className = 'device-grid view-' + cardViewMode + (selectMode ? ' selecting' : '');
  const list = filteredDevices();
  renderedIps = list.map((d) => d._ip).sort().join(',');
  if (!devices.length) {
    grid.innerHTML = `<div class="empty">${ic('radar')}<h3>Let's find your miners</h3><p>Scan your home network and every BitAxe and NerdQAxe that answers will show up here. You can also add one by its IP address.</p><button class="btn btn-primary" id="emptyScanBtn">${ic('plus')}Add devices</button></div>`;
    $('emptyScanBtn').addEventListener('click', () => $('scanPopover').showPopover());
    return;
  }
  if (!list.length) {
    grid.innerHTML = `<div class="empty">${ic('search')}<h3>No devices match</h3><p>Nothing fits the current search or filters.</p><button class="btn" id="clearFiltersBtn">Clear filters</button></div>`;
    $('clearFiltersBtn').addEventListener('click', clearFilters);
    return;
  }
  const frag = document.createDocumentFragment();
  const draggable = sortField === 'custom' && !sortLocked && !selectMode && !searchQuery;
  list.forEach((dev) => frag.appendChild(createDeviceCard(dev, draggable)));
  grid.replaceChildren(frag);
  requestAnimationFrame(drawSparklines);
}
function clearFilters() {
  typeFilter = 'all'; labelFilter = null; searchQuery = ''; $('deviceSearch').value = '';
  syncFilterChips(); renderLabelFilters(); renderDevices();
}
function syncFilterChips() { $$('#typeFilters .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === typeFilter && !labelFilter))); }
function updateCardsInPlace() {
  const list = filteredDevices();
  const sig = list.map((d) => d._ip).sort().join(',');
  const grid = $('deviceGrid');
  if (sig !== renderedIps || !grid.querySelector('.dcard')) { renderDevices(); return; }
  grid.querySelectorAll('.dcard[data-ip]').forEach((card) => { const dev = findDev(card.dataset.ip); if (dev) fillCard(card, dev); });
  drawSparklines();
}

function cardActionsHTML() {
  return `<button class="dc-act" data-act="logs" title="Live log" aria-label="Live log">${ic('terminal')}</button>
    <button class="dc-act" data-act="settings" title="Device settings" aria-label="Device settings">${ic('gear')}</button>
    <button class="dc-act restart" data-act="restart" title="Restart" aria-label="Restart">${ic('restart')}</button>
    <button class="dc-act" data-act="menu" title="More actions" aria-label="More actions">${ic('more')}</button>`;
}
function createDeviceCard(dev, draggable) {
  const card = document.createElement('article');
  card.className = 'dcard';
  card.dataset.ip = dev._ip;
  card.innerHTML = `
    <label class="dc-select"><input type="checkbox" class="dc-check" aria-label="Select device"></label>
    <header class="dc-head">
      <button class="dc-icon" data-act="icon" title="Change icon" aria-label="Change icon"></button>
      <div class="dc-id">
        <span class="dc-name" title="Double-click to rename"></span>
        <div class="dc-meta"><span class="dc-type"></span><span class="dc-ip"></span><span class="dc-labels"></span><span class="dc-state"></span></div>
      </div>
      <div class="dc-actions">${cardActionsHTML()}</div>
    </header>
    <div class="dc-main">
      <div class="dc-hr"><span class="dc-hr-val"></span><span class="dc-hr-unit"></span></div>
      <div class="dc-hr-sub"><span class="dc-trend"></span>1h avg <strong class="sec-1h"></strong></div>
      <div class="dc-best"><span class="lbl">Best difficulty</span><span class="hero-diff"></span><span class="sec-session"></span></div>
    </div>
    <div class="dc-spark-wrap"><canvas class="dc-spark"></canvas><div class="dc-spark-tip" hidden></div><div class="dc-spark-vline" hidden></div></div>
    <div class="dc-stats">
      <div class="dc-stat temp"><span class="dc-stat-lbl">${ic('thermo')}Chip temp</span><span class="dc-stat-val hero-temp"></span><div class="dc-temp-bar"><div class="dc-temp-fill"></div></div></div>
      <div class="dc-stat"><span class="dc-stat-lbl">${ic('fan')}Fan</span><span class="dc-stat-val sec-fan"></span></div>
      <div class="dc-stat detail-only"><span class="dc-stat-lbl">${ic('bolt')}Power</span><span class="dc-stat-val sec-power"></span></div>
      <div class="dc-stat detail-only"><span class="dc-stat-lbl">${ic('gauge')}Efficiency</span><span class="dc-stat-val sec-eff"></span></div>
    </div>
    <div class="dc-row-actions">${cardActionsHTML()}</div>
    <footer class="dc-foot">
      <span class="dc-pool"></span>
      <span class="dc-shares"><span class="ok">✓ <b class="sec-shares"></b></span><span class="rej">✗ <b class="sec-rejected"></b></span></span>
      <button class="dc-expand" data-act="expand" aria-expanded="false">Details ${ic('chev')}</button>
    </footer>
    <div class="dc-details" hidden></div>`;
  fillCard(card, dev, true);
  if (selectedIps.has(dev._ip)) { card.classList.add('selected'); card.querySelector('.dc-check').checked = true; }
  wireSparkHover(card);
  if (draggable) {
    card.draggable = true;
    card.addEventListener('dragstart', (e) => { dragSrcIp = dev._ip; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragSrcIp = null; $$('.drag-over').forEach((c) => c.classList.remove('drag-over')); });
    card.addEventListener('dragover', (e) => { e.preventDefault(); if (dragSrcIp && dragSrcIp !== dev._ip) card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault(); card.classList.remove('drag-over');
      if (!dragSrcIp || dragSrcIp === dev._ip) return;
      const order = getSortedDevices(devices).map((d) => d._ip);
      const si = order.indexOf(dragSrcIp), ti = order.indexOf(dev._ip); if (si < 0 || ti < 0) return;
      order.splice(ti, 0, order.splice(si, 1)[0]);
      customOrder = order; saveSortPrefs(); renderDevices();
    });
  }
  return card;
}
function setText(root, sel, val) { const el = root.querySelector(sel); if (el && el.textContent !== String(val)) el.textContent = val; }
function fillCard(card, dev, initial) {
  const type = D.type(dev), off = !!dev._offline;
  card.classList.toggle('t-nerd', type === 'nerdqaxe');
  card.classList.toggle('offline', off);
  const iconId = deviceIconId(dev);
  const iconBtn = card.querySelector('.dc-icon');
  if (initial || iconBtn.dataset.icon !== iconId) { iconBtn.dataset.icon = iconId; iconBtn.innerHTML = deviceIconSvg(iconId); }
  if (!card.querySelector('.dc-rename')) setText(card, '.dc-name', D.name(dev));
  setText(card, '.dc-type', type === 'nerdqaxe' ? 'NerdQAxe' : 'BitAxe');
  setText(card, '.dc-ip', dev._ip);
  const labels = deviceLabels[dev._ip] || [];
  const lHtml = labels.map((l) => `<span class="dc-label" style="--lc:${esc(l.color)}">${esc(l.text)}</span>`).join('');
  const lEl = card.querySelector('.dc-labels'); if (lEl.innerHTML !== lHtml) lEl.innerHTML = lHtml;
  const out = off ? ongoingOutage(dev._ip) : null;
  const stateEl = card.querySelector('.dc-state');
  stateEl.textContent = off ? (out ? `Offline ${fmt.dur(Date.now() - out.offAt)}` : 'Offline') : '';
  stateEl.style.color = off ? 'var(--bad)' : ''; stateEl.style.fontWeight = off ? '650' : '';
  const hp = fmt.hrParts(D.hr(dev));
  setText(card, '.dc-hr-val', off ? '--' : hp.v); setText(card, '.dc-hr-unit', hp.u);
  const tr = trendOf(D.hr(dev), D.hr1h(dev)); const trEl = card.querySelector('.dc-trend');
  trEl.className = 'dc-trend ' + tr; trEl.textContent = TREND_GLYPH[tr];
  setText(card, '.sec-1h', fmt.hr(D.hr1h(dev)));
  setText(card, '.hero-diff', fmt.diff(D.bestDiff(dev)));
  setText(card, '.sec-session', 'session ' + fmt.diff(D.bestSession(dev)));
  const t = D.chipTemp(dev);
  const tEl = card.querySelector('.hero-temp'); tEl.textContent = dispTempShort(t); tEl.className = 'dc-stat-val hero-temp ' + tempClass(t);
  const tf = card.querySelector('.dc-temp-fill'); tf.style.width = tempPct(t) + '%'; tf.className = 'dc-temp-fill ' + tempClass(t);
  card.querySelector('.sec-fan').innerHTML = `${D.fanRpm(dev) || 0}<small>rpm</small>`;
  card.querySelector('.sec-power').innerHTML = `${D.power(dev).toFixed(1)}<small>W</small>`;
  const eff = D.eff(dev); card.querySelector('.sec-eff').innerHTML = eff ? `${eff.toFixed(1)}<small>J/TH</small>` : '--';
  const pool = D.poolUrl(dev); const poolEl = card.querySelector('.dc-pool');
  poolEl.textContent = pool ? `${pool}:${D.poolPort(dev)}` : 'No pool set'; poolEl.title = pool ? `${pool}:${D.poolPort(dev)}\n${D.poolUser(dev)}` : '';
  setText(card, '.sec-shares', D.shares(dev).toLocaleString());
  setText(card, '.sec-rejected', D.rejected(dev).toLocaleString());
  const open = expandedCards.has(dev._ip);
  const det = card.querySelector('.dc-details'), exp = card.querySelector('.dc-expand');
  det.hidden = !open; exp.setAttribute('aria-expanded', String(open));
  if (open) det.innerHTML = detailsHTML(dev);
}
function detailsHTML(dev) {
  const rows = [
    ['Uptime', fmt.uptime(D.uptime(dev))], ['Pool difficulty', fmt.diff(D.poolDiff(dev))],
    ['Frequency', (D.freq(dev) || '--') + ' MHz'], ['Core voltage', (D.volt(dev) || '--') + ' mV'],
    ['Board temp', dispTemp(D.temp(dev))], ['VR temp', dispTemp(D.vrTemp(dev))],
    ['ASIC', D.model(dev) || '--'], ['Firmware', D.fw(dev) || '--'],
    ['Wi-Fi', D.rssi(dev) != null ? D.rssi(dev) + ' dBm' : '--'], ['Last answer', dev._lastSeen ? fmt.ago(dev._lastSeen) : '--'],
  ];
  return rows.map(([k, v]) => `<div>${k}<span>${esc(v)}</span></div>`).join('') +
    `<div class="full">Worker<span title="${esc(D.poolUser(dev))}">${esc(D.poolUser(dev) || '--')}</span></div>`;
}

// ─── Sparklines (detailed view) ───
function drawSparklines() {
  if (cardViewMode !== 'detailed' || activeView !== 'fleet') return;
  $$('#deviceGrid .dcard[data-ip]').forEach((card) => {
    const cv = card.querySelector('.dc-spark'); if (!cv) return;
    const s = setupCanvas(cv); if (!s) return; const { ctx, W, H } = s;
    const data = deviceHrHistory[card.dataset.ip] || [];
    if (data.length < 2) return;
    const col = cssVar(card.classList.contains('t-nerd') ? '--type-nerd' : '--type-bitaxe', '#F2B544');
    const min = Math.min(...data), max = Math.max(...data), rng = (max - min) || 1;
    ctx.beginPath();
    data.forEach((v, k) => { const x = (k / (data.length - 1)) * W; const y = H - 3 - ((v - min) / rng) * (H - 6); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, withAlpha(col, .3)); g.addColorStop(1, withAlpha(col, 0)); ctx.fillStyle = g; ctx.fill();
  });
}
function wireSparkHover(card) {
  const wrap = card.querySelector('.dc-spark-wrap'), tip = wrap.querySelector('.dc-spark-tip'), vline = wrap.querySelector('.dc-spark-vline');
  wrap.addEventListener('pointermove', (e) => {
    const data = deviceHrHistory[card.dataset.ip] || []; if (data.length < 2) return;
    const r = wrap.getBoundingClientRect(); const mx = e.clientX - r.left;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(mx / r.width * (data.length - 1))));
    const px = idx / (data.length - 1) * r.width;
    vline.hidden = false; vline.style.left = px + 'px';
    const secsAgo = (data.length - 1 - idx) * (prefs.pollSec || 10);
    tip.innerHTML = `<strong>${fmt.hr(data[idx])}</strong> ${idx === data.length - 1 ? 'now' : (secsAgo < 60 ? secsAgo + 's ago' : Math.round(secsAgo / 60) + 'm ago')}`;
    tip.hidden = false;
    const tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(r.width - tw, px - tw / 2)) + 'px';
  });
  wrap.addEventListener('pointerleave', () => { tip.hidden = true; vline.hidden = true; });
}

// ─── Card interactions (delegated) ───
function onGridClick(e) {
  const card = e.target.closest('.dcard'); if (!card) return;
  const dev = findDev(card.dataset.ip); if (!dev) return;
  if (e.target.closest('.dc-select')) return; // checkbox handles itself
  const btn = e.target.closest('[data-act]');
  if (selectMode && !btn) { toggleSelected(dev._ip); return; }
  if (!btn) return;
  e.stopPropagation();
  const act = btn.dataset.act;
  if (act === 'icon') openIconPicker(dev);
  else if (act === 'logs') { if (dev._offline) return toast(`${D.name(dev)} is offline. Live logs need a reachable device.`, 'warn'); openLiveLogs(dev._ip, D.name(dev)); }
  else if (act === 'settings') { if (dev._offline) return toast(`${D.name(dev)} is offline. Settings can be changed once it's back.`, 'warn'); openSettingsModal(dev._ip); }
  else if (act === 'restart') confirmRestart(dev);
  else if (act === 'menu') openCardMenu(dev, btn);
  else if (act === 'expand') {
    const opening = !expandedCards.has(dev._ip);
    if (opening) expandedCards.add(dev._ip); else expandedCards.delete(dev._ip);
    saveExpanded(); fillCard(card, dev);
  }
}
async function confirmRestart(dev) {
  if (dev._offline) { toast(`${D.name(dev)} is offline, so it can't be restarted from here.`, 'warn'); return; }
  const ok = await confirmDialog(`${D.name(dev)} will stop hashing for about 20 seconds while it reboots.`, { title: `Restart ${D.name(dev)}?`, ok: 'Restart', danger: true });
  if (!ok) return;
  if (await restartDevice(dev)) toast(`Restarting ${D.name(dev)}`, 'success');
}
let cardMenuIp = null, cardMenuClosedAt = 0;
function openCardMenu(dev, anchor) {
  const menu = $('cardMenu');
  if (cardMenuIp === dev._ip && Date.now() - cardMenuClosedAt < 250) { cardMenuIp = null; return; }
  const isBitaxe = D.type(dev) === 'bitaxe';
  menu.innerHTML = `
    <div class="menu-head">${esc(D.name(dev))} (${esc(dev._ip)})</div>
    <button class="menu-item" data-m="rename">${ic('pencil')}Rename</button>
    <button class="menu-item" data-m="labels">${ic('tag')}Labels</button>
    <button class="menu-item" data-m="icon">${ic('shapes')}Change icon</button>
    <div class="menu-sep"></div>
    <button class="menu-item" data-m="open">${ic('external')}Open the device's web page</button>
    ${isBitaxe ? `<button class="menu-item" data-m="identify" ${dev._offline ? 'disabled' : ''}>${ic('bulb')}Identify (flash the screen)</button>` : ''}
    <button class="menu-item" data-m="copy">${ic('copy')}Copy IP address</button>
    <div class="menu-sep"></div>
    <button class="menu-item danger" data-m="remove">${ic('trash')}Remove from fleet</button>`;
  cardMenuIp = dev._ip;
  menu.onclick = async (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    menu.hidePopover();
    const m = b.dataset.m;
    if (m === 'rename') startRename(dev);
    else if (m === 'labels') openLabelEditor(dev);
    else if (m === 'icon') openIconPicker(dev);
    else if (m === 'open') window.open(`http://${dev._ip}`, '_blank');
    else if (m === 'identify') { log('action', `Identify <strong>${esc(D.name(dev))}</strong>`); const r = await apiIdentify(dev._ip); toast(r.ok ? `${D.name(dev)} is flashing its screen` : `Identify isn't supported on ${D.name(dev)}`, r.ok ? 'success' : 'warn'); }
    else if (m === 'copy') { try { await navigator.clipboard.writeText(dev._ip); toast('IP address copied', 'success'); } catch { toast('Could not copy', 'error'); } }
    else if (m === 'remove') removeDevices([dev._ip]);
  };
  menu.showPopover();
  placePopover(menu, anchor);
  menu.querySelector('.menu-item')?.focus();
}
function startRename(dev) {
  const card = document.querySelector(`.dcard[data-ip="${CSS.escape(dev._ip)}"]`);
  const nameEl = card?.querySelector('.dc-name'); if (!nameEl) return;
  const cur = D.name(dev);
  const input = document.createElement('input'); input.type = 'text'; input.value = cur; input.className = 'dc-rename'; input.maxLength = 24;
  input.setAttribute('aria-label', 'Device name');
  nameEl.hidden = true; nameEl.after(input); input.focus(); input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return; done = true;
    const val = input.value.trim();
    input.remove(); nameEl.hidden = false;
    if (!commit || val === cur) return;
    if (!val) { delete deviceNicknames[dev._ip]; saveNicknames(); log('info', `Reset name of <strong>${esc(dev._ip)}</strong>`); renderAll(); return; }
    if (/[^a-zA-Z0-9 _-]/.test(val)) { toast('Names can use letters, numbers, spaces, hyphens and underscores. The name becomes the pool worker suffix.', 'error', 5200); return; }
    deviceNicknames[dev._ip] = val; saveNicknames();
    log('info', `Renamed <strong>${esc(cur)}</strong> to <strong>${esc(val)}</strong>`);
    renderAll();
  };
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
}
async function removeDevices(ips) {
  const names = ips.map((ip) => { const d = findDev(ip); return d ? D.name(d) : ip; });
  const ok = await confirmDialog(ips.length === 1 ? `${names[0]} will be removed from the dashboard. The miner itself keeps running.` : `${ips.length} devices will be removed from the dashboard. The miners keep running.`, { title: ips.length === 1 ? `Remove ${names[0]}?` : `Remove ${ips.length} devices?`, ok: 'Remove', danger: true });
  if (!ok) return false;
  const set = new Set(ips);
  devices = devices.filter((d) => !set.has(d._ip));
  ips.forEach((ip) => { expandedCards.delete(ip); delete deviceNicknames[ip]; delete deviceLabels[ip]; delete deviceIcons[ip]; delete deviceHrHistory[ip]; selectedIps.delete(ip); });
  customOrder = customOrder.filter((ip) => !set.has(ip));
  for (const k of Object.keys(autoConfig)) autoConfig[k].devices = autoConfig[k].devices.filter((ip) => !set.has(ip));
  saveDevices(); saveExpanded(); saveNicknames(); saveLabels(); saveSortPrefs(); saveAutoConfig();
  chrome.storage.local.set({ deviceIcons, deviceHrHistory });
  log('info', `Removed ${names.map((n) => `<strong>${esc(n)}</strong>`).join(', ')}`);
  updateBulkBar(); renderAll(); updateActionBadge();
  return true;
}

// ─── Labels ───
function openLabelEditor(dev) {
  const body = $('labelBody'); $('labelTitle').textContent = `Labels for ${D.name(dev)}`;
  let selColor = LABEL_COLORS[0];
  const existing = [...new Map(Object.values(deviceLabels).flat().map((l) => [l.text + l.color, l])).values()];
  const render = () => {
    const labels = deviceLabels[dev._ip] || [];
    const reusable = existing.filter((l) => !labels.some((x) => x.text === l.text));
    body.innerHTML = `
      <p class="muted small" style="margin-bottom:.8rem">Up to two labels per device. Labels become filters above the device list.</p>
      <div class="label-list">${labels.map((l, i) => `<div class="label-item"><span class="sw" style="background:${esc(l.color)}"></span><span>${esc(l.text)}</span><button class="icon-btn sm" data-del="${i}" aria-label="Remove label ${esc(l.text)}">${ic('x')}</button></div>`).join('') || '<p class="muted small">No labels yet.</p>'}</div>
      ${labels.length < 2 ? `
        ${reusable.length ? `<div class="field"><label>Reuse a label</label><div class="dev-filters">${reusable.map((l, i) => `<button class="chip label-chip" style="--lc:${esc(l.color)}" data-reuse="${i}"><span class="chip-dot"></span>${esc(l.text)}</button>`).join('')}</div></div>` : ''}
        <div class="field" style="margin-top:.8rem"><label for="labelText">New label</label>
          <div class="input-row"><input type="text" id="labelText" maxlength="10" placeholder="e.g. office"><button class="btn btn-primary" id="labelAddBtn" disabled>Add</button></div></div>
        <div class="swatches" role="radiogroup" aria-label="Label color">${LABEL_COLORS.map((c) => `<button class="swatch" role="radio" aria-checked="${c === selColor}" data-color="${c}" style="background:${c}" aria-label="Color ${c}">${c === selColor ? ic('check') : ''}</button>`).join('')}</div>` : ''}`;
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const arr = deviceLabels[dev._ip] || []; arr.splice(+b.dataset.del, 1); if (!arr.length) delete deviceLabels[dev._ip];
      saveLabels(); render(); afterLabelChange();
    }));
    body.querySelectorAll('[data-reuse]').forEach((b) => b.addEventListener('click', () => { addLabel(reusable[+b.dataset.reuse]); }));
    body.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => { selColor = b.dataset.color; const txt = $('labelText')?.value; render(); if ($('labelText')) { $('labelText').value = txt || ''; $('labelText').dispatchEvent(new Event('input')); $('labelText').focus(); } }));
    const inp = $('labelText');
    if (inp) {
      inp.addEventListener('input', () => { $('labelAddBtn').disabled = !inp.value.trim(); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim()) addLabel({ text: inp.value.trim().slice(0, 10), color: selColor }); });
      $('labelAddBtn').addEventListener('click', () => addLabel({ text: inp.value.trim().slice(0, 10), color: selColor }));
    }
  };
  const addLabel = (l) => {
    if (!l || !l.text) return;
    const arr = (deviceLabels[dev._ip] = deviceLabels[dev._ip] || []);
    if (arr.length >= 2 || arr.some((x) => x.text === l.text)) return;
    arr.push({ text: l.text, color: l.color }); saveLabels(); render(); afterLabelChange();
    $('labelText')?.focus();
  };
  render(); openDialog('labelModal');
}
function afterLabelChange() {
  if (labelFilter && !Object.values(deviceLabels).flat().some((l) => l.text === labelFilter)) labelFilter = null;
  renderLabelFilters(); syncFilterChips(); renderDevices();
}
function renderLabelFilters() {
  const c = $('labelFilters'); if (!c) return;
  const all = new Map(); Object.values(deviceLabels).forEach((ls) => ls.forEach((l) => { if (!all.has(l.text)) all.set(l.text, l); }));
  c.innerHTML = [...all.values()].map((l) => `<button class="chip label-chip" style="--lc:${esc(l.color)}" data-label="${esc(l.text)}" aria-pressed="${labelFilter === l.text}"><span class="chip-dot"></span>${esc(l.text)}</button>`).join('');
  c.hidden = !all.size;
}

// ─── Icons ───
function openIconPicker(dev) {
  const cur = deviceIconId(dev);
  $('iconTitle').textContent = `Icon for ${D.name(dev)}`;
  $('iconGrid').innerHTML = DEVICE_ICON_ORDER.map((id) => `<button class="icon-opt" role="radio" aria-checked="${id === cur}" data-icon="${id}" aria-label="${id}">${deviceIconSvg(id)}</button>`).join('');
  $('iconGrid').onclick = (e) => { const b = e.target.closest('[data-icon]'); if (!b) return; deviceIcons[dev._ip] = b.dataset.icon; chrome.storage.local.set({ deviceIcons }); closeDialog('iconModal'); updateCardsInPlace(); };
  $('iconResetBtn').onclick = () => { delete deviceIcons[dev._ip]; chrome.storage.local.set({ deviceIcons }); closeDialog('iconModal'); updateCardsInPlace(); };
  openDialog('iconModal');
}

// ─── Selection mode ───
function setSelectMode(on) {
  selectMode = on;
  if (!on) selectedIps.clear();
  $('selectModeBtn').setAttribute('aria-pressed', String(on));
  renderDevices(); updateBulkBar();
}
function toggleSelected(ip, force) {
  const on = force ?? !selectedIps.has(ip);
  if (on) selectedIps.add(ip); else selectedIps.delete(ip);
  const card = document.querySelector(`.dcard[data-ip="${CSS.escape(ip)}"]`);
  if (card) { card.classList.toggle('selected', on); card.querySelector('.dc-check').checked = on; }
  updateBulkBar();
}
function updateBulkBar() {
  $('bulkBar').hidden = !selectMode;
  const n = selectedIps.size;
  $('bulkCount').textContent = n ? `${n} selected` : 'Tap devices to select';
  ['bulkPoolBtn', 'bulkRestartBtn', 'bulkRemoveBtn'].forEach((id) => { $(id).disabled = !n; });
}
async function bulkRestart() {
  const devs = [...selectedIps].map(findDev).filter((d) => d && !d._offline);
  if (!devs.length) { toast('None of the selected devices are online.', 'warn'); return; }
  const ok = await confirmDialog(`${devs.length} device${devs.length === 1 ? '' : 's'} will reboot one after another.`, { title: 'Restart selected devices?', ok: 'Restart', danger: true });
  if (!ok) return;
  let okCount = 0;
  for (const d of devs) { if (await restartDevice(d, 'bulk')) okCount++; await sleep(400); }
  toast(`Restart sent to ${okCount} of ${devs.length}`, okCount === devs.length ? 'success' : 'warn');
}

// ════════ DEVICE SETTINGS DIALOG ════════
function openSettingsModal(ip) {
  settingsDeviceIp = ip; const dev = findDev(ip); if (!dev) return;
  $('settingsModalTitle').textContent = D.name(dev);
  $('settingsModalSub').textContent = `${D.type(dev) === 'nerdqaxe' ? 'NerdQAxe' : 'BitAxe'} at ${ip}`;
  setSettingsTab('s-general');
  const info = [['Hostname', dev.hostname || '--'], ['ASIC', D.model(dev)], ['Board', D.board(dev)], ['Firmware', D.fw(dev)],
    ['Hashrate', fmt.hr(D.hr(dev)), 'accent'], ['1h average', fmt.hr(D.hr1h(dev))], ['24h average', fmt.hr(D.hr24h(dev))],
    ['Best difficulty', fmt.diff(D.bestDiff(dev)), 'accent'], ['Session best', fmt.diff(D.bestSession(dev))], ['Pool difficulty', fmt.diff(D.poolDiff(dev))],
    ['Accepted', D.shares(dev).toLocaleString()], ['Rejected', D.rejected(dev).toLocaleString()],
    ['Power', D.power(dev).toFixed(1) + ' W'], ['Efficiency', D.eff(dev) ? D.eff(dev).toFixed(1) + ' J/TH' : '--'],
    ['Chip temp', dispTemp(D.asicTemp(dev))], ['Board temp', dispTemp(D.temp(dev))], ['VR temp', dispTemp(D.vrTemp(dev))],
    ['Frequency', D.freq(dev) + ' MHz'], ['Core voltage', D.volt(dev) + ' mV'], ['Measured voltage', D.voltActual(dev) ? D.voltActual(dev) + ' mV' : '--'],
    ['Fan', D.fanRpm(dev) + ' rpm'], ['Uptime', fmt.uptime(D.uptime(dev))], ['Wi-Fi', D.rssi(dev) != null ? D.rssi(dev) + ' dBm' : '--'],
    ['Pool', D.poolUrl(dev) + ':' + D.poolPort(dev)]];
  $('sInfoGrid').innerHTML = info.map(([l, v, c]) => `<div class="info-item${c ? ' ' + c : ''}"><span>${l}</span><span>${esc(v || '--')}</span></div>`).join('');
  const isNerd = D.type(dev) === 'nerdqaxe';
  $('sAutoFanRow').hidden = isNerd; $('sNerdFanNote').hidden = !isNerd;
  $('sAutoFan').checked = !isNerd && !!D.autoFan(dev);
  const fs = D.fanSpeed(dev) ?? 100; $('sFanSlider').value = fs; $('sFanVal').textContent = fs + '%';
  $('sManualFanRow').hidden = !isNerd && !!D.autoFan(dev);
  $('sFrequency').value = D.freq(dev) || ''; $('sVoltage').value = D.volt(dev) || '';
  $('sFreqHint').textContent = D.freqOpts(dev) ? 'Suggested: ' + [].concat(D.freqOpts(dev)).join(', ') : 'Stock BitAxe values are usually 400 to 600 MHz';
  $('sVoltHint').textContent = D.voltOpts(dev) ? 'Suggested: ' + [].concat(D.voltOpts(dev)).join(', ') : 'Stock values are usually 1100 to 1250 mV';
  $('sPoolURL').value = D.poolUrl(dev); $('sPoolPort').value = D.poolPort(dev); $('sPoolUser').value = D.poolUser(dev); $('sPoolPass').value = D.poolPass(dev) || 'x';
  $('sFbPoolURL').value = D.fbUrl(dev); $('sFbPoolPort').value = D.fbPort(dev); $('sFbPoolUser').value = D.fbUser(dev); $('sFbPoolPass').value = D.fbPass(dev) || 'x';
  ['sFanStatus', 'sMiningStatus', 'sPoolStatus'].forEach((id) => { $(id).textContent = ''; $(id).className = 'status-line'; });
  $('sIdentifyBtn').hidden = isNerd;
  openDialog('settingsModal');
}
function setSettingsTab(id) {
  $$('#settingsModalBody .mtab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mtab === id)));
  $$('#settingsModalBody .mtab-content').forEach((c) => { c.hidden = c.id !== id; });
}
function setSt(id, cls, text) { const el = $(id); el.className = 'status-line ' + cls; el.textContent = text; }
async function applyFanSettings() {
  const ip = settingsDeviceIp; const dev = findDev(ip); if (!dev) return;
  const isNerd = D.type(dev) === 'nerdqaxe', autoFan = $('sAutoFan').checked, speed = parseInt($('sFanSlider').value);
  const patch = {};
  if (isNerd) { patch.autofanspeed = 0; patch.manualFanSpeed = speed; }   // NerdQAxe: auto fan deprecated; camelCase field
  else { patch.autofanspeed = autoFan ? 1 : 0; if (!autoFan) { patch.fanSpeed = speed; patch.manualfanspeed = speed; } } // BitAxe: lowercase fields
  setSt('sFanStatus', 'working', 'Applying…'); log('action', `Fan setting on <strong>${esc(D.name(dev))}</strong>`);
  try { const r = await apiPatch(ip, patch); if (r && !r.error) { setSt('sFanStatus', 'success', 'Applied.'); log('success', `Fan updated on <strong>${esc(D.name(dev))}</strong>`); } else throw new Error(r?.error || 'Failed'); }
  catch (e) { setSt('sFanStatus', 'error', 'Failed: ' + e.message); log('error', `Fan: ${esc(e.message)}`); }
}
async function applyMiningSettings() {
  const ip = settingsDeviceIp; const dev = findDev(ip); if (!dev) return;
  const freq = parseInt($('sFrequency').value), volt = parseInt($('sVoltage').value);
  if (!freq && !volt) { setSt('sMiningStatus', 'error', 'Enter a frequency or a voltage.'); return; }
  const patch = {}; if (freq) { patch.asicfrequency = freq; patch.frequency = freq; } if (volt) patch.coreVoltage = volt;
  setSt('sMiningStatus', 'working', 'Applying…'); log('action', `Frequency/voltage on <strong>${esc(D.name(dev))}</strong>: ${freq || '-'} MHz, ${volt || '-'} mV`);
  try { const r = await apiPatch(ip, patch); if (r && !r.error) { setSt('sMiningStatus', 'success', 'Applied. Some firmware needs a restart for this to take effect.'); log('success', `Frequency/voltage updated on <strong>${esc(D.name(dev))}</strong>`); } else throw new Error(r?.error || 'Failed'); }
  catch (e) { setSt('sMiningStatus', 'error', 'Failed: ' + e.message); log('error', `Frequency/voltage: ${esc(e.message)}`); }
}
async function readNerdSettings(ip) {
  let cs = {};
  try { cs = await chrome.runtime.sendMessage({ type: 'GET_SYSTEM_SETTINGS', ip }); if (!cs || cs.error) cs = {}; } catch { cs = {}; }
  const patch = {}; NERD_WRITABLE.forEach((k) => { if (k in cs) patch[k] = cs[k]; });
  return patch;
}
async function applyPoolSettings() {
  const ip = settingsDeviceIp; const dev = findDev(ip); if (!dev) return;
  const parsed = parseStratumUrl($('sPoolURL').value); const isNerd = D.type(dev) === 'nerdqaxe';
  if (!parsed.host) { setSt('sPoolStatus', 'error', 'Enter a stratum address.'); return; }
  setSt('sPoolStatus', 'working', 'Reading current settings…');
  try {
    let patch;
    const port = parsed.port || parseInt($('sPoolPort').value) || 3333;
    const fbRaw = $('sFbPoolURL').value.trim();
    if (isNerd) {
      patch = await readNerdSettings(ip);
      Object.assign(patch, { stratumURL: parsed.host, stratumPort: port, stratumUser: $('sPoolUser').value.trim(), stratumEnonceSubscribe: false, stratumTLS: false });
      if ($('sPoolPass').value.trim()) patch.stratumPassword = $('sPoolPass').value.trim();
      if (fbRaw) { const fp = parseStratumUrl(fbRaw); Object.assign(patch, { fallbackStratumURL: fp.host, fallbackStratumPort: fp.port || parseInt($('sFbPoolPort').value) || 3333, fallbackStratumUser: $('sFbPoolUser').value.trim(), fallbackStratumEnonceSubscribe: false, fallbackStratumTLS: false }); }
    } else {
      patch = { stratumURL: parsed.host, stratumPort: port, stratumUser: $('sPoolUser').value.trim(), stratumExtranonceSubscribe: false, stratumSuggestedDifficulty: 512 };
      if (fbRaw) { const fp = parseStratumUrl(fbRaw); Object.assign(patch, { fallbackStratumURL: fp.host, fallbackStratumPort: fp.port || parseInt($('sFbPoolPort').value) || 3333, fallbackStratumUser: $('sFbPoolUser').value.trim(), fallbackStratumExtranonceSubscribe: false, fallbackStratumSuggestedDifficulty: 1000 }); }
      else Object.assign(patch, { fallbackStratumURL: parsed.host, fallbackStratumPort: port, fallbackStratumUser: $('sPoolUser').value.trim(), fallbackStratumExtranonceSubscribe: false, fallbackStratumSuggestedDifficulty: 1000 });
    }
    setSt('sPoolStatus', 'working', 'Applying and restarting…'); log('action', `Pool change on <strong>${esc(D.name(dev))}</strong>`);
    const r = await apiPatch(ip, patch);
    if (r && !r.error) { await sleep(500); await apiRestart(ip); setSt('sPoolStatus', 'success', 'Applied. The device is restarting.'); log('success', `Pool set on <strong>${esc(D.name(dev))}</strong>, restarting`); setTimeout(refreshAllDevices, 9000); }
    else throw new Error(r?.error || 'Failed');
  } catch (e) { setSt('sPoolStatus', 'error', 'Failed: ' + e.message); log('error', `Pool: ${esc(e.message)}`); }
}

// ════════ DESKTOP ALERTS & TOOLBAR BADGE ════════
function notify(kind, title, message) {
  const on = { offline: prefs.notifyOffline, block: prefs.notifyBlock, auto: prefs.notifyAuto }[kind];
  if (!on || !document.hidden || !chrome.notifications) return;
  try {
    chrome.notifications.create('axe-' + kind + '-' + Date.now(), {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: String(title).slice(0, 80), message: String(message || '').slice(0, 200), priority: kind === 'block' ? 2 : 0
    });
  } catch (e) { console.warn('notify', e); }
}
function updateActionBadge() {
  if (!chrome.action) return;
  try {
    if (!prefs.badge || !devices.length) { chrome.action.setBadgeText({ text: '' }); chrome.action.setTitle({ title: 'AxeOS Fleet Manager' }); return; }
    const off = devices.filter((d) => d._offline).length, on = devices.length - off;
    const total = devices.filter((d) => !d._offline).reduce((s, d) => s + D.hr(d), 0);
    chrome.action.setBadgeText({ text: String(off || on) });
    chrome.action.setBadgeBackgroundColor({ color: off ? '#D8454F' : '#2E9E6B' });
    if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    chrome.action.setTitle({ title: `AxeOS Fleet Manager\n${on}/${devices.length} online · ${fmt.hr(total)}${off ? `\n${off} offline` : ''}` });
  } catch (e) { /* action API unavailable */ }
}

// ════════ BLOCKS FOUND ════════
function checkBlockFound() {
  // First poll after load is a baseline: BitAxe keeps blockFound=true until
  // dismissed and NerdQAxe counters persist, so a reload must not celebrate.
  const baseline = !blockStateInitialized;
  devices.forEach((d) => {
    if (d._offline) return;
    const ip = d._ip, isNerd = D.type(d) === 'nerdqaxe', prev = prevBlockState[ip] || {};
    let found = false;
    if (isNerd) {
      const total = D.totalBlocks(d);
      if (!baseline && prev.totalFound !== undefined && total > prev.totalFound) found = true;
      prevBlockState[ip] = { ...prev, totalFound: total };
    } else {
      const bf = D.blockFound(d);
      if (!baseline && bf && !prev.blockFound) found = true;
      prevBlockState[ip] = { ...prev, blockFound: bf };
    }
    if (found) {
      recordBlockFound(d);
      if (!isNerd) chrome.runtime.sendMessage({ type: 'DEVICE_WRITE', ip, method: 'POST', endpoint: `http://${ip}/api/system/blockFound/dismiss`, data: {} }).catch(() => {});
    }
  });
  blockStateInitialized = true;
}
function guessCoinFromPool(url) {
  const u = (url || '').toLowerCase();
  const pool = savedPools.find((p) => parseStratumUrl(p.url).host.toLowerCase() === u);
  if (pool) { const c = SHA256_COINS.find((x) => x.id === pool.coin); if (c && c.id !== 'other') return c.symbol; }
  if (u.includes('bch')) return 'BCH';
  if (u.includes('dgb') || u.includes('digibyte')) return 'DGB';
  if (u.includes('ocean') || u.includes('public-pool') || u.includes('ckpool') || u.includes('btc')) return 'BTC';
  return '';
}
function recordBlockFound(d) {
  const block = { deviceName: D.name(d), ip: d._ip, type: D.type(d), diff: D.bestSession(d) || D.bestDiff(d) || D.netDiff(d), bestDiff: D.bestDiff(d), netDiff: D.netDiff(d), time: Date.now(), poolUrl: D.poolUrl(d), poolUser: D.poolUser(d), coin: guessCoinFromPool(D.poolUrl(d)) };
  blockHistory.unshift(block);
  if (blockHistory.length > 200) blockHistory.pop();
  blockUnread++;
  chrome.storage.local.set({ blockHistory });
  log('success', `<strong>Block found!</strong> ${esc(D.name(d))} solved a block at difficulty ${fmt.diff(block.diff)}`);
  notify('block', `Block found by ${D.name(d)}`, `Difficulty ${fmt.diff(block.diff)}${block.coin ? ' · ' + block.coin : ''}`);
  showBlockCelebration(block);
  updateBlockBadge();
  if (historyTab === 'blocks' && activeView === 'history') renderBlockHistory();
}
function showBlockCelebration(b) {
  $('bcDevice').textContent = b.deviceName;
  $('bcDiff').textContent = fmt.diff(b.diff);
  $('bcTime').textContent = fmt.datetime(new Date(b.time));
  $('bcPool').textContent = b.poolUrl || 'Unknown pool';
  $('bcCoin').textContent = b.coin || '-';
  openDialog('blockCelebrationModal');
  requestAnimationFrame(launchConfetti);
}
function launchConfetti() {
  const c = $('confettiCanvas'); if (!c) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = c.getContext('2d'); c.width = c.offsetWidth; c.height = c.offsetHeight;
  const colors = [cssVar('--gold', '#FFD66B'), cssVar('--accent', '#F2B544'), cssVar('--type-nerd', '#8FB8FF'), cssVar('--ok', '#4CD69E'), '#EC4899', '#F7931A'];
  const pieces = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: Math.random() * -c.height, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 2, s: Math.random() * 7 + 4, col: colors[Math.floor(Math.random() * colors.length)], r: Math.random() * 360, vr: (Math.random() - 0.5) * 10 }));
  let frame = 0;
  (function anim() {
    ctx.clearRect(0, 0, c.width, c.height);
    pieces.forEach((p) => { p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r * Math.PI / 180); ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++frame < 220 && $('blockCelebrationModal').open) requestAnimationFrame(anim); else ctx.clearRect(0, 0, c.width, c.height);
  })();
}
function updateBlockBadge() {
  [['blockBadge', blockUnread], ['blockBadgeTab', blockUnread]].forEach(([id, n]) => { const b = $(id); if (!b) return; b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
  updateHistoryBadge();
}
function renderBlockHistory() {
  const list = $('blockHistoryList');
  if (!blockHistory.length) { list.innerHTML = `<div class="empty">${ic('trophy')}<h3>No blocks yet</h3><p>When one of your miners solves a block it lands here, with the difficulty it actually reached and the pool it was on. Good luck.</p></div>`; return; }
  list.innerHTML = blockHistory.map((b) => `
    <div class="ev block">
      <span class="ev-ico">${ic('trophy')}</span>
      <div><div class="ev-title">${esc(b.deviceName)}${b.coin ? `<span class="ev-tag">${esc(b.coin)}</span>` : ''}</div>
        <div class="ev-sub"><span>${fmt.datetime(new Date(b.time))}</span><span>${esc(b.poolUrl || 'Unknown pool')}</span></div></div>
      <div class="ev-right"><span class="ev-big">${fmt.diff(b.diff)}</span><span class="ev-small">difficulty reached</span></div>
    </div>`).join('');
}

// ════════ DOWNTIME HISTORY ════════
function renderUptimeHistory() {
  const list = $('uptimeHistoryList');
  if (!uptimeEvents.length) { list.innerHTML = `<div class="empty">${ic('wifi')}<h3>No downtime recorded</h3><p>Every time a miner stops answering, it's logged here with how long it was gone.</p></div>`; return; }
  const total = uptimeEvents.reduce((s, e) => s + ((e.backAt || Date.now()) - e.offAt), 0);
  const head = `<div class="ev-summary muted small">${uptimeEvents.length} outage${uptimeEvents.length === 1 ? '' : 's'}, ${fmt.dur(total)} of downtime in total. <button class="link-btn" id="clearDowntimeBtn">Clear</button></div>`;
  list.innerHTML = head + uptimeEvents.map((e) => {
    const down = e.backAt === null;
    return `<div class="ev${down ? ' down' : ''}">
      <span class="ev-ico">${ic(down ? 'x' : 'check')}</span>
      <div><div class="ev-title">${esc(e.name)}<span class="ev-tag">${down ? 'Still offline' : 'Recovered'}</span></div>
        <div class="ev-sub"><span>Went offline ${fmt.datetime(new Date(e.offAt))}</span>${down ? '' : `<span>Back ${fmt.datetime(new Date(e.backAt))}</span>`}<span>${esc(e.ip)}</span></div></div>
      <div class="ev-right"><span class="ev-big">${fmt.dur((e.backAt || Date.now()) - e.offAt)}</span><span class="ev-small">${down ? 'so far' : 'downtime'}</span></div>
    </div>`;
  }).join('');
  $('clearDowntimeBtn').addEventListener('click', async () => {
    if (!(await confirmDialog('Recovered outages are removed. Devices that are offline right now stay listed.', { title: 'Clear downtime history?', ok: 'Clear', danger: true }))) return;
    uptimeEvents = uptimeEvents.filter((e) => e.backAt === null);
    chrome.storage.local.set({ uptimeEvents }); uptimeSig = ''; renderUptimeMonitor(); renderUptimeHistory();
  });
}

// ════════ AUTOMATIONS ════════
async function checkFlapRecovery(ip) {
  const cfg = autoConfig.flapRecovery;
  if (!cfg || !cfg.enabled || !cfg.devices.includes(ip)) return;
  const now = Date.now();
  if (flapLastRestart[ip] && (now - flapLastRestart[ip]) < cfg.cooldownMin * 60000) return;
  const count = uptimeEvents.filter((e) => e.ip === ip && e.backAt != null && (now - e.offAt) <= cfg.windowMin * 60000).length;
  if (count < cfg.threshold) return;
  const dev = findDev(ip), name = dev ? D.name(dev) : ip;
  const retrySoon = (ms) => { flapLastRestart[ip] = now - cfg.cooldownMin * 60000 + ms; };
  log('warn', `Flap recovery: <strong>${esc(name)}</strong> dropped ${count} times in ${cfg.windowMin} min. Restarting after 15s of stable connection.`);
  flapLastRestart[ip] = now; // reserve the slot so attempts don't queue up
  setTimeout(async () => {
    const d2 = findDev(ip);
    if (!d2 || d2._offline) { log('warn', `Flap recovery: <strong>${esc(name)}</strong> dropped again, restart skipped. Will retry.`); retrySoon(60000); return; }
    try {
      const probe = await chrome.runtime.sendMessage({ type: 'FETCH_DEVICE_INFO', ip });
      if (!probe || probe.error) { log('warn', `Flap recovery: <strong>${esc(name)}</strong> not reachable, restart skipped.`); retrySoon(60000); return; }
    } catch { log('warn', `Flap recovery: <strong>${esc(name)}</strong> probe failed, restart skipped.`); retrySoon(60000); return; }
    try {
      await apiRestart(ip);
      log('action', `Flap recovery restarted <strong>${esc(name)}</strong>`);
      notify('auto', `Flap recovery restarted ${name}`, `${count} drops in ${cfg.windowMin} minutes`);
    } catch (e) { log('error', `Flap recovery: restart failed for <strong>${esc(name)}</strong>: ${esc(e.message || 'unknown error')}`); retrySoon(120000); }
    updateAutoStatus();
  }, 15000);
}

// Pool payload builder shared by the Pool manager and Pool rotation.
// NerdQAxe needs the full writable settings echoed back (it resets missing
// fields); BitAxe gets only pool fields.
async function buildPoolPatch(dev, pool, fbPool, { withFallback = true } = {}) {
  const suffix = getWorkerSuffix(dev);
  const worker = (u) => { if (!u) return u; if (!u.includes('.')) return u + '.' + suffix; if (u.endsWith('.')) return u + suffix; return u; };
  const pp = parseStratumUrl(pool.url), port = pp.port || parseInt(pool.port);
  const user = worker(pool.user);
  const fp = fbPool ? parseStratumUrl(fbPool.url) : null;
  const fbPort = fbPool ? (fp.port || parseInt(fbPool.port)) : null, fbUser = fbPool ? worker(fbPool.user) : '';
  if (D.type(dev) === 'nerdqaxe') {
    let cs = {};
    try { cs = (await chrome.runtime.sendMessage({ type: 'GET_SYSTEM_SETTINGS', ip: dev._ip })) || {}; if (cs.error) cs = {}; }
    catch { log('warn', `Could not read the current settings of ${esc(D.name(dev))}`); }
    const patch = {};
    NERD_WRITABLE.forEach((k) => { if (k in cs) patch[k] = cs[k]; });
    Object.assign(patch, { stratumURL: pp.host, stratumPort: port, stratumUser: user, stratumEnonceSubscribe: false, stratumTLS: !!pool.tls });
    if (fbPool) Object.assign(patch, { fallbackStratumURL: fp.host, fallbackStratumPort: fbPort, fallbackStratumUser: fbUser, fallbackStratumEnonceSubscribe: false, fallbackStratumTLS: !!fbPool.tls });
    return { patch, user };
  }
  const patch = { stratumURL: pp.host, stratumPort: port, stratumUser: user, stratumExtranonceSubscribe: false, stratumSuggestedDifficulty: 512 };
  if (withFallback) Object.assign(patch, {
    fallbackStratumURL: fbPool ? fp.host : pp.host, fallbackStratumPort: fbPool ? fbPort : port, fallbackStratumUser: fbUser || user,
    fallbackStratumExtranonceSubscribe: false, fallbackStratumSuggestedDifficulty: 1000
  });
  return { patch, user };
}

// ════════ AUTOMATION ENGINE ════════
function clampInt(v, min, max, def) { const n = parseFloat(v); if (isNaN(n)) return def; return Math.min(max, Math.max(min, n)); }
function tempToUi(c) { return tempUnit === 'F' ? Math.round(toF(c)) : c; }
function tempFromUi(v) { return tempUnit === 'F' ? Math.round((v - 32) * 5 / 9) : v; }
function hm(str) { const [h, m] = String(str || '0:0').split(':').map((x) => parseInt(x) || 0); return h * 60 + m; }
function minutesNow(d = new Date()) { return d.getHours() * 60 + d.getMinutes(); }
function inWindow(start, end, d = new Date()) { const n = minutesNow(d), a = hm(start), b = hm(end); return a === b ? false : a < b ? n >= a && n < b : n >= a || n < b; }
function dayKey(d = new Date()) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function expectedHr(d) { return d.expectedHashrate > 0 ? d.expectedHashrate : D.hr1h(d); }
function onFallback(d) { const v = d.isUsingFallbackStratum ?? d.isUsingFallback; return v === true || v === 1; }

// Alerts the user chose explicitly ("Alert me only") always get through
function autoAlert(title, msg) {
  log('warn', `${esc(title)}: ${esc(msg)}`, 'auto');
  if (document.hidden && chrome.notifications) {
    try { chrome.notifications.create('axe-alert-' + Date.now(), { type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title: String(title).slice(0, 80), message: String(msg).slice(0, 200), priority: 1 }); } catch {}
  } else toast(`${title}. ${msg}`, 'warn', 7000);
}
function fanPatch(dev, auto, pct) {
  if (D.type(dev) === 'nerdqaxe') return { autofanspeed: 0, manualFanSpeed: pct };
  return auto ? { autofanspeed: 1 } : { autofanspeed: 0, fanSpeed: pct, manualfanspeed: pct };
}
async function setFan(dev, auto, pct) {
  try { await apiPatch(dev._ip, fanPatch(dev, auto, pct)); return true; }
  catch (e) { log('error', `Fan change failed on <strong>${esc(D.name(dev))}</strong>: ${esc(e.message)}`, 'auto'); return false; }
}
async function quietRestore(dev, st, why) {
  if (!dev || dev._offline) return false;
  const ok = await setFan(dev, st.prevAuto, st.prevSpeed);
  if (ok) log('action', `Quiet hours: fan on <strong>${esc(D.name(dev))}</strong> back to ${st.prevAuto ? 'automatic' : st.prevSpeed + '%'}${why ? ' (' + why + ')' : ''}`, 'auto');
  return ok;
}

async function runAutomations() {
  if (!devices.length) return;
  const now = Date.now(), c = autoConfig;
  const active = (cfg) => cfg.enabled ? cfg.devices.map(findDev).filter((d) => d && !d._offline) : [];

  // Watchdog: 0 GH/s for too long
  if (c.watchdog.enabled) {
    for (const dev of active(c.watchdog)) {
      const ip = dev._ip;
      if (D.hr(dev) < 0.01) {
        if (!watchdogZeroSince[ip]) watchdogZeroSince[ip] = now;
        if (now - watchdogZeroSince[ip] >= c.watchdog.minutes * 60000) {
          delete watchdogZeroSince[ip];
          log('warn', `Watchdog: <strong>${esc(D.name(dev))}</strong> sat at 0 GH/s for ${c.watchdog.minutes}+ min`, 'auto');
          if (await restartDevice(dev, 'watchdog', 'auto')) notify('auto', `Watchdog restarted ${D.name(dev)}`, `0 GH/s for ${c.watchdog.minutes}+ minutes`);
        }
      } else delete watchdogZeroSince[ip];
    }
  } else watchdogZeroSince = {};

  // Hashrate drop: well below normal for a sustained period
  const hd = c.hashrateDrop;
  if (hd.enabled) {
    for (const dev of active(hd)) {
      const ip = dev._ip, base = expectedHr(dev), hr = D.hr(dev);
      if (!base || hr < 0.01 || hr >= base * (1 - hd.dropPct / 100)) { delete hashDropSince[ip]; continue; }
      if (!hashDropSince[ip]) hashDropSince[ip] = now;
      if (now - hashDropSince[ip] < hd.minutes * 60000) continue;
      if (hashDropLast[ip] && now - hashDropLast[ip] < hd.cooldownMin * 60000) continue;
      hashDropLast[ip] = now; delete hashDropSince[ip];
      const detail = `${fmt.hr(hr)} instead of about ${fmt.hr(base)} for ${hd.minutes}+ min`;
      if (hd.action === 'restart') {
        log('warn', `Hashrate drop: <strong>${esc(D.name(dev))}</strong> at ${detail}`, 'auto');
        if (await restartDevice(dev, 'hashrate drop', 'auto')) notify('auto', `${D.name(dev)} restarted`, `Hashrate dropped to ${fmt.hr(hr)}`);
      } else autoAlert(`${D.name(dev)} is running slow`, detail);
    }
  } else hashDropSince = {};

  // Back to primary pool
  const fr = c.fallbackReturn;
  if (fr.enabled) {
    for (const dev of active(fr)) {
      const ip = dev._ip;
      if (!onFallback(dev)) { delete fallbackSince[ip]; continue; }
      if (!fallbackSince[ip]) fallbackSince[ip] = now;
      if (now - fallbackSince[ip] < fr.minutes * 60000) continue;
      delete fallbackSince[ip];
      log('warn', `Back to primary: <strong>${esc(D.name(dev))}</strong> has been on its fallback pool for ${fr.minutes}+ min`, 'auto');
      if (await restartDevice(dev, 'back to primary pool', 'auto')) notify('auto', `${D.name(dev)} restarted`, 'Reconnecting to the primary pool');
    }
  } else fallbackSince = {};

  // Reject rate over a rolling window
  const rr = c.rejectRate;
  if (rr.enabled) {
    for (const dev of active(rr)) {
      const ip = dev._ip, a = D.shares(dev), r = D.rejected(dev);
      let arr = rejSamples[ip] || [];
      const last = arr[arr.length - 1];
      if (last && (a < last.a || r < last.r)) arr = []; // counters reset: device restarted
      arr.push({ t: now, a, r });
      while (arr.length > 2 && now - arr[1].t >= rr.windowMin * 60000) arr.shift();
      rejSamples[ip] = arr;
      const first = arr[0], da = a - first.a, dr = r - first.r, total = da + dr;
      if (total < 20) { delete rejRate[ip]; continue; }
      const rate = dr / total * 100; rejRate[ip] = rate;
      if (rate <= rr.maxPct || now - first.t < rr.windowMin * 30000) continue; // need at least half a window of data
      if (rejLast[ip] && now - rejLast[ip] < rr.cooldownMin * 60000) continue;
      rejLast[ip] = now;
      const detail = `${rate.toFixed(1)}% rejected (${dr} of ${total}) in the last ${Math.round((now - first.t) / 60000)} min`;
      if (rr.action === 'restart') {
        log('warn', `Reject rate: <strong>${esc(D.name(dev))}</strong> ${detail}`, 'auto');
        if (await restartDevice(dev, 'reject rate', 'auto')) notify('auto', `${D.name(dev)} restarted`, detail);
        rejSamples[ip] = [];
      } else autoAlert(`${D.name(dev)} rejects too many shares`, detail);
    }
  } else { rejSamples = {}; rejRate = {}; }

  // Overheat protection, with a cooldown so a hot room can't cause a restart loop
  const oh = c.overheatProtect;
  if (oh.enabled) {
    for (const dev of active(oh)) {
      const ip = dev._ip, t = D.chipTemp(dev) ?? 0;
      if (t <= oh.maxTemp) continue;
      if (overheatLastRestart[ip] && now - overheatLastRestart[ip] < (oh.cooldownMin || 10) * 60000) continue;
      overheatLastRestart[ip] = now;
      log('warn', `Overheat: <strong>${esc(D.name(dev))}</strong> at ${dispTemp(t)} (limit ${dispTemp(oh.maxTemp)})`, 'auto');
      if (await restartDevice(dev, 'overheat', 'auto')) notify('auto', `${D.name(dev)} was too hot`, `Restarted at ${dispTemp(t)}`);
    }
  }

  // Quiet hours: lower fans in a time window, restore afterwards, with a heat safety valve
  const q = c.quietHours, quietNow = q.enabled && inWindow(q.start, q.end);
  let qChanged = false;
  for (const ip of Object.keys(autoState.quiet)) {
    if (quietNow && q.devices.includes(ip)) continue;
    const dev = findDev(ip);
    if (!dev) { delete autoState.quiet[ip]; qChanged = true; continue; }
    if (dev._offline) continue; // restore once it's back
    const st = autoState.quiet[ip];
    if (st.suspended || await quietRestore(dev, st, quietNow ? 'removed from quiet hours' : 'quiet hours are over')) { delete autoState.quiet[ip]; qChanged = true; }
  }
  if (quietNow) {
    for (const dev of active(q)) {
      const ip = dev._ip, t = D.chipTemp(dev), st = autoState.quiet[ip];
      if (!st) {
        if (t != null && t > q.safeTemp) continue; // too warm to quieten right now
        const prev = { prevAuto: D.type(dev) === 'bitaxe' && !!D.autoFan(dev), prevSpeed: D.fanSpeed(dev) ?? 100, suspended: false };
        if (await setFan(dev, false, q.fanPct)) { autoState.quiet[ip] = prev; qChanged = true; log('action', `Quiet hours: fan on <strong>${esc(D.name(dev))}</strong> set to ${q.fanPct}%`, 'auto'); }
      } else if (!st.suspended && t != null && t > q.safeTemp) {
        if (await quietRestore(dev, st, `chip reached ${dispTemp(t)}`)) { st.suspended = true; qChanged = true; notify('auto', `${D.name(dev)} is too warm for quiet hours`, `Fan back to normal at ${dispTemp(t)}`); }
      } else if (st.suspended && t != null && t < q.safeTemp - 5) {
        if (await setFan(dev, false, q.fanPct)) { st.suspended = false; qChanged = true; log('action', `Quiet hours: <strong>${esc(D.name(dev))}</strong> cooled down, fan back to ${q.fanPct}%`, 'auto'); }
      }
    }
  }
  if (qChanged) saveAutoState();

  // Daily restart at a fixed time (within a 30-minute grace window)
  const sr = c.scheduledRestart;
  if (sr.enabled && sr.devices.length) {
    const target = new Date(); target.setHours(Math.floor(hm(sr.time) / 60), hm(sr.time) % 60, 0, 0);
    const today = dayKey();
    if (now >= target.getTime() && now - target.getTime() < 30 * 60000) {
      for (const dev of active(sr)) {
        if (autoState.sched[dev._ip] === today) continue;
        autoState.sched[dev._ip] = today; saveAutoState();
        if (await restartDevice(dev, 'daily restart', 'auto')) notify('auto', `Daily restart: ${D.name(dev)}`, `Scheduled for ${sr.time}`);
        await sleep(4000);
      }
    }
  }

  // Shares stalled: the miner reports hashrate but its share counters stop moving.
  // The wait is never shorter than 10× the expected time between shares, so a
  // high pool difficulty (fewer, bigger shares) can't trigger a false restart.
  const ss = c.shareStall;
  if (ss.enabled) {
    for (const dev of active(ss)) {
      const ip = dev._ip, count = D.shares(dev) + D.rejected(dev), up = D.uptime(dev), hr = D.hr(dev);
      const t = shareTrack[ip];
      if (!t || count !== t.count || up + 30 < t.up || hr < 0.01) { shareTrack[ip] = { count, since: now, up }; continue; }
      t.up = up;
      const limit = shareStallLimitMs(dev, ss);
      if (now - t.since < limit) continue;
      if (shareStallLast[ip] && now - shareStallLast[ip] < ss.cooldownMin * 60000) continue;
      shareStallLast[ip] = now; shareTrack[ip] = { count, since: now, up };
      log('warn', `Shares stalled: <strong>${esc(D.name(dev))}</strong> hashes at ${fmt.hr(hr)} but sent no share for ${fmt.dur(limit)}`, 'auto');
      if (await restartDevice(dev, 'no shares sent', 'auto')) notify('auto', `${D.name(dev)} restarted`, `No shares for ${fmt.dur(limit)} while hashing`);
    }
  } else shareTrack = {};

  // Heat slowdown: step frequency (and voltage) down when the voltage
  // regulator or the chip runs too hot, instead of letting the firmware's
  // thermal cut-off switch the miner off and on in a loop.
  const vp = c.vrProtect;
  if (vp.enabled) {
    const useVr = vp.watch !== 'chip', useChip = vp.watch !== 'vr';
    for (const dev of active(vp)) {
      const ip = dev._ip, vr = useVr ? D.vrTemp(dev) : null, chip = useChip ? D.chipTemp(dev) : null;
      if (vr == null && chip == null) continue;
      // Remember when a sensor ran close to its limit, to recognise a cut-off afterwards
      if (vr != null && vr >= vp.maxTemp - 8) vrHotSeen[ip] = { t: now, what: 'VR', temp: vr };
      if (chip != null && chip >= vp.chipMaxTemp - 4) vrHotSeen[ip] = { t: now, what: 'chip', temp: chip };
      const st = autoState.vr[ip];
      const vrHot = vr != null && vr >= vp.maxTemp, chipHot = chip != null && chip >= vp.chipMaxTemp;
      // A cut-off shows up as ~0 GH/s shortly after a sensor ran close to its limit
      const cutoff = D.hr(dev) < 0.01 && vrHotSeen[ip] && now - vrHotSeen[ip].t < 5 * 60000;
      const hot = vrHot || chipHot || cutoff;
      const warm = (vr != null && vr >= vp.maxTemp - 5) || (chip != null && chip >= vp.chipMaxTemp - 5);
      if (st) st.coolSince = hot || warm ? null : (st.coolSince || now);
      if (hot) {
        if (st && st.lastStep && now - st.lastStep < vp.cooldownMin * 60000) continue;
        const why = vrHot && chipHot ? `VR at ${dispTemp(vr)} and chip at ${dispTemp(chip)}` : vrHot ? `VR at ${dispTemp(vr)}` : chipHot ? `chip at ${dispTemp(chip)}`
          : `thermal cut-off after the ${vrHotSeen[ip].what} reached ${dispTemp(vrHotSeen[ip].temp)}`;
        await vrStepDown(dev, vp, why);
      } else if (st && vp.recoverHours > 0 && st.coolSince && now - st.coolSince >= vp.recoverHours * 3600000 && now - st.lastStep >= vp.recoverHours * 3600000) {
        await vrStepUp(dev, vp);
      }
    }
    saveAutoState();
  }

  // Pool rotation
  const pr = c.poolRotation;
  const rotPools = pr.poolIds.filter((id) => savedPools.some((p) => p.id === id));
  if (pr.enabled && rotPools.length >= 2) {
    for (const dev of active(pr)) {
      const ip = dev._ip;
      const st = (poolRotationState[ip] = poolRotationState[ip] || { lastSwitch: now, currentPoolIdx: 0 });
      if (now - st.lastSwitch < pr.hours * 3600000) continue;
      st.currentPoolIdx = (st.currentPoolIdx + 1) % rotPools.length; st.lastSwitch = now;
      chrome.storage.local.set({ poolRotationState });
      const pool = savedPools.find((p) => p.id === rotPools[st.currentPoolIdx]); if (!pool) continue;
      log('info', `Pool rotation: <strong>${esc(D.name(dev))}</strong> moves to <strong>${esc(pool.name)}</strong>`, 'auto');
      try {
        const { patch } = await buildPoolPatch(dev, pool, null, { withFallback: false });
        await apiPatch(ip, patch); await sleep(500); await apiRestart(ip);
        log('success', `Pool rotation: <strong>${esc(D.name(dev))}</strong> is on ${esc(pool.name)}, restarting`, 'auto');
        notify('auto', `${D.name(dev)} switched pool`, pool.name);
      } catch (e) { log('error', `Pool rotation failed on <strong>${esc(D.name(dev))}</strong>: ${esc(e.message)}`, 'auto'); }
    }
  }
  updateAutoStatus();
}

// ─── Helpers for Shares stalled and VR overheat ───
function shareIntervalSec(dev) {
  const pd = D.poolDiff(dev), hr = D.hr(dev);
  if (!pd || hr < 0.01) return null;
  return pd * 4294967296 / (hr * 1e9); // expected seconds between shares
}
function shareStallLimitMs(dev, cfg) {
  const i = shareIntervalSec(dev);
  return Math.max(cfg.minutes * 60000, i ? i * 10 * 1000 : 0);
}
function optNums(opts) { return Array.isArray(opts) ? opts.map((o) => typeof o === 'object' ? +(o.value ?? o.freq ?? o.voltage) : +o).filter((n) => n > 0) : []; }
function snapDown(value, opts) { const n = optNums(opts).sort((a, b) => b - a); return n.length ? (n.find((x) => x <= value) ?? value) : value; }
function snapUp(value, opts, cap) { const n = optNums(opts).sort((a, b) => a - b); return Math.min(n.length ? (n.find((x) => x >= value) ?? value) : value, cap); }
async function writeFreqVolt(dev, freq, volt, restart) {
  let patch = {};
  if (D.type(dev) === 'nerdqaxe') patch = await readNerdSettings(dev._ip); // NerdQAxe resets fields it doesn't receive
  patch.frequency = freq; patch.asicfrequency = freq; if (volt) patch.coreVoltage = volt;
  const r = await apiPatch(dev._ip, patch);
  if (r && r.error) throw new Error(r.error);
  if (restart) { await sleep(500); await apiRestart(dev._ip); }
}
async function vrStepDown(dev, vp, why) {
  const ip = dev._ip, f = D.freq(dev), v = D.volt(dev);
  if (!f) return;
  const st = autoState.vr[ip] || { origFreq: f, origVolt: v, steps: 0 };
  let nf = f, nv = v;
  const canFreq = f > vp.minFreq, canVolt = v && v > vp.minVolt;
  const lowF = () => Math.max(vp.minFreq, snapDown(f - vp.freqStep, D.freqOpts(dev)));
  const lowV = () => Math.max(vp.minVolt, snapDown(v - vp.voltStep, D.voltOpts(dev)));
  if (vp.mode === 'freq') { if (canFreq) nf = lowF(); }
  else if (vp.mode === 'freqThenVolt') { if (canFreq) nf = lowF(); else if (canVolt) nv = lowV(); }
  else { if (canFreq) nf = lowF(); if (canVolt) nv = lowV(); }
  st.lastStep = Date.now(); st.coolSince = null;
  autoState.vr[ip] = st;
  if (nf === f && nv === v) {
    if (!st.atFloor) { st.atFloor = true; autoAlert(`${D.name(dev)} is still too hot`, `${why}, already at the lowest allowed settings (${f} MHz, ${v} mV). Check the cooling.`); }
    return;
  }
  st.atFloor = false; st.steps = (st.steps || 0) + 1;
  log('warn', `Heat slowdown: <strong>${esc(D.name(dev))}</strong> ${esc(why)}. Lowering to ${nf} MHz${nv !== v ? `, ${nv} mV` : ''} (was ${f} MHz, ${v} mV)`, 'auto');
  try {
    await writeFreqVolt(dev, nf, nv, vp.restart === 'yes');
    log('success', `Heat slowdown: <strong>${esc(D.name(dev))}</strong> now at ${nf} MHz, ${nv} mV${vp.restart === 'yes' ? ', restarting' : ''}`, 'auto');
    notify('auto', `${D.name(dev)} slowed down to cool off`, `${nf} MHz, ${nv} mV`);
  } catch (e) { log('error', `Heat slowdown: could not change <strong>${esc(D.name(dev))}</strong>: ${esc(e.message)}`, 'auto'); }
}
async function vrStepUp(dev, vp) {
  const ip = dev._ip, st = autoState.vr[ip], f = D.freq(dev), v = D.volt(dev);
  if (!st || !f) return;
  // Undo voltage first (it was lowered last), then frequency
  let nf = f, nv = v;
  if (v && st.origVolt && v < st.origVolt) nv = snapUp(v + vp.voltStep, D.voltOpts(dev), st.origVolt);
  else if (f < st.origFreq) nf = snapUp(f + vp.freqStep, D.freqOpts(dev), st.origFreq);
  st.lastStep = Date.now(); st.coolSince = Date.now();
  if (nf >= st.origFreq && (!st.origVolt || nv >= st.origVolt)) delete autoState.vr[ip];
  if (nf === f && nv === v) return;
  log('action', `Heat slowdown: <strong>${esc(D.name(dev))}</strong> stayed cool for ${vp.recoverHours}h, raising to ${nf} MHz, ${nv} mV`, 'auto');
  try { await writeFreqVolt(dev, nf, nv, vp.restart === 'yes'); }
  catch (e) { log('error', `Heat slowdown: could not raise <strong>${esc(D.name(dev))}</strong>: ${esc(e.message)}`, 'auto'); }
}
async function vrRestoreAll() {
  for (const ip of Object.keys(autoState.vr)) {
    const dev = findDev(ip), st = autoState.vr[ip];
    if (!dev || dev._offline) continue;
    try {
      await writeFreqVolt(dev, st.origFreq, st.origVolt, autoConfig.vrProtect.restart === 'yes');
      log('action', `Heat slowdown: <strong>${esc(D.name(dev))}</strong> restored to ${st.origFreq} MHz, ${st.origVolt} mV`, 'auto');
      delete autoState.vr[ip];
    } catch (e) { log('error', `Could not restore <strong>${esc(D.name(dev))}</strong>: ${esc(e.message)}`, 'auto'); }
  }
  saveAutoState(); updateAutoStatus();
  if (amId === 'vrProtect') openAutoModal('vrProtect');
}

// ════════ AUTOMATION REGISTRY & UI ════════
const ACTION_OPTS = [['restart', 'Restart the miner'], ['notify', 'Alert me only']];
const AUTOMATIONS = {
  watchdog: {
    icon: 'power', title: 'Watchdog', desc: 'Restarts a miner that sits at 0 GH/s for too long.',
    help: 'Checked on every refresh. A miner that still answers but reports 0 GH/s for longer than this is restarted once, then the timer starts over.',
    fields: [{ key: 'minutes', label: 'Restart after', type: 'number', unit: 'min', min: 1, max: 60 }],
    chips: (c) => [`0 GH/s for ${c.minutes} min`],
    status(c) {
      const z = c.devices.filter((ip) => watchdogZeroSince[ip]);
      if (z.length) { const left = Math.max(0, Math.ceil((c.minutes * 60000 - (Date.now() - Math.min(...z.map((ip) => watchdogZeroSince[ip])))) / 60000)); return ['warn', `${z.length} at 0 GH/s, restart in ${left} min`]; }
      return ['active', 'All hashing'];
    }
  },
  hashrateDrop: {
    icon: 'trend', title: 'Hashrate drop', desc: 'Acts when a miner runs well below its normal hashrate.',
    help: 'Normal hashrate is the expected hashrate the firmware reports, or the one-hour average when it doesn\'t. The drop has to last the whole period before anything happens, and 0 GH/s is left to the Watchdog.',
    fields: [
      { key: 'dropPct', label: 'Drop of more than', type: 'number', unit: '%', min: 10, max: 90 },
      { key: 'minutes', label: 'Lasting at least', type: 'number', unit: 'min', min: 2, max: 240 },
      { key: 'action', label: 'Then', type: 'select', options: ACTION_OPTS },
      { key: 'cooldownMin', label: 'Wait between actions', type: 'number', unit: 'min', min: 5, max: 1440 }],
    chips: (c) => [`−${c.dropPct}% for ${c.minutes} min`, c.action === 'restart' ? 'Restarts' : 'Alerts'],
    status(c) { const n = c.devices.filter((ip) => hashDropSince[ip]).length; return n ? ['warn', `${n} running slow, watching`] : ['active', 'All at normal speed']; }
  },
  fallbackReturn: {
    icon: 'switch', title: 'Back to primary pool', desc: 'Restarts a miner stuck on its fallback pool so it returns to the primary.',
    help: 'AxeOS moves to the fallback pool when the primary drops out, but it doesn\'t always move back. After this long on the fallback the miner is restarted and connects to the primary first. Needs firmware that reports which pool is in use (AxeOS 2.x).',
    fields: [{ key: 'minutes', label: 'On the fallback for', type: 'number', unit: 'min', min: 5, max: 1440 }],
    chips: (c) => [`after ${c.minutes} min`],
    status(c) {
      const devs = c.devices.map(findDev).filter(Boolean);
      if (devs.length && !devs.some((d) => 'isUsingFallbackStratum' in d || 'isUsingFallback' in d)) return ['warn', 'These miners don\'t report their active pool'];
      const n = devs.filter(onFallback).length;
      return n ? ['warn', `${n} on fallback now`] : ['active', 'All on their primary pool'];
    }
  },
  flapRecovery: {
    icon: 'wifi', title: 'Flap recovery', desc: 'Restarts a board that keeps dropping offline and coming back.',
    help: 'When a miner drops more than the set number of times within the window, it is restarted once it has been reachable for 15 seconds. Then it is left alone for the wait time.',
    fields: [
      { key: 'threshold', label: 'Drops', type: 'number', unit: 'times', min: 2, max: 20 },
      { key: 'windowMin', label: 'Within', type: 'number', unit: 'min', min: 2, max: 120 },
      { key: 'cooldownMin', label: 'Then wait', type: 'number', unit: 'min', min: 5, max: 240 }],
    chips: (c) => [`${c.threshold}× in ${c.windowMin} min`],
    status(c) {
      const since = Date.now() - c.windowMin * 60000;
      const n = c.devices.filter((ip) => uptimeEvents.some((e) => e.ip === ip && e.offAt >= since)).length;
      return n ? ['warn', `${n} dropped recently`] : ['active', 'All stable'];
    }
  },
  rejectRate: {
    icon: 'alert', title: 'Reject rate', desc: 'Watches the share of rejected work over a rolling window.',
    help: 'Worked out from the accepted and rejected totals between refreshes, once at least 20 shares came in. A high reject rate usually means a slow link to the pool or an unstable overclock.',
    fields: [
      { key: 'maxPct', label: 'More than', type: 'number', unit: '% rejected', min: 0.5, max: 50, step: 0.5 },
      { key: 'windowMin', label: 'Over the last', type: 'number', unit: 'min', min: 10, max: 240 },
      { key: 'action', label: 'Then', type: 'select', options: ACTION_OPTS },
      { key: 'cooldownMin', label: 'Wait between actions', type: 'number', unit: 'min', min: 10, max: 1440 }],
    chips: (c) => [`> ${c.maxPct}% in ${c.windowMin} min`, c.action === 'restart' ? 'Restarts' : 'Alerts'],
    status(c) {
      const rates = c.devices.filter((ip) => rejRate[ip] != null).map((ip) => rejRate[ip]);
      if (!rates.length) return ['active', 'Collecting shares'];
      const worst = Math.max(...rates);
      return [worst > c.maxPct ? 'warn' : 'active', `Worst ${worst.toFixed(2)}% rejected`];
    }
  },
  shareStall: {
    icon: 'bolt', title: 'Shares stalled', desc: 'Restarts a miner that keeps hashing but stops sending shares.',
    help: 'Watches the accepted and rejected share counters. If a miner reports hashrate but neither counter moves for the set time, it is restarted. The wait is never shorter than 10 times the expected time between shares at the current pool difficulty, so a high difficulty can\'t cause a false restart.',
    fields: [
      { key: 'minutes', label: 'No shares for at least', type: 'number', unit: 'min', min: 3, max: 240 },
      { key: 'cooldownMin', label: 'Wait between restarts', type: 'number', unit: 'min', min: 5, max: 1440 }],
    chips: (c) => [`no shares ${c.minutes} min`],
    status(c) {
      const now = Date.now();
      const stalled = c.devices.map(findDev).filter((d) => d && !d._offline && shareTrack[d._ip] && now - shareTrack[d._ip].since > 2 * 60000);
      if (stalled.length) { const d = stalled[0]; return ['warn', `${D.name(d)}: no share for ${fmt.dur(now - shareTrack[d._ip].since)}`]; }
      const waits = c.devices.map(findDev).filter((d) => d && !d._offline).map(shareIntervalSec).filter(Boolean);
      return ['active', waits.length ? `All sending shares, one every ~${Math.max(1, Math.round(Math.max(...waits)))}s at most` : 'All sending shares'];
    }
  },
  vrProtect: {
    icon: 'gauge', title: 'Heat slowdown', desc: 'Lowers frequency and voltage when the chip or voltage regulator runs too hot.',
    help: 'The firmware stops hashing when the chip passes about 70 °C or the voltage regulator gets too hot, then starts again once it cools: on a hot miner that becomes a loop. This automation steps the miner down instead. It acts when a watched temperature reaches its limit, or when the miner drops to 0 GH/s shortly after running close to one (the cut-off itself). With "Frequency, then voltage" the voltage is lowered only once frequency reaches its floor; "Both together" lowers both at once. After each step the miner gets the wait time to settle. The original values are remembered: restore them here by hand, or let them come back step by step after the miner has stayed cool for the hours you set. Keep the chip limit a few degrees under 70 °C so the step happens before the firmware cuts out.',
    fields: [
      { key: 'watch', label: 'Watch', type: 'select', options: [['both', 'Chip and VR'], ['chip', 'Chip only'], ['vr', 'VR only']] },
      { key: 'chipMaxTemp', label: 'Chip limit', type: 'temp', min: 50, max: 100 },
      { key: 'maxTemp', label: 'VR limit', type: 'temp', min: 50, max: 120 },
      { key: 'mode', label: 'Lower', type: 'select', options: [['freqThenVolt', 'Frequency, then voltage'], ['freq', 'Frequency only'], ['both', 'Both together']] },
      { key: 'freqStep', label: 'Frequency step', type: 'number', unit: 'MHz', min: 5, max: 200 },
      { key: 'minFreq', label: 'Frequency never below', type: 'number', unit: 'MHz', min: 100, max: 1000 },
      { key: 'voltStep', label: 'Voltage step', type: 'number', unit: 'mV', min: 5, max: 100 },
      { key: 'minVolt', label: 'Voltage never below', type: 'number', unit: 'mV', min: 900, max: 1400 },
      { key: 'restart', label: 'Restart to apply', type: 'select', options: [['yes', 'Yes'], ['no', 'No, firmware applies it live']] },
      { key: 'cooldownMin', label: 'Wait between steps', type: 'number', unit: 'min', min: 5, max: 240 },
      { key: 'recoverHours', label: 'Raise back after cool for', type: 'number', unit: 'h, 0 = never', min: 0, max: 168, step: 0.5 }],
    extra() {
      const rows = Object.entries(autoState.vr).map(([ip, st]) => { const d = findDev(ip); return d ? `<li><strong>${esc(D.name(d))}</strong>: ${D.freq(d)} MHz, ${D.volt(d)} mV <span class="muted">(originally ${st.origFreq} MHz, ${st.origVolt} mV)</span></li>` : ''; }).join('');
      return rows ? `<div class="field am-section"><div class="field-head"><label>Slowed down by this automation</label><button class="link-btn" id="amVrRestore">Restore original settings</button></div><ul class="am-list">${rows}</ul></div>` : '';
    },
    chips: (c) => [c.watch === 'vr' ? `VR over ${dispTempShort(c.maxTemp)}` : c.watch === 'chip' ? `chip over ${dispTempShort(c.chipMaxTemp)}` : `chip ${dispTempShort(c.chipMaxTemp)} · VR ${dispTempShort(c.maxTemp)}`, `−${c.freqStep} MHz steps`],
    status(c) {
      const devs = c.devices.map(findDev).filter((d) => d && !d._offline);
      const useVr = c.watch !== 'chip', useChip = c.watch !== 'vr';
      if (devs.length && c.watch === 'vr' && devs.every((d) => D.vrTemp(d) == null)) return ['warn', 'These miners don\'t report a VR temperature'];
      const hot = devs.filter((d) => (useVr && (D.vrTemp(d) ?? 0) >= c.maxTemp) || (useChip && (D.chipTemp(d) ?? 0) >= c.chipMaxTemp));
      if (hot.length) return ['bad', `${hot.map((d) => D.name(d)).join(', ')} over the limit`];
      const slowed = Object.keys(autoState.vr).filter((ip) => c.devices.includes(ip)).length;
      const vrs = useVr ? devs.map(D.vrTemp).filter((t) => t != null) : [], chips = useChip ? devs.map(D.chipTemp).filter((t) => t != null) : [];
      const parts = [];
      if (chips.length) parts.push(`chip ${dispTempShort(Math.max(...chips))}`);
      if (vrs.length) parts.push(`VR ${dispTempShort(Math.max(...vrs))}`);
      return [slowed ? 'warn' : 'active', `${parts.length ? 'Hottest ' + parts.join(', ') : 'Watching'}${slowed ? `, ${slowed} slowed down` : ''}`];
    }
  },
  overheatProtect: {
    icon: 'thermo', title: 'Overheat protection', desc: 'Restarts a miner whose chip runs hotter than your limit.',
    help: 'After a restart the same miner is left alone for the wait time, so a hot room can\'t cause a restart loop. The firmware already stops hashing at about 70 °C chip temperature, so a limit at or above 70 °C never triggers: keep it below. To slow a hot miner down instead of restarting it, use Heat slowdown.',
    fields: [
      { key: 'maxTemp', label: 'Chip limit', type: 'temp', min: 50, max: 100 },
      { key: 'cooldownMin', label: 'Wait between restarts', type: 'number', unit: 'min', min: 2, max: 120 }],
    chips: (c) => [`over ${dispTempShort(c.maxTemp)}`],
    status(c) {
      const hot = c.devices.map(findDev).filter((d) => d && !d._offline && (D.chipTemp(d) ?? 0) > c.maxTemp);
      if (hot.length) return ['bad', `${hot.map((d) => D.name(d)).join(', ')} over the limit`];
      if (c.maxTemp >= 70) return ['warn', `Limit ${dispTempShort(c.maxTemp)} is above the firmware cut-off, lower it`];
      const temps = c.devices.map(findDev).filter((d) => d && !d._offline).map((d) => D.chipTemp(d)).filter((t) => t != null);
      return ['active', temps.length ? `Hottest ${dispTempShort(Math.max(...temps))}` : 'All under the limit'];
    }
  },
  quietHours: {
    icon: 'moon', title: 'Quiet hours', desc: 'Turns fans down at night and puts them back in the morning.',
    help: 'During the window each miner\'s fan runs at a fixed speed. Afterwards it goes back to the setting it had before. If a chip passes the safety limit, its fan goes back to normal right away and returns to quiet once it has cooled down 5 degrees.',
    fields: [
      { key: 'start', label: 'From', type: 'time' },
      { key: 'end', label: 'Until', type: 'time' },
      { key: 'fanPct', label: 'Fan speed', type: 'number', unit: '%', min: 20, max: 100 },
      { key: 'safeTemp', label: 'Safety limit', type: 'temp', min: 50, max: 90 }],
    chips: (c) => [`${c.start} to ${c.end}`, `fan ${c.fanPct}%`],
    status(c) {
      const quiet = Object.keys(autoState.quiet).length, susp = Object.values(autoState.quiet).filter((s) => s.suspended).length;
      if (inWindow(c.start, c.end)) return [susp ? 'warn' : 'active', `Quiet until ${c.end}${quiet ? `, ${quiet - susp} miner${quiet - susp === 1 ? '' : 's'} at ${c.fanPct}%` : ''}${susp ? `, ${susp} too warm` : ''}`];
      return ['active', `Next quiet period at ${c.start}`];
    }
  },
  scheduledRestart: {
    icon: 'clock', title: 'Daily restart', desc: 'Restarts the chosen miners once a day at a set time.',
    help: 'Uses this computer\'s clock and restarts one miner every few seconds. If the dashboard isn\'t open within half an hour after the set time, that day is skipped instead of restarting late.',
    fields: [{ key: 'time', label: 'Every day at', type: 'time' }],
    chips: (c) => [`daily at ${c.time}`],
    status(c) {
      const t = new Date(); t.setHours(Math.floor(hm(c.time) / 60), hm(c.time) % 60, 0, 0);
      const doneToday = c.devices.length && c.devices.every((ip) => autoState.sched[ip] === dayKey());
      if (Date.now() > t.getTime() || doneToday) t.setDate(t.getDate() + 1);
      return ['active', `Next restart ${t.toDateString() === new Date().toDateString() ? 'today' : 'tomorrow'} at ${c.time}`];
    }
  },
  poolRotation: {
    icon: 'pools', title: 'Pool rotation', desc: 'Moves miners through a set of saved pools on a schedule.',
    help: 'Every interval each miner switches to the next pool in the list and restarts. The worker name is added for you, as in the Pools view.',
    pools: true,
    fields: [{ key: 'hours', label: 'Switch every', type: 'number', unit: 'hours', min: 0.5, max: 720, step: 0.5 }],
    chips: (c) => [`every ${c.hours}h`, `${c.poolIds.filter((id) => savedPools.some((p) => p.id === id)).length} pools`],
    status(c) {
      const pools = c.poolIds.filter((id) => savedPools.some((p) => p.id === id));
      if (pools.length < 2) return ['warn', 'Pick at least two pools'];
      const next = Math.min(...c.devices.map((ip) => (poolRotationState[ip]?.lastSwitch || Date.now()) + c.hours * 3600000));
      return ['active', `Next switch in ${fmt.dur(next - Date.now())}`];
    }
  },
};
const AUTO_GROUPS = [
  { title: 'Keep hashing', sub: 'Recover miners that stall, slow down or wander off their pool.', ids: ['watchdog', 'hashrateDrop', 'shareStall', 'fallbackReturn', 'flapRecovery', 'rejectRate'] },
  { title: 'Protect the hardware', sub: 'Heat and noise.', ids: ['overheatProtect', 'vrProtect', 'quietHours'] },
  { title: 'Schedules', sub: 'Routine jobs on a timer.', ids: ['scheduledRestart', 'poolRotation'] },
];
function autoStatusOf(id) {
  const c = autoConfig[id];
  if (!c.enabled) return ['', 'Off'];
  if (!c.devices.length) return ['warn', 'No miners selected'];
  try { return AUTOMATIONS[id].status(c); } catch { return ['active', 'On']; }
}
function autoChipsHTML(id) {
  const c = autoConfig[id], n = c.devices.length;
  return [...AUTOMATIONS[id].chips(c), `${n} miner${n === 1 ? '' : 's'}`].map((t) => `<span class="ac-chip">${esc(t)}</span>`).join('');
}
function statusHTML([cls, text]) { return `<span class="dot"></span><span class="txt">${esc(text)}</span>`; }
function renderAutoPanel() {
  $('autoPanel').innerHTML = `<div class="auto-cards">${AUTO_GROUPS.flatMap((g) => g.ids.map((id) => {
    const a = AUTOMATIONS[id], c = autoConfig[id];
    return `<article class="ac${c.enabled ? ' on' : ''}" data-auto="${id}" tabindex="0" role="button" aria-label="${a.title} settings">
      <div class="ac-top"><span class="ac-icon">${ic(a.icon)}</span>
        <label class="switch" title="On or off"><input type="checkbox" data-auto-toggle="${id}" ${c.enabled ? 'checked' : ''} aria-label="${a.title} on or off"><span></span></label></div>
      <span class="ac-group">${g.title}</span>
      <h3>${a.title}</h3>
      <p class="ac-desc">${a.desc}</p>
      <div class="ac-chips">${autoChipsHTML(id)}</div>
      <footer class="ac-foot"><span class="ac-status">${statusHTML(autoStatusOf(id))}</span><span class="ac-edit">Configure ${ic('chev')}</span></footer>
    </article>`;
  })).join('')}</div>`;
  updateAutoStatus();
  renderAutoRecent();
}
function refreshAutoLists() { updateAutoStatus(); if ($('autoModal').open && amId) renderAutoPickers(); }
function updateAutoStatus() {
  const ids = Object.keys(AUTOMATIONS), on = ids.filter((id) => autoConfig[id]?.enabled);
  $$('#autoPanel .ac[data-auto]').forEach((card) => {
    const id = card.dataset.auto, c = autoConfig[id]; if (!c) return;
    card.classList.toggle('on', c.enabled);
    const t = card.querySelector('[data-auto-toggle]'); if (t && t.checked !== c.enabled) t.checked = c.enabled;
    const [cls, text] = autoStatusOf(id), st = card.querySelector('.ac-status');
    st.className = 'ac-status' + (cls ? ' ' + cls : ''); st.innerHTML = statusHTML([cls, text]); st.title = text;
    const chips = autoChipsHTML(id), ch = card.querySelector('.ac-chips'); if (ch.innerHTML !== chips) ch.innerHTML = chips;
  });
  if ($('autoModal')?.open && amId) { const [cls, text] = autoStatusOf(amId); $('amStatus').className = 'ac-status' + (cls ? ' ' + cls : ''); $('amStatus').innerHTML = statusHTML([cls, text]); }
  const sum = $('autoSummary');
  if (sum) {
    const lastAuto = [...activityLogs].reverse().find((e) => e.tag === 'auto' && e.level !== 'info');
    sum.innerHTML = `<span class="as-count">${on.length}<small>/${ids.length}</small></span>
      <div class="as-text"><strong>${on.length ? `${on.length} automation${on.length === 1 ? '' : 's'} on` : 'No automations on'}</strong>
      <span>They run while this dashboard is open. ${lastAuto ? `Last action ${fmt.ago(lastAuto.time)}.` : 'No actions taken yet.'}</span></div>`;
  }
  $('autoNavDot').hidden = !on.length;
}
function renderAutoRecent() {
  const box = $('autoRecent'); if (!box) return;
  const list = activityLogs.filter((e) => e.tag === 'auto').slice(-8).reverse();
  box.innerHTML = list.length ? list.map((e) => `<div class="log-entry">${logEntryHTML(e)}</div>`).join('') : '<div class="log-empty">Nothing yet. Restarts, alerts and fan changes made by automations show up here.</div>';
}
function toggleAutomation(id, on) {
  const c = autoConfig[id]; if (!c || c.enabled === on) return;
  c.enabled = on; saveAutoConfig();
  log('info', `${AUTOMATIONS[id].title} turned <strong>${on ? 'on' : 'off'}</strong>`, 'auto');
  if (on && !c.devices.length && !($('autoModal').open && amId === id)) { openAutoModal(id); toast('Pick the miners this should watch', 'info'); }
  if (!on && id === 'quietHours') runAutomations(); // restore fans straight away
  updateAutoStatus();
  if ($('autoModal').open && amId === id) { $('amEnabled').checked = on; $('autoModal').classList.toggle('on', on); }
}

// ─── Settings dialog for one automation ───
let amId = null;
function fieldHTML(f, c) {
  const v = c[f.key];
  if (f.type === 'select') return `<div class="field inline"><label for="am-${f.key}">${f.label}</label><select id="am-${f.key}" class="select sm" data-key="${f.key}" data-type="select">${f.options.map(([o, t]) => `<option value="${o}" ${o === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  if (f.type === 'time') return `<div class="field inline"><label for="am-${f.key}">${f.label}</label><input type="time" id="am-${f.key}" class="sm-input" data-key="${f.key}" data-type="time" value="${esc(v)}"></div>`;
  const temp = f.type === 'temp';
  return `<div class="field inline"><label for="am-${f.key}">${f.label}</label><div class="unit-input"><input type="number" id="am-${f.key}" data-key="${f.key}" data-type="${f.type}" value="${temp ? tempToUi(v) : v}" min="${temp ? tempToUi(f.min) : f.min}" max="${temp ? tempToUi(f.max) : f.max}" step="${f.step || 1}"><span>${temp ? '°' + tempUnit : f.unit}</span></div></div>`;
}
function openAutoModal(id) {
  const a = AUTOMATIONS[id], c = autoConfig[id]; if (!a) return;
  amId = id;
  $('amIcon').innerHTML = ic(a.icon); $('amTitle').textContent = a.title; $('amDesc').textContent = a.desc;
  $('amEnabled').checked = c.enabled; $('autoModal').classList.toggle('on', c.enabled);
  $('amBody').innerHTML = `<p class="am-help">${a.help}</p>
    <div class="am-fields">${a.fields.map((f) => fieldHTML(f, c)).join('')}</div>
    ${a.pools ? `<div class="field am-section"><label>Pools in the rotation <span class="muted">pick two or more</span></label><div id="amPools" class="pick-list"></div></div>` : ''}
    ${a.extra ? a.extra(c) : ''}
    <div class="field am-section"><div class="field-head"><label>Miners</label><button class="link-btn" id="amAll">All</button></div><div id="amDevices" class="pick-list"></div></div>`;
  renderAutoPickers();
  updateAutoStatus();
  openDialog('autoModal');
}
function pickHTML(value, text, checked, sub) {
  return `<label class="pick"${sub ? ` title="${esc(sub)}"` : ''}><input type="checkbox" value="${esc(value)}" ${checked ? 'checked' : ''}><span>${esc(text)}</span>${sub ? `<small class="muted">${esc(sub)}</small>` : ''}</label>`;
}
function renderAutoPickers() {
  const c = autoConfig[amId]; if (!c) return;
  const dv = $('amDevices');
  if (dv) dv.innerHTML = devices.length ? getSortedDevices(devices).map((d) => pickHTML(d._ip, D.name(d), c.devices.includes(d._ip), d._offline ? 'offline' : '')).join('') : '<p class="muted small">Add miners first.</p>';
  const pv = $('amPools');
  if (pv) pv.innerHTML = savedPools.length ? savedPools.map((p) => pickHTML(p.id, `${p.name} · ${coinSymbol(p.coin)}`, c.poolIds.includes(p.id))).join('') : '<p class="muted small">Save at least two pools in Pools first.</p>';
  if ($('amAll')) $('amAll').textContent = devices.length && devices.every((d) => c.devices.includes(d._ip)) ? 'None' : 'All';
}
function onAutoModalChange(e) {
  const c = autoConfig[amId]; if (!c) return;
  const el = e.target;
  if (el.dataset.key) {
    const f = AUTOMATIONS[amId].fields.find((x) => x.key === el.dataset.key);
    if (f.type === 'select') c[f.key] = el.value;
    else if (f.type === 'time') { if (/^\d{2}:\d{2}$/.test(el.value)) c[f.key] = el.value; }
    else if (f.type === 'temp') { c[f.key] = clampInt(tempFromUi(parseFloat(el.value)), f.min, f.max, c[f.key]); el.value = tempToUi(c[f.key]); }
    else { c[f.key] = clampInt(el.value, f.min, f.max, c[f.key]); el.value = c[f.key]; }
  } else if (el.closest('#amDevices')) c.devices = $$('#amDevices input:checked').map((x) => x.value);
  else if (el.closest('#amPools')) c.poolIds = $$('#amPools input:checked').map((x) => x.value);
  else return;
  saveAutoConfig(); updateAutoStatus();
  if ($('amAll')) $('amAll').textContent = devices.length && devices.every((d) => c.devices.includes(d._ip)) ? 'None' : 'All';
}

// ════════ POOLS ════════
const coinSymbol = (id) => SHA256_COINS.find((c) => c.id === id)?.symbol || String(id || '').toUpperCase();
const coinName = (id) => SHA256_COINS.find((c) => c.id === id)?.name || id;
let pendingApplySelection = null, applyListSig = '';
function renderPoolManager() { renderCoinTabs(); renderSavedPools(); renderApplyForm(); }
function renderCoinTabs() {
  const used = [...new Set(savedPools.map((p) => p.coin))];
  if (selectedCoinFilter !== 'all' && !used.includes(selectedCoinFilter)) selectedCoinFilter = 'all';
  const tabs = $('coinTabs');
  tabs.hidden = used.length < 2;
  tabs.innerHTML = ['all', ...used].map((cid) => `<button class="chip" data-coin="${esc(cid)}" aria-pressed="${selectedCoinFilter === cid}">${cid === 'all' ? 'All coins' : esc(coinSymbol(cid))}</button>`).join('');
}
function poolUsers(pool) {
  const pp = parseStratumUrl(pool.url), port = String(pp.port || pool.port);
  return devices.filter((d) => D.poolUrl(d).toLowerCase() === pp.host.toLowerCase() && String(D.poolPort(d)) === port);
}
function renderSavedPools() {
  const list = $('savedPoolsList');
  const pools = selectedCoinFilter === 'all' ? savedPools : savedPools.filter((p) => p.coin === selectedCoinFilter);
  if (!savedPools.length) { list.innerHTML = `<div class="empty">${ic('pools')}<h3>No pools saved yet</h3><p>Save a pool once and push it to any number of miners. Paste the stratum address straight from the pool's website.</p><div class="btn-row center"><button class="btn" data-pool-dir>${ic('book')}Pool directory</button><button class="btn btn-primary" data-pool-new>${ic('plus')}New pool</button></div></div>`; return; }
  list.innerHTML = pools.map((p) => {
    const users = poolUsers(p).length;
    return `<div class="pool-row" data-pool="${esc(p.id)}">
      <span class="pool-coin">${esc(coinSymbol(p.coin))}</span>
      <div class="pool-info">
        <div class="pool-name">${esc(p.name)}${poolTypeTag(p.type)}<span class="pool-used" ${users ? '' : 'hidden'}>${users} mining</span></div>
        <div class="pool-url">${esc(parseStratumUrl(p.url).host)}:${esc(p.port)}${p.tls ? ' · TLS' : ''}</div>
        <div class="pool-user" title="${esc(p.user)}">${esc(p.user || 'no wallet')}</div>
      </div>
      <div class="pool-actions">
        <button class="btn sm" data-pool-act="use" title="Pick this pool in the Apply form">Use</button>
        <button class="icon-btn sm" data-pool-act="edit" aria-label="Edit ${esc(p.name)}">${ic('pencil')}</button>
        <button class="icon-btn sm" data-pool-act="delete" aria-label="Delete ${esc(p.name)}">${ic('trash')}</button>
      </div>
    </div>`;
  }).join('');
}
function renderPoolListUsage() {
  if (activeView !== 'pools') return;
  $$('#savedPoolsList .pool-row').forEach((row) => {
    const p = savedPools.find((x) => x.id === row.dataset.pool); if (!p) return;
    const n = poolUsers(p).length, el = row.querySelector('.pool-used');
    el.hidden = !n; el.textContent = `${n} mining`;
  });
}
function fillSelect(sel, placeholder, options) {
  const prev = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>` + options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  if (options.some(([v]) => v === prev)) sel.value = prev;
}
function renderApplyForm() {
  const coins = [...new Set(savedPools.map((p) => p.coin))].map((c) => [c, coinName(c)]);
  fillSelect($('applyCoinSelect'), 'Choose a coin', coins);
  fillSelect($('applyFbCoinSelect'), 'Any coin', coins);
  if (!$('applyCoinSelect').value && coins.length === 1) $('applyCoinSelect').value = coins[0][0];
  updatePoolSelects();
  applyListSig = ''; renderApplyDevices();
}
function updatePoolSelects() {
  const coin = $('applyCoinSelect').value;
  const pools = coin ? savedPools.filter((p) => p.coin === coin) : [];
  fillSelect($('applyPoolSelect'), coin ? 'Choose a pool' : 'Choose a coin first', pools.map((p) => [p.id, p.name]));
  if (!$('applyPoolSelect').value && pools.length === 1) $('applyPoolSelect').value = pools[0].id;
  updateFallbackSelects();
}
function updateFallbackSelects() {
  const fbCoin = $('applyFbCoinSelect').value, primary = $('applyPoolSelect').value;
  const pools = (fbCoin ? savedPools.filter((p) => p.coin === fbCoin) : savedPools).filter((p) => p.id !== primary);
  fillSelect($('applyFallbackSelect'), 'None', pools.map((p) => [p.id, `${p.name} (${coinSymbol(p.coin)})`]));
  updateApplyBtn();
}
function renderApplyDevices() {
  if (applyInProgress) return;
  const box = $('applyDeviceList'); if (!box) return;
  const sig = devices.map((d) => d._ip + D.name(d) + (d._offline ? 0 : 1)).join('|');
  if (sig === applyListSig && !pendingApplySelection) return; applyListSig = sig;
  const keep = new Set(pendingApplySelection || $$('.apply-dev-cb:checked').map((cb) => cb.value));
  pendingApplySelection = null;
  if (!devices.length) { box.innerHTML = '<p class="muted small">No devices yet. Add some from the Fleet view.</p>'; updateApplyBtn(); return; }
  box.innerHTML = getSortedDevices(devices).map((d) => {
    const off = !!d._offline;
    return `<label class="check-card${off ? ' off' : ''}" data-ip="${esc(d._ip)}">
      <input type="checkbox" class="apply-dev-cb" value="${esc(d._ip)}" ${keep.has(d._ip) && !off ? 'checked' : ''} ${off ? 'disabled' : ''}>
      <span class="chip-dot ${D.type(d) === 'nerdqaxe' ? 't-nerd' : 't-bitaxe'}"></span>
      <span class="cc-text"><span class="cc-name">${esc(D.name(d))}</span><span class="cc-sub">${esc(d._ip)}${off ? ' · offline' : ''}</span></span>
      <span class="apply-state" hidden></span>
    </label>`;
  }).join('');
  updateApplyBtn();
}
function updateApplyBtn() {
  const n = $$('.apply-dev-cb:checked').length;
  const ready = $('applyCoinSelect').value && $('applyPoolSelect').value && n;
  $('applyPoolBtn').disabled = !ready || applyInProgress;
  $('applyPoolBtn').textContent = n ? `Apply to ${n} device${n === 1 ? '' : 's'}` : 'Apply pool';
}
function setApplyState(ip, cls, text) {
  const el = document.querySelector(`#applyDeviceList .check-card[data-ip="${CSS.escape(ip)}"] .apply-state`); if (!el) return;
  el.hidden = !cls; el.className = 'apply-state ' + (cls || ''); el.textContent = text || '';
}
async function applyPoolToDevices() {
  const pool = savedPools.find((p) => p.id === $('applyPoolSelect').value); if (!pool) return;
  const fbId = $('applyFallbackSelect').value, fbPool = fbId ? savedPools.find((p) => p.id === fbId) : null;
  const doRestart = $('applyRestart').checked;
  const ips = $$('.apply-dev-cb:checked').map((cb) => cb.value);
  if (!ips.length) return;
  applyInProgress = true; updateApplyBtn();
  $$('.apply-dev-cb').forEach((cb) => { cb.disabled = true; });
  setSt('applyStatus', 'working', `Applying to ${ips.length} device${ips.length === 1 ? '' : 's'}…`);
  $('applyProgress').hidden = false; $('applyProgressBar').style.width = '0';
  ips.forEach((ip) => setApplyState(ip, 'pending', 'Queued'));
  log('action', `Applying <strong>${esc(pool.name)}</strong>${fbPool ? ` with fallback <strong>${esc(fbPool.name)}</strong>` : ''} to ${ips.length} device(s)`);
  let ok = 0, fail = 0;
  for (let i = 0; i < ips.length; i++) {
    const ip = ips[i], dev = findDev(ip);
    if (!dev) { fail++; continue; }
    setApplyState(ip, 'working', 'Applying');
    try {
      const { patch, user } = await buildPoolPatch(dev, pool, fbPool);
      const r = await apiPatch(ip, patch);
      if (r && r.error) throw new Error(r.error);
      if (doRestart) { await sleep(500); await apiRestart(ip); }
      ok++; setApplyState(ip, 'done', doRestart ? 'Done, restarting' : 'Done');
      log('success', `<strong>${esc(D.name(dev))}</strong> set to ${esc(pool.name)} (worker ${esc(user)})${doRestart ? ', restarting' : ''}`);
    } catch (e) {
      fail++; setApplyState(ip, 'fail', 'Failed');
      log('error', `Pool change failed on <strong>${esc(D.name(dev))}</strong>: ${esc(e.message)}`);
    }
    $('applyProgressBar').style.width = ((i + 1) / ips.length * 100) + '%';
    await sleep(500);
  }
  setSt('applyStatus', fail ? 'error' : 'success', fail ? `${ok} applied, ${fail} failed. See History for details.` : `Applied to ${ok} device${ok === 1 ? '' : 's'}.${doRestart ? ' They are restarting.' : ''}`);
  toast(fail ? `Pool applied to ${ok}, ${fail} failed` : `Pool applied to ${ok} device${ok === 1 ? '' : 's'}`, fail ? 'warn' : 'success');
  setTimeout(() => { $('applyProgress').hidden = true; }, 800);
  applyInProgress = false;
  setTimeout(() => { $$('#applyDeviceList .apply-state').forEach((el) => { el.hidden = true; }); }, 6000);
  applyListSig = ''; pendingApplySelection = ips; renderApplyDevices();
  setTimeout(refreshAllDevices, doRestart ? 9000 : 2500);
}
function useSavedPool(p) {
  $('applyCoinSelect').value = p.coin; updatePoolSelects();
  $('applyPoolSelect').value = p.id; updateFallbackSelects();
  $('applyPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('applyPanel').classList.remove('flash'); void $('applyPanel').offsetWidth; $('applyPanel').classList.add('flash');
}
const POOL_TYPE_HINT = { '': 'Shown as a tag on the saved pool.', solo: 'If your miner finds a block, the whole reward goes to your address.', pool: 'Rewards are shared with the other miners in proportion to your work.' };
function poolTypeTag(type) { return type === 'solo' ? '<span class="cat-tag solo">SOLO</span>' : type === 'pool' ? '<span class="cat-tag pool">POOLED</span>' : ''; }
function getPoolType() { return $('poolTypeSeg').querySelector('[aria-pressed="true"]')?.dataset.ptype || ''; }
function setPoolType(t) {
  t = t === 'solo' || t === 'pool' ? t : '';
  $$('#poolTypeSeg .seg-btn').forEach((b) => { const on = b.dataset.ptype === t; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-checked', String(on)); });
  $('poolTypeHint').textContent = POOL_TYPE_HINT[t];
}
// When the address matches a pool in the directory, suggest its type
function guessPoolType() {
  if (getPoolType()) return;
  const pp = parseStratumUrl($('poolURL').value), port = String(pp.port || $('poolPort').value || '');
  const hit = catalogPools().find((p) => p.host === pp.host.toLowerCase() && (!port || String(p.port) === port));
  if (hit) setPoolType(hit.type);
}
function openPoolModal(pool = null, tpl = null) {
  editingPoolId = pool ? pool.id : null;
  const src = pool || tpl;
  $('poolModalTitle').textContent = pool ? 'Edit pool' : tpl ? `Add ${tpl.name}` : 'New pool';
  $('poolCoin').value = src ? src.coin : (selectedCoinFilter !== 'all' ? selectedCoinFilter : 'btc');
  $('poolName').value = src ? src.name : '';
  $('poolURL').value = pool ? pool.url : tpl ? tpl.host : '';
  $('poolPort').value = src ? src.port : '';
  // Pre-fill the wallet from another saved pool of the same coin
  const sameCoin = tpl && savedPools.find((p) => p.coin === tpl.coin && p.user);
  $('poolUser').value = pool ? pool.user : sameCoin ? sameCoin.user.split('.')[0] : '';
  $('poolUser').placeholder = tpl && tpl.user ? tpl.user : 'bc1q…';
  $('poolPassword').value = pool ? (pool.password || '') : tpl ? 'x' : '';
  $('poolTLS').checked = src ? !!src.tls : false;
  setPoolType(src ? src.type : '');
  $('poolFormError').textContent = '';
  openDialog('poolModal'); setTimeout(() => (tpl ? $('poolUser') : $('poolName')).focus(), 30);
}
function parsePoolUrlField() {
  const parsed = parseStratumUrl($('poolURL').value);
  if (parsed.host !== $('poolURL').value.trim()) $('poolURL').value = parsed.host;
  if (parsed.port) $('poolPort').value = parsed.port;
  return parsed;
}
function savePool() {
  const raw = $('poolURL').value.trim();
  if (/^stratum\+ssl:\/\//i.test(raw)) $('poolTLS').checked = true;
  const parsed = parsePoolUrlField();
  const coin = $('poolCoin').value, name = $('poolName').value.trim(), url = parsed.host, port = parseInt($('poolPort').value);
  const user = $('poolUser').value.trim(), password = $('poolPassword').value.trim() || 'x', tls = $('poolTLS').checked, type = getPoolType();
  const err = !name ? 'Give the pool a name.' : !url ? 'Enter the stratum address.' : !(port > 0 && port < 65536) ? 'Enter a valid port.' : '';
  if (err) { $('poolFormError').textContent = err; return; }
  if (editingPoolId) {
    const i = savedPools.findIndex((p) => p.id === editingPoolId);
    if (i >= 0) savedPools[i] = { ...savedPools[i], coin, name, url, port, user, password, tls, type };
    log('info', `Updated pool <strong>${esc(name)}</strong>`);
  } else {
    savedPools.push({ id: genId(), coin, name, url, port, user, password, tls, type });
    log('success', `Saved pool <strong>${esc(name)}</strong>`);
  }
  savePools(); closeDialog('poolModal'); renderPoolManager(); if ($('catalogModal').open) renderCatalog();
  toast(editingPoolId ? 'Pool updated' : 'Pool saved', 'success');
}
async function deletePool(p) {
  const inRot = autoConfig.poolRotation.poolIds.includes(p.id);
  if (!(await confirmDialog(`${p.name} is removed from your saved pools.${inRot ? ' It is also taken out of pool rotation.' : ''} Miners already using it are not changed.`, { title: 'Delete this pool?', ok: 'Delete', danger: true }))) return;
  savedPools = savedPools.filter((x) => x.id !== p.id);
  autoConfig.poolRotation.poolIds = autoConfig.poolRotation.poolIds.filter((id) => id !== p.id);
  savePools(); saveAutoConfig();
  log('info', `Deleted pool <strong>${esc(p.name)}</strong>`);
  renderPoolManager(); updateAutoStatus();
}


// ─── Pool directory (bundled list, optionally updated from a URL) ───
let catCoin = 'all', builtinCatalog = null;
function validateCatalog(j) {
  const list = Array.isArray(j) ? j : j && j.pools;
  if (!Array.isArray(list)) throw new Error('No pools found in the list');
  const seen = new Set();
  const pools = list.map((p) => ({
    id: String(p.id || '').slice(0, 60), coin: SHA256_COINS.some((c) => c.id === p.coin) ? p.coin : 'other',
    name: String(p.name || '').slice(0, 50), host: parseStratumUrl(String(p.host || p.url || '')).host.slice(0, 120).toLowerCase(),
    port: parseInt(p.port), tls: !!p.tls, type: p.type === 'pool' ? 'pool' : 'solo',
    fee: p.fee != null ? String(p.fee).slice(0, 10) : '', region: String(p.region || '').slice(0, 20),
    user: String(p.user || '').slice(0, 60), site: /^https:\/\//i.test(p.site || '') ? String(p.site).slice(0, 200) : '', note: String(p.note || '').slice(0, 180)
  })).filter((p) => {
    if (!p.name || !/^[a-z0-9.-]+$/.test(p.host) || !(p.port > 0 && p.port < 65536)) return false;
    if (!p.id) p.id = p.host + ':' + p.port;
    if (seen.has(p.id)) return false; seen.add(p.id); return true;
  });
  if (!pools.length) throw new Error('The list has no valid pools');
  return { updated: String((j && j.updated) || '').slice(0, 20), pools };
}
async function loadCatalog() {
  if (!builtinCatalog) {
    try { builtinCatalog = { ...validateCatalog(await (await fetch(chrome.runtime.getURL('pool-catalog.json'))).json()), source: 'builtin' }; }
    catch (e) { console.error('catalog', e); builtinCatalog = { updated: '', pools: [], source: 'builtin' }; }
  }
  return builtinCatalog;
}
function activeCatalog() {
  // A downloaded list wins unless the list shipped with the extension is newer
  if (poolCatalog && poolCatalog.pools?.length && (!builtinCatalog || (poolCatalog.updated || '') >= (builtinCatalog.updated || ''))) return poolCatalog;
  return builtinCatalog || { pools: [] };
}
function catalogPools() { return activeCatalog().pools || []; }
async function updateCatalog(silent) {
  const url = (prefs.catalogUrl || '').trim();
  const btn = $('catUpdateBtn');
  if (!url) { await loadCatalog(); if (!silent) { toast('Using the list built into the extension. Add an update source to fetch newer lists.', 'info', 5000); $('catalogModal').querySelector('.cat-details').open = true; } renderCatalog(); return; }
  btn?.classList.add('is-busy');
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal }); clearTimeout(tm);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const cat = validateCatalog(await r.json());
    poolCatalog = { ...cat, source: url, fetchedAt: Date.now() };
    chrome.storage.local.set({ poolCatalog });
    if (!silent) toast(`Pool list updated: ${cat.pools.length} pools`, 'success');
  } catch (e) {
    if (!silent) toast('Could not update the list: ' + (e.name === 'AbortError' ? 'timed out' : e.message), 'error', 5000);
    else console.warn('catalog update', e);
  } finally { btn?.classList.remove('is-busy'); renderCatalog(); }
}
async function openCatalog() {
  await loadCatalog();
  $('catUrl').value = prefs.catalogUrl || '';
  $('catSearch').value = '';
  renderCatalog(); openDialog('catalogModal');
}
function isSavedPool(p) { return savedPools.some((sp) => parseStratumUrl(sp.url).host.toLowerCase() === p.host && String(parseStratumUrl(sp.url).port || sp.port) === String(p.port)); }
function renderCatalog() {
  if (!$('catalogModal')) return;
  const cat = activeCatalog(), pools = cat.pools || [];
  const coins = [...new Set(pools.map((p) => p.coin))];
  if (catCoin !== 'all' && !coins.includes(catCoin)) catCoin = 'all';
  $('catCoins').innerHTML = ['all', ...coins].map((c) => `<button class="chip" data-cat-coin="${c}" aria-pressed="${catCoin === c}">${c === 'all' ? 'All' : esc(coinSymbol(c))}</button>`).join('');
  const q = $('catSearch').value.trim().toLowerCase();
  const list = pools.filter((p) => (catCoin === 'all' || p.coin === catCoin) && (!q || [p.name, p.host, p.region, coinSymbol(p.coin)].join(' ').toLowerCase().includes(q)));
  $('catList').innerHTML = list.length ? list.map((p) => {
    const saved = isSavedPool(p);
    return `<div class="cat-row">
      <span class="pool-coin">${esc(coinSymbol(p.coin))}</span>
      <div class="pool-info">
        <div class="cat-name">${esc(p.name)}<span class="cat-tag ${p.type}">${p.type === 'solo' ? 'SOLO' : 'POOLED'}</span></div>
        <div class="cat-meta"><code>${esc(p.host)}:${p.port}</code>${p.fee ? `<span>fee ${esc(p.fee)}</span>` : ''}${p.region ? `<span>${esc(p.region)}</span>` : ''}${p.user ? `<span>user: ${esc(p.user)}</span>` : ''}${p.site ? `<a href="${esc(p.site)}" target="_blank" rel="noopener">website</a>` : ''}</div>
        ${p.note ? `<div class="cat-note">${esc(p.note)}</div>` : ''}
      </div>
      ${saved ? `<span class="cat-saved">${ic('check')}Saved</span>` : `<button class="btn sm" data-cat-add="${esc(p.id)}">${ic('plus')}Add</button>`}
    </div>`;
  }).join('') : `<div class="empty">${ic('search')}<h3>No pools match</h3><p>Try another coin or search.</p></div>`;
  const src = cat.source && cat.source !== 'builtin'
    ? `${pools.length} pools from your source, checked ${fmt.ago(cat.fetchedAt)}`
    : `${pools.length} pools, built-in list${cat.updated ? ` from ${cat.updated}` : ''}`;
  $('catSourceInfo').textContent = src + '. Addresses can change: check the pool\'s website if one stops working.';
}

// ════════ LIVE LOG ════════
let liveLogPending = [];
function setLiveLogStatus(state, text) { const el = $('llStatus'); el.textContent = text; el.className = 'll-status ll-' + state; }
function openLiveLogs(ip, name) {
  liveLogBuffer = []; liveLogPending = []; liveLogPaused = false; liveLogActiveIp = ip;
  $('llDevice').textContent = name || ip;
  $('llConsole').innerHTML = ''; $('llFilter').value = '';
  setPauseBtn();
  setLiveLogStatus('connecting', 'Connecting');
  appendLiveLog(`Opening a connection to ${ip} through the device's own page…`, 'sys');
  openDialog('liveLogModal');
  chrome.runtime.sendMessage({ type: 'START_WS_LOGS', ip, session: 'logs' }).then((r) => {
    if (r && r.error && liveLogActiveIp === ip) { setLiveLogStatus('error', 'Could not connect'); appendLiveLog('Error: ' + r.error, 'sys'); }
  }).catch((e) => { setLiveLogStatus('error', 'Could not connect'); appendLiveLog('Error: ' + e.message, 'sys'); });
}
function stopLiveLogs() {
  if (!liveLogActiveIp) return;
  liveLogActiveIp = null;
  chrome.runtime.sendMessage({ type: 'STOP_WS_LOGS', session: 'logs' }).catch(() => {});
}
function classifyLine(t) {
  if (/^\s*E \(|error|fail|reject/i.test(t)) return 'err';
  if (/^\s*W \(|warn|timeout|retry/i.test(t)) return 'warnl';
  if (/accepted|diff\s+[\d.]+\s*(of|\/)/i.test(t)) return 'share';
  return '';
}
function renderLogLine(item) {
  const con = $('llConsole');
  const line = document.createElement('div');
  line.className = 'll-line ' + (item.type === 'sys' ? 'sys' : classifyLine(item.text));
  line.textContent = item.text;
  const q = $('llFilter').value.trim().toLowerCase();
  if (q && !item.text.toLowerCase().includes(q)) line.classList.add('hidden-by-filter');
  const nearBottom = con.scrollHeight - con.scrollTop - con.clientHeight < 60;
  con.appendChild(line);
  while (con.children.length > 1000) con.firstChild.remove();
  if (nearBottom) con.scrollTop = con.scrollHeight;
}
function appendLiveLog(text, type = 'log') {
  // Strip ANSI colour codes the firmware embeds
  const clean = String(text).replace(/\x1b\[[0-9;]*m/g, '').replace(/\[[0-9];[0-9]+m/g, '').replace(/\[0m/g, '').replace(/\s+$/, '');
  if (!clean) return;
  clean.split(/\r?\n/).forEach((t) => {
    const item = { time: Date.now(), text: t, type };
    liveLogBuffer.push(item); if (liveLogBuffer.length > 3000) liveLogBuffer.shift();
    if (liveLogPaused && type !== 'sys') { liveLogPending.push(item); return; }
    renderLogLine(item);
  });
}
function setPauseBtn() {
  const b = $('llPauseBtn');
  b.innerHTML = liveLogPaused ? `${ic('play')}<span>Resume${liveLogPending.length ? ` (${liveLogPending.length})` : ''}</span>` : `${ic('pause')}<span>Pause</span>`;
}
function toggleLiveLogPause() {
  liveLogPaused = !liveLogPaused;
  if (!liveLogPaused) { const p = liveLogPending; liveLogPending = []; p.forEach(renderLogLine); const con = $('llConsole'); con.scrollTop = con.scrollHeight; setLiveLogStatus('connected', 'Streaming'); }
  else setLiveLogStatus('paused', 'Paused');
  setPauseBtn();
}
function applyLiveLogFilter() {
  const q = $('llFilter').value.trim().toLowerCase();
  $$('#llConsole .ll-line').forEach((l) => l.classList.toggle('hidden-by-filter', !!q && !l.textContent.toLowerCase().includes(q)));
}
function saveLiveLog() {
  if (!liveLogBuffer.length) { toast('Nothing to save yet', 'warn'); return; }
  const txt = liveLogBuffer.map((l) => `[${new Date(l.time).toISOString()}] ${l.text}`).join('\n');
  downloadFile(`axeos-log-${($('llDevice').textContent || 'device').replace(/[^a-z0-9_-]+/gi, '-')}-${stamp()}.txt`, txt, 'text/plain');
}
function clearLiveLog() { liveLogBuffer = []; liveLogPending = []; $('llConsole').innerHTML = ''; setPauseBtn(); }

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'WS_LOG_EVENT') return;
  if (msg.session === 'diff') { handleDiffWsEvent(msg); return; }
  if (msg.session === 'collect') { handleCollectEvent(msg); return; }
  if ((msg.session || 'logs') !== 'logs' || msg.ip !== liveLogActiveIp) return;
  if (msg.event === 'open') { setLiveLogStatus(liveLogPaused ? 'paused' : 'connected', liveLogPaused ? 'Paused' : 'Streaming'); appendLiveLog('Connected. Lines appear as the miner writes them.', 'sys'); }
  else if (msg.event === 'data') { if (msg.line) { appendLiveLog(msg.line, 'log'); if (liveLogPaused) setPauseBtn(); } }
  else if (msg.event === 'error') setLiveLogStatus('error', 'Connection error' + (msg.msg ? ': ' + msg.msg : ''));
  else if (msg.event === 'close') {
    const codes = { 1000: 'normal', 1001: 'going away', 1006: 'dropped', 1011: 'server error' };
    setLiveLogStatus('closed', 'Disconnected');
    appendLiveLog(`Disconnected (code ${msg.code}${codes[msg.code] ? ', ' + codes[msg.code] : ''}).`, 'sys');
  }
});

// ════════ SHARE MINIMUM & COLLECTOR ════════
function diffShort(v) { return fmt.diff(v).replace(/\.00(?=[KMGTP]?$)/, '').replace(/(\.\d)0(?=[KMGTP]?$)/, '$1'); }
function parseDiffInput(str) {
  const m = String(str || '').trim().replace(',', '.').match(/^([\d.]+)\s*([kmgtp]?)$/i);
  if (!m) return str && String(str).trim() ? NaN : 0;
  const mult = { '': 1, k: 1e3, m: 1e6, g: 1e9, t: 1e12, p: 1e15 }[m[2].toLowerCase()];
  return parseFloat(m[1]) * mult;
}
// Expected shares per hour at or above a difficulty, for the miners online now
function sharesPerHour(min) {
  return devices.filter((d) => !d._offline).reduce((sum, d) => {
    const level = Math.max(min, D.poolDiff(d) || 1);
    return sum + (D.hr(d) * 1e9 * 3600) / (level * 4294967296);
  }, 0);
}
function updateShareEstimate(min) {
  const el = $('shareMinEst'); if (!el) return;
  if (isNaN(min)) { el.className = 'status-line error'; el.textContent = 'Use a number, optionally followed by K, M, G or T.'; return; }
  if (!min) { el.className = 'status-line'; el.textContent = 'No minimum: the chart shows every new session best.'; return; }
  const rate = sharesPerHour(min);
  const r = rate >= 10 ? Math.round(rate).toLocaleString() : rate >= 1 ? rate.toFixed(1) : rate.toFixed(2);
  const busy = rate > MAX_SHARE_HITS / 24;
  el.className = 'status-line' + (busy ? ' error' : '');
  el.textContent = `Your fleet should find about ${r} share${rate === 1 ? '' : 's'} an hour at or above ${diffShort(min)}.` + (busy ? ` The chart keeps the last ${MAX_SHARE_HITS.toLocaleString()}, so pick a higher minimum to keep a full day.` : '');
}
function renderShareMinUI() {
  const on = prefs.shareMin > 0;
  $('shareMinLabel').textContent = on ? `From ${diffShort(prefs.shareMin)}` : 'All records';
  $('shareMinBtn').dataset.on = String(on);
  $('shareMinBtn').querySelector('.rec')?.remove();
  if (collectorOn) $('shareMinBtn').insertAdjacentHTML('beforeend', '<span class="rec" title="Recording every share"></span>');
  if ($('shareMinPop').matches(':popover-open') && document.activeElement !== $('shareMinInput')) $('shareMinInput').value = on ? diffShort(prefs.shareMin) : '';
  $('shareCollect').checked = !!prefs.shareCollect;
  $$('#shareMinPop [data-smin]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.smin === (prefs.shareMin || 0))));
  updateShareEstimate(parseDiffInput($('shareMinInput').value) || prefs.shareMin || 0);
}
function applyShareMin() {
  const min = parseDiffInput($('shareMinInput').value);
  if (isNaN(min)) { updateShareEstimate(min); return; }
  const collect = $('shareCollect').checked;
  if (collect && !min) { $('shareCollect').checked = false; const el = $('shareMinEst'); el.className = 'status-line error'; el.textContent = 'Set a minimum first. Recording every share without one would flood the chart.'; return; }
  prefs.shareMin = min; prefs.shareCollect = collect; savePrefs();
  renderShareMinUI(); hoverDiffIdx = -1; drawDiffChart(); updateDiffLiveUI();
  syncCollector();
}
async function syncCollector() {
  const want = prefs.shareCollect && prefs.shareMin > 0;
  if (!want) {
    if (collectorOn) { collectorOn = false; collectorConn = {}; collectorIps = []; chrome.runtime.sendMessage({ type: 'STOP_COLLECT' }).catch(() => {}); renderShareMinUI(); updateDiffLiveUI(); log('info', 'Stopped recording shares'); }
    return;
  }
  const ips = devices.filter((d) => !d._offline).map((d) => d._ip);
  if (!ips.length) return;
  if (!collectorOn) log('info', `Recording every share from <strong>${diffShort(prefs.shareMin)}</strong> up`);
  collectorOn = true;
  try {
    const r = await chrome.runtime.sendMessage({ type: 'COLLECT_SHARES', ips, min: prefs.shareMin });
    collectorIps = (r && r.streaming) || [];
    Object.keys(collectorConn).forEach((ip) => { if (!collectorIps.includes(ip)) delete collectorConn[ip]; });
  } catch (e) { console.warn('collector', e); }
  renderShareMinUI(); updateDiffLiveUI();
}
function handleCollectEvent(msg) {
  if (!collectorOn) return;
  if (msg.event === 'open') { collectorConn[msg.ip] = true; updateDiffLiveUI(); return; }
  if (msg.event === 'close') { collectorConn[msg.ip] = false; updateDiffLiveUI(); return; }
  if (msg.event !== 'share' || !(msg.diff >= prefs.shareMin)) return;
  const d = findDev(msg.ip);
  shareHits.push({ time: Date.now(), ip: msg.ip, name: d ? D.name(d) : msg.ip, pool: msg.target || (d ? D.poolDiff(d) : 0), net: d ? D.netDiff(d) : 0, diff: msg.diff, kind: 'share' });
  if (shareHits.length > MAX_SHARE_HITS) shareHits = shareHits.slice(-MAX_SHARE_HITS);
  clearTimeout(shareSaveTimer); shareSaveTimer = setTimeout(() => chrome.storage.local.set({ shareHits }), 4000);
  // Redraw at most twice a second when shares arrive in bursts
  if (chartTab === 'diff' && !diffLiveMode && activeView === 'fleet') {
    const wait = Math.max(0, shareDrawAt + 500 - Date.now());
    if (!shareDrawAt || wait === 0) { shareDrawAt = Date.now(); requestAnimationFrame(drawDiffChart); }
    else if (!handleCollectEvent.pending) { handleCollectEvent.pending = true; setTimeout(() => { handleCollectEvent.pending = false; shareDrawAt = Date.now(); drawDiffChart(); }, wait); }
  }
}

// ════════ LIVE SHARE DIFFICULTY ════════
let diffLiveState = '';
function handleDiffWsEvent(msg) {
  if (!diffLiveMode || msg.ip !== diffLiveIp) return;
  if (msg.event === 'open') { diffLiveState = 'connected'; updateDiffLiveUI(); }
  else if (msg.event === 'data') {
    // BitAxe: "diff 1234.5 of 512"  NerdQAxe: "diff 1234.5/512"
    const m = (msg.line || '').match(/diff\s+([\d.]+)\s*(?:of\s+\d+|\/\d+)/i);
    if (m) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > 0) {
        diffLivePoints.push({ time: Date.now(), val });
        if (diffLivePoints.length > 600) diffLivePoints.shift();
        if (chartTab === 'diff') drawDiffChart();
        updateDiffLiveUI();
      }
    }
  } else if (msg.event === 'error') { diffLiveState = 'error'; updateDiffLiveUI(); }
  else if (msg.event === 'close') { diffLiveState = 'error'; updateDiffLiveUI(); }
}
function startDiffLive(ip) {
  diffLiveMode = true; diffLiveIp = ip; diffLivePoints = []; diffLiveState = 'connecting'; hoverDiffIdx = -1; diffLiveStart = Date.now();
  const dv = findDev(ip);
  if (dv) { const sb = D.bestSession(dv); if (sb > 0) diffLivePoints.push({ time: Date.now() - 1, val: sb, isSeed: true }); }
  updateDiffLiveUI(); drawDiffChart();
  chrome.runtime.sendMessage({ type: 'START_WS_LOGS', ip, session: 'diff' }).then((r) => { if (r && r.error) { diffLiveState = 'error'; updateDiffLiveUI(); toast('Live stream failed: ' + r.error, 'error'); } }).catch(() => { diffLiveState = 'error'; updateDiffLiveUI(); });
}
function stopDiffLive() {
  if (!diffLiveMode) return;
  diffLiveMode = false; diffLiveIp = null; diffLiveState = ''; hoverDiffIdx = -1;
  chrome.runtime.sendMessage({ type: 'STOP_WS_LOGS', session: 'diff' }).catch(() => {});
  updateDiffLiveUI(); drawDiffChart();
}
function toggleDiffLive() {
  if (diffLiveMode) { stopDiffLive(); return; }
  const ip = $('diffChartDevice').value;
  if (ip === 'all') { const n = $('diffLiveNote'); n.classList.remove('nudge'); void n.offsetWidth; n.classList.add('nudge'); $('diffChartDevice').focus(); return; }
  const dv = findDev(ip);
  if (dv && dv._offline) { toast(`${D.name(dv)} is offline. Live shares need a reachable device.`, 'warn'); return; }
  startDiffLive(ip);
}
function updateDiffLiveUI() {
  const btn = $('diffLiveBtn'); if (!btn) return;
  const sel = $('diffChartDevice').value;
  btn.setAttribute('aria-pressed', String(diffLiveMode));
  if (diffLiveState) btn.dataset.state = diffLiveState; else delete btn.dataset.state;
  $('diffLiveLabel').textContent = !diffLiveMode ? 'Stream live shares' : diffLiveState === 'connecting' ? 'Connecting…' : diffLiveState === 'error' ? 'Stream lost, stop' : 'Streaming, stop';
  const note = $('diffLiveNote');
  $('diffRange').hidden = diffLiveMode;
  if (diffLiveMode) { const dv = findDev(diffLiveIp); const n = diffLivePoints.filter((p) => !p.isSeed).length; note.textContent = `${n} share${n === 1 ? '' : 's'} from ${dv ? D.name(dv) : diffLiveIp}, each at its real difficulty`; }
  else if (collectorOn) { const n = Object.values(collectorConn).filter(Boolean).length; note.textContent = `Recording every share from ${diffShort(prefs.shareMin)} up${collectorIps.length ? `, ${n} of ${collectorIps.length} miners connected` : ''}.`; }
  else note.textContent = sel === 'all' ? 'Each dot is a share that beat a session best. Pick one miner to stream every share live.' : 'Each dot is a share that beat the session best. Stream to see every share.';
  $('shareMinBtn').hidden = diffLiveMode;
}

// ════════ FILES: export / import / backup ════════
function stamp() { return new Date().toISOString().slice(0, 10); }
function downloadFile(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { try { resolve(JSON.parse(r.result)); } catch { reject(new Error('The file is not valid JSON')); } };
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsText(file);
  });
}
function exportDevices() {
  if (!devices.length) { toast('There are no devices to export', 'warn'); return; }
  const data = { app: 'AxeOS Fleet Manager', type: 'devices', version: 1, exported: new Date().toISOString(),
    devices: devices.map((d) => ({ ip: d._ip, nickname: deviceNicknames[d._ip] || null, labels: deviceLabels[d._ip] || [], icon: deviceIcons[d._ip] || null })),
    customOrder: customOrder.slice() };
  downloadFile(`axeos-devices-${stamp()}.json`, JSON.stringify(data, null, 2));
  log('success', `Exported ${devices.length} device(s)`); toast(`Exported ${devices.length} device${devices.length === 1 ? '' : 's'}`, 'success');
}
async function importDevicesFromFile(file) {
  try {
    const data = await readJsonFile(file);
    const list = Array.isArray(data) ? data : (data.devices || []);
    if (!Array.isArray(list) || !list.length) throw new Error('No devices found in the file');
    const newIps = []; let skipped = 0;
    list.forEach((d) => {
      if (!d || !d.ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(d.ip)) return;
      if (findDev(d.ip)) { skipped++; return; }
      if (d.nickname) deviceNicknames[d.ip] = String(d.nickname).slice(0, 24);
      if (Array.isArray(d.labels) && d.labels.length) deviceLabels[d.ip] = d.labels.slice(0, 2).map((l) => ({ text: String(l.text || '').slice(0, 10), color: LABEL_COLORS.includes(l.color) ? l.color : LABEL_COLORS[0] })).filter((l) => l.text);
      if (d.icon && DEVICE_ICONS[d.icon]) deviceIcons[d.ip] = d.icon;
      newIps.push(d.ip);
    });
    if (Array.isArray(data.customOrder)) customOrder = data.customOrder.filter((ip) => typeof ip === 'string');
    saveNicknames(); saveLabels(); chrome.storage.local.set({ deviceIcons });
    if (!newIps.length) { toast(`Nothing new to import (${skipped} already in your fleet)`, 'info'); renderAll(); return; }
    toast(`Checking ${newIps.length} device${newIps.length === 1 ? '' : 's'}…`, 'info', 2500);
    const results = await Promise.all(newIps.map((ip) => chrome.runtime.sendMessage({ type: 'FETCH_DEVICE_INFO', ip }).catch(() => null)));
    let reachable = 0;
    newIps.forEach((ip, i) => {
      if (results[i]) { devices.push({ ...results[i], _ip: ip, _offline: false, _everSeen: true }); reachable++; }
      else devices.push({ _ip: ip, _offline: true, _everSeen: false }); // placeholder keeps name and labels
    });
    saveDevices(); updateCustomOrderFromDevices();
    log('success', `Imported ${newIps.length} device(s): ${reachable} reachable${newIps.length - reachable ? `, ${newIps.length - reachable} waiting to come online` : ''}${skipped ? `, ${skipped} already present` : ''}`);
    toast(`Imported ${newIps.length} device${newIps.length === 1 ? '' : 's'}`, 'success');
    renderAll();
  } catch (e) { toast('Import failed: ' + e.message, 'error'); log('error', 'Device import failed: ' + esc(e.message)); }
}
function exportPools() {
  if (!savedPools.length) { toast('There are no saved pools to export', 'warn'); return; }
  downloadFile(`axeos-pools-${stamp()}.json`, JSON.stringify({ app: 'AxeOS Fleet Manager', type: 'pools', version: 1, exported: new Date().toISOString(), pools: savedPools }, null, 2));
  log('success', `Exported ${savedPools.length} pool(s)`); toast(`Exported ${savedPools.length} pool${savedPools.length === 1 ? '' : 's'}`, 'success');
}
async function importPoolsFromFile(file) {
  try {
    const data = await readJsonFile(file);
    const incoming = Array.isArray(data) ? data : (data.pools || []);
    if (!Array.isArray(incoming) || !incoming.length) throw new Error('No pools found in the file');
    let added = 0, skipped = 0;
    incoming.forEach((p) => {
      if (!p || !p.url || !p.name) return;
      if (savedPools.some((sp) => sp.name === p.name && sp.url === p.url && String(sp.port) === String(p.port))) { skipped++; return; }
      savedPools.push({ id: genId(), name: String(p.name).slice(0, 40), coin: SHA256_COINS.some((c) => c.id === p.coin) ? p.coin : 'other', url: String(p.url), port: parseInt(p.port) || '', user: p.user || '', password: p.password || 'x', tls: !!p.tls, type: p.type === 'solo' || p.type === 'pool' ? p.type : '' });
      added++;
    });
    savePools(); renderPoolManager();
    log('success', `Imported ${added} pool(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ''}`);
    toast(`Imported ${added} pool${added === 1 ? '' : 's'}${skipped ? `, ${skipped} already saved` : ''}`, 'success');
  } catch (e) { toast('Import failed: ' + e.message, 'error'); }
}
const BACKUP_KEYS = ['devices', 'savedPools', 'deviceNicknames', 'deviceLabels', 'deviceIcons', 'customOrder', 'sortField', 'sortAsc', 'sortLocked', 'autoConfig', 'poolRotationState', 'prefs', 'theme', 'tempUnit', 'cardViewMode', 'blockHistory', 'uptimeEvents', 'lastSubnet', 'expandedCards'];
async function exportBackup() {
  const data = await chrome.storage.local.get(BACKUP_KEYS);
  if (Array.isArray(data.devices)) data.devices = data.devices.map((d) => ({ _ip: d._ip, hostname: d.hostname, ASICModel: d.ASICModel, deviceModel: d.deviceModel, _offline: true, _everSeen: false }));
  downloadFile(`axeos-backup-${stamp()}.json`, JSON.stringify({ app: 'AxeOS Fleet Manager', type: 'backup', version: 1, appVersion: APP_VERSION, exported: new Date().toISOString(), data }, null, 2));
  toast('Backup saved', 'success'); log('success', 'Exported a full backup');
}
async function importBackup(file) {
  try {
    const f = await readJsonFile(file);
    if (!f || f.type !== 'backup' || !f.data || typeof f.data !== 'object') throw new Error('This is not a Fleet Manager backup file');
    const ok = await confirmDialog(`This replaces your devices, pools, automations and settings with the backup from ${f.exported ? new Date(f.exported).toLocaleString() : 'the file'}. Chart history is kept.`, { title: 'Restore this backup?', ok: 'Restore', danger: true });
    if (!ok) return;
    const clean = {}; BACKUP_KEYS.forEach((k) => { if (k in f.data) clean[k] = f.data[k]; });
    await chrome.storage.local.set({ ...clean, uiVersion: UI_VERSION, tutorialDone: true });
    location.reload();
  } catch (e) { toast('Restore failed: ' + e.message, 'error'); }
}

// ════════ APP SETTINGS ════════
function applyTheme(id, persist = true) {
  if (!THEMES.some((t) => t.id === id)) id = DEFAULT_THEME;
  currentTheme = id; document.documentElement.dataset.theme = id;
  if (persist) chrome.storage.local.set({ theme: id });
  requestAnimationFrame(() => { drawActiveChart(); drawSparklines(); });
  $$('#themePicker .theme-opt').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeId === id)));
}
function applyTextScale(s) {
  prefs.textScale = [1, 1.12, 1.25].includes(+s) ? +s : 1;
  document.documentElement.style.setProperty('--scale', prefs.textScale);
  $$('#textScaleSeg .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.scale === prefs.textScale)));
  requestAnimationFrame(() => { drawActiveChart(); drawSparklines(); });
}
function setTempUnit(u) {
  tempUnit = u === 'F' ? 'F' : 'C';
  chrome.storage.local.set({ tempUnit });
  $$('#tempUnitSeg .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === tempUnit)));
  renderOverview(); renderDevices();
  if (activeView === 'automations') renderAutoPanel(); else updateAutoStatus();
}
function renderPrefs() {
  $('themePicker').innerHTML = THEMES.map((t) => `
    <button class="theme-opt" role="radio" aria-checked="${t.id === currentTheme}" data-theme-id="${t.id}">
      <span class="theme-swatch" style="background:${t.sw[0]}">${t.sw.slice(1).map((c) => `<span style="background:${c}"></span>`).join('')}</span>
      <strong>${t.name}</strong><small>${t.desc}</small>
    </button>`).join('');
  $$('#textScaleSeg .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.scale === prefs.textScale)));
  $$('#tempUnitSeg .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === tempUnit)));
  $('prefPoll').value = String(prefs.pollSec);
  $('prefPrice').value = prefs.kwhPrice > 0 ? prefs.kwhPrice : '';
  $('prefCurrency').value = prefs.currency || 'USD';
  $('prefNotifyOffline').checked = !!prefs.notifyOffline; $('prefNotifyBlock').checked = !!prefs.notifyBlock;
  $('prefNotifyAuto').checked = !!prefs.notifyAuto; $('prefBadge').checked = !!prefs.badge;
}
function openPrefs(focusId) { renderPrefs(); openDialog('prefsModal'); if (focusId) setTimeout(() => $(focusId)?.focus(), 60); }
async function clearCharts() {
  if (!(await confirmDialog('The hashrate graph, the recorded share hits and the card sparklines start over. Devices and settings are not touched.', { title: 'Clear chart history?', ok: 'Clear', danger: true }))) return;
  hashrateHistory = []; diffHistory = []; deviceHrHistory = {}; prevShares = {}; diffLivePoints = []; shareHits = [];
  chrome.storage.local.set({ hashrateHistory, diffHistory, deviceHrHistory, shareHits });
  drawActiveChart(); drawSparklines(); toast('Chart history cleared', 'success');
}

// ════════ GUIDE ════════
const GUIDE_SECTIONS = [
  { id: 'start', title: 'Getting started', html: `
<h4>Add your miners</h4>
<p>Press <strong>Add devices</strong> in the top bar. Type your subnet (the first three parts of a miner's IP, for example <code>192.168.1</code>) and press <strong>Scan</strong>. Every address from .1 to .254 is checked and each BitAxe or NerdQAxe that answers is added. You can also add a single miner by IP.</p>
<h4>How it stays up to date</h4>
<p>The dashboard polls every device on a fixed interval (10 seconds by default, change it in <strong>Settings</strong>). The dot next to the page title turns amber when data goes stale or every device is unreachable.</p>
<h4>Keep this tab open</h4>
<p>Charts, block detection, alerts and automations all run inside the dashboard tab. Pin it and let it sit in the background.</p>` },
  { id: 'fleet', title: 'Fleet view', html: `
<h4>Fleet hashrate</h4>
<p>The big number is the combined hashrate of every online miner, with 1h and 24h averages beneath it. Hover the chart for exact values. Gold markers show blocks found; small red ticks under the timeline show moments when a device was offline.</p>
<h4>Share difficulty</h4>
<p>AxeOS doesn't report every share, but it does report each miner's <strong>session best</strong>. Whenever that number goes up between two refreshes, a share of exactly that difficulty was just found, and it is plotted as a dot at its real value. A gold dot is a new best ever.</p>
<p>The scale is logarithmic: each gridline is ten times the one below, so a 1M share and a 5G share are both clearly visible. Dashed lines mark the pool floor (every accepted share is at least this), the session best, the best ever and the <strong>block</strong> line, the network difficulty a share needs to find a block. Hover a dot to see how far it was from a block. Pick the time range next to the device menu.</p>
<p><strong>Minimum difficulty</strong> (the button next to the time range) hides everything below a level you choose, for example <code>1M</code>, and draws it as a line. Session bests alone get rare once miners have been running for a while, because each new one has to beat the last. To see more, tick <strong>Record every share above the minimum</strong>: the dashboard then reads each miner's log as it happens and plots every share at or above your minimum. The miners' pages open in a minimized browser window for this, the same way the live log works, and recording runs while the dashboard is open. The popover estimates how many shares an hour your fleet will find at that level; the chart keeps the last 5,000.</p>
<p>To see <em>every</em> share of one miner right now, pick it and press <strong>Stream live shares</strong>.</p>
<h4>Stat tiles</h4>
<ul><li><strong>Online</strong>: devices answering, and their average uptime.</li><li><strong>Power</strong>: total draw and fleet efficiency in J/TH.</li><li><strong>Energy cost</strong>: daily cost at your electricity price. Click it to set the price.</li><li><strong>Average temp</strong>: and which device runs hottest.</li><li><strong>Shares</strong>: accepted, rejected and the reject rate.</li><li><strong>Best difficulty</strong>: all-time best across the fleet and the best of the current sessions.</li></ul>
<h4>Health strip</h4>
<p>A ring with the online count, one segment per device, and recent outages scrolling past. <strong>Downtime</strong> opens the full outage history.</p>` },
  { id: 'cards', title: 'Device cards', html: `
<h4>Density</h4>
<p><strong>Compact</strong> shows one row per device, good for big fleets. <strong>Standard</strong> is a card with hashrate, best difficulty, temperature and fan. <strong>Detailed</strong> adds a one-hour hashrate sparkline, power and efficiency.</p>
<h4>Actions on each card</h4>
<p>Live log, device settings, restart, and the <strong>⋯</strong> menu for rename, labels, icon, opening the device's own web page, identify (BitAxe) and remove. Double-click a name to rename it in place. Names can use letters, numbers, spaces, hyphens and underscores, because the name becomes the pool worker suffix.</p>
<h4>Find, filter, sort</h4>
<p>Search by name, IP, model, pool or label (press <kbd>/</kbd>). Filter chips narrow the list by type, offline state or label. Sort by hashrate, difficulty, temperature, efficiency, uptime, name or IP. In <strong>Custom order</strong> drag cards to arrange them and use the lock to freeze the order.</p>
<h4>Select several</h4>
<p>The select button turns on checkboxes. The bar at the bottom can apply a pool, restart or remove every selected device at once.</p>` },
  { id: 'live', title: 'Live monitoring', html: `
<h4>Live log</h4>
<p>The terminal button on a card streams the miner's own log in real time. Filter lines, pause (lines keep collecting and appear when you resume), save everything to a text file, or clear the view. Errors, warnings and shares are coloured.</p>
<h4>Live share difficulty</h4>
<p>On the <strong>Share difficulty</strong> chart pick one device and press <strong>Stream live shares</strong>. Every share lands as a point the moment the miner submits it. The dashed line is the device's session best.</p>
<h4>Why a background tab opens</h4>
<p>A browser extension can't open an insecure <code>ws://</code> connection to your LAN, and AxeOS protects writes with a session cookie. The extension briefly opens the device's own page in a background tab and runs the request from there, exactly as the device's web UI would. The tab closes itself.</p>` },
  { id: 'pools', title: 'Pools', html: `
<h4>Pool directory</h4>
<p>Press <strong>Pool directory</strong> for a list of well-known pools for BitAxe and NerdQAxe: BTC solo pools, pooled options like OCEAN and Braiins, and SHA-256 altcoin pools. <strong>Add</strong> opens the pool editor with the address filled in; you only add your wallet. If you already saved a pool for that coin, its wallet is filled in too.</p>
<p>The list ships with the extension. To keep it current, host a JSON file in the same format (for example in a GitHub repository) and paste its raw link under <strong>Update source</strong>. It is checked once a day and whenever you press <strong>Update list</strong>. A newer built-in list wins over an older downloaded one.</p>
<h4>Save your own pools</h4>
<p>Press <strong>New pool</strong>, pick the coin and paste the stratum address from the pool's site. <code>stratum+tcp://</code> is removed and the port is picked up automatically. Your wallet gets the device name appended as the worker, for example <code>bc1q….kitchen-axe</code>.</p>
<h4>Apply to devices</h4>
<p>Choose coin, primary pool, an optional fallback (it can mine a different coin) and the devices, then press <strong>Apply</strong>. Each device shows its own progress. Offline devices can't be picked. <strong>Use</strong> on a saved pool fills the form for you, and the number next to a pool shows how many miners are on it right now.</p>
<h4>Import and export</h4>
<p>Move saved pools between browsers as a JSON file. Duplicates are skipped.</p>` },
  { id: 'settings', title: 'Device settings', html: `
<h4>Overview</h4><p>Everything the miner reports: temperatures, voltages, shares, firmware, Wi-Fi signal and more.</p>
<h4>Fan</h4><p><strong>BitAxe</strong>: automatic or a fixed speed. <strong>NerdQAxe</strong>: fixed speed only, because the firmware dropped automatic control.</p>
<h4>Frequency and voltage</h4><p>Change one step at a time and watch the temperature. The miner restarts to apply.</p>
<h4>Pool</h4><p>Edit the primary and fallback pool directly on this one device.</p>` },
  { id: 'auto', title: 'Automations', html: `
<p>Automations run while the dashboard is open. Switch one on from its card; click the card to choose the miners and the settings. Changes save as you make them, and every action appears under <strong>Recent automation actions</strong> and in History.</p>
<h4>Keep hashing</h4>
<ul>
<li><strong>Watchdog</strong>: restarts a miner that sits at 0 GH/s longer than the time you set.</li>
<li><strong>Hashrate drop</strong>: when a miner runs more than a set percentage below its normal hashrate for a while, restart it or just alert you. Normal is the firmware's expected hashrate, or its one-hour average.</li>
<li><strong>Shares stalled</strong>: restarts a miner that reports hashrate but whose accepted and rejected counters stop moving. It never waits less than 10 times the expected time between shares at the current pool difficulty.</li>
<li><strong>Back to primary pool</strong>: restarts a miner that has been on its fallback pool for too long, so it reconnects to the primary. Needs AxeOS 2.x.</li>
<li><strong>Flap recovery</strong>: a board that drops offline and comes back N times within the window is restarted once it has been stable for 15 seconds, then left alone for the wait time.</li>
<li><strong>Reject rate</strong>: alerts or restarts when the share of rejected work over a rolling window goes above your limit.</li>
</ul>
<h4>Protect the hardware</h4>
<ul>
<li><strong>Overheat protection</strong>: restarts a miner whose chip passes your limit, then waits before it may do so again. The firmware already stops hashing at about 70 °C, so the limit must be lower than that to ever act.</li>
<li><strong>Heat slowdown</strong>: the firmware stops hashing when the chip passes about 70 °C or the voltage regulator gets too hot, then restarts once it cools, which can loop. When the chip or the VR reaches your limit, or the miner drops to 0 GH/s right after running close to one, the frequency is lowered one step, then the voltage once frequency reaches its floor. Keep the chip limit a few degrees under 70 °C. The original values are remembered and can be restored from the dialog, or come back step by step after the miner stays cool.</li>
<li><strong>Quiet hours</strong>: sets a fixed, lower fan speed during a time window (for example at night) and restores each miner's own fan setting afterwards. If a chip passes the safety limit the fan goes back to normal at once.</li>
</ul>
<h4>Schedules</h4>
<ul>
<li><strong>Daily restart</strong>: restarts the chosen miners once a day at a set time, one after another.</li>
<li><strong>Pool rotation</strong>: moves miners through two or more saved pools on a schedule.</li>
</ul>
<p><strong>Alert me only</strong> actions show a desktop notification when the dashboard is in the background, or a message when it is in front.</p>` },
  { id: 'history', title: 'History and alerts', html: `
<h4>Activity</h4><p>Scans, restarts, pool changes and automation actions. Filter by actions, warnings or errors.</p>
<h4>Downtime</h4><p>Every outage with when it started, when the device came back and how long it lasted.</p>
<h4>Blocks found</h4><p>Each block with the difficulty the miner actually reached, the coin and the pool. The trophy in the top bar counts blocks you haven't seen yet.</p>
<h4>Desktop alerts and toolbar badge</h4><p>In <strong>Settings</strong> choose which events show a system notification when the dashboard is in the background. The toolbar icon can show how many devices are online, or in red how many are offline.</p>` },
  { id: 'prefs', title: 'Settings and backup', html: `
<p>Open <strong>Settings</strong> at the bottom of the side bar.</p>
<ul><li><strong>Theme</strong>: Circuit, Daylight, Neon Vault or Aurora.</li><li><strong>Text size</strong> and <strong>°C / °F</strong>.</li><li><strong>Refresh interval</strong> from 5 seconds to 1 minute.</li><li><strong>Electricity price</strong> for the energy cost tile.</li><li><strong>Full backup</strong>: devices, names, labels, pools, automations and settings in one file. Restore it after a reinstall.</li></ul>` },
  { id: 'keys', title: 'Keyboard shortcuts', html: `
<ul><li><kbd>/</kbd> find a device</li><li><kbd>R</kbd> refresh now</li><li><kbd>1</kbd> to <kbd>4</kbd> switch between Fleet, Pools, Automations and History</li><li><kbd>?</kbd> open this guide</li><li><kbd>Esc</kbd> close a dialog or menu</li></ul>` },
];
function openGuide(sectionId = 'start') {
  $('guideNav').innerHTML = GUIDE_SECTIONS.map((s) => `<button data-guide="${s.id}">${s.title}</button>`).join('');
  showGuideSection(sectionId);
  openDialog('guideModal');
}
function showGuideSection(id) {
  const s = GUIDE_SECTIONS.find((x) => x.id === id) || GUIDE_SECTIONS[0];
  $$('#guideNav button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.guide === s.id)));
  $('guideContent').innerHTML = `<h3>${s.title}</h3>${s.html}`;
  $('guideContent').scrollTop = 0;
}

// ════════ FIRST-RUN TOUR ════════
const TOUR = [
  { icon: 'logo', title: 'Welcome to AxeOS Fleet Manager', desc: 'Every BitAxe and NerdQAxe on your network in one place: live hashrate, pools, automations and alerts. This takes about a minute.' },
  { icon: 'radar', title: 'Find your miners', desc: 'Enter your subnet, the first three parts of a miner\'s IP address. If a miner is at 192.168.1.42, type 192.168.1.', interactive: 'scan' },
  { icon: 'fleet', title: 'Make the fleet yours', desc: 'Double-click a name to rename it. The ⋯ menu on each card adds labels and icons. Switch between Compact, Standard and Detailed cards, and press / to search.' },
  { icon: 'pools', title: 'Pools and automations', desc: 'Save pools once and push them to many miners, with the device name added as the worker. Automations can restart stuck, overheating or flapping devices and rotate pools on a schedule.' },
  { icon: 'check', title: 'You\'re set', desc: 'Keep this tab open, pinned if you like. Charts, alerts and automations run from here. The Guide in the side bar explains everything else.' },
];
let tourStep = 0;
function showTutorial() { tourStep = 0; renderTourStep(); openDialog('tutorialOverlay'); }
function renderTourStep() {
  const s = TOUR[tourStep];
  $('tutIllust').innerHTML = ic(s.icon);
  $('tutTitle').textContent = s.title;
  $('tutDesc').textContent = s.desc;
  $('tutDots').innerHTML = TOUR.map((_, i) => `<span class="tour-dot${i === tourStep ? ' on' : ''}"></span>`).join('');
  $('tutNext').textContent = tourStep === TOUR.length - 1 ? 'Start mining' : 'Next';
  $('tutSkip').hidden = tourStep === TOUR.length - 1;
  const box = $('tutInteractive');
  if (s.interactive === 'scan') {
    box.innerHTML = `<div class="tut-box">
      <div class="input-row"><input type="text" id="tutSubnet" placeholder="192.168.1" value="${esc($('subnetInput').value)}" inputmode="decimal" spellcheck="false" aria-label="Subnet"><button class="btn btn-primary" id="tutScanBtn">${ic('radar')}<span>Scan</span></button></div>
      <div class="status-line" id="tutScanStatus" role="status"></div>
      <div class="tut-list" id="tutList"></div></div>`;
    const go = async () => {
      $('subnetInput').value = $('tutSubnet').value;
      const b = $('tutScanBtn'); b.classList.add('is-busy'); b.disabled = true;
      $('tutScanStatus').className = 'status-line working'; $('tutScanStatus').textContent = 'Scanning 254 addresses, this takes a few seconds…';
      await scanNetwork();
      if (!$('tutScanBtn')) return;
      b.classList.remove('is-busy'); b.disabled = false;
      $('tutScanStatus').className = $('scanStatus').className; $('tutScanStatus').textContent = $('scanStatus').textContent;
      renderTourDevices();
    };
    $('tutScanBtn').addEventListener('click', go);
    $('tutSubnet').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    renderTourDevices();
    setTimeout(() => $('tutSubnet')?.focus(), 50);
  } else box.innerHTML = '';
  box.hidden = !s.interactive;
}
function renderTourDevices() {
  const l = $('tutList'); if (!l) return;
  l.innerHTML = devices.map((d) => `<div class="tut-dev"><span class="chip-dot ${D.type(d) === 'nerdqaxe' ? 't-nerd' : 't-bitaxe'}"></span><strong>${esc(D.name(d))}</strong><code>${esc(d._ip)}</code></div>`).join('');
}
function nextTour() { if (tourStep < TOUR.length - 1) { tourStep++; renderTourStep(); } else closeDialog('tutorialOverlay'); }

// ════════ RENDER ALL ════════
function updateSortUI() {
  $('sortSelect').value = sortField;
  const custom = sortField === 'custom';
  $('sortLockBtn').hidden = !custom;
  $('sortLockBtn').setAttribute('aria-pressed', String(sortLocked));
  $('sortLockBtn').innerHTML = ic(sortLocked ? 'lock' : 'unlock');
  $('sortLockBtn').title = sortLocked ? 'Order locked. Click to allow dragging.' : 'Drag cards to reorder. Click to lock the order.';
  $('sortDirBtn').hidden = custom;
  $('sortDirBtn').innerHTML = ic(sortAsc ? 'sort-asc' : 'sort-desc');
  $('sortDirBtn').title = sortAsc ? 'Ascending' : 'Descending';
}
function updateViewModeUI() { $$('#viewModeControl .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === cardViewMode))); }
function renderAll() {
  renderOverview();
  renderUptimeMonitor();
  renderLabelFilters(); syncFilterChips();
  updateSortUI(); updateViewModeUI();
  renderDevices();
  populateDiffDeviceSelect();
  updateSyncState(); updateBulkBar(); updateBlockBadge(); updateActionBadge(); updateAutoStatus();
  if (activeView === 'pools') renderPoolManager();
  if (activeView === 'automations') refreshAutoLists();
  if (activeView === 'history' && historyTab === 'downtime') renderUptimeHistory();
}

// ════════ EVENTS ════════
function initEvents() {
  // Navigation
  $$('.nav-item[data-nav]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.nav)));
  $('guideBtn').addEventListener('click', () => openGuide());
  $('prefsBtn').addEventListener('click', () => openPrefs());
  $('donateBtn').addEventListener('click', () => openDialog('donateModal'));
  $('blockHistoryBtn').addEventListener('click', () => showView('history', { tab: 'blocks' }));
  $('refreshBtn').addEventListener('click', async () => {
    if (!devices.length) { toast('Add devices first', 'info'); return; }
    const b = $('refreshBtn'); b.classList.add('spinning');
    await refreshAllDevices(); b.classList.remove('spinning');
  });

  // Search
  const search = $('deviceSearch');
  search.addEventListener('input', () => {
    searchQuery = search.value;
    if (activeView !== 'fleet') showView('fleet', { keepScroll: true });
    renderDevices();
  });
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.preventDefault(); search.value = ''; searchQuery = ''; renderDevices(); } });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(document.activeElement) || document.querySelector('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); search.select(); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); $('refreshBtn').click(); }
    else if (e.key === '?') { e.preventDefault(); openGuide(); }
    else if (['1', '2', '3', '4'].includes(e.key)) showView(['fleet', 'pools', 'automations', 'history'][+e.key - 1]);
  });

  // Scan popover
  wirePopover('scanPopover', 'scanPopoverBtn');
  wirePopover('shareMinPop', 'shareMinBtn');
  $('shareMinPop').addEventListener('toggle', (e) => { if (e.newState === 'open') { renderShareMinUI(); setTimeout(() => $('shareMinInput').focus(), 30); } });
  $('shareMinApply').addEventListener('click', () => applyShareMin());
  $('shareMinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyShareMin(); });
  $('shareMinInput').addEventListener('input', () => updateShareEstimate(parseDiffInput($('shareMinInput').value)));
  $('shareMinPop').addEventListener('click', (e) => { const b = e.target.closest('[data-smin]'); if (!b) return; $('shareMinInput').value = +b.dataset.smin ? diffShort(+b.dataset.smin) : ''; applyShareMin(); });
  $('shareCollect').addEventListener('change', () => applyShareMin());
  $('scanPopover').addEventListener('toggle', (e) => { if (e.newState === 'open') setTimeout(() => ($('subnetInput').value ? $('scanBtn') : $('subnetInput')).focus(), 30); });
  $('scanBtn').addEventListener('click', scanNetwork);
  $('addIpBtn').addEventListener('click', () => addManualDevice());
  $('subnetInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') scanNetwork(); });
  $('manualIpInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addManualDevice(); });

  // Charts
  $$('.pulse .seg-btn[data-chart]').forEach((b) => b.addEventListener('click', () => setChartTab(b.dataset.chart)));
  $('diffChartDevice').addEventListener('change', () => { if (diffLiveMode) stopDiffLive(); hoverDiffIdx = -1; $('diffChartTooltip').hidden = true; updateDiffLiveUI(); drawDiffChart(); });
  $('diffLiveBtn').addEventListener('click', toggleDiffLive);
  $('diffRange').addEventListener('change', () => { hoverDiffIdx = -1; chrome.storage.local.set({ diffRangeH: diffRangeHours() }); drawDiffChart(); });
  let rafDraw = 0;
  const ro = new ResizeObserver(() => { cancelAnimationFrame(rafDraw); rafDraw = requestAnimationFrame(() => { drawActiveChart(); drawSparklines(); }); });
  $$('.chart-wrap').forEach((w) => ro.observe(w));
  ro.observe($('deviceGrid'));

  // Device toolbar
  $('typeFilters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    typeFilter = b.dataset.filter; labelFilter = null;
    syncFilterChips(); renderLabelFilters(); renderDevices();
  });
  $('labelFilters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    labelFilter = labelFilter === b.dataset.label ? null : b.dataset.label;
    if (labelFilter) typeFilter = 'all';
    syncFilterChips(); renderLabelFilters(); renderDevices();
  });
  $('sortSelect').addEventListener('change', () => {
    sortField = $('sortSelect').value;
    if (sortField === 'custom') updateCustomOrderFromDevices();
    else if (['name', 'ip'].includes(sortField)) sortAsc = true;
    else if (sortField === 'efficiency') sortAsc = true;
    else sortAsc = false;
    saveSortPrefs(); updateSortUI(); renderDevices();
  });
  $('sortDirBtn').addEventListener('click', () => { sortAsc = !sortAsc; saveSortPrefs(); updateSortUI(); renderDevices(); });
  $('sortLockBtn').addEventListener('click', () => { sortLocked = !sortLocked; saveSortPrefs(); updateSortUI(); renderDevices(); toast(sortLocked ? 'Order locked' : 'Drag cards to reorder', 'info', 2000); });
  $('viewModeControl').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    cardViewMode = b.dataset.view; chrome.storage.local.set({ cardViewMode });
    updateViewModeUI(); renderDevices();
  });
  $('selectModeBtn').addEventListener('click', () => setSelectMode(!selectMode));
  wirePopover('deviceIoMenu', 'deviceIoBtn');
  $('exportDevicesBtn').addEventListener('click', () => { $('deviceIoMenu').hidePopover(); exportDevices(); });
  $('importDevicesBtn').addEventListener('click', () => { $('deviceIoMenu').hidePopover(); $('importDevicesFile').click(); });
  $('importDevicesFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importDevicesFromFile(f); e.target.value = ''; });

  // Grid
  const grid = $('deviceGrid');
  grid.addEventListener('click', onGridClick);
  grid.addEventListener('change', (e) => { const cb = e.target.closest('.dc-check'); if (!cb) return; toggleSelected(cb.closest('.dcard').dataset.ip, cb.checked); });
  grid.addEventListener('dblclick', (e) => { const n = e.target.closest('.dc-name'); if (!n || selectMode) return; const dev = findDev(n.closest('.dcard').dataset.ip); if (dev) startRename(dev); });
  $('cardMenu').addEventListener('toggle', (e) => { if (e.newState === 'closed') cardMenuClosedAt = Date.now(); });

  // Bulk bar
  $('bulkAllBtn').addEventListener('click', () => {
    const list = filteredDevices(); const all = list.every((d) => selectedIps.has(d._ip));
    list.forEach((d) => toggleSelected(d._ip, !all));
    $('bulkAllBtn').textContent = all ? 'Select all' : 'Select none';
  });
  $('bulkPoolBtn').addEventListener('click', () => {
    pendingApplySelection = [...selectedIps];
    setSelectMode(false); showView('pools');
    toast('Devices picked. Choose a pool and apply.', 'info');
  });
  $('bulkRestartBtn').addEventListener('click', bulkRestart);
  $('bulkRemoveBtn').addEventListener('click', async () => { if (await removeDevices([...selectedIps])) setSelectMode(false); });
  $('bulkCloseBtn').addEventListener('click', () => setSelectMode(false));
  $('ovCostStat').addEventListener('click', () => openPrefs('prefPrice'));

  // Pools
  $('addPoolBtn').addEventListener('click', () => openPoolModal());
  $('exportPoolsBtn').addEventListener('click', exportPools);
  $('importPoolsBtn').addEventListener('click', () => $('importPoolsFile').click());
  $('importPoolsFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importPoolsFromFile(f); e.target.value = ''; });
  $('coinTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-coin]'); if (!b) return; selectedCoinFilter = b.dataset.coin; renderCoinTabs(); renderSavedPools(); });
  $('savedPoolsList').addEventListener('click', (e) => {
    if (e.target.closest('[data-pool-new]')) { openPoolModal(); return; }
    if (e.target.closest('[data-pool-dir]')) { openCatalog(); return; }
    const b = e.target.closest('[data-pool-act]'); if (!b) return;
    const p = savedPools.find((x) => x.id === b.closest('.pool-row').dataset.pool); if (!p) return;
    if (b.dataset.poolAct === 'use') useSavedPool(p);
    else if (b.dataset.poolAct === 'edit') openPoolModal(p);
    else deletePool(p);
  });
  $('applyCoinSelect').addEventListener('change', updatePoolSelects);
  $('applyPoolSelect').addEventListener('change', updateFallbackSelects);
  $('applyFbCoinSelect').addEventListener('change', updateFallbackSelects);
  $('applyFallbackSelect').addEventListener('change', updateApplyBtn);
  $('applyDeviceList').addEventListener('change', updateApplyBtn);
  $('applySelectAll').addEventListener('click', () => {
    const cbs = $$('.apply-dev-cb:not(:disabled)'); const all = cbs.length && cbs.every((c) => c.checked);
    cbs.forEach((c) => { c.checked = !all; }); updateApplyBtn();
    $('applySelectAll').textContent = all ? 'Select all online' : 'Select none';
  });
  $('applyPoolBtn').addEventListener('click', applyPoolToDevices);
  $('poolModalSave').addEventListener('click', savePool);
  $('poolURL').addEventListener('blur', () => { if (/^stratum\+ssl:\/\//i.test($('poolURL').value.trim())) $('poolTLS').checked = true; parsePoolUrlField(); guessPoolType(); });
  $('poolTypeSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-ptype]'); if (b) setPoolType(b.dataset.ptype); });
  $('poolModal').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); savePool(); } });

  // Automations
  $('autoPanel').addEventListener('change', (e) => { const t = e.target.closest('[data-auto-toggle]'); if (t) toggleAutomation(t.dataset.autoToggle, t.checked); });
  $('autoPanel').addEventListener('click', (e) => {
    if (e.target.closest('.switch')) return;
    const card = e.target.closest('.ac[data-auto]'); if (card) openAutoModal(card.dataset.auto);
  });
  $('autoPanel').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.ac[data-auto]')) { e.preventDefault(); openAutoModal(e.target.dataset.auto); }
  });
  $('amEnabled').addEventListener('change', () => toggleAutomation(amId, $('amEnabled').checked));
  $('amBody').addEventListener('change', onAutoModalChange);
  $('amBody').addEventListener('click', (e) => {
    if (e.target.id === 'amVrRestore') { vrRestoreAll(); return; }
    if (e.target.id !== 'amAll') return;
    const c = autoConfig[amId]; const all = devices.length && devices.every((d) => c.devices.includes(d._ip));
    c.devices = all ? [] : devices.map((d) => d._ip); saveAutoConfig(); renderAutoPickers(); updateAutoStatus();
  });
  $('autoModal').addEventListener('close', () => { amId = null; });
  $('autoRecentAll').addEventListener('click', () => { logLevelFilter = 'all'; $$('#logLevelFilters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.level === 'all'))); showView('history', { tab: 'activity' }); });

  // Pool directory
  $('catalogBtn').addEventListener('click', openCatalog);
  $('catSearch').addEventListener('input', renderCatalog);
  $('catCoins').addEventListener('click', (e) => { const b = e.target.closest('[data-cat-coin]'); if (!b) return; catCoin = b.dataset.catCoin; renderCatalog(); });
  $('catList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat-add]'); if (!b) return;
    const p = catalogPools().find((x) => x.id === b.dataset.catAdd); if (p) openPoolModal(null, p);
  });
  $('catUpdateBtn').addEventListener('click', () => updateCatalog(false));
  $('catUrlSave').addEventListener('click', () => {
    const v = $('catUrl').value.trim();
    if (v && !/^https:\/\//i.test(v)) { toast('Use an https:// address', 'error'); return; }
    prefs.catalogUrl = v; savePrefs(); toast(v ? 'Source saved' : 'Source cleared. Using the built-in list.', 'success');
    if (v) updateCatalog(false); else { poolCatalog = null; chrome.storage.local.remove('poolCatalog'); loadCatalog().then(renderCatalog); }
  });

  // History
  $('historyTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-htab]'); if (b) showHistoryTab(b.dataset.htab); });
  $('logLevelFilters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]'); if (!b) return;
    logLevelFilter = b.dataset.level;
    $$('#logLevelFilters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    renderLogs();
  });
  $('clearLogsBtn').addEventListener('click', async () => {
    if (!activityLogs.length) return;
    if (!(await confirmDialog('All activity entries are deleted. Downtime and block history are kept.', { title: 'Clear the activity log?', ok: 'Clear', danger: true }))) return;
    activityLogs = []; saveLogs(); renderLogs();
  });

  // Device settings dialog
  $$('#settingsModalBody .mtab').forEach((t) => t.addEventListener('click', () => setSettingsTab(t.dataset.mtab)));
  $('sAutoFan').addEventListener('change', () => { $('sManualFanRow').hidden = $('sAutoFan').checked; });
  $('sFanSlider').addEventListener('input', () => { $('sFanVal').textContent = $('sFanSlider').value + '%'; });
  $('sFanSave').addEventListener('click', applyFanSettings);
  $('sMiningSave').addEventListener('click', applyMiningSettings);
  $('sPoolSave').addEventListener('click', applyPoolSettings);
  $('sIdentifyBtn').addEventListener('click', async () => {
    const dev = findDev(settingsDeviceIp); if (!dev) return;
    const r = await apiIdentify(dev._ip);
    toast(r.ok ? `${D.name(dev)} is flashing its screen` : `Identify isn't supported on ${D.name(dev)}`, r.ok ? 'success' : 'warn');
  });
  $('sOpenBtn').addEventListener('click', () => { if (settingsDeviceIp) window.open(`http://${settingsDeviceIp}`, '_blank'); });
  $('sRemoveBtn').addEventListener('click', async () => { const ip = settingsDeviceIp; closeDialog('settingsModal'); if (ip) await removeDevices([ip]); });
  $('sRestartBtn').addEventListener('click', () => { const dev = findDev(settingsDeviceIp); if (dev) confirmRestart(dev); });
  $('settingsModal').addEventListener('close', () => { settingsDeviceIp = null; });

  // Live log dialog
  $('llClose').addEventListener('click', () => closeDialog('liveLogModal'));
  $('liveLogModal').addEventListener('close', stopLiveLogs);
  $('llPauseBtn').addEventListener('click', toggleLiveLogPause);
  $('llSaveBtn').addEventListener('click', saveLiveLog);
  $('llClearBtn').addEventListener('click', clearLiveLog);
  $('llFilter').addEventListener('input', applyLiveLogFilter);

  // App settings
  $('themePicker').addEventListener('click', (e) => { const b = e.target.closest('[data-theme-id]'); if (b) applyTheme(b.dataset.themeId); });
  $('textScaleSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-scale]'); if (!b) return; applyTextScale(b.dataset.scale); savePrefs(); });
  $('tempUnitSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-unit]'); if (b) setTempUnit(b.dataset.unit); });
  $('prefPoll').addEventListener('change', () => { prefs.pollSec = clampInt($('prefPoll').value, 5, 60, 10); savePrefs(); startPolling(); updateSyncState(); toast(`Refreshing every ${prefs.pollSec} seconds`, 'success', 2000); });
  $('prefPrice').addEventListener('input', () => { const v = parseFloat($('prefPrice').value); prefs.kwhPrice = v > 0 ? v : null; savePrefs(); renderOverview(); });
  $('prefCurrency').addEventListener('change', () => { prefs.currency = $('prefCurrency').value; savePrefs(); renderOverview(); });
  [['prefNotifyOffline', 'notifyOffline'], ['prefNotifyBlock', 'notifyBlock'], ['prefNotifyAuto', 'notifyAuto'], ['prefBadge', 'badge']].forEach(([id, key]) => {
    $(id).addEventListener('change', () => { prefs[key] = $(id).checked; savePrefs(); if (key === 'badge') updateActionBadge(); });
  });
  $('backupExportBtn').addEventListener('click', exportBackup);
  $('backupImportBtn').addEventListener('click', () => $('backupImportFile').click());
  $('backupImportFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importBackup(f); e.target.value = ''; });
  $('clearChartsBtn').addEventListener('click', clearCharts);
  $('rerunTutorialBtn').addEventListener('click', () => { closeDialog('prefsModal'); showTutorial(); });

  // Support
  $$('.donate-copy').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.addr); toast('Address copied. Thank you!', 'success'); b.innerHTML = ic('check'); setTimeout(() => { b.innerHTML = ic('copy'); }, 1600); }
    catch { toast('Could not copy', 'error'); }
  }));

  // Block celebration
  $('bcClose').addEventListener('click', () => closeDialog('blockCelebrationModal'));
  $('bcViewHistory').addEventListener('click', () => { closeDialog('blockCelebrationModal'); showView('history', { tab: 'blocks' }); });

  // Guide
  $('guideNav').addEventListener('click', (e) => { const b = e.target.closest('[data-guide]'); if (b) showGuideSection(b.dataset.guide); });

  // Confirm
  $('confirmOk').addEventListener('click', () => settleConfirm(true));
  $('confirmCancel').addEventListener('click', () => settleConfirm(false));
  $('confirmModal').addEventListener('close', () => { if (confirmResolver) settleConfirm(false); });

  // Tour
  $('tutNext').addEventListener('click', nextTour);
  $('tutSkip').addEventListener('click', () => closeDialog('tutorialOverlay'));
  $('tutorialOverlay').addEventListener('close', () => { chrome.storage.local.set({ tutorialDone: true }); if (devices.length) renderAll(); });

  // Page lifecycle
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (activeView === 'history' && historyTab === 'activity') { logUnread = 0; updateHistoryBadge(); }
    if (devices.length && Date.now() - lastRefresh > prefs.pollSec * 1000) refreshAllDevices();
  });
  window.addEventListener('pagehide', () => {
    chrome.runtime.sendMessage({ type: 'STOP_WS_LOGS', session: 'logs' }).catch(() => {});
    chrome.runtime.sendMessage({ type: 'STOP_WS_LOGS', session: 'diff' }).catch(() => {});
    if (collectorOn) chrome.runtime.sendMessage({ type: 'STOP_COLLECT' }).catch(() => {});
  });
}

// ════════ INIT ════════
async function init() {
  wireDialogs();
  let stored = {};
  try { stored = await loadState(); } catch (e) { console.error('loadState', e); }
  applyTheme(currentTheme, false);
  applyTextScale(prefs.textScale);
  $('appVersion').textContent = 'v' + APP_VERSION;
  $('poolCoin').innerHTML = SHA256_COINS.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  try { initEvents(); } catch (e) { console.error('initEvents', e); }
  initChartHover(); initDiffChartHover();
  setChartTab(chartTab);
  showView(activeView, { keepScroll: true });
  renderAll();
  renderLogs();
  startPolling();
  if (devices.length) refreshAllDevices();
  setInterval(updateSyncState, 1000);
  setInterval(() => { if (activeView === 'automations') updateAutoStatus(); }, 30000);
  if (stored.diffRangeH != null && $('diffRange').querySelector(`option[value="${stored.diffRangeH}"]`)) $('diffRange').value = String(stored.diffRangeH);
  loadCatalog().then(() => { if (prefs.catalogUrl && (!poolCatalog || Date.now() - (poolCatalog.fetchedAt || 0) > 86400000)) updateCatalog(true); });
  renderShareMinUI();
  if (!stored.tutorialDone) showTutorial();
}
init();
