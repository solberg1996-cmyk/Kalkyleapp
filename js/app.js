// ── KalkyleApp — Hovedinngang ─────────────────────────────────────────────
// Importerer alle moduler og kobler dem sammen

import { $, uid, currency, percent, safe, escapeHtml, escapeAttr, sel, vatFactor, displayVatValue, parseVatInput, parseNbNumber } from './utils.js';
import { STORAGE_KEY, defaultSettings, defaultCompany, builtinTemplates, addOnPackages } from './config.js';
import { state, saveState, getCustomer, getProject, getAllTemplates, blankProject, exportData, importData, loadFromCloud, getBackups, restoreBackup, saveToCloud, updateSyncIndicator } from './state.js';
import { initOfflineDetection, flushQueue } from './sync-queue.js';
import { captureSnapshot, getHistory, rollbackProject } from './project-history.js';
import { initAutoExport, setAutoExportInterval } from './auto-export.js';
import { _sb, _sbUser, initAuth, doLogin, doSignup, showSignup, showLogin } from './auth.js';
import { compute, computeOfferPostsTotal } from './compute.js';
import { lookupPriceForMaterial, parsePriceCsv, importPriceFile, clearPriceCatalog as clearPriceCatalogFn, searchPriceCatalog, getCatalogItem, getFavoriteCatalogItems, getRecentCatalogItems, isFavoriteCatalog, toggleFavoriteCatalog as toggleFavoriteCatalogFn, rememberRecentCatalog, renderPriceSearchResults, renderQuickCatalogButtons } from './price-catalog.js';
import { showModal, closeModal, backdropClose } from './modals.js';
import { openCustomerModal, editCustomer as editCustomerFn, deleteCustomer as deleteCustomerFn } from './customers.js';
import { currentProjectId, setCurrentProjectId, openProjectModal, openProject as openProjectFn, openDashboard, deleteCurrentProject } from './projects.js';
import { renderDashboard } from './dashboard.js';
import { openSettings, updateColorPreview, setColor, showLogoPreview, removeLogo, saveSettings, initLogoUpload } from './settings.js';
import { difficultyFactors, calcDefaults, getCalcRate, calcDefs, saveCalcRate as saveCalcRateFn } from './calculator.js';
import { renderTabInfo } from './tab-info.js';
import { renderTabWork } from './tab-work.js';
import { renderTabMaterials } from './tab-materials.js';
import { renderTabOffer, renderOfferPosts } from './tab-offer.js';
import { renderTabPreview, initOfferPreviewTab, renderOfferEditorPane } from './tab-preview.js';
import { _offerState, getOfferCSS, getExtraPosts, rebuildExtraPosts, renderOfferPreview as renderOfferPreviewFn, openOfferFullPreview as openOfferFullPreviewFn, downloadOfferPDF as downloadOfferPDFFn, sendOfferNow as sendOfferNowFn, openAndSendOffer as openAndSendOfferFn } from './offer-preview.js';

// ── Lokal state ──────────────────────────────────────────────────────────
let currentTab = 'info';

// ── Prosjektvisning ──────────────────────────────────────────────────────
function renderProjectView() {
  const p = getProject(currentProjectId);
  if (!p) return;
  const cust = getCustomer(p.customerId);
  $('#projectTitle').textContent = p.name || 'Prosjekt';
  $('#projectSubtitle').textContent = `${cust?.name || 'Ingen kunde valgt'} • ${p.type} • ${p.address || 'Ingen adresse'}`;
  $('#toggleEx').classList.toggle('active', p.settings.vatMode === 'ex');
  $('#toggleInc').classList.toggle('active', p.settings.vatMode === 'inc');
  $('#projectTopPills').innerHTML = `
    <span class="pill status-${p.status}">${p.status}</span>
    <span class="pill">Oppstart: ${escapeHtml(p.startPref)}</span>
    <span class="pill">Kunde: ${escapeHtml(cust?.name || 'Ingen')}</span>`;

  const tabs = [
    { id: 'info', label: '📋 Info' },
    { id: 'work', label: '🔨 Arbeid og kostnader' },
    { id: 'materials', label: '🪵 Utregning og materialer' },
    { id: 'offer', label: '📄 Tilbud' },
    { id: 'preview', label: '📑 Tilbudsvisning' },
  ];
  const tabBar = `<div class="tab-bar">${tabs.map(t => `<button class="tab-btn ${currentTab === t.id ? 'active' : ''}" onclick="switchTab('${t.id}')">${t.label}</button>`).join('')}</div>`;

  let panel = '';
  if (currentTab === 'info') panel = renderTabInfo(p);
  if (currentTab === 'work') panel = renderTabWork(p);
  if (currentTab === 'materials') panel = renderTabMaterials(p);
  if (currentTab === 'offer') panel = renderTabOffer(p);
  if (currentTab === 'preview') {
    $('#stepsContainer').innerHTML = tabBar + '<div class="tab-panel" style="padding:0">' + renderTabPreview(p) + '</div>';
    bindProjectEvents();
    initOfferPreviewTab(p, currentProjectId);
    return;
  }

  $('#stepsContainer').innerHTML = tabBar + `<div class="tab-panel">${panel}</div>`;
  bindProjectEvents();
  updateSummary();
}

function switchTab(id) { currentTab = (id === 'costs' ? 'work' : id); renderProjectView(); }

// ── Binding av prosjekt-events ───────────────────────────────────────────
function bindVal(sel, fn) { const el = $(sel); if (el) el.addEventListener('input', () => { fn(el.value); persistAndUpdate(); }); }
function bindNum(sel, fn) { const el = $(sel); if (el) el.addEventListener('input', () => { fn(Number(el.value) || 0); persistAndUpdate(); }); }
function bindNumVat(sel, fn) { const el = $(sel); if (el) el.addEventListener('input', () => { fn(parseVatInput(getProject(currentProjectId), el.value)); persistAndUpdate(); }); }

function persistAndUpdate() {
  const p = getProject(currentProjectId);
  if (!p) return;
  p.updatedAt = Date.now();
  saveState();
  updateSummary();
}

function persistAndRenderProject() {
  const p = getProject(currentProjectId);
  if (!p) return;
  captureSnapshot(p);
  p.updatedAt = Date.now();
  saveState();
  renderProjectView();
  renderDashboard();
}

