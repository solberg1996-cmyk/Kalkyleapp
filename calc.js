// ============================================================
// calc.js — Kalkylemotor for arbeidstid og prosjektkostnad
// ============================================================
// Tar et project-objekt, leser operations (deloppgaver),
// beregner total arbeidstid med justeringsfaktorer og
// indirekte tid, og returnerer fullstendig breakdown.
// ============================================================

// ── PRODUKSJONSTALL (basistimer per enhet) ───────────────────
// Disse er "normaltid" under normale forhold.
// Bruker lagrede erfaringstall fra state.calcRates hvis tilgjengelig.

// Hvert oppslag har low / normal / high timer per enhet.
// «normal» er standardverdien brukt i kalkyler.
// «low» = rutinearbeid, god flyt.  «high» = forstyrrelser, ekstra tilpasning.
const productionRates = {
  terrasse:       { low: 2.0, normal: 2.5, high: 3.2, unit: 'm²',  label: 'Terrasse' },
  kledning:       { low: 1.0, normal: 1.3, high: 1.7, unit: 'm²',  label: 'Kledning' },
  tak:            { low: 1.4, normal: 1.8, high: 2.4, unit: 'm²',  label: 'Tak' },
  lettvegg:       { low: 0.7, normal: 1.0, high: 1.4, unit: 'm²',  label: 'Lettvegg' },
  etterisolering: { low: 0.6, normal: 0.9, high: 1.2, unit: 'm²',  label: 'Etterisolering' },
  vindu:          { low: 3.0, normal: 4.0, high: 5.5, unit: 'stk', label: 'Vindu' },
  gulv:           { low: 0.5, normal: 0.8, high: 1.1, unit: 'm²',  label: 'Gulvlegging' },
  panel:          { low: 0.8, normal: 1.1, high: 1.5, unit: 'm²',  label: 'Innvendig panel' },
  dor:            { low: 2.0, normal: 3.0, high: 4.5, unit: 'stk', label: 'Dor' },
  trapp:          { low: 12,  normal: 16,  high: 22,  unit: 'stk', label: 'Trapp' },
  bad:            { low: 1.8, normal: 2.5, high: 3.5, unit: 'm²',  label: 'Bad / vatrom' },
  listing:        { low: 0.1, normal: 0.15,high: 0.22,unit: 'lm',  label: 'Listing' },
  riving:         { low: 0.5, normal: 0.8, high: 1.2, unit: 'm²',  label: 'Riving' },
  maling:         { low: 0.15,normal: 0.25,high: 0.35,unit: 'm²',  label: 'Maling' },
  sparkling:      { low: 0.25,normal: 0.4, high: 0.6, unit: 'm²',  label: 'Sparkling' },
  annet:          { low: 0.7, normal: 1.0, high: 1.5, unit: 'stk', label: 'Annet' },
};

/**
 * Hent basistid for en jobbtype og et niva.
 *
 * @param {string} jobType  - Nokkel i productionRates (f.eks. 'terrasse')
 * @param {string} [level]  - 'low' | 'normal' | 'high'  (default: 'normal')
 * @returns {number} Timer per enhet
 */
function getBaseTime(jobType, level) {
  var entry = productionRates[jobType] || productionRates.annet;
  var lvl = (level && entry[level] != null) ? level : 'normal';
  return entry[lvl];
}

// ── JUSTERINGSFAKTORER ───────────────────────────────────────

const accessFactors = {
  god:      { factor: 0.9,  label: 'God tilkomst' },
  normal:   { factor: 1.0,  label: 'Normal tilkomst' },
  vanskelig:{ factor: 1.2,  label: 'Vanskelig tilkomst' },
  svart:    { factor: 1.4,  label: 'Svart vanskelig' },
};

const heightFactors = {
  bakke:   { factor: 1.0,  label: 'Bakkeniva' },
  lav:     { factor: 1.05, label: 'Lav hoyde (< 3m)' },
  middels: { factor: 1.15, label: 'Middels hoyde (3-6m)' },
  hoy:     { factor: 1.3,  label: 'Stor hoyde (> 6m)' },
};

