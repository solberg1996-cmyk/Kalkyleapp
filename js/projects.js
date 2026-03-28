// ── Prosjekt-CRUD og navigering ───────────────────────────────────────────
import { state, saveState, getCustomer, getProject, blankProject } from './state.js';
import { uid, escapeHtml, $ } from './utils.js';
import { showModal, closeModal } from './modals.js';

export let currentProjectId = null;

export function setCurrentProjectId(id) { currentProjectId = id; }

export function openProjectModal(renderDashboardFn, openProjectFn) {
  const p = blankProject();
  const opts = ['<option value="">Velg kunde</option>'].concat(
    state.customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
  ).join('');
  showModal(`
    <div class="section-head"><div class="section-title">Nytt prosjekt</div><button class="btn small secondary" onclick="closeModal()">Lukk</button></div>
    <div class="row">
      <div><label>Prosjektnavn</label><input id="mPN" /></div>
      <div><label>Kunde</label><select id="mPC">${opts}</select></div>
    </div>
    <div class="row">
      <div><label>Adresse</label><input id="mPA" /></div>
      <div><label>Type jobb</label><select id="mPT"><option>Terrasse</option><option>Lettvegg</option><option>Vindu</option><option>Listing</option><option>Kledning</option><option>Etterisolering</option><option>Rehabilitering</option><option>Bad</option><option>Tak</option><option>Annet</option></select></div>
    </div>
    <div class="row">
      <div><label>Ønsket oppstart</label><select id="mPS"><option>Snarest</option><option>Innen 2 uker</option><option>Innen 1 måned</option><option>Etter avtale</option></select></div>
      <div><label>Status</label><select id="mPSt"><option>Utkast</option><option>Sendt</option><option>Vunnet</option><option>Tapt</option><option>Pågår</option><option>Ferdig</option></select></div>
    </div>
    <label>Beskrivelse</label><textarea id="mPD"></textarea>
    <div class="toolbar" style="margin-top:14px"><button class="btn primary" id="saveProjBtn">Opprett prosjekt</button></div>
  `);
  $('#mPC').addEventListener('change', () => {
    const cu = getCustomer($('#mPC').value);
    if ($('#mPA') && cu) $('#mPA').value = cu.address || '';
  });
  $('#saveProjBtn').onclick = () => {
    p.name = $('#mPN').value.trim();
    p.customerId = $('#mPC').value;
    p.address = $('#mPA').value.trim();
    if (!p.address && p.customerId) { const cu = getCustomer(p.customerId); if (cu) p.address = cu.address || ''; }
    p.type = $('#mPT').value;
    p.startPref = $('#mPS').value;
    p.status = $('#mPSt').value;
    p.description = $('#mPD').value.trim();
    if (!p.name) { alert('Skriv inn prosjektnavn.'); return; }
    p.updatedAt = Date.now();
    state.projects.unshift(p);
    saveState();
    closeModal();
    if (renderDashboardFn) renderDashboardFn();
    if (openProjectFn) openProjectFn(p.id);
  };
}

export function openProject(id, renderProjectViewFn) {
  currentProjectId = id;
  const p = getProject(id);
  if (!p) return;
  $('#dashboardView').classList.add('hidden');
  $('#projectView').classList.remove('hidden');
  if (renderProjectViewFn) renderProjectViewFn();
}

export function openDashboard(renderDashboardFn) {
  currentProjectId = null;
  $('#projectView').classList.add('hidden');
  $('#dashboardView').classList.remove('hidden');
  if (renderDashboardFn) renderDashboardFn();
}

export function deleteCurrentProject(renderDashboardFn) {
  if (!confirm('Slette prosjektet?')) return;
  state.projects = state.projects.filter(p => p.id !== currentProjectId);
  saveState();
  openDashboard(renderDashboardFn);
}
