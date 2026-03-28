// ── Prosjektversjonering ─────────────────────────────────────────────────
import { state, saveState } from './state.js';

const MAX_SNAPSHOTS = 20;

export function captureSnapshot(project) {
  if (!project?.id) return;
  if (!state._projectHistory) state._projectHistory = {};
  if (!state._projectHistory[project.id]) state._projectHistory[project.id] = [];

  const history = state._projectHistory[project.id];
  // Unngå dupliserte snapshots tatt innen 30 sekunder
  const lastTs = history.length ? history[history.length - 1].ts : 0;
  if (Date.now() - lastTs < 30000) return;

  // Lag en kopi uten tunge felter
  const snapshot = JSON.parse(JSON.stringify(project));
  delete snapshot._projectHistory; // Unngå rekursjon

  history.push({ ts: Date.now(), data: snapshot });
  while (history.length > MAX_SNAPSHOTS) history.shift();
}

export function getHistory(projectId) {
  if (!state._projectHistory) return [];
  return (state._projectHistory[projectId] || []).map(h => ({
    timestamp: h.ts,
    date: new Date(h.ts).toLocaleString('nb-NO'),
    snapshot: h.data
  }));
}

export function rollbackProject(projectId, timestamp) {
  if (!state._projectHistory?.[projectId]) return false;
  const entry = state._projectHistory[projectId].find(h => h.ts === timestamp);
  if (!entry) return false;

  const idx = state.projects.findIndex(p => p.id === projectId);
  if (idx === -1) return false;

  // Ta snapshot av nåværende versjon før vi ruller tilbake
  captureSnapshot(state.projects[idx]);

  state.projects[idx] = JSON.parse(JSON.stringify(entry.data));
  state.projects[idx].updatedAt = Date.now();
  saveState();
  return true;
}

export function clearHistory(projectId) {
  if (state._projectHistory) delete state._projectHistory[projectId];
}
