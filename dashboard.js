// ════════════════════════════════════════════════════════════
// AxeOS Fleet Manager — Dashboard Logic v1.0
// ════════════════════════════════════════════════════════════

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
  {id:'midnight-orange',name:'🟠 Midnight Orange',group:'dark'},{id:'cyber-green',name:'🟢 Cyber Green',group:'dark'},
  {id:'deep-purple',name:'🟣 Deep Purple',group:'dark'},{id:'crimson-night',name:'🔴 Crimson Night',group:'dark'},
  {id:'arctic-blue',name:'🔵 Arctic Blue',group:'dark'},{id:'clean-amber',name:'🟧 Clean Amber',group:'light'},
  {id:'mint-fresh',name:'🍃 Mint Fresh',group:'light'},{id:'soft-lavender',name:'💜 Soft Lavender',group:'light'},
  {id:'paper-rose',name:'🌸 Paper Rose',group:'light'},{id:'sky-slate',name:'🩵 Sky Slate',group:'light'},
];

// ─── STATE ───
let devices=[], savedPools=[], activityLogs=[], hashrateHistory=[];
let selectedCoinFilter='all', selectedDeviceFilter='all';
let editingPoolId=null, settingsDeviceIp=null, pollTimer=null, currentTheme='midnight-orange';
let expandedCards=new Set(), deviceNicknames={};
let logWidgetOpen=false, logUnread=0, chartPoints=[], poolPanelOpen=false;
let sortField='custom', sortAsc=false, customOrder=[];
let sortLocked=false;
let dragSrcIp=null;
// Pool manager state preservation
let pmCoin='', pmPool='', pmFallback='', pmFbCoin='', pmCheckedDevices=[];
let deviceLabels={}; // {ip: [{text,color},...]} max 2 per device
const LABEL_COLORS=['#f7931a','#3b82f6','#10b981','#ef4444','#a855f7','#eab308','#ec4899','#06b6d4'];
const MAX_HISTORY=120, MAX_LOGS=500;
let tempUnit='C', fontScale=1; // C or F, 1=normal 1.15=large

// ════════ HELPERS ════════
const fmt={
  hr(gh){if(gh==null||isNaN(gh))return'--';return gh>=1000?(gh/1000).toFixed(2)+' TH/s':gh.toFixed(2)+' GH/s';},
  hrTh(gh){if(gh==null||isNaN(gh))return'--';return(gh/1000).toFixed(gh>=100?2:3);},
  hrThUnit(gh){return gh>=1000?'TH/s':'TH/s';},
  diff(d){if(!d||isNaN(d))return'--';if(d>=1e12)return(d/1e12).toFixed(2)+'T';if(d>=1e9)return(d/1e9).toFixed(2)+'G';if(d>=1e6)return(d/1e6).toFixed(2)+'M';if(d>=1e3)return(d/1e3).toFixed(2)+'K';return d.toFixed(2);},
  uptime(s){if(!s)return'--';const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);if(d>0)return`${d}d ${h}h`;if(h>0)return`${h}h ${m}m`;return`${m}m`;},
  time(date){return date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});},
  datetime(date){return date.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});}
};
function toF(c){return c!=null?(c*9/5+32):null;}
function dispTemp(c){if(c==null)return'--';const v=tempUnit==='F'?toF(c):c;return v.toFixed(1)+'°'+(tempUnit==='F'?'F':'C');}
function dispTempShort(c){if(c==null)return'--';const v=tempUnit==='F'?toF(c):c;return v.toFixed(1)+'°';}
function tempClass(t){if(t==null)return'';return t<55?'temp-ok':t<70?'temp-warn':'temp-hot';}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function esc(s){const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}
function $(id){return document.getElementById(id);}

// ─── Stratum URL smart parsing ───
function parseStratumUrl(input){
  let url=input.trim(), port=null;
  // Remove protocol prefix
  url=url.replace(/^stratum\+tcp:\/\//i,'').replace(/^stratum\+ssl:\/\//i,'').replace(/^stratum:\/\//i,'').replace(/^tcp:\/\//i,'');
  // Extract port if present (host:port)
  const m=url.match(/^(.+):(\d+)$/);
  if(m){url=m[1];port=parseInt(m[2]);}
  return {host:url, port};
}

// ════════════════════════════════════════════════════════════
// WRITE API — goes through background.js tab injection
// This bypasses CSRF by running fetch inside the device's own page
// ════════════════════════════════════════════════════════════
async function apiPatch(ip,data){
  const r=await chrome.runtime.sendMessage({type:'DEVICE_WRITE',ip,method:'PATCH',endpoint:`http://${ip}/api/system`,data});
  if(r&&r.error)throw new Error(r.error);
  return r;
}
async function apiRestart(ip){
  const r=await chrome.runtime.sendMessage({type:'DEVICE_WRITE',ip,method:'POST',endpoint:`http://${ip}/api/system/restart`,data:{}});
  if(r&&r.error){
    // Restart errors are expected (device drops connection)
    if(r.error.includes('disconnect')||r.error.includes('timeout')||r.error.includes('Tab'))return{ok:true};
    throw new Error(r.error);
  }
  return r||{ok:true};
}
async function apiIdentify(ip){
  try{
    const r=await chrome.runtime.sendMessage({type:'DEVICE_WRITE',ip,method:'POST',endpoint:`http://${ip}/api/system/identify`,data:{}});
    return{ok:!(r&&r.error)};
  }catch{return{ok:false};}
}

// ─── Device name helpers ───
function getDisplayName(dev){
  if(deviceNicknames[dev._ip])return deviceNicknames[dev._ip];
  return dev.hostname||dev.deviceModel||dev.ASICModel||'Unknown';
}
function getWorkerSuffix(dev){
  const nick=deviceNicknames[dev._ip];
  if(nick){
    const sanitized=nick.replace(/[^a-zA-Z0-9]/g,'');
    return sanitized||D.type(dev);
  }
  const hostname=dev.hostname||'';
  if(!hostname||/[^a-zA-Z0-9._-]/.test(hostname)||hostname.includes(' '))return D.type(dev);
  return hostname;
}

// SVG icons for device types
const ICON_AXE='<svg class="card-dev-icon axe" viewBox="0 0 20 20" width="14" height="14"><rect x="3" y="5" width="14" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/></svg>';
const ICON_NERD='<svg class="card-dev-icon nerd" viewBox="0 0 20 20" width="14" height="14"><rect x="2" y="4" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 9h8M6 12h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/></svg>';

const D={
  type(d){const m=(d.deviceModel||d.ASICModel||d.asicModel||'').toLowerCase();return(m.includes('nerd')||m.includes('nqaxe')||m.includes('nerdqaxe'))?'nerdqaxe':'bitaxe';},
  name(d){return getDisplayName(d);},
  hr(d){return d.hashRate||d.currentHashrate||0;},hr1h(d){return d.hashRate_1h||d.hashrate_1h||0;},hr24h(d){return d.hashRate_1d||d.hashrate_1d||0;},
  bestDiff(d){return d.bestDiff||d.bestdiff||0;},bestSession(d){return d.bestSessionDiff||0;},
  temp(d){return d.temp??d.chipTemp??null;},asicTemp(d){return d.asicTemp??null;},vrTemp(d){return d.vrTemp??d.vregTemp??null;},
  fanRpm(d){return d.fanRpm||d.fanrpm||d.fan2Rpm||d.fan2rpm||0;},fanSpeed(d){return d.fanSpeed??d.manualFanSpeed??d.manualfanspeed??null;},autoFan(d){return d.autofanspeed??d.auto_fan??null;},
  freq(d){return d.frequency||d.asicfrequency||0;},volt(d){return d.coreVoltage||d.voltage||d.asicvoltage||0;},voltActual(d){return d.coreVoltageActual||0;},
  power(d){return d.power||0;},shares(d){return d.sharesAccepted||0;},rejected(d){return d.sharesRejected||0;},
  poolUrl(d){return d.stratumURL||d.stratumurl||'';},poolPort(d){return d.stratumPort||d.stratumport||'';},poolUser(d){return d.stratumUser||d.stratumuser||'';},poolPass(d){return d.stratumPassword||'';},poolDiff(d){return d.poolDifficulty||d.stratumDifficulty||0;},
  fbUrl(d){return d.fallbackStratumURL||'';},fbPort(d){return d.fallbackStratumPort||'';},fbUser(d){return d.fallbackStratumUser||'';},fbPass(d){return d.fallbackStratumPassword||'';},
  model(d){return d.ASICModel||d.asicModel||d.deviceModel||'';},board(d){return d.boardVersion||d.boardversion||'';},fw(d){return d.version||d.axeOSVersion||'';},
  rssi(d){return d.wifiRSSI??d.wifiRssi??null;},freqOpts(d){return d.frequencyOptions||null;},voltOpts(d){return d.voltageOptions||null;},
};

// ════════ THEME ════════
function initThemes(){
  const sel=$('themeSelect');sel.innerHTML='';
  const dg=document.createElement('optgroup');dg.label='Dark';const lg=document.createElement('optgroup');lg.label='Light';
  THEMES.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.name;(t.group==='dark'?dg:lg).appendChild(o);});
  sel.appendChild(dg);sel.appendChild(lg);sel.value=currentTheme;
  sel.addEventListener('change',()=>applyTheme(sel.value));
}
function toggleTempUnit(){tempUnit=tempUnit==='C'?'F':'C';chrome.storage.local.set({tempUnit});$('tempUnitBtn').textContent=tempUnit==='C'?'°C':'°F';renderAll();}
function applyFontScale(s){fontScale=s;document.body.style.zoom=fontScale;chrome.storage.local.set({fontScale});$('fontScaleBtn').textContent=fontScale>1?'Aa−':'Aa+';}
function applyTheme(id){currentTheme=id;document.documentElement.setAttribute('data-theme',id);chrome.storage.local.set({theme:id});drawHashrateChart();}

