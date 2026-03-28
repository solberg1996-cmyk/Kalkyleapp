// ── State Management ─────────────────────────────────────────────────────
import { STORAGE_KEY, defaultSettings, defaultCompany, builtinTemplates } from './config.js';
import { uid } from './utils.js';
import { encryptCustomers, decryptCustomers } from './crypto.js';
import { isOnline, enqueue, flushQueue } from './sync-queue.js';
import { checkMigrationStatus, saveStructured, loadStructured } from './migration.js';

export let state;
let _syncTimeout = null;
let _sbRef = null;
let _sbUserRef = null;

// ── Backup-rotasjon (5 siste versjoner i localStorage) ──────────────────
const BACKUP_PREFIX = 'kalkyleapp_backup_';
const MAX_BACKUPS = 5;

function rotateBackups() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (!current) return;
    // Slett eldste, flytt resten opp
    localStorage.removeItem(BACKUP_PREFIX + MAX_BACKUPS);
    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      const data = localStorage.getItem(BACKUP_PREFIX + i);
      if (data) {
        localStorage.setItem(BACKUP_PREFIX + (i + 1), data);
      }
    }
    // Lagre nåværende som backup 1
    localStorage.setItem(BACKUP_PREFIX + '1', current);
  } catch (e) {
    console.log('Backup rotation:', e);
  }
}

export function getBackups() {
  const backups = [];
  for (let i = 1; i <= MAX_BACKUPS; i++) {
    try {
      const raw = localStorage.getItem(BACKUP_PREFIX + i);
      if (raw) {
        const data = JSON.parse(raw);
        backups.push({
          index: i,
          timestamp: data._lastModified || 0,
          date: data._lastModified ? new Date(data._lastModified).toLocaleString('nb-NO') : 'Ukjent',
          projectCount: (data.projects || []).length,
          customerCount: (data.customers || []).length
        });
      }
    } catch { /* skip */ }
  }
  return backups;
}

export function restoreBackup(index, renderFn) {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + index);
    if (!raw) return false;
    const data = JSON.parse(raw);
    applyStateData(data);
    saveState();
    if (renderFn) renderFn();
    return true;
  } catch { return false; }
}

// ── Supabase-referanser ─────────────────────────────────────────────────
export function setSbRef(sb, getUserFn) {
  _sbRef = sb;
  _sbUserRef = getUserFn;
}

// ── Felles state-merger ─────────────────────────────────────────────────
function applyStateData(p) {
  state.customers = p.customers || [];
  state.projects = p.projects || [];
  state.settings = { ...defaultSettings, ...(p.settings || {}) };
  state.priceCatalog = p.priceCatalog || [];
  state.priceFileName = p.priceFileName || '';
  state.favoriteCatalogIds = p.favoriteCatalogIds || [];
  state.recentCatalogIds = p.recentCatalogIds || [];
  state.userTemplates = p.userTemplates || [];
  state.calcRates = p.calcRates || {};
  state.company = { ...defaultCompany, ...(p.company || {}) };
  state._projectHistory = p._projectHistory || {};
  state.autoExportInterval = p.autoExportInterval || 0;
  // Migrer gammel subcontractor-felt
  (state.projects || []).forEach(pr => {
    if (pr.extras && pr.extras.subcontractor > 0 && !pr.extras.subcontractors) {
      pr.extras.subcontractors = [{ id: uid(), trade: 'Underentreprenør', amount: pr.extras.subcontractor }];
    }
    if (pr.extras) pr.extras.subcontractors = pr.extras.subcontractors || [];
  });
}

// ── Load / Save ─────────────────────────────────────────────────────────
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const s = {
        customers: p.customers || [],
        projects: p.projects || [],
        settings: { ...defaultSettings, ...(p.settings || {}) },
        priceCatalog: p.priceCatalog || [],
        priceFileName: p.priceFileName || '',
        favoriteCatalogIds: p.favoriteCatalogIds || [],
        recentCatalogIds: p.recentCatalogIds || [],
        userTemplates: p.userTemplates || [],
        calcRates: p.calcRates || {},
        company: { ...defaultCompany, ...(p.company || {}) },
        _lastModified: p._lastModified || 0,
        _projectHistory: p._projectHistory || {},
        autoExportInterval: p.autoExportInterval || 0
      };
      s.projects.forEach(pr => {
        if (pr.extras && pr.extras.subcontractor > 0 && !pr.extras.subcontractors) {
          pr.extras.subcontractors = [{ id: uid(), trade: 'Underentreprenør', amount: pr.extras.subcontractor }];
        }
        if (pr.extras) pr.extras.subcontractors = pr.extras.subcontractors || [];
      });
      return s;
    }
  } catch (e) { /* ignore */ }
  return {
    customers: [], projects: [], settings: { ...defaultSettings },
    priceCatalog: [], priceFileName: '', favoriteCatalogIds: [], recentCatalogIds: [],
    userTemplates: [], calcRates: {}, company: { ...defaultCompany },
    _lastModified: 0, _projectHistory: {}, autoExportInterval: 0
  };
}