function bindProjectEvents() {
  const p = getProject(currentProjectId);
  if (!p) return;
  bindVal('#fName', v => p.name = v);
  bindVal('#fCustomer', v => { p.customerId = v; const cu = getCustomer(v); p.address = cu ? (cu.address || '') : ''; const el = $('#fAddress'); if (el) el.value = p.address; });
  bindVal('#fAddress', v => p.address = v);
  bindVal('#fType', v => p.type = v);
  bindVal('#fStart', v => p.startPref = v);
  bindVal('#fStatus', v => p.status = v);
  bindVal('#fDescription', v => p.description = v);
  bindVal('#fNote', v => p.note = v);
  const sT = $('#sTimeRate');
  if (sT) sT.addEventListener('input', () => { p.settings.timeRate = parseVatInput(p, sT.value); p.work.timeRate = p.settings.timeRate; const l = $('#wTimeRate'); if (l && document.activeElement !== l) l.value = displayVatValue(p, p.work.timeRate); persistAndUpdate(); });
  const sI = $('#sInternalCost');
  if (sI) sI.addEventListener('input', () => { p.settings.internalCost = Number(sI.value) || 0; p.work.internalCost = p.settings.internalCost; const l = $('#wInternalCost'); if (l && document.activeElement !== l) l.value = p.work.internalCost; persistAndUpdate(); });
  const sD = $('#sDriveCost');
  if (sD) sD.addEventListener('input', () => { p.settings.driveCost = parseVatInput(p, sD.value); p.extras.driveCost = p.settings.driveCost; const l = $('#eDrive'); if (l && document.activeElement !== l) l.value = displayVatValue(p, p.extras.driveCost); persistAndUpdate(); });
  bindNum('#wActualHours', v => p.work.actualHours = v);
  bindNum('#wLaborHireHours', v => p.work.laborHireHours = v);
  bindNumVat('#wLaborHireRate', v => p.extras.laborHire = v);
  bindNumVat('#wTimeRate', v => p.work.timeRate = v);
  bindNum('#wInternalCost', v => p.work.internalCost = v);
  bindVal('#wRisk', v => p.work.risk = v);
  bindNum('#eDriftRate', v => p.extras.driftRate = v);
  bindNumVat('#eRental', v => p.extras.rental = v);
  bindNumVat('#eWaste', v => p.extras.waste = v);
  bindNumVat('#eScaffolding', v => p.extras.scaffolding = v);
  bindNumVat('#eDrawings', v => p.extras.drawings = v);
  bindNum('#eRig', v => p.extras.rigPercent = v);
  bindNum('#wMatMarkup', v => p.settings.materialMarkup = v);
  bindNumVat('#eMisc', v => p.extras.misc = v);
  bindVal('#oValidity', v => p.offer.validity = v);
  const pfi = $('#priceFileInput');
  if (pfi) { pfi.addEventListener('change', e => { const f = e.target.files[0]; if (f) importPriceFile(f, renderProjectView); e.target.value = ''; }, { once: true }); }
  const psi = $('#priceSearchInput');
  if (psi) { psi.addEventListener('input', () => renderPriceSearchResults(psi.value)); }
}

function updateSummary() {
  const p = getProject(currentProjectId);
  if (!p) return;
  const c = compute(p), ps = computeOfferPostsTotal(p);
  const vatM = p.settings.vatMode === 'inc';
  const laborEl = document.getElementById('summaryLaborVal');
  if (laborEl) laborEl.textContent = currency(vatM ? c.totalLaborSaleEx * 1.25 : c.totalLaborSaleEx);
  const totalDisplayHours = (c.hoursTotal || 0) + (ps.hours || 0);
  const hoursEl = document.getElementById('summaryLaborHours');
  if (hoursEl) hoursEl.textContent = totalDisplayHours + 't totalt';
  const ohd = document.getElementById('offerTotalHoursDisplay');
  if (ohd) ohd.textContent = totalDisplayHours + 't';
  const oht = document.getElementById('offerTotalHoursText');
  if (oht) oht.textContent = totalDisplayHours + 't';
  const ohDetail = document.getElementById('offerTotalHoursDetail');
  if (ohDetail) {
    const parts = [];
    if (c.hoursTotal > 0) parts.push(c.hoursTotal + 't fra arbeid');
    if (ps.hours > 0) parts.push(ps.hours + 't fra poster');
    ohDetail.textContent = parts.join(' + ');
  }
  const ohInput = document.getElementById('offerTotalHours');
  if (ohInput) ohInput.placeholder = (c.totalHours || 0) + '';
  const modeEl = $('#summaryModeNote');
  if (modeEl) modeEl.textContent = (p.offerPosts && p.offerPosts.length) ? 'Viser sum av tilbudsposter' : (p.settings.vatMode === 'inc' ? 'Viser inkl. mva' : 'Viser eks. mva');
}

// ── Material-operasjoner ─────────────────────────────────────────────────
function addMaterial() {
  const p = getProject(currentProjectId);
  if (!p) return;
  p.materials.push({ id: uid(), name: 'Nytt materiale', qty: 1, unit: 'stk', cost: 0, waste: 0, markup: p.settings.materialMarkup });
  persistAndRenderProject();
}

function updMaterial(id, key, value) {
  const p = getProject(currentProjectId);
  if (!p) return;
  const m = p.materials.find(x => x.id === id);
  if (!m) return;
  m[key] = ['qty', 'cost', 'waste', 'markup'].includes(key) ? (Number(value) || 0) : value;
  persistAndUpdate();
}

function removeMaterial(id) {
  const p = getProject(currentProjectId);
  if (!p) return;
  p.materials = p.materials.filter(m => m.id !== id);
  persistAndRenderProject();
}

function addPackage(idx) {
  const p = getProject(currentProjectId);
  if (!p) return;
  addOnPackages[idx].items.forEach(item => {
    p.materials.push({ ...item, id: uid(), cost: lookupPriceForMaterial(item.name) || 0 });
  });
  persistAndRenderProject();
}

function setAllMarkup(v) {
  const p = getProject(currentProjectId);
  if (!p) return;
  p.materials = p.materials.map(m => ({ ...m, markup: v }));
  persistAndRenderProject();
}

function setAllWaste(v) {
  const p = getProject(currentProjectId);
  if (!p) return;
  p.materials = p.materials.map(m => ({ ...m, waste: v }));
  persistAndRenderProject();
}

function duplicateLastMaterial() {
  const p = getProject(currentProjectId);
  if (!p || !p.materials.length) return;
  const last = p.materials[p.materials.length - 1];
  p.materials.push({ ...last, id: uid(), name: last.name + ' kopi' });
  persistAndRenderProject();
}

function addCatalogMaterial(id) {
  const p = getProject(currentProjectId);
  if (!p) return;
  const item = getCatalogItem(id);
  if (!item) return;
  p.materials.push({ id: uid(), name: item.name, qty: 1, unit: item.unit || 'stk', cost: item.userPrice || 0, waste: 0, markup: p.settings.materialMarkup, itemNo: item.itemNo || '', regularPrice: item.regularPrice || 0, discountPercent: item.discountPercent || 0 });
  rememberRecentCatalog(id);
  persistAndRenderProject();
  const s = $('#priceSearchInput');
  if (s) s.value = '';
  renderPriceSearchResults('');
}

// ── Maler ────────────────────────────────────────────────────────────────
function applyTemplateById(tplId) {
  const p = getProject(currentProjectId);
  if (!p) return;
  const tpl = getAllTemplates().find(t => t.id === tplId);
  if (!tpl) return;
  const newMats = tpl.materials.map(m => {
    let cost = 0;
    if (m.itemNo && state.priceCatalog.length) {
      const byItemNo = state.priceCatalog.find(x => String(x.itemNo) === String(m.itemNo));
      cost = byItemNo ? (byItemNo.userPrice || 0) : lookupPriceForMaterial(m.name);
    } else if (m.cost) { cost = m.cost; } else { cost = lookupPriceForMaterial(m.name); }
    return { id: uid(), name: m.name, itemNo: m.itemNo || '', qty: m.qty || 1, unit: m.unit || 'stk', cost, waste: m.waste || 0, markup: p.settings.materialMarkup };
  });
  p.materials = [...p.materials, ...newMats];
  const matched = newMats.filter(m => m.cost > 0).length;
  persistAndRenderProject();
  if (matched < newMats.length && state.priceCatalog.length) {
    alert(`Mal "${tpl.name}" lagt til.\n${matched} av ${newMats.length} materialer fikk pris.\nSjekk oransje felt og fyll inn manglende priser.`);
  }
}