// ════════ STORAGE ════════
function loadState(){
  return new Promise(resolve=>{
    chrome.storage.local.get(['devices','savedPools','logs','lastSubnet','theme','tutorialDone','expandedCards','sortField','sortAsc','customOrder','deviceNicknames','sortLocked','deviceLabels','hashrateHistory','tempUnit','fontScale'],r=>{
      if(r.devices)devices=r.devices;if(r.savedPools)savedPools=r.savedPools;if(r.logs)activityLogs=r.logs;
      if(r.lastSubnet)$('subnetInput').value=r.lastSubnet;if(r.theme)currentTheme=r.theme;
      if(r.expandedCards)try{expandedCards=new Set(JSON.parse(r.expandedCards));}catch{}
      if(r.sortField)sortField=r.sortField;if(r.sortAsc!==undefined)sortAsc=r.sortAsc;
      if(r.customOrder)try{customOrder=JSON.parse(r.customOrder);}catch{}
      if(r.sortLocked)sortLocked=r.sortLocked;
      if(r.deviceNicknames)try{deviceNicknames=JSON.parse(r.deviceNicknames);}catch{}
      if(r.deviceLabels)try{deviceLabels=JSON.parse(r.deviceLabels);}catch{}
      if(r.hashrateHistory)try{hashrateHistory=r.hashrateHistory;}catch{}
      if(r.tempUnit)tempUnit=r.tempUnit;
      if(r.fontScale)fontScale=r.fontScale;
      resolve(r);
    });
  });
}
function saveDevices(){chrome.storage.local.set({devices});}
function savePools(){chrome.storage.local.set({savedPools});}
function saveLogs(){chrome.storage.local.set({logs:activityLogs.slice(-MAX_LOGS)});}
function saveExpanded(){chrome.storage.local.set({expandedCards:JSON.stringify([...expandedCards])});}
function saveSortPrefs(){chrome.storage.local.set({sortField,sortAsc,customOrder:JSON.stringify(customOrder),sortLocked});}
function saveNicknames(){chrome.storage.local.set({deviceNicknames:JSON.stringify(deviceNicknames)});}
function saveLabels(){chrome.storage.local.set({deviceLabels:JSON.stringify(deviceLabels)});}

// ════════ LOG ════════
function log(level,msg){const entry={time:Date.now(),level,msg};activityLogs.push(entry);if(activityLogs.length>MAX_LOGS)activityLogs=activityLogs.slice(-MAX_LOGS);saveLogs();prependLogEntry(entry);if(!logWidgetOpen){logUnread++;updateLogBadge();}}
function renderLogs(){const c=$('logContainer');if(!activityLogs.length){c.innerHTML='<div class="log-empty">No activity yet.</div>';return;}c.innerHTML='';[...activityLogs].reverse().forEach(e=>prependLogEntry(e,true));}
function prependLogEntry(entry,append){const c=$('logContainer'),empty=c.querySelector('.log-empty');if(empty)empty.remove();const el=document.createElement('div');el.className='log-entry';const t=new Date(entry.time);el.innerHTML=`<span class="log-time">${fmt.time(t)}</span><span class="log-badge ${entry.level}">${entry.level}</span><span class="log-msg">${entry.msg}</span>`;if(append)c.appendChild(el);else{if(c.firstChild)c.insertBefore(el,c.firstChild);else c.appendChild(el);}}
function updateLogBadge(){const b=$('logBadge');if(logUnread>0){b.textContent=logUnread>99?'99+':logUnread;b.style.display='';}else b.style.display='none';}
function toggleLogWidget(){logWidgetOpen=!logWidgetOpen;$('logWidget').classList.toggle('open',logWidgetOpen);if(logWidgetOpen){logUnread=0;updateLogBadge();}}

// ════════ POOL PANEL ════════
function togglePoolPanel(force){poolPanelOpen=force!==undefined?force:!poolPanelOpen;$('poolPanel').classList.toggle('open',poolPanelOpen);$('poolPanelOverlay').classList.toggle('open',poolPanelOpen);}

// ════════ SORTING ════════
function ipToNum(ip){const p=ip.split('.');return((+p[0])<<24)+((+p[1])<<16)+((+p[2])<<8)+(+p[3]);}
function getSortedDevices(list){
  if(sortField==='custom'){if(!customOrder.length)return list;const om=new Map(customOrder.map((ip,i)=>[ip,i]));return[...list].sort((a,b)=>(om.get(a._ip)??9999)-(om.get(b._ip)??9999));}
  const fns={hashrate:d=>D.hr(d),bestdiff:d=>D.bestDiff(d),uptime:d=>d.uptimeSeconds||0,ip:d=>ipToNum(d._ip),name:d=>D.name(d).toLowerCase(),temp:d=>D.asicTemp(d)??D.temp(d)??0};
  const fn=fns[sortField];if(!fn)return list;
  return[...list].sort((a,b)=>{let va=fn(a),vb=fn(b);if(typeof va==='string')return sortAsc?va.localeCompare(vb):-va.localeCompare(vb);return sortAsc?(va-vb):(vb-va);});
}
function updateCustomOrder(){customOrder=devices.map(d=>d._ip);saveSortPrefs();}
function initSortControls(){$('sortSelect').value=sortField;$('sortDirBtn').textContent=sortAsc?'↑':'↓';updateLockBtn();}
function updateLockBtn(){const btn=$('sortLockBtn');if(!btn)return;if(sortLocked){btn.classList.add('locked');btn.title='Order locked';}else{btn.classList.remove('locked');btn.title='Lock custom order';}}

// ════════ SCAN ════════
async function scanNetwork(){
  const subnet=$('subnetInput').value.trim();
  if(!subnet||!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(subnet)){setStatus('Enter valid subnet (e.g. 192.168.1)','error');return;}
  chrome.storage.local.set({lastSubnet:subnet});const btn=$('scanBtn');btn.classList.add('scanning');btn.disabled=true;setStatus('Scanning...','');log('action',`Scan <strong>${esc(subnet)}.0/24</strong>`);
  try{const found=await chrome.runtime.sendMessage({type:'SCAN_NETWORK',subnet});
    if(found&&found.length>0){found.forEach(nd=>{const idx=devices.findIndex(d=>d._ip===nd._ip);if(idx>=0)devices[idx]={...devices[idx],...nd,_offline:false};else devices.push({...nd,_offline:false});});saveDevices();setStatus(`Found ${found.length} device(s)!`,'success');log('success',`Found <strong>${found.length}</strong> device(s)`);
    }else{setStatus('No devices found.','error');log('warn','No devices');}
  }catch(err){setStatus('Scan failed','error');log('error',`Scan: ${esc(err.message)}`);}
  btn.classList.remove('scanning');btn.disabled=false;renderAll();
}
async function addManualDevice(){
  const ipInput=$('manualIpInput'),ip=ipInput.value.trim();
  if(!ip||!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)){setStatus('Enter valid IP','error');return;}
  if(devices.find(d=>d._ip===ip)){setStatus(`${ip} already exists`,'error');return;}
  setStatus(`Connecting to ${ip}...`,'');log('action',`Manual add: <strong>${ip}</strong>`);
  try{const data=await chrome.runtime.sendMessage({type:'FETCH_DEVICE_INFO',ip});
    if(data&&(data.ASICModel||data.asicModel||data.deviceModel)){devices.push({...data,_offline:false});saveDevices();ipInput.value='';setStatus(`Added ${D.name(data)}!`,'success');log('success',`Added <strong>${esc(D.name(data))}</strong>`);renderAll();}
    else{setStatus(`No device at ${ip}`,'error');log('warn',`No device at ${ip}`);}
  }catch(err){setStatus(`Can't reach ${ip}`,'error');log('error',`${ip}: ${esc(err.message)}`);}
}
async function refreshAllDevices(){
  if(!devices.length)return;setStatus('Refreshing...','');
  // Save pool manager state
  savePmState();
  const results=await Promise.all(devices.map(d=>chrome.runtime.sendMessage({type:'FETCH_DEVICE_INFO',ip:d._ip})));
  let alive=0;results.forEach((data,i)=>{if(data){if(devices[i]._offline)log('success',`<strong>${esc(D.name(devices[i]))}</strong> is back online`);devices[i]={...devices[i],...data,_offline:false};alive++;}else{if(!devices[i]._offline)log('warn',`<strong>${esc(D.name(devices[i]))}</strong> went offline`);devices[i]._offline=true;}});
  saveDevices();setStatus(`${alive}/${devices.length} online`,'success');updateHashrateHistory();
  // Update cards in-place instead of full rebuild
  updateCardsInPlace();
  renderOverview();
  renderPoolManager();
  // Restore pool manager state
  restorePmState();
}
function savePmState(){
  pmCoin=$('applyCoinSelect').value;pmPool=$('applyPoolSelect').value;pmFallback=$('applyFallbackSelect').value;
  const fbCoin=$('applyFbCoinSelect');if(fbCoin)pmFbCoin=fbCoin.value;
  pmCheckedDevices=Array.from(document.querySelectorAll('.apply-dev-cb:checked')).map(cb=>cb.value);
}
function restorePmState(){
  if(pmCoin){$('applyCoinSelect').value=pmCoin;updatePoolSelects();}
  const fbCoin=$('applyFbCoinSelect');if(fbCoin&&pmFbCoin){fbCoin.value=pmFbCoin;updateFallbackSelects();}
  if(pmPool)$('applyPoolSelect').value=pmPool;
  if(pmFallback)$('applyFallbackSelect').value=pmFallback;
  pmCheckedDevices.forEach(ip=>{const cb=document.querySelector(`.apply-dev-cb[value="${ip}"]`);if(cb)cb.checked=true;});
  updateApplyBtn();
}
function setStatus(msg,cls){const el=$('scanStatus');el.textContent=msg;el.className='scan-status'+(cls?' '+cls:'');}

// ════════ CHART ════════
function updateHashrateHistory(){const on=devices.filter(d=>!d._offline);const total=on.reduce((s,d)=>s+D.hr(d),0);hashrateHistory.push({time:Date.now(),value:total,online:on.length,offline:devices.length-on.length});if(hashrateHistory.length>MAX_HISTORY)hashrateHistory.shift();chrome.storage.local.set({hashrateHistory});}

