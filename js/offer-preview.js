// ── Tilbuds-PDF-generering og forhåndsvisning ────────────────────────────
import { state, getCustomer, getProject } from './state.js';
import { uid, escapeHtml, escapeAttr, currency } from './utils.js';
import { compute, computeOfferPostsTotal } from './compute.js';

// ── Offer View State ─────────────────────────────────────────────────────
export var _offerState = {
  postMode: 'all',
  customPosts: [],
  sections: {
    innledning: true, grunnlag: true, arbeidsomfang: true,
    ikkemedregnet: true, prisogbetaling: true, fremdrift: true, forbehold: true
  },
  texts: { innledning: '', fremdrift: '', forbehold: '' },
  arbeidsomfangPosts: [],
  arbeidsomfangExtra: [],
  ikkemedregnet: {
    elektriker: true, rorlegger: true, maling: true,
    byggesoknad: true, avfall: true, stillas: false, custom: []
  },
  prisType: 'medgaatt',
  freeSections: [],
  estDays: '',
  rigChecked: true,
  extraPostsChecked: {}
};

export function getOfferCSS(color) {
  return '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:Calibri,Arial,sans-serif;color:#000;font-size:11pt;line-height:1.5}'
    + '.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}'
    + '.co{text-align:left;font-size:10.5pt;line-height:1.5}'
    + '.co strong{font-size:11.5pt;display:block;font-weight:700}'
    + '.divider{border:none;border-top:2.5px solid ' + color + ';margin:12px 0 28px}'
    + '.custbox{border:2.5px solid ' + color + ';padding:16px 18px;font-size:10.5pt;line-height:2.1;display:inline-block;min-width:280px;max-width:45%;margin-bottom:28px;border-radius:4px}'
    + '.title{font-size:26pt;font-weight:700;margin-bottom:18px}'
    + '.mt{width:100%;border-collapse:collapse;margin-bottom:24px}'
    + '.mt .hr th{background:' + color + ';color:#fff;padding:8px 12px;text-align:left;font-size:10pt;font-weight:600}'
    + '.mt .hr th.ac{text-align:right}'
    + '.mt td{padding:7px 12px;border-bottom:1px solid #e8e8e8;font-size:10.5pt;vertical-align:top}'
    + '.mt tr:nth-child(odd) td{background:#f0f5fb}'
    + '.mt tr:nth-child(even) td{background:#fff}'
    + '.dc{width:65%}'
    + '.ac{text-align:right;font-weight:700;white-space:nowrap}'
    + '.sum-row td{border-top:1.5px solid #aaa;font-weight:700;padding:8px 12px;background:#f0f5fb!important}'
    + '.mva-row td{color:#666;font-size:10pt;background:#fff!important}'
    + '.total-row td{background:' + color + '!important;color:#fff!important;font-weight:800;font-size:11.5pt;padding:10px 12px}'
    + '.sec{margin-bottom:18px}'
    + '.sec h3{font-size:10.5pt;font-weight:700;text-transform:uppercase;margin-bottom:6px}'
    + '.sec p{font-size:10.5pt;line-height:1.65;color:#222;margin-bottom:5px}';
}

