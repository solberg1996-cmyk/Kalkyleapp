// ── Innstillinger ────────────────────────────────────────────────────────
import { state, saveState, getBackups, restoreBackup } from './state.js';
import { $, escapeHtml } from './utils.js';

export function openSettings() {
  $('#dashboardView').classList.add('hidden');
  $('#settingsView').classList.remove('hidden');
  const co = state.company;
  ['Name', 'OrgNr', 'Address', 'City', 'Phone', 'Email', 'Website', 'ExtraInfo'].forEach(k => {
    const el = $('#c' + k);
    if (el) el.value = co[k.charAt(0).toLowerCase() + k.slice(1)] || '';
  });
  $('#sDefTimeRate').value = state.settings.timeRate || 850;
  $('#sDefInternalCost').value = state.settings.internalCost || 450;
  $('#sDefMatMarkup').value = state.settings.materialMarkup || 20;
  $('#sDefDriveCost').value = state.settings.driveCost || 650;
  const colorEl = $('#cColor');
  if (colorEl) { colorEl.value = co.color || '#2e75b6'; updateColorPreview(co.color || '#2e75b6'); }
  if (co.logo) { showLogoPreview(co.logo); }
  colorEl && colorEl.addEventListener('input', function () { updateColorPreview(this.value); });

  // Auto-eksport dropdown
  const autoEl = $('#sAutoExport');
  if (autoEl) autoEl.value = state.autoExportInterval || 0;

  // Backup-liste
  renderBackupList();
}

function renderBackupList() {
  const el = $('#backupList');
  if (!el) return;
  const backups = getBackups();
  if (!backups.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px">Ingen lokale backups enda.</div>';
    return;
  }
  el.innerHTML = backups.map(b => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:4px">
      <div>
        <span style="font-weight:700">Backup #${b.index}</span>
        <span style="color:var(--muted);margin-left:8px">${escapeHtml(b.date)}</span>
        <span style="color:var(--muted);margin-left:8px">${b.customerCount} kunder, ${b.projectCount} prosjekter</span>
      </div>
      <button class="btn small secondary" style="font-size:11px" onclick="if(confirm('Gjenopprette denne backupen? Nåværende data blir overskrevet.')) restoreBackup(${b.index})">Gjenopprett</button>
    </div>`).join('');
}

export function updateColorPreview(hex) {
  const h = $('#colorPreviewHeader');
  if (h) h.style.background = hex;
  const l = $('#colorPreviewLine');
  if (l) l.style.background = hex;
}

export function setColor(hex) {
  const el = $('#cColor');
  if (el) { el.value = hex; updateColorPreview(hex); }
}

export function showLogoPreview(dataUrl) {
  const prev = $('#logoPreview');
  if (prev) { prev.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:contain;border-radius:12px" />'; }
  const btn = $('#removeLogoBtn');
  if (btn) btn.style.display = '';
}

export function removeLogo() {
  state.company.logo = '';
  const prev = $('#logoPreview');
  if (prev) prev.innerHTML = '<span style="color:var(--muted);font-size:12px">Ingen logo</span>';
  const btn = $('#removeLogoBtn');
  if (btn) btn.style.display = 'none';
}

export function saveSettings(renderDashboardFn) {
  state.company.name = $('#cName')?.value.trim() || '';
  state.company.orgNr = $('#cOrgNr')?.value.trim() || '';
  state.company.address = $('#cAddress')?.value.trim() || '';
  state.company.city = $('#cCity')?.value.trim() || '';
  state.company.phone = $('#cPhone')?.value.trim() || '';
  state.company.email = $('#cEmail')?.value.trim() || '';
  state.company.website = $('#cWebsite')?.value.trim() || '';
  state.company.extraInfo = $('#cExtraInfo')?.value.trim() || '';
  state.company.color = $('#cColor')?.value || '#2e75b6';
  state.settings.timeRate = Number($('#sDefTimeRate')?.value) || 850;
  state.settings.internalCost = Number($('#sDefInternalCost')?.value) || 450;
  state.settings.materialMarkup = Number($('#sDefMatMarkup')?.value) || 20;
  state.settings.driveCost = Number($('#sDefDriveCost')?.value) || 650;
  saveState();
  alert('Innstillinger lagret.');
}

export function initLogoUpload() {
  document.getElementById('logoFileInput')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Logo er for stor (maks 2MB)'); return; }
    const reader = new FileReader();
    reader.onload = function (ev) {
      state.company.logo = ev.target.result;
      showLogoPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
}