function drawHashrateChart(){
  const canvas=$('hashrateChart');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const wrap=canvas.parentElement;
  const W=wrap.clientWidth, H=wrap.clientHeight;
  const dpr=window.devicePixelRatio||1;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  const cs=getComputedStyle(document.documentElement);
  const lineColor=cs.getPropertyValue('--chart-line').trim()||'#f7931a';
  const fillA=cs.getPropertyValue('--chart-fill-a').trim()||'rgba(247,147,26,.25)';
  const fillB=cs.getPropertyValue('--chart-fill-b').trim()||'rgba(247,147,26,0)';
  const gridC=cs.getPropertyValue('--border').trim()||'#1e1e3a';
  const textC=cs.getPropertyValue('--text-muted').trim()||'#555570';
  if(hashrateHistory.length<2){ctx.fillStyle=textC;ctx.font='12px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Hashrate data will appear after a few refreshes',W/2,H/2);chartPoints=[];return;}
  const vals=hashrateHistory.map(h=>h.value);
  // Dynamic Y-axis: zoom into actual data range
  const dataMin=Math.min(...vals), dataMax=Math.max(...vals);
  const range=dataMax-dataMin;
  const padding=range<0.01?Math.max(dataMax*0.1,0.5):range*0.15;
  const minV=Math.max(0,dataMin-padding), maxV=dataMax+padding;
  const pT=8,pB=22,pL=50,pR=8,pW=W-pL-pR,pH=H-pT-pB;
  ctx.strokeStyle=gridC;ctx.lineWidth=.5;
  for(let i=0;i<=4;i++){const y=pT+(pH/4)*i;ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=textC;ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
    const v=maxV-((maxV-minV)/4)*i;ctx.fillText(v.toFixed(2),pL-4,y+3);}
  const pts=vals.map((v,i)=>({x:pL+(i/(vals.length-1))*pW,y:pT+pH-((v-minV)/(maxV-minV))*pH,idx:i}));
  const grad=ctx.createLinearGradient(0,pT,0,H-pB);grad.addColorStop(0,fillA);grad.addColorStop(1,fillB);
  ctx.beginPath();ctx.moveTo(pts[0].x,H-pB);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(pts[pts.length-1].x,H-pB);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
  ctx.strokeStyle=lineColor;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
  const last=pts[pts.length-1];
  ctx.beginPath();ctx.arc(last.x,last.y,3.5,0,Math.PI*2);ctx.fillStyle=lineColor;ctx.fill();
  ctx.beginPath();ctx.arc(last.x,last.y,6,0,Math.PI*2);ctx.strokeStyle=fillA;ctx.lineWidth=1.5;ctx.stroke();
  chartPoints=pts;
}

function initChartHover(){
  const canvas=$('hashrateChart'),tt=$('chartTooltip');
  function handleMove(e){
    if(!chartPoints.length||hashrateHistory.length<2)return;
    // offsetX/offsetY are already in CSS pixel space — works at any zoom level
    const mx=e.offsetX, my=e.offsetY;
    let closest=null,minDist=Infinity;
    chartPoints.forEach(p=>{const dx=Math.abs(p.x-mx);if(dx<minDist){minDist=dx;closest=p;}});
    if(closest&&minDist<30){
      const entry=hashrateHistory[closest.idx];if(!entry)return;
      tt.style.display='block';
      const d=new Date(entry.time);
      tt.innerHTML=`<span class="ct-time">${fmt.datetime(d)}</span><span class="ct-val">${fmt.hr(entry.value)}</span>${entry.online!=null?`<span class="ct-devices">${entry.online} online${entry.offline?' · '+entry.offline+' offline':''}</span>`:''}`;
      const cw=canvas.parentElement.clientWidth,ch=canvas.parentElement.clientHeight;
      const tw=tt.offsetWidth,th=tt.offsetHeight;
      let tx=closest.x-tw/2,ty=closest.y-th-12;
      if(tx<4)tx=4;if(tx+tw>cw-4)tx=cw-tw-4;if(ty<4)ty=closest.y+12;
      tt.style.left=tx+'px';tt.style.top=ty+'px';
      drawHashrateChart();
      const dpr=window.devicePixelRatio||1;
      const ctx=canvas.getContext('2d');
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const lc=getComputedStyle(document.documentElement).getPropertyValue('--chart-line').trim()||'#f7931a';
      ctx.setLineDash([3,3]);ctx.strokeStyle=lc;ctx.lineWidth=1;ctx.globalAlpha=.5;
      ctx.beginPath();ctx.moveTo(closest.x,8);ctx.lineTo(closest.x,ch-22);ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
      ctx.beginPath();ctx.arc(closest.x,closest.y,5,0,Math.PI*2);ctx.fillStyle=lc;ctx.fill();
      ctx.beginPath();ctx.arc(closest.x,closest.y,8,0,Math.PI*2);ctx.strokeStyle=lc;ctx.lineWidth=1.5;ctx.globalAlpha=.4;ctx.stroke();
    }else{tt.style.display='none';drawHashrateChart();}
  }
  canvas.addEventListener('mousemove',handleMove);
  canvas.addEventListener('mouseleave',()=>{tt.style.display='none';drawHashrateChart();});
}

// ════════ OVERVIEW ════════
function renderOverview(){
  const on=devices.filter(d=>!d._offline);
  const totCur=on.reduce((s,d)=>s+D.hr(d),0),tot1h=on.reduce((s,d)=>s+D.hr1h(d),0),tot24h=on.reduce((s,d)=>s+D.hr24h(d),0);
  $('ovCurrentHR2').textContent=fmt.hr(totCur);$('ov1hHR2').textContent=fmt.hr(tot1h);$('ov24hHR2').textContent=fmt.hr(tot24h);
  $('ovDevices').textContent=on.length;
  $('ovShares').textContent=on.reduce((s,d)=>s+D.shares(d),0).toLocaleString();
  $('ovRejected').textContent=on.reduce((s,d)=>s+D.rejected(d),0).toLocaleString();
  $('ovPower').textContent=on.reduce((s,d)=>s+D.power(d),0).toFixed(1)+'W';
  const temps=on.map(d=>D.asicTemp(d)||D.temp(d)).filter(Boolean);
  $('ovAvgTemp').textContent=temps.length?dispTempShort(temps.reduce((a,b)=>a+b,0)/temps.length):'--°';
  const ups=on.map(d=>d.uptimeSeconds).filter(Boolean);
  $('ovUptime').textContent=ups.length?fmt.uptime(ups.reduce((a,b)=>a+b,0)/ups.length):'--';
  let bdVal=0,bsVal=0;on.forEach(d=>{if(D.bestDiff(d)>bdVal)bdVal=D.bestDiff(d);if(D.bestSession(d)>bsVal)bsVal=D.bestSession(d);});
  $('ovBestDiff').textContent=fmt.diff(bdVal);$('ovBestSession').textContent=fmt.diff(bsVal);
  $('deviceCountBadge').textContent=`${on.length} device${on.length!==1?'s':''}`;
  drawHashrateChart();
}

// ════════ IN-PLACE CARD UPDATE ════════
function updateCardsInPlace(){
  const grid=$('deviceGrid');
  const cards=grid.querySelectorAll('.device-card[data-ip]');
  if(!cards.length){renderDevices();return;}
  cards.forEach(card=>{
    const ip=card.dataset.ip;const dev=devices.find(d=>d._ip===ip);if(!dev)return;
    card.classList.toggle('offline',!!dev._offline);
    const displayTemp=D.asicTemp(dev)??D.temp(dev);
    const qv=(sel,val)=>{const el=card.querySelector(sel);if(el)el.textContent=val;};
    const qa=(sel,val,cls)=>{const el=card.querySelector(sel);if(el){el.textContent=val;if(cls!==undefined)el.className=cls;}};
    qv('.card-name-text',D.name(dev));
    qv('.card-ip',dev._ip);
    // Hero stats (GH/s)
    qv('.hero-hr',D.hr(dev).toFixed(2));
    qv('.hero-diff',fmt.diff(D.bestDiff(dev)));
    qa('.hero-temp',dispTempShort(displayTemp),'card-hero-val hero-temp '+tempClass(displayTemp));
    // Secondary stats
    qv('.sec-1h',D.hr1h(dev).toFixed(2));
    qv('.sec-24h',D.hr24h(dev).toFixed(2));
    qv('.sec-session',fmt.diff(D.bestSession(dev)));
    // Offline tag
    const offTag=card.querySelector('.offline-tag');
    if(dev._offline&&!offTag){const nameEl=card.querySelector('.card-name');if(nameEl)nameEl.insertAdjacentHTML('beforeend',' <span class="offline-tag">OFFLINE</span>');}
    else if(!dev._offline&&offTag)offTag.remove();
    // Update details if open
    if(expandedCards.has(ip))updateCardDetails(card,dev);
  });
}
function updateCardDetails(card,dev){
  const detVals=card.querySelectorAll('.det-val');
  const data=[D.power(dev).toFixed(1)+' W',D.fanRpm(dev)+' RPM'+(D.autoFan(dev)?' (auto)':''),D.shares(dev).toLocaleString()+' / '+D.rejected(dev)+' rej',
    esc(D.model(dev)),esc(D.fw(dev)),esc(D.board(dev)),fmt.diff(D.poolDiff(dev)),
    D.poolUrl(dev)+':'+D.poolPort(dev),D.poolUser(dev),
    dispTemp(D.temp(dev)),dispTemp(D.asicTemp(dev)),dispTemp(D.vrTemp(dev)),
    D.freq(dev)+' MHz',D.volt(dev)+' mV',D.voltActual(dev)+' mV',fmt.uptime(dev.uptimeSeconds),D.rssi(dev)!=null?D.rssi(dev)+' dBm':'--'];
  detVals.forEach((el,i)=>{if(data[i]!==undefined)el.textContent=data[i];});
}