export function getExtraPosts(p) {
  var posts = [];
  var cv = compute(p);
  var subTotal = (p.extras.subcontractors || []).reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
  var lhh = Number(p.work.laborHireHours) || 0, lhr = Number(p.extras.laborHire) || 0;
  var laborHireTotal = lhh > 0 ? (lhr * lhh) : lhr;
  var rental = Number(p.extras.rental) || 0;
  var waste = Number(p.extras.waste) || 0;
  var scaffolding = Number(p.extras.scaffolding) || 0;
  var drawings = Number(p.extras.drawings) || 0;
  var misc = Number(p.extras.misc) || 0;
  var rigEx = cv.rigEx || 0;

  if (laborHireTotal > 0) posts.push({ id: '__laborhire', name: 'Innleid håndverker', amount: laborHireTotal });
  if (subTotal > 0) {
    (p.extras.subcontractors || []).forEach(function (s) {
      if (Number(s.amount) > 0) posts.push({ id: '__sub_' + s.id, name: s.trade, amount: Number(s.amount) });
    });
  }
  if (rental > 0) posts.push({ id: '__rental', name: 'Leie av utstyr', amount: rental });
  if (waste > 0) posts.push({ id: '__waste', name: 'Avfall / deponi', amount: waste });
  if (scaffolding > 0) posts.push({ id: '__scaffolding', name: 'Stillas', amount: scaffolding });
  if (drawings > 0) posts.push({ id: '__drawings', name: 'Tegninger / byggesøknad', amount: drawings });
  if (misc > 0) posts.push({ id: '__misc', name: 'Diverse', amount: misc });
  if (rigEx > 0) posts.push({ id: '__rigg', name: 'Rigg og Drift', amount: rigEx });
  return posts;
}

export function rebuildExtraPosts(p) {
  var posts = getExtraPosts(p);
  posts.forEach(function (post) {
    if (_offerState.extraPostsChecked[post.id] == null) {
      _offerState.extraPostsChecked[post.id] = true;
    }
  });
}