function openTemplateModal(existing) {
  const tpl = existing ? { ...existing, materials: existing.materials.map(m => ({ ...m })) } : { id: uid(), name: '', builtIn: false, materials: [] };
  window._editingTpl = tpl;
  function rows() {
    if (!tpl.materials.length) return '<div class="empty" style="padding:14px">Ingen materialer lagt til enda. Søk opp varer nedenfor.</div>';
    return tpl.materials.map((m, i) => `
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-bottom:8px;align-items:center;padding:10px;background:#f8faff;border:1px solid var(--line);border-radius:12px">
        <div>
          <div style="font-weight:700;font-size:14px">${escapeHtml(m.name)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${m.itemNo ? `Varenr: ${escapeHtml(m.itemNo)} • ` : ''}${escapeHtml(m.unit || 'stk')}${m.cost ? ` • ${currency(m.cost)}` : '  • Pris fra prisfil ved bruk'}</div>
        </div>
        <input type="number" value="${m.waste || 0}" placeholder="Svinn%" title="Svinn %" style="width:70px;padding:8px;font-size:13px;text-align:center" oninput="window._editingTpl.materials[${i}].waste=Number(this.value)" />
        <button class="btn small danger" onclick="tplRemoveRow(${i})" style="padding:8px">✕</button>
      </div>`).join('');
  }
  function searchRows(q) {
    const results = searchPriceCatalog(q);
    const host = document.getElementById('tplSearchResults');
    if (!host) return;
    if (!q.trim()) { host.innerHTML = ''; return; }
    if (!state.priceCatalog.length) { host.innerHTML = '<div class="empty">Last opp prisfil for å søke.</div>'; return; }
    if (!results.length) { host.innerHTML = '<div class="empty">Ingen treff.</div>'; return; }
    host.innerHTML = results.map(item => `
      <div class="item" style="padding:10px">
        <div>
          <div style="font-weight:700;font-size:13px">${escapeHtml(item.productName || item.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${escapeHtml(item.itemNo || '')} • ${escapeHtml(item.unit || '-')} • ${currency(item.userPrice || 0)}</div>
        </div>
        <button class="btn small primary" onclick="tplAddFromCatalog('${escapeHtml(item.id)}')">+ Legg til</button>
      </div>`).join('');
  }
  showModal(`
    <div class="section-head"><div class="section-title">${existing ? 'Rediger mal' : 'Ny mal'}</div><button class="btn small secondary" onclick="closeModal()">Lukk</button></div>
    <label>Malnavn</label><input id="tplNameInput" value="${escapeAttr(tpl.name)}" placeholder="F.eks. Bad komplett" />
    <div style="margin-top:16px;padding:14px;background:#f0f7ff;border:1px solid #cde2ff;border-radius:14px">
      <label style="margin:0 0 8px">🔍 Søk i prisfil og legg til materialer</label>
      <input id="tplSearchInput" placeholder="Søk varenummer eller navn..." />
      <div id="tplSearchResults" class="list" style="margin-top:10px;max-height:220px;overflow-y:auto"></div>
    </div>
    <div style="margin-top:14px"><div style="font-weight:800;font-size:14px;margin-bottom:8px">Materialer i malen</div><div id="tplRowsContainer">${rows()}</div></div>
    <div class="toolbar" style="margin-top:16px">
      <button class="btn primary" id="saveTplBtn">Lagre mal</button>
      ${existing && !existing.builtIn ? `<button class="btn danger" onclick="deleteUserTemplate('${tpl.id}')">Slett mal</button>` : ''}
    </div>
  `);
  document.getElementById('tplSearchInput').addEventListener('input', e => searchRows(e.target.value));
  window.tplAddFromCatalog = (itemId) => {
    const item = getCatalogItem(itemId); if (!item) return;
    window._editingTpl.materials.push({ id: uid(), name: item.productName || item.name, itemNo: item.itemNo || '', unit: item.unit || 'stk', cost: item.userPrice || 0, waste: 0 });
    document.getElementById('tplRowsContainer').innerHTML = rows();
    const si = document.getElementById('tplSearchInput');
    if (si) { si.value = ''; document.getElementById('tplSearchResults').innerHTML = ''; }
  };
  window.tplRemoveRow = (i) => { window._editingTpl.materials.splice(i, 1); document.getElementById('tplRowsContainer').innerHTML = rows(); };
  $('#saveTplBtn').onclick = () => {
    const name = $('#tplNameInput').value.trim();
    if (!name) { alert('Skriv inn malnavn.'); return; }
    window._editingTpl.name = name;
    if (!window._editingTpl.materials.length) { alert('Legg til minst ett materiale.'); return; }
    state.userTemplates = state.userTemplates || [];
    const idx = state.userTemplates.findIndex(t => t.id === window._editingTpl.id);
    if (idx > -1) state.userTemplates[idx] = window._editingTpl; else state.userTemplates.push(window._editingTpl);
    saveState(); closeModal(); renderProjectView();
  };
}

function deleteUserTemplate(id) {
  if (!confirm('Slette denne malen?')) return;
  state.userTemplates = (state.userTemplates || []).filter(t => t.id !== id);
  saveState(); closeModal(); renderProjectView();
}

function copyBuiltinTemplate(tplId) {
  const tpl = builtinTemplates.find(t => t.id === tplId); if (!tpl) return;
  const copy = { id: uid(), name: tpl.name + ' (min)', builtIn: false, materials: tpl.materials.map(m => ({ id: uid(), name: m.name, itemNo: '', unit: m.unit || 'stk', cost: 0, waste: m.waste || 0 })) };
  openTemplateModal(copy);
}

// ── Underentreprenører ───────────────────────────────────────────────────
function addSubcontractor() {
  const p = getProject(currentProjectId); if (!p) return;
  p.extras.subcontractors = p.extras.subcontractors || [];
  p.extras.subcontractors.push({ id: uid(), trade: 'Rørlegger', amount: 0 });
  persistAndRenderProject();
}
function removeSubcontractor(id) {
  const p = getProject(currentProjectId); if (!p) return;
  p.extras.subcontractors = (p.extras.subcontractors || []).filter(s => s.id !== id);
  persistAndRenderProject();
}
function updSubcontractor(id, key, val) {
  const p = getProject(currentProjectId); if (!p) return;
  const s = (p.extras.subcontractors || []).find(x => x.id === id); if (!s) return;
  s[key] = key === 'amount' ? (parseVatInput(p, val)) : val;
  persistAndUpdate();
}

