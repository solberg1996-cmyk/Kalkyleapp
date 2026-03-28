// ── Info-fane ────────────────────────────────────────────────────────────
import { state } from './state.js';
import { escapeAttr, escapeHtml, sel } from './utils.js';
import { getHistory } from './project-history.js';

export function renderTabInfo(p) {
  const opts = ['<option value="">Velg kunde</option>'].concat(
    state.customers.map(c => `<option value="${c.id}" ${p.customerId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
  ).join('');
  return `
    <div class="row">
      <div><label>Prosjektnavn</label><input id="fName" value="${escapeAttr(p.name)}" /></div>
      <div><label>Kunde</label><select id="fCustomer">${opts}</select></div>
    </div>
    <div class="row">
      <div><label>Adresse</label><input id="fAddress" value="${escapeAttr(p.address)}" /></div>
      <div><label>Type jobb</label><select id="fType"><option ${sel(p.type, 'Terrasse')}>Terrasse</option><option ${sel(p.type, 'Lettvegg')}>Lettvegg</option><option ${sel(p.type, 'Vindu')}>Vindu</option><option ${sel(p.type, 'Listing')}>Listing</option><option ${sel(p.type, 'Kledning')}>Kledning</option><option ${sel(p.type, 'Etterisolering')}>Etterisolering</option><option ${sel(p.type, 'Rehabilitering')}>Rehabilitering</option><option ${sel(p.type, 'Bad')}>Bad</option><option ${sel(p.type, 'Tak')}>Tak</option><option ${sel(p.type, 'Annet')}>Annet</option></select></div>
    </div>
    <div class="row">
      <div><label>Ønsket oppstart</label><select id="fStart"><option ${sel(p.startPref, 'Snarest')}>Snarest</option><option ${sel(p.startPref, 'Innen 2 uker')}>Innen 2 uker</option><option ${sel(p.startPref, 'Innen 1 måned')}>Innen 1 måned</option><option ${sel(p.startPref, 'Etter avtale')}>Etter avtale</option></select></div>
      <div><label>Status</label><select id="fStatus"><option ${sel(p.status, 'Utkast')}>Utkast</option><option ${sel(p.status, 'Sendt')}>Sendt</option><option ${sel(p.status, 'Vunnet')}>Vunnet</option><option ${sel(p.status, 'Tapt')}>Tapt</option><option ${sel(p.status, 'Pågår')}>Pågår</option><option ${sel(p.status, 'Ferdig')}>Ferdig</option></select></div>
    </div>
    <label>Beskrivelse</label><textarea id="fDescription">${escapeHtml(p.description)}</textarea>
    <label>Notat</label><textarea id="fNote">${escapeHtml(p.note || '')}</textarea>
    ${renderVersionHistory(p)}
  `;
}

function renderVersionHistory(p) {
  const history = getHistory(p.id);
  if (!history.length) return '';
  return `
    <div style="margin-top:18px;padding:14px;background:#f5f8ff;border:1px solid #dce8ff;border-radius:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="document.getElementById('versionList').style.display=document.getElementById('versionList').style.display==='none'?'':'none'">
        <div style="font-weight:800;font-size:13px">📜 Versjonshistorikk (${history.length})</div>
        <span style="color:var(--muted);font-size:12px">Klikk for å vise</span>
      </div>
      <div id="versionList" style="display:none;margin-top:10px;max-height:300px;overflow-y:auto">
        ${history.slice().reverse().map(h => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:4px">
            <div>
              <div style="font-size:12px;font-weight:700">${h.date}</div>
              <div style="font-size:11px;color:var(--muted)">${h.snapshot.status || ''} • ${(h.snapshot.materials||[]).length} materialer • ${(h.snapshot.offerPosts||[]).length} poster</div>
            </div>
            <button class="btn small secondary" style="font-size:11px" onclick="if(confirm('Gjenopprette denne versjonen?')) rollbackProject('${p.id}',${h.timestamp})">Gjenopprett</button>
          </div>`).join('')}
      </div>
    </div>`;
}
