// ── Tilbud-fane (poster og oppsummering) ─────────────────────────────────
import { currency, percent, escapeHtml, escapeAttr } from './utils.js';
import { compute, computeOfferPostsTotal } from './compute.js';

export function renderTabOffer(p) {
  const c = compute(p), ps = computeOfferPostsTotal(p);
  return `
    <div class="section-head">
      <div class="section-title">Tilbudsposter</div>
      <div class="toolbar">
        <button class="btn small secondary" onclick="addOfferPost()">+ Legg til post</button>
        <button class="btn small secondary" onclick="addCalcPost()">Bruk kalkyle som post</button>
      </div>
    </div>
    <div class="card" style="margin-top:8px;background:#fafcff">${renderOfferPosts(p)}</div>
    <div class="card" style="margin-top:14px;background:#fafcff">
      <div class="section-head"><div class="section-title">Oppsummering</div></div>

      <div style="display:flex;align-items:center;gap:12px;background:#f5f8ff;border:1px solid #dce8ff;border-radius:14px;padding:12px 16px;margin-bottom:14px">
        <div id="offerTotalHoursDisplay" style="font-size:28px;font-weight:800;color:#0a84ff">${ps.hours + c.hoursTotal}t</div>
        <div>
          <div style="font-size:13px;font-weight:800">⏱️ Totalt timebruk</div>
          <div id="offerTotalHoursDetail" style="font-size:12px;color:var(--muted)">${c.hoursTotal > 0 ? c.hoursTotal + 't fra arbeid' : ''} ${ps.hours > 0 && c.hoursTotal > 0 ? '+ ' : ''} ${ps.hours > 0 ? ps.hours + 't fra poster' : ''}</div>
        </div>
      </div>

      <div class="row-3">
        <div style="padding:12px;background:#f5f8ff;border-radius:14px;border:1px solid #dce8ff">
          <div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:4px">🔨 Tømrerarbeid</div>
          <div id="summaryLaborVal" style="font-size:20px;font-weight:800">${currency(p.settings.vatMode === 'inc' ? c.totalLaborSaleEx * 1.25 : c.totalLaborSaleEx)}</div>
          <div id="summaryLaborHours" style="font-size:12px;color:var(--muted);margin-top:4px">${c.totalHours} timer totalt</div>
        </div>
        <div style="padding:12px;background:#f5fff8;border-radius:14px;border:1px solid #c3f0d5">
          <div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:4px">🪵 Materialer</div>
          <div style="font-size:20px;font-weight:800">${currency(p.settings.vatMode === 'inc' ? c.totalMatSaleEx * 1.25 : c.totalMatSaleEx)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Innkjøp: ${currency(c.totalMatCost)}</div>
        </div>
        <div style="padding:12px;background:#fffbf0;border-radius:14px;border:1px solid #fde68a">
          <div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:4px">🚗 Andre kostnader</div>
          <div style="font-size:20px;font-weight:800">${currency(p.settings.vatMode === 'inc' ? (c.extrasBase + c.rigEx) * 1.25 : (c.extrasBase + c.rigEx))}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Kjøring, rigg m.m.</div>
        </div>
      </div>

      <div style="margin-top:14px;padding:16px;background:linear-gradient(135deg,#0f1728,#1a2540);border-radius:16px;color:#fff">
        <div style="font-size:11px;color:rgba(255,255,255,.5);margin-bottom:10px;font-weight:700;letter-spacing:.05em">TOTALOVERSIKT</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px">
          <div style="background:rgba(255,255,255,.07);border-radius:12px;padding:12px">
            <div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:700">Pris til kunde eks. mva</div>
            <div style="font-size:20px;font-weight:800;margin-top:4px">${currency(c.totalSaleEx)}</div>
          </div>
          <div style="background:rgba(255,255,255,.08);border-radius:12px;padding:12px">
            <div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:700">Pris til kunde inkl. mva</div>
            <div style="font-size:22px;font-weight:800;margin-top:4px;color:#6ee7a0">${currency(c.totalSaleEx * 1.25)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:700">Din kostnad</div>
            <div style="font-size:16px;font-weight:800;margin-top:4px">${currency(c.totalCostPrice)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:700">Fortjeneste</div>
            <div style="font-size:16px;font-weight:800;margin-top:4px;color:#6ee7a0">${currency(c.totalProfit)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:700">Margin</div>
            <div style="font-size:16px;font-weight:800;margin-top:4px">${percent(c.totalMargin)}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)">
          <div style="font-size:12px;color:rgba(255,255,255,.5)" id="summaryModeNote">${p.settings.vatMode === 'inc' ? 'Viser inkl. mva' : 'Viser eks. mva'}</div>
          <button onclick="persistAndRenderProject()" style="background:#0a84ff;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-weight:800;font-size:14px;cursor:pointer">💾 Lagre</button>
        </div>
      </div>
      <div class="row-3" style="margin-top:12px">
        <div><strong>Faste poster</strong><div>${currency(ps.fixed)}</div></div>
        <div><strong>Valgte opsjoner</strong><div>${currency(ps.options)}</div></div>
        <div><strong>Tilbudssum poster</strong><div>${currency(ps.total)}</div></div>
      </div>
    </div>`;
}