// ── Tilbudsposter ────────────────────────────────────────────────────────
function addOfferPost() {
  const p = getProject(currentProjectId); if (!p) return;
  if (!p.offerPosts) p.offerPosts = [];
  p.offerPosts.push({ id: uid(), name: 'Ny post', description: '', type: 'fast', price: 0, enabled: true });
  persistAndRenderProject();
}

function addCalcPost(customName) {
  const p = getProject(currentProjectId); if (!p) return;
  const c = compute(p); if (!p.offerPosts) p.offerPosts = [];
  const totalPrice = p.settings.vatMode === 'inc' ? c.saleInc : c.saleEx;
  const snapshotMats = p.materials.map(m => ({ ...m }));
  p.offerPosts.push({
    id: uid(), name: customName || (p.name || 'Kalkyle'), description: `${c.hoursTotal} timer + materialer`,
    type: 'calc', price: Math.round(totalPrice), enabled: true, snapshotMaterials: snapshotMats,
    snapshotCompute: { hoursTotal: c.hoursTotal, laborSaleEx: c.laborSaleEx, matSaleEx: c.matSaleEx, matCost: c.matCost, laborCost: c.laborCost, costPrice: c.costPrice, saleEx: c.saleEx, saleInc: c.saleInc, profit: c.profit, margin: c.margin }
  });
  p.materials = [];
  p.work.hours = 0;
  persistAndRenderProject();
}

function updatePost(id, key, val) {
  const p = getProject(currentProjectId); if (!p || !p.offerPosts) return;
  const post = p.offerPosts.find(x => x.id === id); if (!post) return;
  post[key] = key === 'price' ? (Number(val) || 0) : val;
  persistAndUpdate();
}
function togglePost(id, val) { const p = getProject(currentProjectId); if (!p || !p.offerPosts) return; const post = p.offerPosts.find(x => x.id === id); if (!post) return; post.enabled = !!val; persistAndUpdate(); }
function removePost(id) { const p = getProject(currentProjectId); if (!p || !p.offerPosts) return; p.offerPosts = p.offerPosts.filter(x => x.id !== id); persistAndRenderProject(); }
function movePost(id, dir) { const p = getProject(currentProjectId); if (!p || !p.offerPosts) return; const idx = p.offerPosts.findIndex(x => x.id === id); if (idx < 0) return; const ni = idx + dir; if (ni < 0 || ni >= p.offerPosts.length) return; [p.offerPosts[idx], p.offerPosts[ni]] = [p.offerPosts[ni], p.offerPosts[idx]]; persistAndRenderProject(); }
function toggleOfferPost(id) {
  const p = getProject(currentProjectId); if (!p || !p.offerPosts) return;
  const post = p.offerPosts.find(x => x.id === id); if (!post) return;
  post._open = (post._open === false) ? true : false;
  persistAndRenderProject();
}

// ── Kalkylator-widget ────────────────────────────────────────────────────
function toggleCalcWidget() { const el = document.getElementById('calcWidget'); if (el) el.classList.toggle('hidden'); }
function toggleMalerSection() {
  const el = document.getElementById('malerContent');
  const icon = document.getElementById('malerToggleIcon');
  if (!el) return;
  const hidden = el.style.display === 'none';
  el.style.display = hidden ? '' : 'none';
  if (icon) icon.textContent = hidden ? '▼' : '▶';
}

function updateCalcWidget() {
  const type = document.getElementById('calcJobType')?.value;
  const def = calcDefs[type];
  const inputsEl = document.getElementById('calcInputs');
  const resultsEl = document.getElementById('calcResults');
  if (!inputsEl || !resultsEl) return;
  if (!def) { inputsEl.innerHTML = ''; resultsEl.innerHTML = ''; return; }
  inputsEl.innerHTML = `
    <div style="margin-bottom:12px">
      <label>Vanskelighetsgrad</label>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${Object.entries(difficultyFactors).map(([k, d]) => `
          <button class="package-btn ${k === 'normal' ? 'user-template' : ''}" id="diffBtn_${k}"
            onclick="selectDifficulty('${k}')"
            style="padding:10px;text-align:center;${k === 'normal' ? 'border-color:#0a84ff;background:#eaf3ff' : ''}">
            <div style="font-size:13px;font-weight:800">${d.label}</div>
            <div style="font-size:11px;color:var(--muted);font-weight:500;margin-top:2px">${d.desc}</div>
            <div style="font-size:11px;font-weight:700;margin-top:2px;color:var(--blue)">×${d.factor}</div>
          </button>`).join('')}
      </div>
    </div>
    ${def.materialOptions && def.materialOptions.length ? `
    <div class="row-3" style="margin-bottom:12px">
      ${def.materialOptions.map(opt => `
        <div><label>${opt.label}</label>
          <select id="calcMat_${opt.id}" onchange="runCalcWidget()" style="padding:10px 12px">
            ${opt.options.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select></div>`).join('')}
    </div>` : ''}
    <div class="row-3" style="margin-bottom:12px">
      ${def.inputs.map(inp => `
        <div><label>${inp.label}</label>
          <input type="number" id="calcInput_${inp.id}" value="${inp.default}" oninput="runCalcWidget()" /></div>`).join('')}
    </div>`;
  window._calcDifficulty = 'normal';
  runCalcWidget();
}

function selectDifficulty(key) {
  window._calcDifficulty = key;
  Object.keys(difficultyFactors).forEach(k => {
    const btn = document.getElementById('diffBtn_' + k);
    if (!btn) return;
    btn.style.borderColor = k === key ? '#0a84ff' : '';
    btn.style.background = k === key ? '#eaf3ff' : '';
  });
  runCalcWidget();
}

function runCalcWidget() {
  const type = document.getElementById('calcJobType')?.value;
  const def = calcDefs[type];
  const resultsEl = document.getElementById('calcResults');
  if (!def || !resultsEl) return;
  const vals = {};
  def.inputs.forEach(inp => { vals[inp.id] = parseFloat(document.getElementById('calcInput_' + inp.id)?.value) || inp.default; });
  const mats = {};
  (def.materialOptions || []).forEach(opt => { const el = document.getElementById('calcMat_' + opt.id); if (el) mats[opt.id] = el.value; });
  const diff = window._calcDifficulty || 'normal';
  const diffFactor = difficultyFactors[diff]?.factor || 1;
  let result;
  try { result = def.calc(vals, mats); } catch (e) { console.error(e); return; }
  const adjustedTimer = Math.round(result.timer * diffFactor);
  const diffLabel = difficultyFactors[diff]?.label || 'Normal';
  window._lastCalcResult = { ...result, timer: adjustedTimer };
  resultsEl.innerHTML = `
    <div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin-top:4px">
      <div style="font-weight:800;font-size:14px;margin-bottom:4px">📊 Estimat — ${def.label} — ${result.areal}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${result.info || ''} • Vanskelighetsgrad: ${diffLabel} (×${diffFactor})</div>
      <table style="margin-bottom:12px">
        <thead><tr><th>Materiale</th><th>Mengde</th><th>Enhet</th><th>Svinn</th></tr></thead>
        <tbody>${result.materialer.map(m => `<tr><td>${escapeHtml(m.name)}</td><td style="font-weight:700">${m.qty}</td><td>${m.unit}</td><td>${m.waste}%</td></tr>`).join('')}</tbody>
      </table>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f0f7ff;border-radius:12px;margin-bottom:12px">
        <div><div style="font-size:13px;font-weight:700;color:var(--muted)">⏱️ Estimert timebruk</div>
          ${diffFactor !== 1 ? `<div style="font-size:11px;color:var(--muted)">Basis: ${result.timer}t × ${diffFactor} = ${adjustedTimer}t</div>` : ''}</div>
        <div style="font-size:24px;font-weight:800;color:var(--blue)">${adjustedTimer} timer</div>
      </div>
      <button class="btn primary" onclick="doAddCalcResult()">+ Legg til i prosjekt</button>
    </div>`;
}