const complexityFactors = {
  enkel:     { factor: 0.85, label: 'Enkel — rette flater, standard' },
  normal:    { factor: 1.0,  label: 'Normal — noen tilpasninger' },
  kompleks:  { factor: 1.2,  label: 'Kompleks — mange hjorner/detaljer' },
  ekstremt:  { factor: 1.45, label: 'Ekstremt — spesialtilpasning' },
};

// ── INDIREKTE TID ────────────────────────────────────────────
// Tre dedikerte funksjoner som bruker faktiske prosjektdata
// i stedet for faste prosenter.
//
// Alle leser fra project.indirect:
//   { avstandKm, antallDager, antallTurer, people,
//     riggTimer, planTimer, oppryddingPct }
//
// Verdier som ikke er satt faller tilbake til fornuftige defaults
// beregnet fra direkte timer og prosjektomfang.

/**
 * Kjoring: tur/retur per dag, 80 km/t snitt.
 *
 * @param {Object} project
 * @param {number} direkteTimer - brukes til a estimere antall dager hvis ikke oppgitt
 * @returns {{ timer: number, km: number, turer: number, dager: number, label: string }}
 */
function calculateDrivingTime(project, direkteTimer) {
  var ind = project.indirect || {};
  var km = Number(ind.avstandKm) || 0;
  var people = Number(ind.people) || Number(project.work.people) || 1;
  var timerPerDag = 7.5;

  // Antall arbeidsdager: eksplisitt, eller utledet fra direkte timer
  var dager = Number(ind.antallDager) || Math.max(Math.ceil(direkteTimer / (timerPerDag * people)), 1);

  // Turer: eksplisitt, eller en tur/retur per dag
  var turer = Number(ind.antallTurer) || dager;

  // Tid = turer * tur/retur-distanse / snitthastighet
  var totalKm = turer * km * 2;
  var timer = km > 0 ? round1(totalKm / 80) : 0;

  return {
    timer: timer,
    km: totalKm,
    turer: turer,
    dager: dager,
    label: 'Kjoring',
  };
}

/**
 * Rigg og nedrigg: fast grunnkostnad + skalering med prosjektstorrelse.
 *
 * Tommelregel:
 *   - Grunnrigg 2t (hente/levere utstyr)
 *   - + 0.5t per 8 direkte timer (omorganisering underveis)
 *   - + stillas-tillegg hvis hoyde > bakke
 *   - Kan overstyres med project.indirect.riggTimer
 *
 * @param {Object} project
 * @param {number} direkteTimer
 * @returns {{ timer: number, grunn: number, lopende: number, stillas: number, label: string }}
 */
function calculateRiggingTime(project, direkteTimer) {
  var ind = project.indirect || {};

  // Eksplisitt overstyring
  if (ind.riggTimer != null && Number(ind.riggTimer) >= 0) {
    var forced = Number(ind.riggTimer);
    return { timer: forced, grunn: forced, lopende: 0, stillas: 0, label: 'Rigg og nedrigg' };
  }

  // Grunnrigg: hente/levere
  var grunn = 2;

  // Lopende: omrigging underveis
  var lopende = round1(direkteTimer / 8 * 0.5);

  // Stillas-tillegg: sjekk om noen operasjon har hoyde > bakke
  var ops = project.operations || [];
  var harHoyde = ops.some(function(op) { return op.hoyde && op.hoyde !== 'bakke'; });
  var stillas = harHoyde ? round1(Math.max(direkteTimer * 0.04, 1)) : 0;

  return {
    timer: round1(grunn + lopende + stillas),
    grunn: grunn,
    lopende: lopende,
    stillas: stillas,
    label: 'Rigg og nedrigg',
  };
}

/**
 * Planlegging, opprydding og kvalitetskontroll.
 *
 * Beregning:
 *   - Planlegging: 1t grunnlag + 3% av direkte timer (befaring, tegninger, koordinering)
 *   - Opprydding: 3% av direkte timer (kan overstyres med oppryddingPct)
 *   - Kvalitetskontroll: 2% av direkte timer
 *   - Kan overstyres med project.indirect.planTimer
 *
 * @param {Object} project
 * @param {number} direkteTimer
 * @returns {{ timer: number, planlegging: number, opprydding: number, kvalitet: number, label: string }}
 */