function renderPostExtra(post) {
  var id = post.id;
  if (post.type === 'option') {
    var chk = post.enabled ? 'checked' : '';
    return '<label style="display:flex;align-items:center;gap:8px;margin-top:34px">'
      + '<input style="width:auto" type="checkbox" ' + chk
      + ' onchange="togglePost(\x27' + id + '\x27,this.checked)" /> Valgt opsjon</label>';
  } else if (post.type === 'calc') {
    return '<div style="margin-top:6px;font-size:12px;color:var(--muted)">📦 Materialer + ⏱️ arbeid inkludert</div>'
      + '<button class="btn small soft" style="font-size:12px;margin-top:6px" onclick="restoreCalcPost(\x27' + id + '\x27)">✏️ Tilpass</button>';
  } else {
    return '<div style="margin-top:8px">'
      + '<button class="btn small secondary" style="font-size:12px" onclick="openPostMaterialEditor(\x27' + id + '\x27)">✏️ Tilpass</button>'
      + '</div>';
  }
}

export function renderOfferPosts(p) {
  if (!p.offerPosts) p.offerPosts = [];
  if (!p.offerPosts.length) return `<div class="empty">Ingen tilbudsposter lagt til enda.</div>`;
  const vatLbl = p.settings.vatMode === 'inc' ? 'inkl. mva' : 'eks. mva';
  return p.offerPosts.map(post => {
    const isOpen = post._open !== false;
    const typeLabel = post.type === 'calc' ? 'Kalkyle' : post.type === 'option' ? 'Opsjon' : 'Fast';

    const header = `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;background:${isOpen ? '#f8faff' : '#fff'};border-radius:${isOpen ? '14px 14px 0 0' : '14px'}" onclick="toggleOfferPost('${post.id}')">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:800;font-size:14px">${escapeHtml(post.name || 'Ny post')}</span>
          <span style="font-size:11px;color:var(--muted);background:#f0f0f0;border-radius:4px;padding:1px 6px">${typeLabel}</span>
          ${post.type === 'option' && post.enabled ? '<span style="font-size:11px;background:#edfff4;color:#167a42;border-radius:4px;padding:1px 6px;font-weight:700">✅ Valgt</span>' : ''}
        </div>
        ${post.description && !isOpen ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(post.description)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:17px;font-weight:800;color:${post.type === 'option' && !post.enabled ? 'var(--muted)' : '#0a84ff'}">${currency(post.price || 0)}</div>
        <div style="font-size:10px;color:var(--muted)">${vatLbl}</div>
      </div>
      <div style="color:var(--muted);font-size:13px;margin-left:2px">${isOpen ? '▲' : '▼'}</div>
    </div>`;

    const body = isOpen ? `<div style="padding:12px 14px 14px;border-top:1px solid var(--line)">
      <div class="row-3">
        <div><label>Navn</label><input value="${escapeAttr(post.name || '')}" onchange="updatePost('${post.id}','name',this.value)" /></div>
        <div><label>Type</label><select onchange="updatePost('${post.id}','type',this.value)">
          <option value="fast" ${post.type === 'fast' ? 'selected' : ''}>Fastpris</option>
          <option value="calc" ${post.type === 'calc' ? 'selected' : ''}>Kalkyle</option>
          <option value="option" ${post.type === 'option' ? 'selected' : ''}>Opsjon</option>
        </select></div>
        <div><label>Pris ${vatLbl}</label>
          ${post.type === 'calc'
      ? `<div style="padding:12px 14px;background:#f5f8ff;border:1px solid #dce8ff;border-radius:14px;font-size:18px;font-weight:800">${currency(post.price || 0)} <span style="font-size:11px;color:var(--muted);font-weight:500">🔒</span></div>`
      : `<input type="number" value="${post.price || 0}" onchange="updatePost('${post.id}','price',this.value)" />`
    }
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <div><label>Beskrivelse</label><input value="${escapeAttr(post.description || '')}" onchange="updatePost('${post.id}','description',this.value)" /></div>
        <div>${renderPostExtra(post)}</div>
      </div>
      <div class="inline-actions" style="margin-top:10px;justify-content:flex-end">
        <button class="btn small secondary" onclick="movePost('${post.id}',-1)">↑</button>
        <button class="btn small secondary" onclick="movePost('${post.id}',1)">↓</button>
        <button class="btn small danger" onclick="removePost('${post.id}')">Slett</button>
      </div>
    </div>` : '';

    return `<div style="border:1.5px solid ${isOpen ? '#bcd0f0' : 'var(--line)'};border-radius:14px;overflow:hidden;background:#fff;margin-bottom:6px">${header}${body}</div>`;
  }).join('');
}