// ════════ DEVICE CARDS ════════
function renderDevices(){
  const grid=$('deviceGrid');
  let filtered=devices.filter(d=>{if(selectedDeviceFilter==='all')return true;if(selectedDeviceFilter.startsWith('label:')){const lt=selectedDeviceFilter.slice(6);return(deviceLabels[d._ip]||[]).some(l=>l.text===lt);}return D.type(d)===selectedDeviceFilter;});
  filtered=getSortedDevices(filtered);
  if(!filtered.length){grid.innerHTML=`<div class="empty-state"><div class="empty-icon">⛏</div><h3>No devices found</h3><p>Enter subnet and <strong>Scan</strong>, or add by IP.</p></div>`;return;}
  grid.innerHTML='';const isCustom=sortField==='custom';
  filtered.forEach((dev,i)=>{const card=createDeviceCard(dev,isCustom);card.style.animationDelay=(i*0.04)+'s';grid.appendChild(card);});
}

function renderCardLabels(ip){
  const labels=deviceLabels[ip]||[];
  return labels.map(l=>`<span class="card-label" style="background:${l.color}20;color:${l.color};border:1px solid ${l.color}40">${esc(l.text)}</span>`).join('');
}
function startLabelEdit(card,dev){
  const labels=deviceLabels[dev._ip]||[];
  const pop=document.createElement('div');pop.className='label-popup';
  pop.innerHTML=`<div class="label-pop-title">Labels (max 2)</div>
    <div class="label-pop-list">${labels.map((l,i)=>`<div class="label-pop-item"><span class="label-dot" style="background:${l.color}"></span><span>${esc(l.text)}</span><button data-idx="${i}" class="label-del">✕</button></div>`).join('')}</div>
    ${labels.length<2?`<div class="label-pop-add"><input type="text" maxlength="10" placeholder="Label text" class="label-input"><div class="label-colors">${LABEL_COLORS.map(c=>`<button class="label-color-btn" data-color="${c}" style="background:${c}"></button>`).join('')}</div><button class="btn-primary btn-sm label-add-btn" disabled>Add</button></div>`:''}
    <button class="btn-secondary btn-sm label-close-btn" style="width:100%;margin-top:6px">Done</button>`;
  pop.style.position='fixed';pop.style.top='50%';pop.style.left='50%';pop.style.transform='translate(-50%,-50%)';pop.style.zIndex='999';document.body.appendChild(pop);const backdrop=document.createElement('div');backdrop.className='label-backdrop';document.body.appendChild(backdrop);backdrop.addEventListener('click',()=>{pop.remove();backdrop.remove();});
  let selColor=null;
  pop.querySelectorAll('.label-color-btn').forEach(b=>b.addEventListener('click',()=>{pop.querySelectorAll('.label-color-btn').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');selColor=b.dataset.color;const inp=pop.querySelector('.label-input');pop.querySelector('.label-add-btn').disabled=!inp.value.trim()||!selColor;}));
  const inp=pop.querySelector('.label-input');
  if(inp)inp.addEventListener('input',()=>{pop.querySelector('.label-add-btn').disabled=!inp.value.trim()||!selColor;});
  pop.querySelector('.label-add-btn')?.addEventListener('click',()=>{if(!selColor||!inp.value.trim())return;if(!deviceLabels[dev._ip])deviceLabels[dev._ip]=[];deviceLabels[dev._ip].push({text:inp.value.trim().slice(0,10),color:selColor});saveLabels();pop.remove();document.querySelector('.label-backdrop')?.remove();renderAll();});
  pop.querySelectorAll('.label-del').forEach(b=>b.addEventListener('click',()=>{const idx=parseInt(b.dataset.idx);if(!deviceLabels[dev._ip])return;deviceLabels[dev._ip].splice(idx,1);if(!deviceLabels[dev._ip].length)delete deviceLabels[dev._ip];saveLabels();pop.remove();document.querySelector('.label-backdrop')?.remove();renderAll();}));
  pop.querySelector('.label-close-btn').addEventListener('click',()=>{pop.remove();document.querySelector('.label-backdrop')?.remove();});
}

function createDeviceCard(dev,draggable){
  const card=document.createElement('div');
  card.className='device-card'+(dev._offline?' offline':'');
  card.dataset.ip=dev._ip;
  const type=D.type(dev),bc=type==='nerdqaxe'?'badge-nerdqaxe':'badge-bitaxe',bt=type==='nerdqaxe'?'NerdQAxe':'BitAxe';
  const displayTemp=D.asicTemp(dev)??D.temp(dev);
  const isOpen=expandedCards.has(dev._ip);
  card.innerHTML=`
    <div class="card-top">
      <div class="card-identity">
        <div class="card-name">${type==='nerdqaxe'?ICON_NERD:ICON_AXE}<span class="card-name-text">${esc(D.name(dev))}</span> <button class="btn-rename" title="Rename"><svg class="btn-rename-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button><button class="btn-label" title="Add label"><svg class="btn-label-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></button>${dev._offline?'<span class="offline-tag">OFFLINE</span>':''}${renderCardLabels(dev._ip)}</div>
        <div class="card-ip">${dev._ip}</div>
      </div>
      <div class="card-top-right"><span class="card-badge ${bc}">${bt}</span><button class="btn-icon btn-open" title="Open local dashboard">🌐</button><button class="btn-icon btn-settings" title="Settings">⚙</button><button class="btn-icon btn-restart" title="Restart">⟳</button></div>
    </div>
    <div class="card-hero">
      <div class="card-hero-item hero-main">
        <span class="card-hero-icon">⚡</span>
        <span class="card-hero-val hero-hr">${D.hr(dev).toFixed(2)}</span>
        <span class="card-hero-unit">GH/s</span>
        <span class="card-hero-lbl">Hashrate</span>
      </div>
      <div class="card-hero-item">
        <span class="card-hero-icon">💎</span>
        <span class="card-hero-val hero-diff">${fmt.diff(D.bestDiff(dev))}</span>
        <span class="card-hero-lbl">Best Diff</span>
      </div>
      <div class="card-hero-item">
        <span class="card-hero-icon">🌡</span>
        <span class="card-hero-val hero-temp ${tempClass(displayTemp)}">${dispTempShort(displayTemp)}</span>
        <span class="card-hero-lbl">Temperature</span>
      </div>
    </div>
    <div class="card-secondary">
      <div class="card-sec-item"><span class="card-sec-lbl">1h</span><span class="card-sec-val sec-1h">${D.hr1h(dev).toFixed(2)}</span></div>
      <div class="card-sec-item"><span class="card-sec-lbl">24h</span><span class="card-sec-val sec-24h">${D.hr24h(dev).toFixed(2)}</span></div>
      <div class="card-sec-item"><span class="card-sec-lbl">Session</span><span class="card-sec-val sec-session">${fmt.diff(D.bestSession(dev))}</span></div>
    </div>
    <div class="card-actions"><button class="card-expand">${isOpen?'▲ Hide':'▼ Details'}</button></div>
    <div class="card-details${isOpen?' open':''}">
      <div class="card-details-grid">
        <div class="card-detail-item">Power<span class="det-val">${D.power(dev).toFixed(1)} W</span></div>
        <div class="card-detail-item">Fan<span class="det-val">${D.fanRpm(dev)} RPM${D.autoFan(dev)?' (auto)':''}</span></div>
        <div class="card-detail-item">Shares<span class="det-val">${D.shares(dev).toLocaleString()} / ${D.rejected(dev)} rej</span></div>
        <div class="card-detail-item">ASIC<span class="det-val">${esc(D.model(dev))}</span></div>
        <div class="card-detail-item">Firmware<span class="det-val">${esc(D.fw(dev))}</span></div>
        <div class="card-detail-item">Board<span class="det-val">${esc(D.board(dev))}</span></div>
        <div class="card-detail-item">Pool Diff<span class="det-val">${fmt.diff(D.poolDiff(dev))}</span></div>
        <div class="card-detail-item">Pool<span class="det-val" style="font-size:9px;word-break:break-all">${esc(D.poolUrl(dev))}:${D.poolPort(dev)}</span></div>
        <div class="card-detail-item">Worker<span class="det-val" style="font-size:9px;word-break:break-all">${esc(D.poolUser(dev))}</span></div>
        <div class="card-detail-item">Board Temp<span class="det-val">${dispTemp(D.temp(dev))}</span></div>
        <div class="card-detail-item">ASIC Temp<span class="det-val">${dispTemp(D.asicTemp(dev))}</span></div>
        <div class="card-detail-item">VR Temp<span class="det-val">${dispTemp(D.vrTemp(dev))}</span></div>
        <div class="card-detail-item">Frequency<span class="det-val">${D.freq(dev)} MHz</span></div>
        <div class="card-detail-item">Voltage<span class="det-val">${D.volt(dev)} mV</span></div>
        <div class="card-detail-item">V. Actual<span class="det-val">${D.voltActual(dev)} mV</span></div>
        <div class="card-detail-item">Uptime<span class="det-val">${fmt.uptime(dev.uptimeSeconds)}</span></div>
        <div class="card-detail-item">WiFi<span class="det-val">${D.rssi(dev)!=null?D.rssi(dev)+' dBm':'--'}</span></div>
      </div>
    </div>`;
  // Rename
  card.querySelector('.btn-rename').addEventListener('click',e=>{e.stopPropagation();startRename(card,dev);});
  card.querySelector('.btn-label').addEventListener('click',e=>{e.stopPropagation();startLabelEdit(card,dev);});
  // Open local dashboard
  card.querySelector('.btn-open').addEventListener('click',e=>{e.stopPropagation();window.open(`http://${dev._ip}`,'_blank');});
  // Expand
  card.querySelector('.card-expand').addEventListener('click',e=>{e.stopPropagation();const det=card.querySelector('.card-details'),btn=e.currentTarget;const opening=!det.classList.contains('open');det.classList.toggle('open',opening);btn.textContent=opening?'▲ Hide':'▼ Details';if(opening)expandedCards.add(dev._ip);else expandedCards.delete(dev._ip);saveExpanded();});
  card.querySelector('.btn-settings').addEventListener('click',e=>{e.stopPropagation();openSettingsModal(dev._ip);});
  card.querySelector('.btn-restart').addEventListener('click',async e=>{e.stopPropagation();if(!confirm(`Restart ${D.name(dev)}?`))return;log('action',`Restarting <strong>${esc(D.name(dev))}</strong>`);try{const r=await apiRestart(dev._ip);if(r&&r.ok)log('success',`Restart → ${esc(D.name(dev))}`);else log('error',`Restart failed: ${esc(D.name(dev))}`);}catch(err){log('error',`Restart: ${esc(err.message)}`);}});
  // Drag-and-drop
  if(draggable&&!sortLocked){
    card.draggable=true;
    card.addEventListener('dragstart',e=>{dragSrcIp=dev._ip;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');dragSrcIp=null;document.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));});
    card.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';if(dragSrcIp&&dragSrcIp!==dev._ip)card.classList.add('drag-over');});
    card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
    card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('drag-over');if(!dragSrcIp||dragSrcIp===dev._ip)return;const si=devices.findIndex(d=>d._ip===dragSrcIp),ti=devices.findIndex(d=>d._ip===dev._ip);if(si<0||ti<0)return;const[moved]=devices.splice(si,1);devices.splice(ti,0,moved);saveDevices();updateCustomOrder();renderDevices();});
  }
  return card;
}

function startRename(card,dev){
  const nameEl=card.querySelector('.card-name-text');if(!nameEl)return;
  const cur=D.name(dev);
  const input=document.createElement('input');input.type='text';input.value=cur;input.className='rename-input';input.maxLength=24;
  nameEl.replaceWith(input);input.focus();input.select();
  const finish=()=>{
    const val=input.value.trim();
    const span=document.createElement('span');span.className='card-name-text';
    if(val&&val!==cur){
      if(/[^a-zA-Z0-9 _-]/.test(val)){alert('Only letters, numbers, spaces, hyphens and underscores allowed.');span.textContent=cur;input.replaceWith(span);return;}
      deviceNicknames[dev._ip]=val;saveNicknames();span.textContent=val;log('info',`Renamed <strong>${esc(cur)}</strong> → <strong>${esc(val)}</strong>`);
    }else{span.textContent=cur;if(!val||val===cur){delete deviceNicknames[dev._ip];saveNicknames();}}
    input.replaceWith(span);
  };
  input.addEventListener('blur',finish);input.addEventListener('keydown',e=>{if(e.key==='Enter')input.blur();if(e.key==='Escape'){input.value=cur;input.blur();}});
}

// ════════ SETTINGS MODAL ════════
function openSettingsModal(ip){
  settingsDeviceIp=ip;const dev=devices.find(d=>d._ip===ip);if(!dev)return;
  $('settingsModal').classList.remove('hidden');$('settingsModalTitle').textContent=`${D.name(dev)} — ${ip}`;
  document.querySelectorAll('#settingsModalBody .mtab').forEach((t,i)=>t.classList.toggle('active',i===0));
  document.querySelectorAll('#settingsModalBody .mtab-content').forEach((c,i)=>c.classList.toggle('active',i===0));
  $('sInfoGrid').innerHTML=[['Hostname',D.name(dev),''],['ASIC',D.model(dev),''],['Board',D.board(dev),''],['Firmware',D.fw(dev),''],['IP',dev._ip,''],['Type',D.type(dev)==='nerdqaxe'?'NerdQAxe':'BitAxe',''],['Current HR',fmt.hr(D.hr(dev)),'accent'],['1h Avg',fmt.hr(D.hr1h(dev)),''],['24h Avg',fmt.hr(D.hr24h(dev)),''],['Best Diff',fmt.diff(D.bestDiff(dev)),'accent'],['Session Best',fmt.diff(D.bestSession(dev)),''],['Pool Diff',fmt.diff(D.poolDiff(dev)),''],['Accepted',D.shares(dev).toLocaleString(),''],['Rejected',D.rejected(dev).toString(),''],['Power',D.power(dev).toFixed(1)+' W',''],['Board Temp',dispTemp(D.temp(dev)),''],['ASIC Temp',dispTemp(D.asicTemp(dev)),''],['VR Temp',dispTemp(D.vrTemp(dev)),''],['Freq',D.freq(dev)+' MHz',''],['Voltage',D.volt(dev)+' mV',''],['Fan',D.fanRpm(dev)+' RPM',''],['Uptime',fmt.uptime(dev.uptimeSeconds),''],['WiFi',D.rssi(dev)!=null?D.rssi(dev)+' dBm':'--',''],['Pool',D.poolUrl(dev)+':'+D.poolPort(dev),'']].map(([l,v,c])=>`<div class="sinfo-item"><span class="sinfo-label">${l}</span><span class="sinfo-value ${c}">${esc(v)}</span></div>`).join('');
  const isNerdFan=D.type(dev)==='nerdqaxe';
  $('sAutoFanRow').style.display=isNerdFan?'none':'flex';
  if(isNerdFan){$('sAutoFan').checked=false;$('sNerdFanNote').style.display='';}else{$('sAutoFan').checked=!!D.autoFan(dev);$('sNerdFanNote').style.display='none';}
  $('sFanSlider').value=D.fanSpeed(dev)??100;$('sFanVal').textContent=(D.fanSpeed(dev)??100)+'%';
  $('sManualFanRow').style.display=(isNerdFan||!D.autoFan(dev))?'flex':'none';$('sFanStatus').textContent='';
  $('sFrequency').value=D.freq(dev)||'';$('sVoltage').value=D.volt(dev)||'';
  $('sFreqHint').textContent=D.freqOpts(dev)?'Options: '+JSON.stringify(D.freqOpts(dev)):'100–800 MHz';
  $('sVoltHint').textContent=D.voltOpts(dev)?'Options: '+JSON.stringify(D.voltOpts(dev)):'700–1400 mV';
  $('sMiningStatus').textContent='';
  $('sPoolURL').value=D.poolUrl(dev);$('sPoolPort').value=D.poolPort(dev);$('sPoolUser').value=D.poolUser(dev);$('sPoolPass').value=D.poolPass(dev)||'x';
  $('sFbPoolURL').value=D.fbUrl(dev);$('sFbPoolPort').value=D.fbPort(dev);$('sFbPoolUser').value=D.fbUser(dev);$('sFbPoolPass').value=D.fbPass(dev)||'x';
  $('sPoolStatus').textContent='';

}

async function applyFanSettings(){const ip=settingsDeviceIp;if(!ip)return;const dev=devices.find(d=>d._ip===ip);const isNerd=D.type(dev)==='nerdqaxe';const autoFan=$('sAutoFan').checked,speed=parseInt($('sFanSlider').value),st=$('sFanStatus');const patch={};
    if(isNerd){
      // NerdQAxe: auto fan is deprecated in firmware (AFC removed).
      // Setting autofanspeed=1 on NerdQAxe makes it manual 100%.
      // We always send manualFanSpeed — if "auto" is checked, set to 100%.
      patch.autofanspeed=0;
      patch.manualFanSpeed=autoFan?100:speed;
      if(autoFan){st.className='status-msg working';st.textContent='Note: NerdQAxe auto-fan is deprecated in firmware. Setting manual 100%.';}
    }else{
      // BitAxe: autofanspeed + manualfanspeed (lowercase!)
      patch.autofanspeed=autoFan?1:0;
      if(!autoFan){patch.fanSpeed=speed;patch.manualfanspeed=speed;}
    }st.className='status-msg working';st.textContent='Applying...';log('action',`Fan → <strong>${esc(D.name(dev))}</strong>`);try{const r=await apiPatch(ip,patch);if(r&&!r.error){st.className='status-msg success';st.textContent='Applied!';log('success',`Fan → ${esc(D.name(dev))}`);}else throw new Error(r?.error||'Failed');}catch(e){st.className='status-msg error';st.textContent='Failed: '+e.message;log('error',`Fan: ${esc(e.message)}`);}
}
async function applyMiningSettings(){const ip=settingsDeviceIp;if(!ip)return;const dev=devices.find(d=>d._ip===ip);const freq=parseInt($('sFrequency').value),volt=parseInt($('sVoltage').value),st=$('sMiningStatus');if(!freq&&!volt){st.className='status-msg error';st.textContent='Enter value';return;}const patch={};if(freq){patch.asicfrequency=freq;patch.frequency=freq;}if(volt)patch.coreVoltage=volt;st.className='status-msg working';st.textContent='Applying...';log('action',`Mining → <strong>${esc(D.name(dev))}</strong>`);try{const r=await apiPatch(ip,patch);if(r&&!r.error){st.className='status-msg success';st.textContent='Applied!';log('success',`Mining → ${esc(D.name(dev))}`);}else throw new Error(r?.error||'Failed');}catch(e){st.className='status-msg error';st.textContent='Failed: '+e.message;log('error',`Mining: ${esc(e.message)}`);}
}
async function applyPoolSettings(){const ip=settingsDeviceIp;if(!ip)return;const dev=devices.find(d=>d._ip===ip),st=$('sPoolStatus');const parsed=parseStratumUrl($('sPoolURL').value);const isNerd=D.type(dev)==='nerdqaxe';st.className='status-msg working';st.textContent='Reading settings...';
  try{
    let patch;
    if(isNerd){
      let cs={};try{cs=await chrome.runtime.sendMessage({type:'GET_SYSTEM_SETTINGS',ip});if(cs&&cs.error)cs={};}catch(e){}
      const writableKeys=['hostname','coreVoltage','asicfrequency','autofanspeed','manualFanSpeed','flipscreen','invertscreen','stratumURL','stratumPort','stratumUser','stratumPassword','stratumEnonceSubscribe','stratumTLS','fallbackStratumURL','fallbackStratumPort','fallbackStratumUser','fallbackStratumPassword','fallbackStratumEnonceSubscribe','fallbackStratumTLS'];
      patch={};writableKeys.forEach(k=>{if(k in cs)patch[k]=cs[k];});
      patch.stratumURL=parsed.host;patch.stratumPort=parsed.port||parseInt($('sPoolPort').value)||3333;
      patch.stratumUser=$('sPoolUser').value.trim();
      patch.stratumEnonceSubscribe=false;patch.stratumTLS=false;
      const fbRaw=$('sFbPoolURL').value.trim();
      if(fbRaw){const fp=parseStratumUrl(fbRaw);patch.fallbackStratumURL=fp.host;patch.fallbackStratumPort=fp.port||parseInt($('sFbPoolPort').value)||3333;patch.fallbackStratumUser=$('sFbPoolUser').value.trim();patch.fallbackStratumEnonceSubscribe=false;patch.fallbackStratumTLS=false;}
    }else{
      patch={stratumURL:parsed.host,stratumPort:parsed.port||parseInt($('sPoolPort').value)||3333,stratumUser:$('sPoolUser').value.trim(),stratumExtranonceSubscribe:false,stratumSuggestedDifficulty:512};
      const fbRaw=$('sFbPoolURL').value.trim();
      if(fbRaw){const fp=parseStratumUrl(fbRaw);patch.fallbackStratumURL=fp.host;patch.fallbackStratumPort=fp.port||parseInt($('sFbPoolPort').value)||3333;patch.fallbackStratumUser=$('sFbPoolUser').value.trim();patch.fallbackStratumExtranonceSubscribe=false;patch.fallbackStratumSuggestedDifficulty=1000;}
      else{patch.fallbackStratumURL=parsed.host;patch.fallbackStratumPort=parsed.port||parseInt($('sPoolPort').value)||3333;patch.fallbackStratumUser=$('sPoolUser').value.trim();patch.fallbackStratumExtranonceSubscribe=false;patch.fallbackStratumSuggestedDifficulty=1000;}
    }
    st.textContent='Applying & restarting...';log('action',`Pool → <strong>${esc(D.name(dev))}</strong>`);
    const r=await apiPatch(ip,patch);
    if(r&&!r.error){await new Promise(w=>setTimeout(w,500));await apiRestart(ip);st.className='status-msg success';st.textContent='Applied, restarting...';log('success',`Pool → ${esc(D.name(dev))}`);}
    else throw new Error(r?.error||'Failed');
  }catch(e){st.className='status-msg error';st.textContent='Failed: '+e.message;log('error',`Pool: ${esc(e.message)}`);}
}

// ════════ POOL MANAGER ════════
function renderPoolManager(){renderCoinTabs();renderSavedPools();renderApplyForm();populateCoinSelect('poolCoin');}
function renderCoinTabs(){const tabs=$('coinTabs'),used=[...new Set(savedPools.map(p=>p.coin))];tabs.innerHTML='';['all',...used].forEach(cid=>{const btn=document.createElement('button');btn.className='coin-tab'+(selectedCoinFilter===cid?' active':'');btn.textContent=cid==='all'?'All':(SHA256_COINS.find(c=>c.id===cid)?.symbol||cid.toUpperCase());btn.addEventListener('click',()=>{selectedCoinFilter=cid;renderPoolManager();});tabs.appendChild(btn);});}
function renderSavedPools(){const list=$('savedPoolsList');const filtered=selectedCoinFilter==='all'?savedPools:savedPools.filter(p=>p.coin===selectedCoinFilter);if(!filtered.length){list.innerHTML=`<div class="empty-state small"><p>No pools saved${selectedCoinFilter!=='all'?' for this coin':''}.</p></div>`;return;}list.innerHTML='';list.classList.toggle('pools-collapsed',filtered.length>2);filtered.forEach(pool=>{const ci=SHA256_COINS.find(c=>c.id===pool.coin);const card=document.createElement('div');card.className='saved-pool-card';card.innerHTML=`<div class="pool-card-top"><span class="pool-card-name">${esc(pool.name)}</span><span class="pool-card-coin">${ci?ci.symbol:pool.coin}</span></div><div class="pool-card-url">${esc(pool.url)}:${pool.port}</div><div class="pool-card-worker">${esc(pool.user)}</div><div class="pool-card-actions"><button class="edit">Edit</button><button class="del">Delete</button></div>`;card.querySelector('.edit').addEventListener('click',()=>openPoolModal(pool));card.querySelector('.del').addEventListener('click',()=>{if(confirm(`Delete "${pool.name}"?`)){savedPools=savedPools.filter(p=>p.id!==pool.id);savePools();log('info',`Deleted <strong>${esc(pool.name)}</strong>`);renderPoolManager();}});list.appendChild(card);});if(filtered.length>2){const toggle=document.createElement('button');toggle.className='btn-secondary btn-sm pools-toggle-btn';toggle.textContent=list.classList.contains('pools-collapsed')?'Show all ('+filtered.length+')':'Collapse';toggle.addEventListener('click',()=>{list.classList.toggle('pools-collapsed');toggle.textContent=list.classList.contains('pools-collapsed')?'Show all ('+filtered.length+')':'Collapse';});list.appendChild(toggle);}}
function renderApplyForm(){
  const coinSel=$('applyCoinSelect');coinSel.innerHTML='<option value="">-- Select coin --</option>';
  const fbCoinSel=$('applyFbCoinSelect');if(fbCoinSel){fbCoinSel.innerHTML='<option value="">-- All coins --</option>';}
  [...new Set(savedPools.map(p=>p.coin))].forEach(cid=>{const ci=SHA256_COINS.find(c=>c.id===cid);coinSel.innerHTML+=`<option value="${cid}">${ci?ci.name:cid}</option>`;if(fbCoinSel)fbCoinSel.innerHTML+=`<option value="${cid}">${ci?ci.name:cid}</option>`;});
  const devList=$('applyDeviceList'),onlineDevs=devices.filter(d=>!d._offline);
  if(!onlineDevs.length)devList.innerHTML='<p class="muted">No devices</p>';
  else{devList.innerHTML='';devList.classList.add('dev-grid-list');
    onlineDevs.forEach(d=>{const type=D.type(d);
      const icon=type==='nerdqaxe'?`<svg class="dev-type-icon nerd" viewBox="0 0 20 20" width="16" height="16"><rect x="2" y="4" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 9h8M6 12h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/></svg>`:`<svg class="dev-type-icon axe" viewBox="0 0 20 20" width="16" height="16"><rect x="3" y="5" width="14" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/></svg>`;
      const lbl=document.createElement('label');lbl.className='dev-grid-item';lbl.innerHTML=`<input type="checkbox" value="${d._ip}" class="apply-dev-cb">${icon}<div class="dev-grid-info"><span class="dev-grid-name">${esc(D.name(d))}</span><span class="dev-grid-ip">${d._ip}</span></div>`;devList.appendChild(lbl);
    });
  }
  updateApplyBtn();
}
function updatePoolSelects(){const coinVal=$('applyCoinSelect').value;const pools=coinVal?savedPools.filter(p=>p.coin===coinVal):[];$('applyPoolSelect').innerHTML='<option value="">-- Select pool --</option>';pools.forEach(p=>{$('applyPoolSelect').innerHTML+=`<option value="${p.id}">${esc(p.name)}</option>`;});updateFallbackSelects();}
function updateFallbackSelects(){const fbCoinVal=$('applyFbCoinSelect')?$('applyFbCoinSelect').value:'';const fbPools=fbCoinVal?savedPools.filter(p=>p.coin===fbCoinVal):savedPools;$('applyFallbackSelect').innerHTML='<option value="">-- None --</option>';fbPools.forEach(p=>{$('applyFallbackSelect').innerHTML+=`<option value="${p.id}">${esc(p.name)} (${p.coin.toUpperCase()})</option>`;});}
function updateApplyBtn(){const coin=$('applyCoinSelect').value,pool=$('applyPoolSelect').value,checked=document.querySelectorAll('.apply-dev-cb:checked').length;$('applyPoolBtn').disabled=!(coin&&pool&&checked);}

async function applyPoolToDevices(){
  const poolId=$('applyPoolSelect').value,pool=savedPools.find(p=>p.id===poolId);if(!pool)return;
  const fbId=$('applyFallbackSelect').value,fbPool=fbId?savedPools.find(p=>p.id===fbId):null;
  const doRestart=$('applyRestart').checked;
  const ips=Array.from(document.querySelectorAll('.apply-dev-cb:checked')).map(cb=>cb.value);
  const st=$('applyStatus');
  const pp=parseStratumUrl(pool.url);
  st.className='status-msg working';st.textContent=`Applying to ${ips.length} device(s)...`;
  // Show progress
  const pb=$('applyProgress');const pbar=$('applyProgressBar');if(pb)pb.style.display='block';
  // Mark devices as pending
  ips.forEach(ip=>{const el=document.querySelector(`.apply-dev-cb[value="${ip}"]`);if(el){const item=el.closest('.dev-grid-item');if(item){item.dataset.applyStatus='pending';item.insertAdjacentHTML('beforeend','<span class="apply-status-icon pending">⏳</span>');}}});
  log('action',`Applying <strong>${esc(pool.name)}</strong>${fbPool?' + <strong>'+esc(fbPool.name)+'</strong>':''} to ${ips.length} device(s)`);
  let ok=0,fail=0;
  for(const ip of ips){
    const dev=devices.find(d=>d._ip===ip);
    const workerSuffix=getWorkerSuffix(dev);
    const isNerd=D.type(dev)==='nerdqaxe';
    let user=pool.user;
    if(user&&!user.includes('.'))user=user+'.'+workerSuffix;
    else if(user&&user.endsWith('.'))user=user+workerSuffix;
    // Fallback user
    let fbUser=fbPool?fbPool.user:'';
    if(fbUser&&!fbUser.includes('.'))fbUser=fbUser+'.'+workerSuffix;
    else if(fbUser&&fbUser.endsWith('.'))fbUser=fbUser+workerSuffix;
    // Fallback URL parsing
    const fp=fbPool?parseStratumUrl(fbPool.url):{host:pp.host,port:null};
    try{
      let patch;
      if(isNerd){
        // ─── NerdQAxe: extract WRITABLE fields from current settings, then set pool ───
        // /api/system/info returns both stats and config. We pick ONLY writable fields.
        let cs={};
        try{
          cs=await chrome.runtime.sendMessage({type:'GET_SYSTEM_SETTINGS',ip});
          if(cs&&cs.error)cs={};
        }catch(e){log('warn',`Could not read ${esc(D.name(dev))} settings`);}
        // Whitelist of known writable NerdQAxe fields
        const writableKeys=['hostname','coreVoltage','asicfrequency','autofanspeed','manualFanSpeed',
          'flipscreen','invertscreen','stratumURL','stratumPort','stratumUser','stratumPassword',
          'stratumEnonceSubscribe','stratumTLS',
          'fallbackStratumURL','fallbackStratumPort','fallbackStratumUser','fallbackStratumPassword',
          'fallbackStratumEnonceSubscribe','fallbackStratumTLS'];
        patch={};
        writableKeys.forEach(k=>{if(k in cs)patch[k]=cs[k];});
        // Override pool fields
        patch.stratumURL=pp.host;
        patch.stratumPort=pp.port||parseInt(pool.port);
        patch.stratumUser=user;
        patch.stratumEnonceSubscribe=false;
        patch.stratumTLS=false;
        if(fbPool){
          patch.fallbackStratumURL=fp.host;
          patch.fallbackStratumPort=fp.port||parseInt(fbPool.port);
          patch.fallbackStratumUser=fbUser;
          patch.fallbackStratumEnonceSubscribe=false;
          patch.fallbackStratumTLS=false;
        }
      }else{
        // ─── BitAxe: simple payload with only pool settings ───
        // NO stratumPassword, NO stratumTLS (exact match with Tampermonkey)
        patch={
          stratumURL:pp.host,
          stratumPort:pp.port||parseInt(pool.port),
          stratumUser:user,
          stratumExtranonceSubscribe:false,
          stratumSuggestedDifficulty:512,
          fallbackStratumURL:fbPool?fp.host:pp.host,
          fallbackStratumPort:fbPool?(fp.port||parseInt(fbPool.port)):(pp.port||parseInt(pool.port)),
          fallbackStratumUser:fbUser||user,
          fallbackStratumExtranonceSubscribe:false,
          fallbackStratumSuggestedDifficulty:1000
        };
      }
      // Update progress
      if(pbar)pbar.style.width=((ips.indexOf(ip)+1)/ips.length*100)+'%';
      // Update device status icon
      const devEl=document.querySelector(`.apply-dev-cb[value="${ip}"]`);
      if(devEl){const item=devEl.closest('.dev-grid-item');if(item){item.dataset.applyStatus='working';const si=item.querySelector('.apply-status-icon');if(si)si.textContent='⏳';}}
      // PATCH
      const r=await apiPatch(ip,patch);
      if(r&&!r.error){
        ok++;
        // Wait 500ms then restart (same as Tampermonkey)
        if(doRestart){
          await new Promise(r=>setTimeout(r,500));
          await apiRestart(ip);
        }
        log('success',`Pool → <strong>${esc(D.name(dev))}</strong> (worker: ${esc(user)})${doRestart?' restarting':''}`);
        if(devEl){const item=devEl.closest('.dev-grid-item');if(item){item.dataset.applyStatus='done';const si=item.querySelector('.apply-status-icon');if(si){si.textContent='✅';si.className='apply-status-icon done';}}}
      }else{fail++;log('error',`Fail on ${esc(D.name(dev))}: ${r?.error||'unknown'}`);
        if(devEl){const item=devEl.closest('.dev-grid-item');if(item){item.dataset.applyStatus='fail';const si=item.querySelector('.apply-status-icon');if(si){si.textContent='❌';si.className='apply-status-icon fail';}}}}
      // Wait between devices (same as Tampermonkey)
      await new Promise(r=>setTimeout(r,500));
    }catch(e){fail++;log('error',`Fail on ${esc(D.name(dev))}: ${esc(e.message)}`);}
  }
  st.className=fail===0?'status-msg success':'status-msg error';st.textContent=fail===0?`Applied to ${ok}!${doRestart?' Restarting...':''}`:`OK: ${ok}, Failed: ${fail}`;
  if(pb)pb.style.display='none';if(pbar)pbar.style.width='0';
  // Clear status icons after 5s
  setTimeout(()=>{document.querySelectorAll('.apply-status-icon').forEach(el=>el.remove());document.querySelectorAll('[data-apply-status]').forEach(el=>delete el.dataset.applyStatus);},5000);
  if(doRestart)setTimeout(()=>refreshAllDevices(),8000);
}

function populateCoinSelect(selectId){const sel=$(selectId);sel.innerHTML='';SHA256_COINS.forEach(c=>{sel.innerHTML+=`<option value="${c.id}">${c.name}</option>`;});}
function openPoolModal(pool=null){editingPoolId=pool?pool.id:null;$('poolModalTitle').textContent=pool?'Edit Pool':'Add Pool';$('poolCoin').value=pool?pool.coin:'btc';$('poolName').value=pool?pool.name:'';$('poolURL').value=pool?pool.url:'';$('poolPort').value=pool?pool.port:'';$('poolUser').value=pool?pool.user:'';$('poolPassword').value=pool?pool.password:'';$('poolTLS').checked=pool?pool.tls:false;$('poolModal').classList.remove('hidden');}
function closeModal(id){$(id).classList.add('hidden');}
function savePool(){
  const coin=$('poolCoin').value,name=$('poolName').value.trim();
  let urlRaw=$('poolURL').value.trim();
  // Smart URL parsing
  const parsed=parseStratumUrl(urlRaw);
  const url=parsed.host;
  let port=$('poolPort').value.trim();
  if(parsed.port&&!port)port=String(parsed.port);
  // Update UI with parsed values
  $('poolURL').value=url;
  if(parsed.port)$('poolPort').value=parsed.port;
  const user=$('poolUser').value.trim(),password=$('poolPassword').value.trim(),tls=$('poolTLS').checked;
  if(!name||!url||!port){alert('Fill Name, URL, Port.');return;}
  if(editingPoolId){const idx=savedPools.findIndex(p=>p.id===editingPoolId);if(idx>=0)savedPools[idx]={...savedPools[idx],coin,name,url,port:parseInt(port),user,password,tls};log('info',`Updated <strong>${esc(name)}</strong>`);}
  else{savedPools.push({id:genId(),coin,name,url,port:parseInt(port),user,password,tls});log('success',`Saved <strong>${esc(name)}</strong>`);}
  savePools();closeModal('poolModal');renderPoolManager();
}

// ════════ TUTORIAL / SETUP WIZARD ════════
const TUTORIAL_STEPS=[
  {illust:'⛏',title:'Welcome to AxeOS Fleet Manager',desc:'Manage all your BitAxe and NerdQAxe SHA-256 miners from one place. Let\'s set up your fleet!'},
  {illust:'📡',title:'Discover Your Devices',desc:'Enter your local subnet and scan, or add devices by IP address.',interactive:'scan'},
  {illust:'✏️',title:'Rename Your Devices',desc:'Click the <strong>pencil icon</strong> on any device card to give it a custom name. Use only letters, numbers, hyphens and underscores — this name is used as the worker suffix when applying pools.'},
  {illust:'🏷',title:'Organize with Labels',desc:'Click the <strong>tag icon</strong> on any device card to add colored labels (max 2 per device, 10 chars). Labels appear as filter buttons so you can quickly view groups of devices.'},
  {illust:'🏊',title:'Pool Manager',desc:'Click <strong>Pools</strong> on the left to manage mining pools. When you apply a pool, the extension auto-appends the device name as worker suffix. The URL field auto-strips <strong>stratum+tcp://</strong> and extracts the port.'},
  {illust:'🔒',title:'Ready to Go!',desc:'Your fleet is configured! Use 🔍 to scan anytime, ⚙ for device settings, 🌐 to open the device\'s local web UI. Happy mining!'},
];
let tutorialStep=0;
function showTutorial(){$('tutorialOverlay').classList.remove('hidden');tutorialStep=0;renderTutorialStep();}
function renderTutorialStep(){
  const s=TUTORIAL_STEPS[tutorialStep];
  $('tutIllust').textContent=s.illust;$('tutTitle').textContent=s.title;$('tutDesc').innerHTML=s.desc;
  $('tutDots').innerHTML=TUTORIAL_STEPS.map((_,i)=>`<div class="tutorial-dot${i===tutorialStep?' active':''}"></div>`).join('');
  $('tutNext').textContent=tutorialStep===TUTORIAL_STEPS.length-1?'Get Started':'Next';
  const ic=$('tutInteractive');if(!ic)return;ic.innerHTML='';
  if(s.interactive==='scan'){
    ic.innerHTML=`<div class="tut-scan-box">
      <div class="tut-row"><label>Subnet</label><input type="text" id="tutSubnet" placeholder="192.168.1" spellcheck="false" class="tut-input"><button id="tutScanBtn" class="btn-primary btn-sm">⟳ Scan</button></div>
      <div class="tut-row"><label>Or IP</label><input type="text" id="tutManualIp" placeholder="192.168.1.50" spellcheck="false" class="tut-input"><button id="tutAddIpBtn" class="btn-secondary btn-sm">+ Add</button></div>
      <div id="tutScanSpinner" class="tut-spinner" style="display:none"><span class="tut-spin-icon">⟳</span> Scanning network...</div>
      <div id="tutDeviceList" class="tut-device-list"></div>
      <div id="tutDeviceCount" class="tut-device-count">${devices.length} device(s) found</div>
    </div>`;
    if($('subnetInput').value)$('tutSubnet').value=$('subnetInput').value;
    function tutRenderDevList(){const dl=$('tutDeviceList');if(!dl)return;if(!devices.length){dl.innerHTML='<p class="tut-hint">No devices discovered yet.</p>';return;}dl.innerHTML='';devices.forEach(d=>{dl.innerHTML+=`<div class="tut-dev-row"><span class="tut-dev-icon">${D.type(d)==='nerdqaxe'?'🟦':'🟧'}</span><span class="tut-dev-name">${esc(D.name(d))}</span><span class="tut-dev-ip">${d._ip}</span></div>`;});}
    tutRenderDevList();
    $('tutScanBtn').addEventListener('click',async()=>{
      const sub=$('tutSubnet').value.trim();if(!sub)return;
      $('subnetInput').value=sub;$('tutScanBtn').disabled=true;$('tutScanBtn').textContent='Scanning...';
      const sp=$('tutScanSpinner');if(sp)sp.style.display='flex';
      await scanNetwork();
      if(sp)sp.style.display='none';
      $('tutScanBtn').disabled=false;$('tutScanBtn').textContent='⟳ Scan';
      $('tutDeviceCount').textContent=`${devices.length} device(s) found`;
      tutRenderDevList();
    });
    $('tutAddIpBtn').addEventListener('click',async()=>{
      const ipVal=$('tutManualIp').value.trim();if(!ipVal)return;
      $('manualIpInput').value=ipVal;await addManualDevice();
      $('tutManualIp').value='';$('tutDeviceCount').textContent=`${devices.length} device(s) found`;
      tutRenderDevList();
    });
  }
}
function nextTutorial(){if(tutorialStep<TUTORIAL_STEPS.length-1){tutorialStep++;renderTutorialStep();}else closeTutorial();}
function closeTutorial(){$('tutorialOverlay').classList.add('hidden');chrome.storage.local.set({tutorialDone:true});}

// ════════ RENDER ALL ════════
function renderAll(){renderOverview();renderDevices();renderPoolManager();renderLabelFilters();}
function renderLabelFilters(){const c=$('labelFilters');if(!c)return;const allLabels=new Map();Object.values(deviceLabels).forEach(labels=>labels.forEach(l=>{allLabels.set(l.text+':'+l.color,l);}));c.innerHTML='';allLabels.forEach(l=>{const btn=document.createElement('button');btn.className='filter-btn label-filter'+(selectedDeviceFilter===('label:'+l.text)?'active':'');btn.style.cssText=`border-color:${l.color}60;color:${l.color}`;btn.textContent=l.text;btn.addEventListener('click',()=>{const f='label:'+l.text;if(selectedDeviceFilter===f){selectedDeviceFilter='all';document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');}else{selectedDeviceFilter=f;document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}renderDevices();});c.appendChild(btn);});}

// ════════ EVENTS ════════
function initEvents(){
  // Scan popover
  $('tempUnitBtn').addEventListener('click',toggleTempUnit);
  $('fontScaleBtn').addEventListener('click',()=>{applyFontScale(fontScale>1?1:1.15);});
  $('scanPopoverBtn').addEventListener('click',e=>{e.stopPropagation();$('scanPopover').classList.toggle('open');});
  document.addEventListener('click',e=>{if(!e.target.closest('.scan-popover-wrap'))$('scanPopover').classList.remove('open');});
  $('scanBtn').addEventListener('click',scanNetwork);
  $('refreshBtn').addEventListener('click',refreshAllDevices);
  $('subnetInput').addEventListener('keypress',e=>{if(e.key==='Enter')scanNetwork();});
  $('addIpBtn').addEventListener('click',addManualDevice);
  $('manualIpInput').addEventListener('keypress',e=>{if(e.key==='Enter')addManualDevice();});
  document.querySelectorAll('.filter-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');selectedDeviceFilter=btn.dataset.filter;renderDevices();}));
  // Sort lock
  $('sortLockBtn').addEventListener('click',()=>{sortLocked=!sortLocked;updateLockBtn();saveSortPrefs();if(sortLocked){sortField='custom';$('sortSelect').value='custom';renderDevices();}});
  $('sortSelect').addEventListener('change',e=>{if(sortLocked){e.target.value='custom';return;}sortField=e.target.value;saveSortPrefs();renderDevices();});
  $('sortDirBtn').addEventListener('click',()=>{if(sortLocked)return;sortAsc=!sortAsc;$('sortDirBtn').textContent=sortAsc?'↑':'↓';saveSortPrefs();renderDevices();});
  $('poolPanelBtn').addEventListener('click',()=>togglePoolPanel(true));
  $('poolPanelClose').addEventListener('click',()=>togglePoolPanel(false));
  $('poolPanelOverlay').addEventListener('click',()=>togglePoolPanel(false));
  $('addPoolBtn').addEventListener('click',()=>openPoolModal());
  $('poolModalSave').addEventListener('click',savePool);
  // Smart URL parsing on blur
  $('poolURL').addEventListener('blur',()=>{const parsed=parseStratumUrl($('poolURL').value);$('poolURL').value=parsed.host;if(parsed.port&&!$('poolPort').value)$('poolPort').value=parsed.port;});
  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click',()=>ov.closest('.modal').classList.add('hidden')));
  document.querySelectorAll('#settingsModalBody .mtab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#settingsModalBody .mtab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('#settingsModalBody .mtab-content').forEach(c=>c.classList.remove('active'));btn.classList.add('active');$(btn.dataset.mtab).classList.add('active');}));
  $('sAutoFan').addEventListener('change',e=>{$('sManualFanRow').style.display=e.target.checked?'none':'flex';});
  $('sFanSlider').addEventListener('input',e=>{$('sFanVal').textContent=e.target.value+'%';});
  $('sPoolURL').addEventListener('blur',function(){const p=parseStratumUrl(this.value);this.value=p.host;if(p.port&&!$('sPoolPort').value)$('sPoolPort').value=p.port;});
  $('sFbPoolURL').addEventListener('blur',function(){const p=parseStratumUrl(this.value);this.value=p.host;if(p.port&&!$('sFbPoolPort').value)$('sFbPoolPort').value=p.port;});
  $('sFanSave').addEventListener('click',applyFanSettings);$('sMiningSave').addEventListener('click',applyMiningSettings);$('sPoolSave').addEventListener('click',applyPoolSettings);

  $('sIdentifyBtn').addEventListener('click',async()=>{if(!settingsDeviceIp)return;const dev=devices.find(d=>d._ip===settingsDeviceIp);log('action',`Identify <strong>${esc(D.name(dev))}</strong>`);await apiIdentify(settingsDeviceIp);});
  $('sRestartBtn').addEventListener('click',async()=>{if(!settingsDeviceIp)return;const dev=devices.find(d=>d._ip===settingsDeviceIp);if(!confirm(`Restart ${D.name(dev)}?`))return;log('action',`Restart <strong>${esc(D.name(dev))}</strong>`);const r=await apiRestart(settingsDeviceIp);if(r&&r.ok)log('success',`Restart → ${esc(D.name(dev))}`);else log('error',`Restart failed`);closeModal('settingsModal');});
  $('sRemoveBtn').addEventListener('click',()=>{if(!settingsDeviceIp)return;const dev=devices.find(d=>d._ip===settingsDeviceIp);if(!confirm(`Remove ${D.name(dev)}?`))return;devices=devices.filter(d=>d._ip!==settingsDeviceIp);saveDevices();expandedCards.delete(settingsDeviceIp);saveExpanded();delete deviceNicknames[settingsDeviceIp];saveNicknames();log('info',`Removed <strong>${esc(D.name(dev))}</strong>`);closeModal('settingsModal');renderAll();});
  $('applyCoinSelect').addEventListener('change',()=>{updatePoolSelects();updateApplyBtn();});
  $('applyPoolSelect').addEventListener('change',updateApplyBtn);
  $('applyFallbackSelect').addEventListener('change',updateApplyBtn);
  if($('applyFbCoinSelect'))$('applyFbCoinSelect').addEventListener('change',()=>{updateFallbackSelects();updateApplyBtn();});
  $('applyDeviceList').addEventListener('change',updateApplyBtn);
  $('applyPoolBtn').addEventListener('click',applyPoolToDevices);
  $('logFab').addEventListener('click',toggleLogWidget);
  $('logWidgetClose').addEventListener('click',()=>{logWidgetOpen=false;$('logWidget').classList.remove('open');});
  $('clearLogsBtn').addEventListener('click',()=>{if(confirm('Clear all logs?')){activityLogs=[];saveLogs();renderLogs();}});
  $('donateBtn').addEventListener('click',()=>{$('donateModal').classList.remove('hidden');$('donateModal').querySelectorAll('.donate-copy').forEach(btn=>btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.addr);btn.textContent='✅';setTimeout(()=>btn.textContent='📋',1500);}catch{btn.textContent='❌';}}));});
  $('tutNext').addEventListener('click',nextTutorial);$('tutSkip').addEventListener('click',closeTutorial);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));if(logWidgetOpen){logWidgetOpen=false;$('logWidget').classList.remove('open');}if(poolPanelOpen)togglePoolPanel(false);if(!$('tutorialOverlay').classList.contains('hidden'))closeTutorial();}});
  window.addEventListener('resize',()=>drawHashrateChart());
}

// ════════ INIT ════════
function startPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(()=>{if(devices.length)refreshAllDevices();},15000);}
async function init(){
  const state=await loadState();
  applyTheme(currentTheme);initThemes();applyFontScale(fontScale);$('tempUnitBtn').textContent=tempUnit==='C'?'°C':'°F';initEvents();initChartHover();initSortControls();
  populateCoinSelect('poolCoin');renderAll();renderLogs();startPolling();
  if(!$('subnetInput').value&&devices.length&&devices[0]._ip){const p=devices[0]._ip.split('.');if(p.length===4)$('subnetInput').value=p.slice(0,3).join('.');}
  if(devices.length)setTimeout(()=>refreshAllDevices(),1000);
  if(!state.tutorialDone)setTimeout(showTutorial,500);
  log('info','AxeOS Fleet Manager v1.0 started');
}
document.addEventListener('DOMContentLoaded',init);