function calculatePlanningTime(project, direkteTimer) {
  var ind = project.indirect || {};

  // Eksplisitt overstyring av total
  if (ind.planTimer != null && Number(ind.planTimer) >= 0) {
    var forced = Number(ind.planTimer);
    return { timer: forced, planlegging: forced, opprydding: 0, kvalitet: 0, label: 'Planlegging m.m.' };
  }

  var planlegging = round1(1 + direkteTimer * 0.03);
  var oppryddingPct = ind.oppryddingPct != null ? Number(ind.oppryddingPct) : 3;
  var opprydding = round1(direkteTimer * oppryddingPct / 100);
  var kvalitet = round1(direkteTimer * 0.02);

  return {
    timer: round1(planlegging + opprydding + kvalitet),
    planlegging: planlegging,
    opprydding: opprydding,
    kvalitet: kvalitet,
    label: 'Planlegging m.m.',
  };
}

/**
 * Samle alle indirekte poster og returner total + breakdown.
 *
 * @param {Object} project
 * @param {number} direkteTimer
 * @returns {{ poster: Array, totalIndirekte: number }}
 */
function calcIndirectTime(project, direkteTimer) {
  var driving = calculateDrivingTime(project, direkteTimer);
  var rigging = calculateRiggingTime(project, direkteTimer);
  var planning = calculatePlanningTime(project, direkteTimer);

  var poster = [];

  if (driving.timer > 0) {
    poster.push({
      key: 'kjoring',
      label: driving.label,
      timer: driving.timer,
      detalj: driving.turer + ' turer x ' + ((project.indirect || {}).avstandKm || 0) + ' km = ' + driving.km + ' km',
    });
  }

  poster.push({
    key: 'rigging',
    label: rigging.label,
    timer: rigging.timer,
    detalj: 'Grunn ' + rigging.grunn + 't + lopende ' + rigging.lopende + 't'
      + (rigging.stillas > 0 ? ' + stillas ' + rigging.stillas + 't' : ''),
  });

  poster.push({
    key: 'planlegging',
    label: 'Planlegging',
    timer: planning.planlegging,
    detalj: '1t grunnlag + 3% av ' + direkteTimer + 't',
  });

  poster.push({
    key: 'opprydding',
    label: 'Opprydding',
    timer: planning.opprydding,
    detalj: ((project.indirect || {}).oppryddingPct || 3) + '% av ' + direkteTimer + 't',
  });

  poster.push({
    key: 'kvalitet',
    label: 'Kvalitetskontroll',
    timer: planning.kvalitet,
    detalj: '2% av ' + direkteTimer + 't',
  });

  var totalIndirekte = round1(poster.reduce(function(s, p) { return s + p.timer; }, 0));

  return { poster: poster, totalIndirekte: totalIndirekte };
}


// ── HJELPEFUNKSJON ───────────────────────────────────────────

function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }


// ── HOVEDFUNKSJONER ──────────────────────────────────────────

/**
 * Henter effektiv produksjonsrate for en operasjonstype.
 * Bruker brukerens erfaringstall hvis lagret, ellers standard.
 */
function getProductionRate(type) {
  const userRate = (state.calcRates || {})[type];
  if (userRate != null) return userRate;
  return getBaseTime(type, 'normal');
}

/**
 * Beregner direkte timer for en enkelt operasjon.
 */
function calcOperationHours(op) {
  const userRate = (state.calcRates || {})[op.type || 'annet'];
  const rate = userRate != null ? userRate : getBaseTime(op.type || 'annet', op.level || 'normal');
  const mengde = Number(op.mengde) || 0;

  const baseTimer = mengde * rate;

  const af = (accessFactors[op.tilkomst] || accessFactors.normal).factor;
  const hf = (heightFactors[op.hoyde] || heightFactors.bakke).factor;
  const cf = (complexityFactors[op.kompleksitet] || complexityFactors.normal).factor;

  const samletFaktor = af * hf * cf;
  const faktorTimer = round1(baseTimer * samletFaktor);

  return {
    baseTimer: round1(baseTimer),
    faktorTimer,
    faktorer: { tilkomst: af, hoyde: hf, kompleksitet: cf, samlet: Math.round(samletFaktor * 100) / 100 },
  };
}

/**
 * Hovedfunksjon: beregn hele prosjektet fra operations.
 */
