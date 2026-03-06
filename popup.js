document.getElementById('o').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
});
chrome.storage.local.get(['devices'], r => {
  const d = r.devices || [];
  document.getElementById('dc').textContent = d.length;
  if (d.length > 0) {
    const t = d.reduce((s, x) => s + (x.hashRate || x.currentHashrate || 0), 0);
    document.getElementById('th').textContent = t.toFixed(1);
  }
});
