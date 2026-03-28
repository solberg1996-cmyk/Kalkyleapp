// ── Materialer-fane ──────────────────────────────────────────────────────
import { state, getAllTemplates } from './state.js';
import { escapeHtml, escapeAttr, displayVatValue, currency } from './utils.js';
import { calcDefaults } from './calculator.js';
import { renderQuickCatalogButtons, getFavoriteCatalogItems, getRecentCatalogItems } from './price-catalog.js';

export function renderTabMaterials(p) {
  const allTpls = getAllTemplates();
  const builtIn = allTpls.filter(t => t.builtIn);
  const userTpls = allTpls.filter(t => !t.builtIn);
  const hasCatalog = state.priceCatalog.length > 0;
  return `
    <!-- KALKULATOR -->
    <div class="card" style="background:#fafcff;border:1px solid var(--line);box-shadow:none;margin-bottom:14px">
      <div class="section-head">
        <div class="section-title">📐 Time & Material Kalkulator</div>
        <button class="btn small soft" onclick="toggleCalcWidget()">Åpne / lukk</button>
      </div>
      <div id="calcWidget" class="hidden">
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <button class="btn small secondary" onclick="document.getElementById('calcRateSettings').classList.toggle('hidden')">⚙️ Mine erfaringstimer</button>
        </div>
        <div style="margin-bottom:12px">
          <label>Velg jobbtype</label>
          <select id="calcJobType" onchange="updateCalcWidget()">
            <option value="">-- Velg --</option>
            <option value="terrasse">Terrasse</option>
            <option value="kledning">Kledning</option>
            <option value="tak">Tak</option>
            <option value="lettvegg">Lettvegg</option>
            <option value="etterisolering">Etterisolering</option>
            <option value="vindu">Vindu</option>
            <option value="gulv">Gulvlegging</option>
            <option value="panel">Innvendig panel</option>
            <option value="dor">Dørmontering</option>
            <option value="trapp">Trapp</option>
            <option value="bad">Bad / våtrom</option>
          </select>
        </div>
        <div id="calcInputs"></div>
        <div id="calcResults"></div>
        <div id="calcRateSettings" class="hidden" style="margin-top:14px;padding:14px;background:#fffbea;border:1px solid #fde68a;border-radius:14px">
          <div style="font-weight:800;font-size:13px;margin-bottom:10px">⚙️ Mine egne erfaringstimer (t/m² eller t/stk)</div>
          <div class="row-3">
            ${Object.entries(calcDefaults).map(([k, v]) => `
              <div>
                <label>${k.charAt(0).toUpperCase() + k.slice(1)} (${v.label})</label>
                <input type="number" step="0.1" value="${(state.calcRates || {})[k] ?? v.tPerM2}"
                  onchange="saveCalcRate('${k}',this.value)" />
              </div>`).join('')}
          </div>
          <div class="footer-note">Standard: Terrasse 2,5 • Kledning 1,3 • Tak 1,8 • Lettvegg 1,0 • Etterisolering 0,9 • Vindu 4,0 t/stk</div>
        </div>
      </div>
    </div>

    <!-- MALER -->
    <div class="card" style="background:#fafcff;border:1px solid var(--line);box-shadow:none;margin-bottom:14px">
      <div class="section-head">
        <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="toggleMalerSection()">
          <div class="section-title">Maler</div>
          <span id="malerToggleIcon" style="color:var(--muted);font-size:13px">▶</span>
        </div>
        <button class="btn small success" onclick="openTemplateModal()">+ Ny mal</button>
      </div>
      <div id="malerContent" style="display:none">
      <div class="footer-note" style="margin-bottom:12px;padding:10px;background:${hasCatalog ? '#edfff4' : '#fffbea'};border-radius:12px;border:1px solid ${hasCatalog ? '#b7f0cf' : '#fde68a'}">
        ${hasCatalog ? `✅ Prisfil aktiv: <strong>${escapeHtml(state.priceFileName)}</strong> (${state.priceCatalog.length} varer) — priser hentes automatisk` : '⚠️ Ingen prisfil lastet opp — priser settes til 0 og må fylles inn manuelt'}
      </div>
      <div style="font-weight:800;font-size:13px;color:var(--muted);margin-bottom:8px">Innebygde maler <span style="font-weight:500;font-size:12px">— rediger og lagre som din egen for å koble til prisfilen din</span></div>
      <div class="package-grid">
        ${builtIn.map(t => `
          <div style="display:flex;gap:6px">
            <button class="package-btn" style="flex:1" onclick="applyTemplateById('${t.id}')">${escapeHtml(t.name)}<small>${t.materials.length} materialer</small></button>
            <button style="border:none;background:none;color:var(--muted);font-size:12px;cursor:pointer;align-self:center;padding:4px 6px;white-space:nowrap" onclick="copyBuiltinTemplate('${t.id}')">✏️</button>
          </div>`).join('')}
      </div>
      <div style="font-weight:800;font-size:13px;color:var(--muted);margin:14px 0 8px">Mine maler ${userTpls.length ? '' : '<span style="font-weight:500">(ingen enda)</span>'}</div>
      ${userTpls.length ? `<div class="package-grid">${userTpls.map(t => `
        <div style="display:flex;gap:6px">
          <button class="package-btn user-template" style="flex:1" onclick="applyTemplateById('${t.id}')">${escapeHtml(t.name)}<small>${t.materials.length} materialer • priser fra prisfil</small></button>
          <button style="border:none;background:none;color:var(--muted);font-size:12px;cursor:pointer;align-self:center;padding:4px 6px;white-space:nowrap" onclick='openTemplateModal(${JSON.stringify(t).replace(/'/g, "&#39;")})'>✏️</button>
        </div>`).join('')}</div>`
        : `<div class="footer-note">Klikk <strong>+ Ny mal</strong> for å lage din første egendefinerte mal.</div>`}
    </div>

      </div>
    <!-- PRISFIL OG SØK -->
    <div class="card" style="padding:14px;background:#fafcff;border:1px solid var(--line);box-shadow:none;margin-bottom:14px">
      <div class="row">
        <div>
          <label>Prisfil</label>
          <div class="toolbar">
            <button class="btn small secondary" onclick="document.getElementById('priceFileInput').click()">Last opp prisfil</button>
            ${state.priceCatalog.length ? `<button class="btn small danger" onclick="clearPriceCatalog()">Fjern prisfil</button>` : ''}
          </div>
          <input id="priceFileInput" type="file" accept=".csv,text/csv" class="hidden" />
          <div class="footer-note">${state.priceCatalog.length ? `Aktiv: ${escapeHtml(state.priceFileName)} • ${state.priceCatalog.length} varer` : 'Ingen prisfil lastet opp enda.'}</div>
        </div>
        <div>
          <label>Søk i materialregister</label>
          <input id="priceSearchInput" placeholder="Søk varenummer, navn eller beskrivelse" value="" />
        </div>
      </div>
      <div id="priceSearchResults" class="list" style="margin-top:12px"></div>
    </div>

    <!-- FAVORITTER OG SIST BRUKT -->
    <div class="section-head"><div class="section-title">Favoritter fra prisfil</div></div>
    <div class="package-grid">${renderQuickCatalogButtons(getFavoriteCatalogItems(), 'Ingen favoritter valgt enda.')}</div>
    <div class="section-head" style="margin-top:14px"><div class="section-title">Sist brukte varer</div></div>
    <div class="package-grid">${renderQuickCatalogButtons(getRecentCatalogItems(), 'Ingen varer brukt fra prisfil enda.')}</div>

    <!-- VERKTØYLINJE -->
    <div class="toolbar" style="margin-top:14px;align-items:center">
      <div style="display:flex;align-items:center;gap:8px;background:#f3f6fb;border:1px solid var(--line);border-radius:12px;padding:6px 10px">
        <span style="font-size:13px;font-weight:700;color:var(--muted);white-space:nowrap">Alle påslag:</span>
        <select onchange="setAllMarkup(Number(this.value))" style="border:none;background:transparent;font-weight:700;font-size:13px;padding:4px 6px;cursor:pointer">
          <option value="">Velg %</option>
          ${[5, 8, 10, 12, 15, 20, 25, 30].map(v => `<option value="${v}">${v}%</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:#f3f6fb;border:1px solid var(--line);border-radius:12px;padding:6px 10px">
        <span style="font-size:13px;font-weight:700;color:var(--muted);white-space:nowrap">Alle svinn:</span>
        <select onchange="setAllWaste(Number(this.value))" style="border:none;background:transparent;font-weight:700;font-size:13px;padding:4px 6px;cursor:pointer">
          <option value="">Velg %</option>
          ${[0, 5, 8, 10, 12, 15, 20, 25, 30].map(v => `<option value="${v}">${v}%</option>`).join('')}
        </select>
      </div>
      <button class="btn small secondary" onclick="duplicateLastMaterial()">Kopier siste</button>
      <button class="btn small secondary" onclick="addMaterial()">+ Legg til materiale</button>
      <button class="btn small soft" onclick="openSendCalcToOfferModal()">📄 Send arbeid til tilbud</button>
    </div>

    <!-- MATERIALETABELL -->
    <div class="table-wrap" style="margin-top:14px">
      <table>
        <thead><tr><th>Navn / Varenr</th><th>Antall</th><th>Enhet</th><th>Innpris</th><th>Svinn %</th><th>Påslag %</th><th></th></tr></thead>
        <tbody>
          ${p.materials.length ? p.materials.map(m => `
            <tr>
              <td>
                <input value="${escapeAttr(m.name)}" onchange="updMaterial('${m.id}','name',this.value)" />
                ${m.itemNo ? `<div style="font-size:11px;color:var(--muted);margin-top:3px;padding-left:2px">🔖 ${escapeHtml(m.itemNo)}</div>` : ''}
              </td>
              <td><input type="number" value="${m.qty}" onchange="updMaterial('${m.id}','qty',this.value)" /></td>
              <td><input value="${escapeAttr(m.unit)}" onchange="updMaterial('${m.id}','unit',this.value)" /></td>
              <td><input type="number" value="${displayVatValue(p, m.cost)}" onchange="updMaterial('${m.id}','cost',this.value)" style="${m.cost === 0 ? 'border-color:#f0a202;background:#fffbea' : ''}" /></td>
              <td><input type="number" value="${m.waste}" onchange="updMaterial('${m.id}','waste',this.value)" /></td>
              <td><input type="number" value="${m.markup}" onchange="updMaterial('${m.id}','markup',this.value)" /></td>
              <td><button class="btn small danger" onclick="removeMaterial('${m.id}')">Slett</button></td>
            </tr>`).join('') : `<tr><td colspan="7"><div class="empty">Ingen materialer lagt til enda.</div></td></tr>`}
        </tbody>
      </table>
    </div>
    ${p.materials.some(m => m.cost === 0) ? `<div class="footer-note" style="color:var(--yellow);margin-top:8px">⚠️ Gule felt mangler pris — fyll inn manuelt eller last opp prisfil.</div>` : ''}`;
}
