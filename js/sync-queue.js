// ── Offline-kø og tilkoblingshåndtering ──────────────────────────────────
const QUEUE_KEY = 'kalkyleapp_sync_queue';

let _onStatusChange = null;

export function initOfflineDetection(callback) {
  _onStatusChange = callback;
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}

export function isOnline() {
  return navigator.onLine;
}

export function enqueue(payload) {
  const queue = getQueue();
  queue.push({ ts: Date.now(), data: JSON.parse(JSON.stringify(payload)) });
  // Behold maks 10 køelementer for å spare plass
  while (queue.length > 10) queue.shift();
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch { return []; }
}

export function getQueueLength() {
  return getQueue().length;
}

export async function flushQueue(saveFn) {
  const queue = getQueue();
  if (!queue.length) return;
  // Bare send den nyeste — eldre versjoner er utdaterte
  const latest = queue[queue.length - 1];
  try {
    await saveFn(latest.data);
    localStorage.removeItem(QUEUE_KEY);
  } catch (e) {
    console.log('Sync queue flush failed:', e);
  }
}