export function renderOfferPreview(currentProjectId) {
  const p = getProject(currentProjectId);
  if (!p) return;
  rebuildExtraPosts(p);
  const cv = compute(p);
  const ps = computeOfferPostsTotal(p);
  const co = state.company || {};
  const color = co.color || '#2e75b6';
  const cust = getCustomer(p.customerId);
  const os = _offerState;
  function fmt(n) { return Math.round(n || 0).toLocaleString('nb-NO') + ' kr'; }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function nl2br(s) { return esc(s || '').replace(/\n/g, '<br>'); }

  // Build price rows
  var priceRows = '', totalEx = 0;
  if (os.postMode === 'simple') {
    var lEx = cv.totalLaborSaleEx, mEx = cv.totalMatSaleEx, eEx = cv.extrasBase + cv.rigEx;
    if (lEx > 0) { priceRows += '<tr><td class="dc"><b>Tømrerarbeider</b></td><td class="ac">' + fmt(lEx) + '</td></tr>'; totalEx += lEx; }
    if (mEx > 0) { priceRows += '<tr><td class="dc"><b>Materialer</b></td><td class="ac">' + fmt(mEx) + '</td></tr>'; totalEx += mEx; }
    if (eEx > 0) { priceRows += '<tr><td class="dc"><b>Rigg og Drift</b></td><td class="ac">' + fmt(eEx) + '</td></tr>'; totalEx += eEx; }
  } else if (os.postMode === 'custom') {
    os.customPosts.forEach(function (cp) { priceRows += '<tr><td class="dc"><b>' + esc(cp.name || '') + '</b></td><td class="ac">' + fmt(cp.price) + '</td></tr>'; totalEx += cp.price; });
  } else {
    if (p.offerPosts && p.offerPosts.length) {
      p.offerPosts.filter(function (post) { return post.type !== 'option' || post.enabled; }).forEach(function (post) {
        var desc = '';
        if (post.type === 'calc') {
          var hasLabor = post.snapshotCompute && post.snapshotCompute.laborSaleEx > 0;
          var hasMat = post.snapshotCompute && post.snapshotCompute.matSaleEx > 0;
          if (hasLabor && hasMat) desc = 'Tømrerarbeid + Materialer';
          else if (hasLabor) desc = 'Tømrerarbeid';
          else if (hasMat) desc = 'Materialer';
        } else if (post.description) { desc = post.description; }
        var optBadge = post.type === 'option' ? '<span style="font-size:9pt;color:#a96800;font-weight:600;margin-left:6px">(Opsjon)</span>' : '';
        priceRows += '<tr><td class="dc"><b>' + esc(post.name || '') + optBadge + '</b>' + (desc ? '<br><span style="font-size:10pt;color:#555">' + esc(desc) + '</span>' : '') + '</td><td class="ac">' + fmt(post.price || 0) + '</td></tr>';
        totalEx += Number(post.price) || 0;
      });
    } else {
      var lEx2 = cv.totalLaborSaleEx, mEx2 = cv.totalMatSaleEx;
      if (lEx2 > 0) { priceRows += '<tr><td class="dc"><b>Tømrerarbeider</b></td><td class="ac">' + fmt(lEx2) + '</td></tr>'; totalEx += lEx2; }
      if (mEx2 > 0) { priceRows += '<tr><td class="dc"><b>Materialer</b></td><td class="ac">' + fmt(mEx2) + '</td></tr>'; totalEx += mEx2; }
    }
    getExtraPosts(p).forEach(function (ep) {
      if (os.extraPostsChecked[ep.id] !== false) {
        priceRows += '<tr><td class="dc"><b>' + esc(ep.name) + '</b></td><td class="ac">' + fmt(ep.amount) + '</td></tr>';
        totalEx += ep.amount;
      }
    });
  }
  var mva = Math.round(totalEx * 0.25);
  var totalInc = Math.round(totalEx * 1.25);

  var logoSrc = co.logo || window._fallbackLogo || '';
  var logoHtml = logoSrc ? '<div style="width:350px;height:140px;display:flex;align-items:center"><img src="' + logoSrc + '" style="max-width:100%;max-height:100%;object-fit:contain"></div>' : '';
  var coBlock =
    (co.name ? '<strong style="display:block;margin-bottom:4px">' + esc(co.name) + '</strong>' : '')
    + (co.address ? '<div>' + esc(co.address) + '</div>' : '')
    + ((co.zip || co.city) ? '<div>' + (esc(co.zip || '') + ' ' + esc(co.city || '')).trim() + '</div>' : '')
    + (co.phone ? '<div>Tlf: ' + esc(co.phone) + '</div>' : '')
    + (co.email ? '<div>' + esc(co.email) + '</div>' : '')
    + (co.orgNr ? '<div>Org.nr: ' + esc(co.orgNr) + '</div>' : '');
  var custBlock = (cust ? '<b>' + esc(cust.name) + '</b>' : 'NAVN') + '<br>'
    + (cust && cust.phone ? esc(cust.phone) + '<br>' : '')
    + (p.address ? esc(p.address) + '<br>' : '')
    + (cust && cust.email ? esc(cust.email) : '');

  function sec(key, title, content) {
    if (!os.sections[key]) return '';
    return '<div class="sec"><h3>' + title + '</h3>' + content + '</div>';
  }

  var innlDesc = os.texts.innledning || p.name || '[prosjekt]';
  var innl = 'Tilbudet gjelder tømrerarbeider i forbindelse med ' + esc(innlDesc) + '. Arbeidet utføres iht. befaring og avtalt omfang.';
  var validity = p.offer && p.offer.validity ? p.offer.validity : '14';

  var css = getOfferCSS(color);

  var html = '<style>' + css + '</style>'
    + '<div class="hdr">' + logoHtml + '<div class="co">' + coBlock + '</div></div>'
    + '<hr class="divider">'
    + '<div class="custbox">' + custBlock + '</div>'
    + '<div class="title">TILBUD</div>'
    + '<table class="mt"><thead><tr class="hr"><th class="dc">BESKRIVELSE</th><th class="ac">SUM eks mva</th></tr></thead><tbody>'
    + priceRows
    + '<tr class="mva-row"><td class="dc">MVA 25%</td><td class="ac">' + fmt(mva) + '</td></tr>'
    + '<tr class="sum-row"><td class="dc">Sum eks. mva</td><td class="ac">' + fmt(totalEx) + '</td></tr>'
    + '<tr class="total-row"><td class="dc"><b>ESTIMERT TOTALPRIS INKL. MVA</b></td><td class="ac">' + fmt(totalInc) + '</td></tr>'
    + '</tbody></table>'
    + sec('innledning', 'Innledning', '<p>' + innl + '</p>')
    + sec('grunnlag', 'Grunnlag for tilbudet', '<p>Tilbudet er basert på befaring, mottatte tegninger/skisser og normale arbeidsforhold. Dersom forutsetningene endres eller det avdekkes forhold som ikke var synlige ved befaring, kan dette medføre endringer i pris og fremdrift.</p>')
    + sec('arbeidsomfang', 'Arbeidsomfang',
      '<p>Følgende arbeid er inkludert i tilbudet:</p>'
      + os.arbeidsomfangPosts.filter(function (i) { return i.checked; }).map(function (i) { return '<p style="padding-left:16px">- ' + esc(i.name) + '</p>'; }).join('')
      + os.arbeidsomfangExtra.filter(function (i) { return i.text; }).map(function (i) { return '<p style="padding-left:16px">- ' + esc(i.text) + '</p>'; }).join('')
    )
    + sec('ikkemedregnet', 'Ikke medregnet i tilbudet',
      '<p>Følgende arbeider er ikke inkludert dersom annet ikke er spesifisert:</p>'
      + (os.ikkemedregnet.elektriker ? '<p style="padding-left:16px">- Elektrikerarbeider</p>' : '')
      + (os.ikkemedregnet.rorlegger ? '<p style="padding-left:16px">- Rørleggerarbeider</p>' : '')
      + (os.ikkemedregnet.maling ? '<p style="padding-left:16px">- Maling og sparkling</p>' : '')
      + (os.ikkemedregnet.byggesoknad ? '<p style="padding-left:16px">- Byggesøknad og prosjektering</p>' : '')
      + (os.ikkemedregnet.avfall ? '<p style="padding-left:16px">- Avfallshåndtering</p>' : '')
      + (os.ikkemedregnet.stillas ? '<p style="padding-left:16px">- Stillas</p>' : '')
      + os.ikkemedregnet.custom.filter(function (t) { return t; }).map(function (t) { return '<p style="padding-left:16px">- ' + esc(t) + '</p>'; }).join('')
      + '<p style="padding-left:16px">- Arbeid som følge av skjulte feil eller mangler i eksisterende konstruksjon</p>'
    )
    + sec('prisogbetaling', 'Pris og betaling',
      '<p>Arbeidet utføres ' + (os.prisType === 'fastpris' ? 'til avtalt fastpris' : os.prisType === 'begge' ? 'etter medgått tid og fastpris' : 'etter medgått tid og materialer') + '. Betalingsfrist er 10 dager netto. Ved større arbeider kan det faktureres delbetaling underveis.</p>'
      + '<p>Timepris tømrer: kr ' + Math.round(p.work.timeRate || 850) + ' eks. mva pr time</p>'
      + '<p>Påslag på materiell: ' + (p.settings.materialMarkup || 15) + '%</p>'
      + '<p>Arbeid utover beskrevet omfang regnes som tilleggsarbeid og utføres etter avtale med kunde.</p>'
    )
    + sec('fremdrift', 'Fremdrift',
      '<p>Planlagt oppstart: ' + esc(p.startPref || 'Etter avtale') + '</p>'
      + (os.estDays ? '<p>Beregnet tid: <strong>' + esc(os.estDays) + '</strong> arbeidsdager.</p>' : '')
      + '<p>Oppstart og ferdigstillelse er estimert og kan påvirkes av værforhold, leveranser og uforutsette forhold.</p>')
    + sec('forbehold', 'Forbehold', '<p>Tilbudet er basert på dagens priser på materialer og lønn. Det tas forbehold om prisendringer fra leverandører eller uforutsette forhold utenfor entreprenørens kontroll. Riggposten omfatter transport/frakt av materialer, materialhåndtering, tildekking av konstruksjonen i byggetiden, organisering/koordinering, rigging av utstyr og verktøy, vernerunder, HMS-tiltak og retur, etc.</p>'
      + '<p>Tilbudet er gyldig i <b>' + esc(validity) + '</b> dager fra tilbudsdato, dersom annet ikke er avtalt.</p>')
    + os.freeSections.map(function (fs) {
      return fs.title || fs.text ? '<div class="sec"><h3>' + esc(fs.title || '') + '</h3><p>' + nl2br(fs.text) + '</p></div>' : '';
    }).join('');

  var doc = document.getElementById('offerPreviewDoc');
  if (doc) doc.innerHTML = html;
}

