// ── Automatisk sikkerhetskopiering ───────────────────────────────────────
const LAST_EXPORT_KEY = 'kalkyleapp_last_autoexport';
let _interval = null;

export function initAutoExport(getStateFn, intervalMs) {
  stopAutoExport();
  if (!intervalMs || intervalMs <= 0) return;
  _interval = setInterval(() => runAutoExport(getStateFn), intervalMs);
  // Sjekk umiddelbart om det er på tide
  const last = getLastAutoExport();
  if (!last || Date.now() - last > intervalMs) {
    runAutoExport(getStateFn);
  }
}

export function stopAutoExport() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

export function setAutoExportInterval(getStateFn, minutes) {
  const ms = minutes > 0 ? minutes * 60 * 1000 : 0;
  initAutoExport(getStateFn, ms);
}

export function getLastAutoExport() {
  const ts = localStorage.getItem(LAST_EXPORT_KEY);
  return ts ? Number(ts) : null;
}

function runAutoExport(getStateFn) {
  try {
    const data = getStateFn();
    if (!data) return;
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Vis en toast-melding med nedlastingslenke i stedet for å tvinge nedlasting
    showExportToast(url, `kalkyleapp-auto-backup-${date}.json`);
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
  } catch (e) {
    console.log('Auto-export feilet:', e);
  }
}

function showExportToast(url, filename) {
  // Fjern gammel toast
  const old = document.getElementById('autoExportToast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'autoExportToast';
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1a2540;color:#fff;padding:14px 18px;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,.3);z-index:10000;font-size:13px;display:flex;align-items:center;gap:12px;max-width:400px';
  toast.innerHTML = `
    <div style="flex:1">
      <div style="font-weight:700;margin-bottom:4px">💾 Sikkerhetskopi klar</div>
      <a href="${url}" download="${filename}" style="color:#6ee7a0;text-decoration:underline;font-weight:600">Last ned ${filename}</a>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px">✕</button>`;
  document.body.appendChild(toast);

  // Fjern etter 30 sekunder
  setTimeout(() => toast.remove(), 30000);
}
