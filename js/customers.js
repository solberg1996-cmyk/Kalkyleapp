// ── Kundehåndtering ──────────────────────────────────────────────────────
import { state, saveState, getCustomer } from './state.js';
import { uid, escapeAttr, $ } from './utils.js';
import { showModal, closeModal } from './modals.js';

export function openCustomerModal(existing, renderDashboardFn) {
  const c = existing || { id: uid(), name: '', phone: '', email: '', address: '' };
  showModal(`
    <div class="section-head"><div class="section-title">${existing ? 'Rediger kunde' : 'Ny kunde'}</div><button class="btn small secondary" onclick="closeModal()">Lukk</button></div>
    <label>Navn</label><input id="mCN" value="${escapeAttr(c.name)}" />
    <label>Telefon</label><input id="mCP" value="${escapeAttr(c.phone)}" />
    <label>E-post</label><input id="mCE" value="${escapeAttr(c.email)}" />
    <label>Adresse</label><input id="mCA" value="${escapeAttr(c.address)}" />
    <div class="toolbar" style="margin-top:14px"><button class="btn primary" id="saveCustBtn">Lagre kunde</button></div>
  `);
  $('#saveCustBtn').onclick = () => {
    c.name = $('#mCN').value.trim();
    c.phone = $('#mCP').value.trim();
    c.email = $('#mCE').value.trim();
    c.address = $('#mCA').value.trim();
    if (!c.name) { alert('Skriv inn kundenavn.'); return; }
    const idx = state.customers.findIndex(x => x.id === c.id);
    if (idx > -1) state.customers[idx] = c; else state.customers.unshift(c);
    saveState();
    closeModal();
    if (renderDashboardFn) renderDashboardFn();
  };
}

export function editCustomer(id, renderDashboardFn) {
  const c = getCustomer(id);
  if (c) openCustomerModal({ ...c }, renderDashboardFn);
}

export function deleteCustomer(id, renderDashboardFn) {
  if (!confirm('Slette denne kunden?')) return;
  state.customers = state.customers.filter(c => c.id !== id);
  state.projects = state.projects.map(p => p.customerId === id ? { ...p, customerId: '' } : p);
  saveState();
  if (renderDashboardFn) renderDashboardFn();
}
