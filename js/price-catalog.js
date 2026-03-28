// ── Prisfil, søk og favoritter ────────────────────────────────────────────
import { state, saveState } from './state.js';
import { uid, parseNbNumber, currency, escapeHtml } from './utils.js';

export function lookupPriceForMaterial(name) {
  if (!state.priceCatalog || !state.priceCatalog.length) return 0;
  const q = (name || '').toLowerCase().trim();
  if (!q) return 0;
  let match = state.priceCatalog.find(item =>
    (item.productName || item.name || '').toLowerCase() === q || (item.name || '').toLowerCase() === q
  );
  if (!match) {
    match = state.priceCatalog.find(item =>
      (item.productName || item.name || '').toLowerCase().includes(q) ||
      q.includes((item.productName || item.name || '').toLowerCase().substring(0, 8))
    );
  }
  return match ? (match.userPrice || 0) : 0;
}

export function parsePriceCsv(text) {
  const rows = text.split(/\r?\n/).filter(Boolean);
  const catalog = [];
  rows.forEach(line => {
    const cols = line.split(';');
    if (cols.length < 8) return;
    const itemNo = (cols[0] || '').trim(), name = (cols[1] || '').trim(), desc = (cols[2] || '').trim();
    const regularPrice = parseNbNumber(cols[4]), discountPercent = parseNbNumber(cols[5]), userPrice = parseNbNumber(cols[6]);
    const unit = (cols[7] || '').trim();
    const fullText = `${name} ${desc}`.trim();
    if (!itemNo && !fullText) return;
    catalog.push({ id: itemNo || uid(), itemNo, name: fullText || name || desc || 'Uten navn', productName: name, description: desc, regularPrice, discountPercent, userPrice, unit });
  });
  return catalog;
}

export function importPriceFile(file, renderFn) {
  const reader = new FileReader();
  reader.onload = e => {
    const catalog = parsePriceCsv(e.target.result || '');
    state.priceCatalog = catalog;
    state.priceFileName = file.name || 'Prisfil';
    saveState();
    if (renderFn) renderFn();
    alert(`Prisfil lastet inn: ${catalog.length} varer.`);
  };
  reader.readAsText(file, 'utf-8');
}

export function clearPriceCatalog(renderFn) {
  state.priceCatalog = [];
  state.priceFileName = '';
  saveState();
  if (renderFn) renderFn();
}

export function searchPriceCatalog(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const exact = [], starts = [], contains = [];
  state.priceCatalog.forEach(item => {
    const itemNo = (item.itemNo || '').toLowerCase(), name = (item.productName || item.name || '').toLowerCase(), description = (item.description || '').toLowerCase();
    if (itemNo === q) exact.push(item);
    else if (itemNo.startsWith(q) || name.startsWith(q)) starts.push(item);
    else if (name.includes(q) || description.includes(q)) contains.push(item);
  });
  return [...exact, ...starts, ...contains].slice(0, 20);
}

export function getCatalogItem(id) {
  return state.priceCatalog.find(x => String(x.id) === String(id));
}

export function getFavoriteCatalogItems() {
  return (state.favoriteCatalogIds || []).map(getCatalogItem).filter(Boolean).slice(0, 12);
}

export function getRecentCatalogItems() {
  return (state.recentCatalogIds || []).map(getCatalogItem).filter(Boolean).slice(0, 10);
}

export function isFavoriteCatalog(id) {
  return (state.favoriteCatalogIds || []).includes(String(id));
}

export function toggleFavoriteCatalog(id, renderFn) {
  const key = String(id);
  state.favoriteCatalogIds = state.favoriteCatalogIds || [];
  if (state.favoriteCatalogIds.includes(key))
    state.favoriteCatalogIds = state.favoriteCatalogIds.filter(x => x !== key);
  else
    state.favoriteCatalogIds.unshift(key);
  state.favoriteCatalogIds = [...new Set(state.favoriteCatalogIds)].slice(0, 30);
  saveState();
  if (renderFn) renderFn();
}

export function rememberRecentCatalog(id) {
  const key = String(id);
  state.recentCatalogIds = [key].concat((state.recentCatalogIds || []).filter(x => x !== key)).slice(0, 20);
  saveState();
}

export function renderPriceSearchResults(query) {
  const host = document.querySelector('#priceSearchResults');
  if (!host) return;
  const results = searchPriceCatalog(query);
  if (!query || !query.trim()) { host.innerHTML = ''; return; }
  if (!state.priceCatalog.length) { host.innerHTML = '<div class="empty">Last opp en prisfil for å søke i varer.</div>'; return; }
  if (!results.length) { host.innerHTML = '<div class="empty">Ingen treff.</div>'; return; }
  host.innerHTML = results.map(item => `
    <div class="item">
      <div>
        <h4>${escapeHtml(item.productName || item.name)}</h4>
        <p>${escapeHtml(item.description || '')}</p>
        <div class="pills" style="margin-top:8px">
          <span class="pill">Varenr: ${escapeHtml(item.itemNo)}</span>
          <span class="pill">Enhet: ${escapeHtml(item.unit || '-')}</span>
          <span class="pill">Din pris: ${currency(item.userPrice)}</span>
          ${item.regularPrice ? `<span class="pill">Ord. pris: ${currency(item.regularPrice)}</span>` : ''}
          ${item.discountPercent ? `<span class="pill">Rabatt: ${item.discountPercent}%</span>` : ''}
        </div>
      </div>
      <div class="inline-actions">
        <button class="btn small secondary" onclick="toggleFavoriteCatalog('${escapeHtml(item.id)}')">${isFavoriteCatalog(item.id) ? '★ Favoritt' : '☆ Favoritt'}</button>
        <button class="btn small primary" onclick="addCatalogMaterial('${escapeHtml(item.id)}')">Legg til</button>
      </div>
    </div>
  `).join('');
}

export function renderQuickCatalogButtons(items, emptyText) {
  if (!items.length) return `<div class="footer-note">${emptyText}</div>`;
  return items.map(item => `
    <button class="package-btn" onclick="addCatalogMaterial('${escapeHtml(item.id)}')">
      ${escapeHtml(item.productName || item.name)}
      <small>Varenr: ${escapeHtml(item.itemNo || '-')} • ${escapeHtml(item.unit || '-')} • Din pris: ${currency(item.userPrice || 0)}</small>
    </button>
  `).join('');
}
