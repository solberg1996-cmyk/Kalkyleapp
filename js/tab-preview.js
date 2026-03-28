// ── Tilbudsvisning-fane (editor + forhåndsvisning) ───────────────────────
import { uid, escapeHtml, escapeAttr, currency } from './utils.js';
import { getProject } from './state.js';
import { compute, computeOfferPostsTotal } from './compute.js';
import { _offerState, renderOfferPreview, rebuildExtraPosts, getExtraPosts } from './offer-preview.js';

export function renderTabPreview(p) {
  const scale = 0.214;
  const docW = 794, docH = 1123;
  const thumbW = Math.round(docW * scale);
  const thumbH = Math.round(docH * scale);
  return '<div style="position:relative;height:calc(100vh - 130px);overflow:hidden">'
    + '<div style="overflow-y:auto;padding:20px 220px 20px 20px;display:flex;flex-direction:column;gap:12px;height:100%" id="offerEditorPane"></div>'
    + '<div style="position:absolute;top:16px;right:16px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:10">'
    + '<div style="font-size:10px;color:#555;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Forhåndsvisning</div>'
    + '<div style="width:' + thumbW + 'px;height:' + thumbH + 'px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer;border-radius:2px;border:1px solid #bbb" title="Klikk for full visning" onclick="openOfferFullPreview()">'
    + '<div id="offerPreviewDoc" style="width:' + docW + 'px;height:' + docH + 'px;background:#fff;transform:scale(' + scale + ');transform-origin:top left;overflow:hidden;pointer-events:none"></div>'
    + '</div>'
    + '<button onclick="openOfferFullPreview()" style="background:#333;color:#fff;border:none;border-radius:5px;padding:5px 12px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;margin-bottom:6px">🔍 Åpne tilbud</button>'
    + '<button onclick="downloadOfferPDF()" style="background:#34c759;color:#fff;border:none;border-radius:5px;padding:5px 12px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;margin-bottom:6px">⬇️ Last ned PDF</button>'
    + '<button onclick="sendOfferNow()" style="background:#2e75b6;color:#fff;border:none;border-radius:5px;padding:5px 12px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap">📧 Send tilbud</button>'
    + '</div>'
    + '</div>';
}

export function initOfferPreviewTab(p, currentProjectId) {
  if (!p) return;
  _offerState.texts.innledning = _offerState.texts.innledning || (p.description || '');
  _offerState.texts.fremdrift = _offerState.texts.fremdrift || ('Planlagt oppstart: ' + (p.startPref || 'Etter avtale') + '\nOppstart og ferdigstillelse er estimert og kan påvirkes av værforhold, leveranser og uforutsette forhold.');
  _offerState.texts.forbehold = _offerState.texts.forbehold || ('Tilbudet er gyldig i ' + (p.offer && p.offer.validity ? p.offer.validity : '14') + ' dager fra tilbudsdato, dersom annet ikke er avtalt.');
  if (!_offerState.arbeidsomfangPosts.length && p.offerPosts && p.offerPosts.length) {
    _offerState.arbeidsomfangPosts = p.offerPosts.map(function (post) {
      return { id: post.id, name: post.name, checked: true };
    });
  }
  if (!_offerState.customPosts.length && p.offerPosts && p.offerPosts.length) {
    _offerState.customPosts = p.offerPosts.map(function (post) {
      return { id: uid(), name: post.name, price: post.price || 0, sourceIds: [post.id] };
    });
  }
  rebuildExtraPosts(p);
  renderOfferEditorPane(currentProjectId);
  renderOfferPreview(currentProjectId);
}