function calcProject(project) {
  const ops = project.operations || [];
  const riskFactor = { Lav: 1, Normal: 1.1, 'Høy': 1.2 }[project.work.risk] || 1.1;
  const timeRate = Number(project.work.timeRate) || 850;
  const internalCost = Number(project.work.internalCost) || 450;

  // 1. Beregn hver operasjon
  var direkteTimer = 0;
  var breakdown = ops.map(function(op) {
    var result = calcOperationHours(op);
    direkteTimer += result.faktorTimer;
    var rateDef = productionRates[op.type] || productionRates.annet;
    return {
      id: op.id,
      navn: op.navn || rateDef.label,
      type: op.type,
      mengde: op.mengde,
      enhet: rateDef.unit,
      baseTimer: result.baseTimer,
      faktorTimer: result.faktorTimer,
      faktorer: result.faktorer,
    };
  });
  direkteTimer = round1(direkteTimer);

  // 2. Beregn indirekte tid (bruker project-data, ikke prosenter)
  var indirect = calcIndirectTime(project, direkteTimer);

  // 3. Totalsum
  var totalTimer = round1(direkteTimer + indirect.totalIndirekte);

  // 4. Priser
  var laborSaleEx = Math.round(totalTimer * timeRate * riskFactor);
  var laborCost = Math.round(totalTimer * internalCost);
  var profit = laborSaleEx - laborCost;
  var margin = laborSaleEx > 0 ? Math.round(profit / laborSaleEx * 1000) / 10 : 0;

  return {
    direkteTimer,
    indirektTimer: indirect.totalIndirekte,
    totalTimer,

    operasjoner: breakdown,
    indirekte: indirect.poster,

    laborSaleEx,
    laborCost,
    profit,
    margin,

    riskFactor,
    timeRate,
    internalCost,
  };
}


// ── HJELPEFUNKSJONER FOR OPERATIONS ──────────────────────────

/** Opprett en blank operasjon */
function blankOperation() {
  return {
    id: uid(),
    type: 'annet',
    navn: '',
    mengde: 0,
    level: 'normal',
    tilkomst: 'normal',
    hoyde: 'bakke',
    kompleksitet: 'normal',
  };
}

/** Rask oversikt: estimert timer for en type+mengde (uten faktorer) */
function quickEstimate(type, mengde) {
  var rate = getProductionRate(type);
  return Math.round(mengde * rate * 10) / 10;
}


// ── WARNINGS ─────────────────────────────────────────────────
// Analyserer prosjektdata og returnerer advarsler sortert etter alvorlighet.
// Severity: 'danger' (rød), 'warning' (gul), 'info' (blå)