state = loadState();

export function saveState() {
  rotateBackups();
  state._lastModified = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (_syncTimeout) clearTimeout(_syncTimeout);
  _syncTimeout = setTimeout(saveToCloud, 2000);
  const el = document.getElementById('syncIndicator');
  if (el) { el.textContent = '☁️ Lagrer...'; el.style.color = '#888'; }
}

// ── Cloud sync med kryptering og offline-kø ─────────────────────────────
export async function saveToCloud(overrideData) {
  const user = _sbUserRef ? _sbUserRef() : null;
  if (!user || !_sbRef) return;

  // Offline? Legg i kø
  if (!isOnline()) {
    enqueue(overrideData || state);
    updateSyncIndicator('offline');
    return;
  }

  try {
    const dataToSave = overrideData || state;
    // Krypter kundedata før sending
    const cloudData = { ...dataToSave };
    cloudData.customers = await encryptCustomers(dataToSave.customers, user.id);

    // Sjekk om vi kan bruke strukturert database
    const migrationStatus = await checkMigrationStatus(_sbRef, user.id);
    if (migrationStatus === 'v2') {
      await saveStructured(_sbRef, user.id, cloudData);
    }

    // Lagre alltid til JSON-blob (bakoverkompatibelt)
    await _sbRef.from('user_data').upsert(
      { user_id: user.id, data: cloudData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    updateSyncIndicator(true);

    // Tøm offline-kø hvis vi er online igjen
    await flushQueue(async (queuedData) => {
      const qd = { ...queuedData };
      qd.customers = await encryptCustomers(queuedData.customers, user.id);
      await _sbRef.from('user_data').upsert(
        { user_id: user.id, data: qd, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    });
  } catch (e) {
    console.log('Cloud save:', e);
    enqueue(overrideData || state);
    updateSyncIndicator(false);
  }
}

// ── Cloud load med konflikthåndtering ───────────────────────────────────
export async function loadFromCloud() {
  const user = _sbUserRef ? _sbUserRef() : null;
  if (!user || !_sbRef) return;
  try {
    const { data } = await _sbRef.from('user_data').select('data,updated_at').eq('user_id', user.id).single();
    if (data && data.data) {
      const cloudData = data.data;
      const cloudTs = data.updated_at ? new Date(data.updated_at).getTime() : 0;
      const localTs = state._lastModified || 0;

      // Konflikthåndtering: sammenlign tidsstempler
      if (localTs > cloudTs && state.projects.length > 0) {
        // Lokal data er nyere — push til sky i stedet
        console.log('Lokal data er nyere enn sky, pusher lokal versjon');
        await saveToCloud();
        return;
      }

      // Sky er nyere eller lik — bruk sky-data
      // Dekrypter kundedata
      cloudData.customers = await decryptCustomers(cloudData.customers, user.id);
      applyStateData(cloudData);
      state._lastModified = cloudTs || Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.log('Cloud load:', e);
  }
}

// ── Sync-indikator ──────────────────────────────────────────────────────
export function updateSyncIndicator(status) {
  const el = document.getElementById('syncIndicator');
  if (!el) return;
  if (status === 'offline') {
    el.textContent = '📴 Offline — lagret lokalt';
    el.style.color = '#f59e0b';
  } else if (status === true) {
    el.textContent = '☁️ Synkronisert';
    el.style.color = '#34c759';
  } else {
    el.textContent = '⚠️ Synkfeil';
    el.style.color = '#ff3b30';
  }
}

// ── Eksport / Import ────────────────────────────────────────────────────
export function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kalkyleapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importData(file, renderDashboardFn) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const p = JSON.parse(e.target.result);
      applyStateData(p);
      saveState();
      if (renderDashboardFn) renderDashboardFn();
      alert('Data importert.');
    } catch (err) {
      alert('Kunne ikke lese filen.');
    }
  };
  reader.readAsText(file);
}

// ── Hjelpefunksjoner ────────────────────────────────────────────────────
export function getCustomer(id) { return state.customers.find(c => c.id === id); }
export function getProject(id) { return state.projects.find(p => p.id === id); }

export function getAllTemplates() {
  return [...builtinTemplates, ...(state.userTemplates || [])];
}

export function blankProject() {
  return {
    id: uid(), name: '', customerId: '', address: '', type: 'Annet', startPref: 'Snarest', status: 'Utkast',
    description: '', note: '', settings: { ...state.settings },
    work: { people: 1, hours: 8, timeRate: state.settings.timeRate, internalCost: state.settings.internalCost, risk: 'Normal', actualHours: 0, laborHireHours: 0 },
    materials: [], extras: { rental: 0, waste: 0, subcontractors: [], laborHire: 0, rigPercent: 10, misc: 0, driftRate: 0, scaffolding: 0, drawings: 0 },
    offer: { included: 'Arbeid, standard materialer og rydding.', excluded: 'Skjulte feil og ekstraarbeid.', validity: '14 dager' },
    offerPosts: [], ui: { openSteps: [1, 2, 3, 4, 5, 6] }
  };
}