export function renderOfferEditorPane(currentProjectId) {
  const el = document.getElementById('offerEditorPane');
  if (!el) return;
  const p = getProject(currentProjectId);
  if (!p) return;
  const cv = compute(p);
  const ps = computeOfferPostsTotal(p);
  const os = _offerState;

  const imStd = [
    { key: 'elektriker', label: 'Elektrikerarbeider' },
    { key: 'rorlegger', label: 'Rørleggerarbeider' },
    { key: 'maling', label: 'Maling og sparkling' },
    { key: 'byggesoknad', label: 'Byggesøknad og prosjektering' },
    { key: 'avfall', label: 'Avfallshåndtering' },
    { key: 'stillas', label: 'Stillas' },
  ];
  const imChecks = imStd.map(function (item) {
    return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:3px 0">'
      + '<input type="checkbox" style="width:auto" ' + (os.ikkemedregnet[item.key] ? 'checked' : '') + ' onchange="_offerState.ikkemedregnet.' + item.key + '=this.checked;renderOfferPreview()" />'
      + item.label + '</label>';
  }).join('');
  const imCustom = os.ikkemedregnet.custom.map(function (t, i) {
    return '<div style="display:flex;gap:6px;align-items:center;margin-top:4px">'
      + '<input value="' + escapeAttr(t) + '" style="flex:1;font-size:12px;padding:5px 8px" oninput="_offerState.ikkemedregnet.custom[' + i + ']=this.value;renderOfferPreview()" />'
      + '<button onclick="_offerState.ikkemedregnet.custom.splice(' + i + ',1);renderOfferEditorPane();renderOfferPreview()" style="border:none;background:#fff1f0;color:var(--red);border-radius:6px;padding:5px 8px;cursor:pointer">✕</button>'
      + '</div>';
  }).join('');

  const aoRows = os.arbeidsomfangPosts.map(function (item, i) {
    return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:3px 0">'
      + '<input type="checkbox" style="width:auto" ' + (item.checked ? 'checked' : '') + ' onchange="_offerState.arbeidsomfangPosts[' + i + '].checked=this.checked;renderOfferPreview()" />'
      + escapeHtml(item.name) + '</label>';
  }).join('');
  const aoExtra = os.arbeidsomfangExtra.map(function (t, i) {
    return '<div style="display:flex;gap:6px;align-items:center;margin-top:4px">'
      + '<input value="' + escapeAttr(t.text) + '" placeholder="Skriv inn..." style="flex:1;font-size:12px;padding:5px 8px" oninput="_offerState.arbeidsomfangExtra[' + i + '].text=this.value;renderOfferPreview()" />'
      + '<button onclick="_offerState.arbeidsomfangExtra.splice(' + i + ',1);renderOfferEditorPane();renderOfferPreview()" style="border:none;background:#fff1f0;color:var(--red);border-radius:6px;padding:5px 8px;cursor:pointer">✕</button>'
      + '</div>';
  }).join('');

  el.innerHTML = ''
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
    + '<div style="font-size:16px;font-weight:800">📑 Tilbudsvisning</div>'
    + '<button class="btn primary" onclick="openAndSendOffer()">📨 Åpne og send tilbud</button>'
    + '</div>'
    + '<div class="card" style="margin:0">'
    + '<div class="section-head"><div class="section-title">1. Innledning</div>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer"><input type="checkbox" style="width:auto" ' + (os.sections.innledning ? 'checked' : '') + ' onchange="_offerState.sections.innledning=this.checked;renderOfferPreview()" /> Vis</label>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Tilbudet gjelder tømrerarbeider i forbindelse med...</div>'
    + '<textarea style="font-size:13px;min-height:60px" placeholder="Beskriv jobben..." oninput="_offerState.texts.innledning=this.value;renderOfferPreview()">' + escapeHtml(os.texts.innledning || p.description || '') + '</textarea>'
    + '</div>'
    + '<div class="card" style="margin:0">'
    + '<div class="section-head"><div class="section-title">2. Arbeidsomfang</div>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer"><input type="checkbox" style="width:auto" ' + (os.sections.arbeidsomfang ? 'checked' : '') + ' onchange="_offerState.sections.arbeidsomfang=this.checked;renderOfferPreview()" /> Vis</label>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Huk av hva som er inkludert:</div>'
    + (aoRows || '<div style="font-size:12px;color:var(--muted);font-style:italic">Ingen tilbudsposter funnet — legg til manuelt under</div>')
    + aoExtra
    + '<button class="btn small soft" style="margin-top:8px" onclick="_offerState.arbeidsomfangExtra.push({id:Math.random().toString(36).slice(2),text:\'\'});renderOfferEditorPane();renderOfferPreview()">+ Legg til linje</button>'
    + '</div>'
    + '<div class="card" style="margin:0">'
    + '<div class="section-head"><div class="section-title">3. Ikke medregnet</div>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer"><input type="checkbox" style="width:auto" ' + (os.sections.ikkemedregnet ? 'checked' : '') + ' onchange="_offerState.sections.ikkemedregnet=this.checked;renderOfferPreview()" /> Vis</label>'
    + '</div>'
    + imChecks
    + '<div style="margin-top:6px;padding:8px 10px;background:#f5f5f5;border-radius:8px;font-size:12px;color:var(--muted)">✅ Alltid med: Arbeid som følge av skjulte feil eller mangler i eksisterende konstruksjon</div>'
    + imCustom
    + '<button class="btn small soft" style="margin-top:8px" onclick="_offerState.ikkemedregnet.custom.push(\'\');renderOfferEditorPane();renderOfferPreview()">+ Legg til linje</button>'
    + '</div>'
    + '<div class="card" style="margin:0">'
    + '<div class="section-head"><div class="section-title">4. Pris og betaling</div>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer"><input type="checkbox" style="width:auto" ' + (os.sections.prisogbetaling ? 'checked' : '') + ' onchange="_offerState.sections.prisogbetaling=this.checked;renderOfferPreview()" /> Vis</label>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 10px;border-radius:10px;border:2px solid ' + (os.prisType === 'medgaatt' ? 'var(--blue)' : 'var(--line)') + ';background:' + (os.prisType === 'medgaatt' ? '#f0f7ff' : '#fff') + '"><input type="radio" name="prisType" value="medgaatt" style="width:auto" ' + (os.prisType === 'medgaatt' ? 'checked' : '') + ' onchange="_offerState.prisType=this.value;renderOfferEditorPane();renderOfferPreview()" /><div><div style="font-weight:700">Etter medgått tid</div><div style="font-size:11px;color:var(--muted)">Arbeidet utføres etter medgått tid og materialer</div></div></label>'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 10px;border-radius:10px;border:2px solid ' + (os.prisType === 'fastpris' ? 'var(--blue)' : 'var(--line)') + ';background:' + (os.prisType === 'fastpris' ? '#f0f7ff' : '#fff') + '"><input type="radio" name="prisType" value="fastpris" style="width:auto" ' + (os.prisType === 'fastpris' ? 'checked' : '') + ' onchange="_offerState.prisType=this.value;renderOfferEditorPane();renderOfferPreview()" /><div><div style="font-weight:700">Fastpris</div><div style="font-size:11px;color:var(--muted)">Arbeidet utføres til avtalt fastpris</div></div></label>'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 10px;border-radius:10px;border:2px solid ' + (os.prisType === 'begge' ? 'var(--blue)' : 'var(--line)') + ';background:' + (os.prisType === 'begge' ? '#f0f7ff' : '#fff') + '"><input type="radio" name="prisType" value="begge" style="width:auto" ' + (os.prisType === 'begge' ? 'checked' : '') + ' onchange="_offerState.prisType=this.value;renderOfferEditorPane();renderOfferPreview()" /><div><div style="font-weight:700">Kombinasjon</div><div style="font-size:11px;color:var(--muted)">Utføres etter medgått tid og fastpris</div></div></label>'
    + '</div>'
    + '</div>'
    + '<div class="card" style="margin:0">'
    + '<div class="section-head"><div class="section-title">⏱️ Beregnet tid</div></div>'
    + '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Totalt beregnet: <strong>' + (ps.hours + cv.hoursTotal) + 't</strong> → ca. ' + Math.ceil((ps.hours + cv.hoursTotal) / 8) + ' arbeidsdager á 8t</div>'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + '<div style="flex:1"><label style="font-size:12px">Antall arbeidsdager i tilbudet</label>'
    + '<input type="number" placeholder="' + Math.ceil((ps.hours + cv.hoursTotal) / 8) + '" value="' + escapeAttr(os.estDays || '') + '" style="font-size:20px;font-weight:800;padding:8px 12px" oninput="_offerState.estDays=this.value;renderOfferPreview()" /></div>'
    + '<div style="font-size:13px;color:var(--muted)">arbeidsdager</div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:6px">Vises i tilbudet som: Beregnet tid: XX arbeidsdager</div>'
    + '</div>'
    + (function () {
      var extras = getExtraPosts(p);
      if (!extras.length) return '';
      var rows = extras.map(function (ep) {
        var chk = os.extraPostsChecked[ep.id] !== false;
        return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:3px 0">'
          + '<input type="checkbox" style="width:auto" data-epid="' + ep.id + '" class="ep-chk" ' + (chk ? 'checked' : '') + '  />'
          + escapeHtml(ep.name) + ' — ' + currency(ep.amount) + '</label>';
      }).join('');
      return '<div class="card" style="margin:0">'
        + '<div class="section-head"><div class="section-title">🔧 Tilleggsposter</div></div>'
        + '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Fra prosjektkostnader og innleid:</div>'
        + rows + '</div>';
    })()
    + '<div class="card" style="margin:0">'
    + '<div class="section-head"><div class="section-title">📋 Postervisning i tilbud</div></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="radio" name="offerPostMode" value="all" ' + (os.postMode === 'all' ? 'checked' : '') + ' onchange="setOfferPostMode(this.value)" style="width:auto"> Vis alle poster enkeltvis</label>'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="radio" name="offerPostMode" value="simple" ' + (os.postMode === 'simple' ? 'checked' : '') + ' onchange="setOfferPostMode(this.value)" style="width:auto"> Enkel — Tømrerarbeid + Materialer</label>'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="radio" name="offerPostMode" value="custom" ' + (os.postMode === 'custom' ? 'checked' : '') + ' onchange="setOfferPostMode(this.value)" style="width:auto"> Tilpasset — slå sammen og gi nye navn</label>'
    + '</div>'
    + '<div id="customPostEditor" style="' + (os.postMode === 'custom' ? '' : 'display:none') + ';margin-top:10px"></div>'
    + '</div>'
    + '<div class="card" style="margin:0">'
    + '<div class="section-head"><div class="section-title">➕ Egne seksjoner</div><button class="btn small soft" onclick="addFreeSection()">+ Legg til</button></div>'
    + '<div id="freeSectionList" style="display:flex;flex-direction:column;gap:8px;margin-top:4px">'
    + os.freeSections.map(function (fs, i) {
      return '<div style="background:#f8f9fc;border:1px solid var(--line);border-radius:10px;padding:8px">'
        + '<div style="display:flex;gap:6px;margin-bottom:6px">'
        + '<input value="' + escapeAttr(fs.title) + '" placeholder="Tittel" style="flex:1;font-size:12px;padding:5px 8px;font-weight:700" oninput="_offerState.freeSections[' + i + '].title=this.value;renderOfferPreview()" />'
        + '<button onclick="_offerState.freeSections.splice(' + i + ',1);renderOfferEditorPane();renderOfferPreview()" style="border:none;background:#fff1f0;color:var(--red);border-radius:6px;padding:5px 8px;cursor:pointer;font-size:12px">✕</button>'
        + '</div>'
        + '<textarea style="font-size:12px;min-height:60px" placeholder="Tekst..." oninput="_offerState.freeSections[' + i + '].text=this.value;renderOfferPreview()">' + escapeHtml(fs.text || '') + '</textarea>'
        + '</div>';
    }).join('')
    + '</div>'
    + '</div>';

  if (os.postMode === 'custom') renderCustomPostEditor(currentProjectId);
}

function renderCustomPostEditor(currentProjectId) {
  const p = getProject(currentProjectId);
  if (!p) return;
  const el = document.getElementById('customPostEditor');
  if (!el) return;
  el.innerHTML = '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Slå sammen poster og gi nye navn:</div>'
    + _offerState.customPosts.map(function (cp, i) {
      return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
        + '<input value="' + escapeAttr(cp.name) + '" style="flex:1;font-size:12px;padding:6px 8px" oninput="_offerState.customPosts[' + i + '].name=this.value;renderOfferPreview()" />'
        + '<button onclick="removeCustomPost(' + i + ')" style="border:none;background:#fff1f0;color:var(--red);border-radius:6px;padding:6px 8px;cursor:pointer;font-size:12px">✕</button>'
        + '</div>';
    }).join('')
    + '<button class="btn small soft" style="width:100%;margin-top:4px" onclick="mergeAllCustomPosts()">Slå sammen alle til én</button>';
}