export function openOfferFullPreview(currentProjectId) {
  const doc = document.getElementById('offerPreviewDoc');
  if (!doc) return;
  const co = state.company || {};
  const color = co.color || '#2e75b6';
  var css = getOfferCSS(color);
  var html = '<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><title>Tilbud</title><style>' + css
    + 'body{padding:30px 40px}@media print{.no-print{display:none!important}}'
    + '</style></head><body>'
    + '<div style="text-align:center;margin-bottom:20px" class="no-print">'
    + '<button onclick="window.print()" style="background:' + color + ';color:#fff;border:none;border-radius:6px;padding:12px 32px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Skriv ut / Lagre som PDF</button>'
    + '</div>'
    + doc.innerHTML + '</body></html>';
  var blob = new Blob([html], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}

export function downloadOfferPDF(currentProjectId) {
  const p = getProject(currentProjectId);
  if (!p) return;
  const doc = document.getElementById('offerPreviewDoc');
  if (!doc) return;
  const co = state.company || {};
  const color = co.color || '#2e75b6';
  var css = getOfferCSS(color);
  var html = '<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><title>Tilbud</title><style>' + css
    + 'body{padding:30px 40px}@media print{.no-print{display:none!important}}'
    + '</style></head><body>'
    + doc.innerHTML + '</body></html>';
  var blob = new Blob([html], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  var name = (p.name || 'prosjekt').replace(/[^\wæøåÆØÅ0-9-]/g, '_');
  var a = document.createElement('a');
  a.href = url;
  a.download = 'Tilbud_' + name + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}

export function sendOfferNow(currentProjectId) {
  const p = getProject(currentProjectId);
  if (!p) return;
  const cust = getCustomer(p.customerId);
  const co = state.company || {};
  const toEmail = cust && cust.email ? cust.email : '';
  const subject = 'Tilbud - ' + (p.name || 'Prosjekt') + (co.name ? ' - ' + co.name : '');
  const body = 'Hei,\n\nVedlagt finner du tilbud på ' + (p.name || 'prosjekt') + '.\n\nGi gjerne tilbakemelding dersom du har spørsmål.\n\nMvh\n' + (co.name || '');
  const mailtoLink = 'mailto:' + encodeURIComponent(toEmail) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  openOfferFullPreview(currentProjectId);
  setTimeout(function () { window.location.href = mailtoLink; }, 1000);
}

export function openAndSendOffer(currentProjectId) {
  const p = getProject(currentProjectId);
  if (!p) return;
  const cust = getCustomer(p.customerId);
  const co = state.company || {};
  const doc = document.getElementById('offerPreviewDoc');
  if (!doc) return;
  const color = (co && co.color) || '#2e75b6';
  const css = getOfferCSS(color) + 'body{padding:30px 40px}.no-print{display:flex}@media print{.no-print{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}body{padding:30px 40px!important;margin:0!important}}';
  const toEmail = cust && cust.email ? cust.email : '';
  const subject = 'Tilbud - ' + (p.name || 'Prosjekt') + (co && co.name ? ' - ' + co.name : '');
  const body = 'Hei,\n\nVedlagt finner du tilbud på ' + (p.name || 'prosjekt') + '.\n\nGi gjerne tilbakemelding dersom du har spørsmål.\n\nMvh\n' + (co.name || '');
  const mailtoLink = 'mailto:' + encodeURIComponent(toEmail) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  const html = '<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><title>Tilbud</title><style>' + css + '</style></head><body>' + doc.innerHTML + '</body></html>';
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    setTimeout(function () {
      const a = document.createElement('a');
      a.href = mailtoLink;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, 1200);
  }
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
}
