// ── Hjelpefunksjoner ──────────────────────────────────────────────────────

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function currency(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('nb-NO')} kr`;
}

export function percent(n) {
  return `${Math.round((Number(n) || 0) * 10) / 10}%`;
}

export function safe(v) {
  return v == null ? '' : String(v);
}

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

export function escapeAttr(str = '') {
  return escapeHtml(str);
}

export function sel(a, b) {
  return a === b ? 'selected' : '';
}

export function vatFactor(p) {
  return (p && p.settings && p.settings.vatMode === 'inc') ? 1.25 : 1;
}

export function displayVatValue(p, v) {
  return Math.round((Number(v) || 0) * vatFactor(p) * 100) / 100;
}

export function parseVatInput(p, v) {
  const n = Number(v) || 0;
  return vatFactor(p) === 1.25 ? (n / 1.25) : n;
}

export function parseNbNumber(value) {
  if (value == null) return 0;
  const cleaned = String(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

// Shortcut for querySelector
export const $ = sel => document.querySelector(sel);