function doAddCalcResult() { if (window._lastCalcResult) addCalcResultToProject(window._lastCalcResult); }

function addCalcResultToProject(result) {
  const p = getProject(currentProjectId); if (!p) return;
  const newMats = result.materialer.map(m => ({ id: uid(), name: m.name, qty: m.qty, unit: m.unit, cost: lookupPriceForMaterial(m.name) || 0, waste: m.waste, markup: p.settings.materialMarkup }));
  p.materials.push(...newMats);
  p.work.hours = Math.round(result.timer / Math.max(Number(p.work.people) || 1, 1));
  persistAndRenderProject();
  document.getElementById('calcWidget')?.classList.add('hidden');
  const missing = newMats.filter(m => m.cost === 0);
  if (missing.length) openCalcPriceLookupModal(missing, p);
}

// ── Calc modal (tilbudspost redigering) ──────────────────────────────────
function renderCalcModal() {
  const p = getProject(currentProjectId);
  const mats = window._cpm || [];
  function matTotal() { return mats.reduce((s, m) => { const base = (Number(m.qty) || 1) * (Number(m.cost) || 0) * (1 + (Number(m.waste) || 0) / 100); return s + base * (1 + (Number(m.markup) || 0) / 100); }, 0); }
  const pctOpts = [0, 5, 8, 10, 12, 15, 20, 25, 30];
  const rows = mats.length ? mats.map((m, i) => `
    <div style="display:grid;grid-template-columns:1fr 64px 64px 72px 68px 68px 32px;gap:5px;align-items:center;padding:8px;background:${m.cost === 0 ? '#fffbea' : '#f8faff'};border:1px solid ${m.cost === 0 ? '#fde68a' : 'var(--line)'};border-radius:12px;margin-bottom:5px">
      <div><div style="font-weight:700;font-size:13px">${escapeHtml(m.name)}</div>${m.itemNo ? `<div style="font-size:11px;color:var(--muted)">🔖 ${escapeHtml(m.itemNo)}</div>` : ''}</div>
      <input type="number" value="${m.qty || 1}" title="Antall" style="padding:6px;font-size:13px;text-align:center;border:1px solid var(--line);border-radius:9px;width:100%" onchange="window._cpm[${i}].qty=Number(this.value);rerenderCalcModal()" />
      <input value="${escapeHtml(m.unit || 'stk')}" title="Enhet" style="padding:6px;font-size:13px;border:1px solid var(--line);border-radius:9px;width:100%" onchange="window._cpm[${i}].unit=this.value" />
      <input type="number" value="${m.cost || 0}" title="Innpris" style="padding:6px;font-size:13px;text-align:right;border:1px solid var(--line);border-radius:9px;width:100%" onchange="window._cpm[${i}].cost=Number(this.value);rerenderCalcModal()" />
      <select title="Svinn %" style="padding:6px;font-size:13px;border:1px solid var(--line);border-radius:9px;width:100%" onchange="window._cpm[${i}].waste=Number(this.value);rerenderCalcModal()">${pctOpts.map(v => `<option value="${v}" ${(m.waste || 0) == v ? 'selected' : ''}>${v}%</option>`).join('')}</select>
      <select title="Påslag %" style="padding:6px;font-size:13px;border:1px solid var(--line);border-radius:9px;width:100%" onchange="window._cpm[${i}].markup=Number(this.value);rerenderCalcModal()">${pctOpts.map(v => `<option value="${v}" ${(m.markup || 20) == v ? 'selected' : ''}>${v}%</option>`).join('')}</select>
      <button style="border:none;background:#fff1f0;color:var(--red);border-radius:8px;padding:6px 8px;cursor:pointer;font-size:12px;width:100%" onclick="window._cpm.splice(${i},1);rerenderCalcModal()">✕</button>
    </div>`).join('') : '<div class="empty">Ingen materialer enda.</div>';

  const searchResults = window._cpmSearch ? searchPriceCatalog(window._cpmSearch) : [];
  const searchHtml = window._cpmSearch ? (searchResults.length
    ? searchResults.map(item => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:5px"><div><div style="font-weight:700;font-size:13px">${escapeHtml(item.productName || item.name)}</div><div style="font-size:11px;color:var(--muted)">${escapeHtml(item.itemNo || '')} • ${escapeHtml(item.unit || '-')} • ${currency(item.userPrice || 0)}</div></div><button class="btn small primary" onclick="addFromCatalogToCalcModal('${escapeHtml(item.id)}')">+ Legg til</button></div>`).join('')
    : '<div class="empty" style="padding:10px">Ingen treff.</div>') : '';

  const postId = window._cpmPostId;
  const offerPost = postId && getProject(currentProjectId)?.offerPosts?.find(x => x.id === postId);
  const calcHours = offerPost?.snapshotCompute?.hoursTotal || 0;
  const currentHours = offerPost ? Number(offerPost.hours) || calcHours : 0;
  const html = `
    <div class="section-head"><div class="section-title">✏️ Tilpass post</div><button class="btn small secondary" onclick="closeModal()">Lukk</button></div>
    ${offerPost ? `<div style="background:#fffbea;border:1px solid #fde68a;border-radius:12px;padding:12px;margin-bottom:12px;display:flex;align-items:center;gap:16px"><div style="flex:1"><div style="font-size:13px;font-weight:800;margin-bottom:2px">⏱️ Timer for denne posten</div><div style="font-size:12px;color:var(--muted)">${calcHours ? 'Kalkyle beregnet: ' + calcHours + 't' : ''}</div></div><div style="display:flex;flex-direction:column;align-items:center;gap:4px"><button onclick="adjustModalHours(1)" style="border:none;background:#fde68a;border-radius:8px;padding:4px 12px;cursor:pointer;font-size:16px;font-weight:800;width:100%">▲</button><div id="postHoursDisplay" style="font-size:28px;font-weight:800;color:#a96800;min-width:70px;text-align:center">${currentHours || calcHours || 0}</div><button onclick="adjustModalHours(-1)" style="border:none;background:#fde68a;border-radius:8px;padding:4px 12px;cursor:pointer;font-size:16px;font-weight:800;width:100%">▼</button></div><div style="font-size:12px;color:var(--muted)">timer<br><span style="font-size:10px">Fra kalkyle: ${calcHours || 0}t</span></div></div>` : ``}
    <div style="background:#f0f7ff;border:1px solid #cde2ff;border-radius:14px;padding:12px;margin-bottom:14px">
      <label style="margin:0 0 6px">🔍 Søk i prisfil og legg til</label>
      <input id="calcModalSearch" placeholder="Søk varenummer eller navn..." value="${escapeAttr(window._cpmSearch || '')}" oninput="window._cpmSearch=this.value;rerenderCalcModal()" style="margin:0" />
      <div style="margin-top:8px;max-height:180px;overflow-y:auto">${searchHtml}</div>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Ant. • Enhet • Innpris • Svinn% • Påslag%</div>
    <div id="calcMatRows">${rows}</div>
    <button class="btn small soft" style="margin-top:8px" onclick="addBlankToCalcModal()">+ Tom rad</button>
    <div style="margin-top:14px;padding:12px 16px;background:#f5f8ff;border-radius:14px;border:1px solid #dce8ff;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:13px;font-weight:700;color:var(--muted)">Materialsum (salgsverdi)</div>
      <div style="font-size:22px;font-weight:800;color:var(--blue)">${currency(matTotal())}</div>
    </div>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn primary" onclick="saveCalcPostMaterials()">💾 Lagre og oppdater tilbud</button>
      <button class="btn secondary" onclick="closeModal()">Avbryt</button>
    </div>`;
  showModal(html);
  const si = document.getElementById('calcModalSearch');
  if (si && window._cpmSearch) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
}

function rerenderCalcModal() { renderCalcModal(); }

function restoreCalcPost(postId) {
  window._pendingPostHours = null;
  const p = getProject(currentProjectId); if (!p || !p.offerPosts) return;
  const post = p.offerPosts.find(x => x.id === postId); if (!post) return;
  window._cpm = [...(post.snapshotMaterials || []).map(m => ({ ...m }))];
  window._cpmPostId = postId;
  window._cpmSearch = '';
  renderCalcModal();
}

function saveCalcPostMaterials() {
  const p = getProject(currentProjectId); if (!p || !p.offerPosts) return;
  const post = p.offerPosts.find(x => x.id === window._cpmPostId); if (!post) return;
  const mats = window._cpm.map(m => ({ ...m }));
  post.snapshotMaterials = mats;
  let matCost = 0, matSaleEx = 0;
  mats.forEach(m => { const qty = Number(m.qty) || 1, cost = Number(m.cost) || 0; const waste = Number(m.waste) || 0, markup = Number(m.markup) || 20; const withWaste = qty * cost * (1 + waste / 100); matCost += withWaste; matSaleEx += withWaste * (1 + markup / 100); });
  const riskFactor = { Lav: 1, Normal: 1.1, 'Høy': 1.2 }[p.work.risk] || 1.1;
  const timeRate = Number(p.work.timeRate) || 850;
  const internalCost = Number(p.work.internalCost) || 0;
  const prev = post.snapshotCompute || {};
  const hoursTotal = window._pendingPostHours != null ? window._pendingPostHours : (prev.hoursTotal || 0);
  window._pendingPostHours = null;
  const laborSaleEx = hoursTotal * timeRate * riskFactor;
  const laborCost = hoursTotal * internalCost;
  const saleEx = laborSaleEx + matSaleEx;
  const costPrice = laborCost + matCost;
  const profit = saleEx - costPrice;
  const margin = saleEx ? (profit / saleEx * 100) : 0;
  post.snapshotCompute = { hoursTotal, laborSaleEx, laborCost, matSaleEx, matCost, costPrice, saleEx, saleInc: saleEx * 1.25, profit, margin };
  post.hours = hoursTotal;
  post.price = Math.round(p.settings.vatMode === 'inc' ? saleEx * 1.25 : saleEx);
  window._cpmSearch = '';
  closeModal();
  persistAndRenderProject();
}

function adjustModalHours(delta) {
  const p = getProject(currentProjectId); if (!p) return;
  const postId = window._cpmPostId;
  const post = postId && p.offerPosts && p.offerPosts.find(x => x.id === postId);
  const calcHours = post?.snapshotCompute?.hoursTotal || 0;
  const base = window._pendingPostHours != null ? window._pendingPostHours : (post?.hours || calcHours || 0);
  const newVal = Math.max(0, base + delta);
  window._pendingPostHours = newVal;
  const el = document.getElementById('postHoursDisplay');
  if (el) el.textContent = newVal + 't';
}

// ── Pris-lookup modal ────────────────────────────────────────────────────
function openCalcPriceLookupModal(missingMats, p) {
  let idx = 0;
  function renderStep() {
    if (idx >= missingMats.length) { closeModal(); persistAndRenderProject(); return; }
    const m = missingMats[idx];
    function searchHtml(q) {
      if (!q) return '';
      const res = searchPriceCatalog(q);
      if (!res.length) return '<div class="empty" style="padding:8px">Ingen treff</div>';
      return res.map(item => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:5px"><div><div style="font-weight:700;font-size:13px">${escapeHtml(item.productName || item.name)}</div><div style="font-size:11px;color:var(--muted)">${escapeHtml(item.itemNo || '')} • ${escapeHtml(item.unit || '-')} • ${currency(item.userPrice || 0)}</div></div><button class="btn small primary" onclick="setPriceFromCatalog('${m.id}','${escapeHtml(item.id)}')">Velg</button></div>`).join('');
    }
    showModal(`
      <div class="section-head"><div class="section-title">💰 Sett pris (${idx + 1}/${missingMats.length})</div><button class="btn small secondary" onclick="skipPriceLookup()">Hopp over alle</button></div>
      <div style="padding:10px;background:#fffbea;border:1px solid #fde68a;border-radius:12px;margin-bottom:12px"><div style="font-weight:800">${escapeHtml(m.name)}</div><div style="font-size:12px;color:var(--muted)">${m.qty} ${m.unit} — mangler pris</div></div>
      <div style="margin-bottom:8px;display:flex;gap:8px"><input id="calcPriceManual" type="number" placeholder="Skriv inn pris manuelt..." style="flex:1" onchange="setManualPrice('${m.id}',this.value)" /><button class="btn small soft" onclick="setManualPrice('${m.id}',document.getElementById('calcPriceManual').value)">OK</button></div>
      <div style="background:#f0f7ff;border:1px solid #cde2ff;border-radius:12px;padding:12px"><label style="margin:0 0 6px">🔍 Søk i prisfil</label><input id="calcPriceSearch" placeholder="Søk varenummer eller navn..." oninput="document.getElementById('calcPriceResults').innerHTML=window._calcSearchHtml(this.value)" /><div id="calcPriceResults" style="margin-top:8px;max-height:200px;overflow-y:auto"></div></div>
      <div class="toolbar" style="margin-top:14px"><button class="btn secondary" onclick="skipOnePriceLookup()">Hopp over denne</button></div>
    `);
    window._calcSearchHtml = searchHtml;
  }
  window.setPriceFromCatalog = function (matId, itemId) {
    const item = getCatalogItem(itemId); if (!item) return;
    const mat = p.materials.find(x => x.id === matId); if (!mat) return;
    mat.cost = item.userPrice || 0; mat.itemNo = item.itemNo || ''; mat.name = item.productName || item.name;
    idx++; renderStep();
  };
  window.setManualPrice = function (matId, val) {
    const price = parseFloat(val) || 0; if (!price) return;
    const mat = p.materials.find(x => x.id === matId); if (!mat) return;
    mat.cost = price; idx++; renderStep();
  };
  window.skipOnePriceLookup = function () { idx++; renderStep(); };
  window.skipPriceLookup = function () { closeModal(); persistAndRenderProject(); };
  renderStep();
}

// ── Prosjekt-fullføring ──────────────────────────────────────────────────
function openProjectCompleteModal(p) {
  const c = compute(p);
  showModal(`
    <div class="section-head"><div class="section-title">✅ Fullfør prosjekt</div><button class="btn small secondary" onclick="closeModal()">Lukk</button></div>
    <div style="background:#edfff4;border:1px solid #b7f0cf;border-radius:14px;padding:12px;margin-bottom:14px;font-size:13px;color:#167a42;font-weight:700">Fyll inn faktiske tall — dette hjelper kalkulatoren å bli bedre over tid.</div>
    <div class="row"><div><label>Faktiske timer brukt</label><input id="fcActualHours" type="number" placeholder="Estimert: ${c.totalHours || c.hoursTotal}" value="${p.work.actualHours || ''}" /></div><div><label>Faktisk materialkostnad (kr)</label><input id="fcActualMatCost" type="number" placeholder="Estimert: ${Math.round(c.totalMatCost || c.matCost)}" value="${p.actualMatCost || ''}" /></div></div>
    <div class="row"><div><label>Faktisk totalpris til kunde (kr)</label><input id="fcActualTotal" type="number" placeholder="Tilbudssum: ${Math.round(c.totalSaleEx || c.saleEx)}" value="${p.actualTotal || ''}" /></div><div><label>Antall reklamasjoner / avvik</label><input id="fcIssues" type="number" placeholder="0" value="${p.completionData?.issues || 0}" /></div></div>
    <label>Notater / læring fra dette prosjektet</label><textarea id="fcNotes" placeholder="Hva gikk bra? Hva tok lengre tid enn estimert?">${p.completionData?.notes || ''}</textarea>
    <div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveProjectComplete('${p.id}')">✅ Merk som ferdig og lagre</button><button class="btn secondary" onclick="closeModal()">Avbryt</button></div>
  `);
}

function quickChangeStatus(projectId, newStatus) {
  const p = getProject(projectId); if (!p) return;
  if (newStatus === 'Ferdig') { openProjectCompleteModal(p); }
  else { p.status = newStatus; p.updatedAt = Date.now(); saveState(); renderDashboard(); }
}

function saveProjectComplete(projectId) {
  const p = getProject(projectId); if (!p) return;
  const actualHours = Number(document.getElementById('fcActualHours')?.value) || 0;
  const actualMatCost = Number(document.getElementById('fcActualMatCost')?.value) || 0;
  const actualTotal = Number(document.getElementById('fcActualTotal')?.value) || 0;
  const issues = Number(document.getElementById('fcIssues')?.value) || 0;
  const notes = document.getElementById('fcNotes')?.value || '';
  if (actualHours) p.work.actualHours = actualHours;
  p.actualMatCost = actualMatCost; p.actualTotal = actualTotal;
  p.completionData = { issues, notes, completedAt: Date.now() };
  p.status = 'Ferdig'; p.updatedAt = Date.now();
  saveState(); closeModal(); renderDashboard();
}

// ── Send kalkyle til tilbud modal ────────────────────────────────────────
function openSendCalcToOfferModal() {
  const p = getProject(currentProjectId); if (!p) return;
  const c = compute(p);
  showModal(`
    <div class="section-head"><div class="section-title">📄 Send til tilbud</div><button class="btn small secondary" onclick="closeModal()">Lukk</button></div>
    <label>Navn på tilbudspost</label><input id="calcPostName" value="${escapeAttr(p.name || 'Kalkyle')}" placeholder="F.eks. Terrasse, Kledning vegg..." />
    <div style="margin-top:12px;padding:12px;background:#f5f8ff;border-radius:14px;font-size:13px;color:var(--muted)">${p.materials.length} materialer + ${c.hoursTotal} timer legges til som post</div>
    <div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="doSendCalcToOffer()">📄 Legg til i tilbud</button><button class="btn secondary" onclick="closeModal()">Avbryt</button></div>
  `);
}

// ── Offer preview wrappere ───────────────────────────────────────────────
function setOfferPostMode(mode) {
  _offerState.postMode = mode;
  const ed = document.getElementById('customPostEditor');
  if (ed) ed.style.display = mode === 'custom' ? '' : 'none';
  renderOfferPreviewFn(currentProjectId);
  if (mode === 'custom') {
    // custom post editor rendering handled by tab-preview
  }
}

function addFreeSection() {
  _offerState.freeSections.push({ id: uid(), title: 'Ny seksjon', text: '' });
  renderOfferEditorPane(currentProjectId);
  renderOfferPreviewFn(currentProjectId);
}

function removeCustomPost(idx) {
  _offerState.customPosts.splice(idx, 1);
  renderOfferPreviewFn(currentProjectId);
}

function mergeAllCustomPosts() {
  const p = getProject(currentProjectId); if (!p) return;
  const total = _offerState.customPosts.reduce(function (s, cp) { return s + cp.price; }, 0);
  _offerState.customPosts = [{ id: uid(), name: p.name || 'Tilbudssum', price: total, sourceIds: [] }];
  renderOfferPreviewFn(currentProjectId);
}

// ── Showapp ──────────────────────────────────────────────────────────────
function showApp() {
  document.getElementById('loginView').style.display = 'none';
  document.querySelector('.app').style.display = '';
  renderDashboard();

  // Offline-deteksjon
  initOfflineDetection(online => {
    updateSyncIndicator(online ? true : 'offline');
    if (online) flushQueue(saveToCloud);
  });

  // Auto-eksport
  if (state.autoExportInterval > 0) {
    initAutoExport(() => state, state.autoExportInterval * 60 * 1000);
  }
}

// ── Global event listeners ───────────────────────────────────────────────
document.addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'newCustomerBtn' || t.id === 'newCustomerBtn2') openCustomerModal(null, renderDashboard);
  if (t.id === 'newProjectBtn' || t.id === 'newProjectBtn2') openProjectModal(renderDashboard, (id) => openProjectFn(id, renderProjectView));
  if (t.id === 'backToDashboard') openDashboard(renderDashboard);
  if (t.id === 'saveProjectBtn') { persistAndRenderProject(); alert('Prosjekt lagret.'); }
  if (t.id === 'deleteProjectBtn') deleteCurrentProject(renderDashboard);
  if (t.id === 'settingsBtn') openSettings();
  if (t.id === 'saveSettingsBtn') saveSettings(renderDashboard);
  if (t.id === 'backToOverviewBtn') { $('#settingsView').classList.add('hidden'); $('#dashboardView').classList.remove('hidden'); renderDashboard(); }
  if (t.id === 'backupBtn') exportData();
  if (t.id === 'importBtn') $('#importFile').click();
  if (t.id === 'toggleEx') { const p = getProject(currentProjectId); if (p) { p.settings.vatMode = 'ex'; persistAndRenderProject(); } }
  if (t.id === 'toggleInc') { const p = getProject(currentProjectId); if (p) { p.settings.vatMode = 'inc'; persistAndRenderProject(); } }
});