function generateWarnings(project, computeResult) {
  var w = [];
  var ops = project.operations || [];
  var ind = project.indirect || {};
  var c = computeResult || {};
  var type = (project.type || '').toLowerCase();
  var margin = c.totalMargin || c.margin || 0;

  // ── Rehabilitering ──────────────────────────────────────
  var isRehab = type === 'rehabilitering' || type === 'bad';
  if (isRehab) {
    var harRiving = ops.some(function(op) { return op.type === 'riving'; });
    if (!harRiving) {
      w.push({ severity: 'warning', text: 'Rehabilitering uten riving — har du husket rivearbeid?' });
    }
    if (!(project.extras.waste > 0)) {
      w.push({ severity: 'warning', text: 'Ingen avfallskostnad — rehab genererer vanligvis avfall.' });
    }
  }

  // ── Tilkomst ────────────────────────────────────────────
  var harVanskelig = ops.some(function(op) {
    return op.tilkomst === 'vanskelig' || op.tilkomst === 'svart';
  });
  if (harVanskelig && !(project.extras.scaffolding > 0) && !(project.extras.rental > 0)) {
    w.push({ severity: 'warning', text: 'Vanskelig tilkomst uten stillas eller utstyrsleie — vurder ekstra kostnad.' });
  }

  // ── Hoyde ───────────────────────────────────────────────
  var harHoy = ops.some(function(op) {
    return op.hoyde === 'middels' || op.hoyde === 'hoy';
  });
  if (harHoy) {
    if (!(project.extras.scaffolding > 0)) {
      w.push({ severity: 'danger', text: 'Arbeid i hoyde uten stillas — dette er et HMS-krav over 2 meter.' });
    }
    if (project.work.risk === 'Lav') {
      w.push({ severity: 'warning', text: 'Hoydearbeid med lav risikofaktor — vurder Normal eller Hoy.' });
    }
  }

  // ── Bebodd / aktiv byggeplass ───────────────────────────
  if (project.bebodd) {
    w.push({ severity: 'info', text: 'Bebodd bolig — husk stovtetting, tildekning og ekstra ryddetid.' });
    var oppryddingPct = ind.oppryddingPct != null ? Number(ind.oppryddingPct) : 3;
    if (oppryddingPct < 5) {
      w.push({ severity: 'warning', text: 'Bebodd bolig med kun ' + oppryddingPct + '% opprydding — anbefalt minst 5%.' });
    }
  }

  // ── Margin ──────────────────────────────────────────────
  if (c.totalSaleEx > 0 && margin < 10) {
    w.push({ severity: 'danger', text: 'Margin under 10% (' + Math.round(margin) + '%) — hoy risiko for tap.' });
  } else if (c.totalSaleEx > 0 && margin < 20) {
    w.push({ severity: 'warning', text: 'Margin under 20% (' + Math.round(margin) + '%) — vurder om prisene dekker uforutsett.' });
  }

  // ── Materialer uten pris ────────────────────────────────
  var allMats = (project.materials || []).concat(
    (project.offerPosts || []).reduce(function(acc, post) {
      return acc.concat(post.snapshotMaterials || []);
    }, [])
  );
  var utenPris = allMats.filter(function(m) { return !m.cost || m.cost === 0; });
  if (utenPris.length > 0) {
    w.push({ severity: 'warning', text: utenPris.length + ' materiale(r) mangler pris — tilbudet kan bli for lavt.' });
  }

  // ── Timer ───────────────────────────────────────────────
  var totalHours = c.totalHours || 0;
  if (totalHours === 0 && (project.offerPosts || []).length > 0) {
    w.push({ severity: 'danger', text: 'Tilbud uten timer — har du lagt inn arbeidstid?' });
  }

  // ── Kjoring uten avstand ────────────────────────────────
  if (!(ind.avstandKm > 0) && ops.length > 0) {
    w.push({ severity: 'info', text: 'Ingen avstand oppgitt — kjoring er ikke med i kalkylen.' });
  }

  // ── Stor avstand ────────────────────────────────────────
  if (ind.avstandKm > 60) {
    w.push({ severity: 'warning', text: 'Lang reisevei (' + ind.avstandKm + ' km) — vurder om kjoring dekkes i tilbudet.' });
  }

  // ── Mangler tilbudsposter ───────────────────────────────
  if (!(project.offerPosts || []).length && (project.materials || []).length > 0) {
    w.push({ severity: 'info', text: 'Materialer finnes, men ingen tilbudsposter — husk a sende til tilbud.' });
  }

  // ── Kompleksitet ────────────────────────────────────────
  var harEkstremt = ops.some(function(op) { return op.kompleksitet === 'ekstremt'; });
  if (harEkstremt && project.work.risk !== 'Høy') {
    w.push({ severity: 'warning', text: 'Ekstrem kompleksitet uten hoy risikofaktor — vurder a oke risiko.' });
  }

  // ── Sorter: danger forst, sa warning, sa info ───────────
  var order = { danger: 0, warning: 1, info: 2 };
  w.sort(function(a, b) { return (order[a.severity] || 9) - (order[b.severity] || 9); });

  return w;
}


// ── EKSPORTER TIL GLOBALT SCOPE ──────────────────────────────

window.productionRates = productionRates;
window.getBaseTime = getBaseTime;
window.accessFactors = accessFactors;
window.heightFactors = heightFactors;
window.complexityFactors = complexityFactors;
window.calculateDrivingTime = calculateDrivingTime;
window.calculateRiggingTime = calculateRiggingTime;
window.calculatePlanningTime = calculatePlanningTime;
window.calcIndirectTime = calcIndirectTime;
window.calcOperationHours = calcOperationHours;
window.calcProject = calcProject;
window.generateWarnings = generateWarnings;
window.blankOperation = blankOperation;
window.quickEstimate = quickEstimate;
