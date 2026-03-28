// ── Arbeid og kostnader-fane ──────────────────────────────────────────────
import { escapeAttr, sel, currency, displayVatValue } from './utils.js';
import { compute } from './compute.js';

export function renderTabWork(p) {
  const cv = compute(p);
  return `
    <div style="font-size:13px;font-weight:800;color:var(--muted);margin-bottom:10px">⚙️ Satser</div>
    <div class="row-3">
      <div><label>Timepris eks. mva</label><input id="wTimeRate" type="number" value="${displayVatValue(p, p.work.timeRate)}" /></div>
      <div><label>Intern timekost</label><input id="wInternalCost" type="number" value="${p.work.internalCost}" /></div>
      <div><label>Risikofaktor</label><select id="wRisk"><option ${sel(p.work.risk, 'Lav')}>Lav (×1.0)</option><option ${sel(p.work.risk, 'Normal')}>Normal (×1.1)</option><option ${sel(p.work.risk, 'Høy')}>Høy (×1.2)</option></select></div>
    </div>
    <div class="row-3" style="margin-top:8px">
      <div><label>Gyldighet tilbud (dager)</label><input id="oValidity" value="${escapeAttr(p.offer.validity || '14')}" placeholder="14" /></div>
      <div></div><div></div>
    </div>
    <div class="row-3" style="margin-top:8px">
      <div><label>Kjøring / drift per time</label><input id="sDriveCost" type="number" value="${displayVatValue(p, p.settings.driveCost)}" /></div>
      <div><label>Påslag materialer %</label><input id="wMatMarkup" type="number" value="${p.settings.materialMarkup}" /></div>
      <div><label>Rigg & drift %</label><input id="eRig" type="number" value="${p.extras.rigPercent}" /></div>
    </div>

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
      <div style="font-size:13px;font-weight:800;color:var(--muted);margin-bottom:10px">📋 Prosjektkostnader</div>
      <div class="row-3">
        <div><label>Leie av utstyr</label><input id="eRental" type="number" value="${displayVatValue(p, p.extras.rental)}" /></div>
        <div><label>Avfall / deponi</label><input id="eWaste" type="number" value="${displayVatValue(p, p.extras.waste)}" /></div>
        <div><label>🏗️ Stillas</label><input id="eScaffolding" type="number" value="${displayVatValue(p, p.extras.scaffolding || 0)}" /></div>
      </div>
      <div class="row-3" style="margin-top:8px">
        <div><label>📐 Tegninger / byggesøknad</label><input id="eDrawings" type="number" value="${displayVatValue(p, p.extras.drawings || 0)}" /></div>
        <div><label>Diverse</label><input id="eMisc" type="number" value="${displayVatValue(p, p.extras.misc)}" /></div>
        <div></div>
      </div>
      <div style="margin-top:10px">
        <label>🔧 Underentreprenører</label>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;margin-bottom:8px">
          ${(p.extras.subcontractors || []).map(s => `
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center">
              <select onchange="updSubcontractor('${s.id}','trade',this.value)" style="padding:10px 12px">
                ${['Rørlegger', 'Elektriker', 'Maler', 'Snekker', 'Flislegger', 'Tømrer', 'Annet'].map(t => `<option value="${t}" ${s.trade === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
              <input type="number" placeholder="Beløp" value="${displayVatValue(p, s.amount || 0)}" onchange="updSubcontractor('${s.id}','amount',this.value)" />
              <button class="btn small danger" onclick="removeSubcontractor('${s.id}')">Slett</button>
            </div>`).join('')}
        </div>
        <button class="btn small soft" onclick="addSubcontractor()">+ Legg til underentreprenør</button>
        ${(p.extras.subcontractors || []).length ? `<div class="footer-note" style="margin-top:6px">Total: <strong>${currency((p.extras.subcontractors || []).reduce((s, x) => s + (Number(x.amount) || 0), 0))}</strong></div>` : ''}
      </div>
    </div>

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
      <div style="font-size:13px;font-weight:800;color:var(--muted);margin-bottom:10px">👷 Innleid håndverker</div>
      <div class="row-3">
        <div><label>Timepris innleid</label><input id="wLaborHireRate" type="number" value="${displayVatValue(p, p.extras.laborHire || 0)}" /></div>
        <div><label>Antall timer</label><input id="wLaborHireHours" type="number" value="${p.work.laborHireHours || 0}" /></div>
        <div><label>Faktiske timer brukt (logging)</label><input id="wActualHours" type="number" value="${p.work.actualHours || 0}" /></div>
      </div>
    </div>
    <div class="footer-note" style="margin-top:8px">Timepris og satser brukes i alle kalkyler for dette prosjektet.</div>`;
}