$('#importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importData(f, renderDashboard); e.target.value = ''; });
$('#customerSearch').addEventListener('input', renderDashboard);
$('#projectSearch').addEventListener('input', renderDashboard);

document.addEventListener('change', function (e) {
  if (e.target.classList.contains('ep-chk')) {
    var epid = e.target.getAttribute('data-epid');
    if (epid) _offerState.extraPostsChecked[epid] = e.target.checked;
    renderOfferPreviewFn(currentProjectId);
  }
});

// ── Logo init ────────────────────────────────────────────────────────────
initLogoUpload();

// ── Window exports (for inline onclick handlers in HTML strings) ─────────
window.doLogin = doLogin();
window.doSignup = doSignup();
window.showSignup = showSignup;
window.showLogin = showLogin;
window.editCustomer = (id) => editCustomerFn(id, renderDashboard);
window.deleteCustomer = (id) => deleteCustomerFn(id, renderDashboard);
window.openProject = (id) => openProjectFn(id, renderProjectView);
window.switchTab = switchTab;
window.toggleStep = (n) => { const p = getProject(currentProjectId); if (!p) return; if (p.ui.openSteps.includes(n)) p.ui.openSteps = p.ui.openSteps.filter(x => x !== n); else p.ui.openSteps.push(n); saveState(); renderProjectView(); };
window.updMaterial = updMaterial;
window.removeMaterial = removeMaterial;
window.addMaterial = addMaterial;
window.addPackage = addPackage;
window.setAllMarkup = setAllMarkup;
window.setAllWaste = setAllWaste;
window.addCatalogMaterial = addCatalogMaterial;
window.clearPriceCatalog = () => clearPriceCatalogFn(renderProjectView);
window.toggleFavoriteCatalog = (id) => toggleFavoriteCatalogFn(id, renderProjectView);
window.duplicateLastMaterial = duplicateLastMaterial;
window.applyTemplateById = applyTemplateById;
window.openTemplateModal = openTemplateModal;
window.deleteUserTemplate = deleteUserTemplate;
window.copyBuiltinTemplate = copyBuiltinTemplate;
window.addOfferPost = addOfferPost;
window.addCalcPost = addCalcPost;
window.updatePost = updatePost;
window.togglePost = togglePost;
window.removePost = removePost;
window.movePost = movePost;
window.toggleOfferPost = toggleOfferPost;
window.closeModal = closeModal;
window.backdropClose = backdropClose;
window.addSubcontractor = addSubcontractor;
window.removeSubcontractor = removeSubcontractor;
window.updSubcontractor = updSubcontractor;
window.persistAndRenderProject = persistAndRenderProject;
window.quickChangeStatus = quickChangeStatus;
window.saveProjectComplete = saveProjectComplete;
window.openSendCalcToOfferModal = openSendCalcToOfferModal;
window.doSendCalcToOffer = function () { const name = document.getElementById('calcPostName')?.value.trim(); closeModal(); addCalcPost(name); };
window.toggleCalcWidget = toggleCalcWidget;
window.toggleMalerSection = toggleMalerSection;
window.updateCalcWidget = updateCalcWidget;
window.selectDifficulty = selectDifficulty;
window.runCalcWidget = runCalcWidget;
window.doAddCalcResult = doAddCalcResult;
window.addCalcResultToProject = addCalcResultToProject;
window.saveCalcRate = saveCalcRateFn;
window.restoreCalcPost = restoreCalcPost;
window.rerenderCalcModal = rerenderCalcModal;
window.saveCalcPostMaterials = saveCalcPostMaterials;
window.adjustModalHours = adjustModalHours;
window.addBlankToCalcModal = function () { window._cpm.push({ id: uid(), name: 'Nytt materiale', qty: 1, unit: 'stk', cost: 0, waste: 0, markup: 20 }); rerenderCalcModal(); };
window.addFromCatalogToCalcModal = function (itemId) {
  const p = getProject(currentProjectId); const item = getCatalogItem(itemId); if (!item) return;
  window._cpm.push({ id: uid(), name: item.productName || item.name, itemNo: item.itemNo || '', unit: item.unit || 'stk', cost: item.userPrice || 0, waste: 0, markup: p ? p.settings.materialMarkup : 20 });
  window._cpmSearch = ''; rerenderCalcModal();
};
window.openPostMaterialEditor = function (postId) {
  const p = getProject(currentProjectId); if (!p || !p.offerPosts) return;
  const post = p.offerPosts.find(x => x.id === postId); if (!post) return;
  window._cpm = [...(post.snapshotMaterials || []).map(m => ({ ...m }))];
  window._cpmPostId = postId; window._cpmSearch = ''; renderCalcModal();
};
window.adjustTotalHours = function (delta) { const p = getProject(currentProjectId); if (!p) return; const c = compute(p); const current = Number(p.work.hoursOverride) > 0 ? Number(p.work.hoursOverride) : c.totalHours; p.work.hoursOverride = Math.max(0, current + delta); persistAndUpdate(); };
window.resetTotalHours = function () { const p = getProject(currentProjectId); if (!p) return; p.work.hoursOverride = 0; persistAndUpdate(); };
window.updateOfferHours = function (val) { const p = getProject(currentProjectId); if (!p) return; p.work.hours = Number(val) || 0; persistAndRenderProject(); };
window.setColor = setColor;
window.removeLogo = removeLogo;
window.setOfferPostMode = setOfferPostMode;
window.addFreeSection = addFreeSection;
window.removeCustomPost = removeCustomPost;
window.mergeAllCustomPosts = mergeAllCustomPosts;
window.openOfferFullPreview = () => openOfferFullPreviewFn(currentProjectId);
window.downloadOfferPDF = () => downloadOfferPDFFn(currentProjectId);
window.sendOfferNow = () => sendOfferNowFn(currentProjectId);
window.openAndSendOffer = () => openAndSendOfferFn(currentProjectId);
window.printOffer = () => openOfferFullPreviewFn(currentProjectId);
window.renderOfferPreview = () => renderOfferPreviewFn(currentProjectId);
window.renderOfferEditorPane = () => renderOfferEditorPane(currentProjectId);
window._offerState = _offerState;
window._sb = _sb;

// ── Nye window exports for forbedringer ─────────────────────────────────
window.getBackups = getBackups;
window.restoreBackup = (idx) => restoreBackup(idx, renderDashboard);
window.getProjectHistory = getHistory;
window.rollbackProject = (projId, ts) => { rollbackProject(projId, ts); renderProjectView(); };
window.setAutoExportInterval = (min) => {
  state.autoExportInterval = min;
  saveState();
  setAutoExportInterval(() => state, min);
};

// ── App init ─────────────────────────────────────────────────────────────
document.querySelector('.app').style.display = 'none';
initAuth(showApp);
