// ============================================================
// calcEngine.js — All beregningslogikk, ingen UI
// ============================================================
// Avhenger av productionData.js (lastes for denne filen).
// Bruker globale: productionRates, accessFactors, heightFactors,
//   complexityFactors, calcDefaults, state, uid()
// ============================================================

// ── HJELPEFUNKSJON ───────────────────────────────────────────

function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }


// ── BASISTID-OPPSLAG ─────────────────────────────────────────

/**
 * Hent basistid for en jobbtype og et niva.
 * @param {string} jobType  - Nokkel i productionRates (f.eks. 'terrasse')
 * @param {string} [level]  - 'low' | 'normal' | 'high'  (default: 'normal')
 * @returns {number} Timer per enhet
 */
function getBaseTime(jobType, level) {
  var entry = productionRates[jobType] || productionRates.annet;
  var lvl = (level && entry[level] != null) ? level : 'normal';
  return entry[lvl];
}

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
 * Henter rate for materialkalkulator.
 * Bruker brukerens erfaringstall, ellers calcDefaults.
 */
function getCalcRate(type){
  const user=(state.calcRates||{})[type];
  return user!=null ? user : calcDefaults[type]?.tPerM2 ?? 1;
}


// ── INDIREKTE TID ────────────────────────────────────────────

/**
 * Kjoring: tur/retur per dag, 80 km/t snitt.
 */
function calculateDrivingTime(project, direkteTimer) {
  var ind = project.indirect || {};
  var km = Number(ind.avstandKm) || 0;
  var people = Number(ind.people) || Number(project.work.people) || 1;
  var timerPerDag = 7.5;

  var dager = Number(ind.antallDager) || Math.max(Math.ceil(direkteTimer / (timerPerDag * people)), 1);
  var turer = Number(ind.antallTurer) || dager;
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
 */
function calculateRiggingTime(project, direkteTimer) {
  var ind = project.indirect || {};

  if (ind.riggTimer != null && Number(ind.riggTimer) >= 0) {
    var forced = Number(ind.riggTimer);
    return { timer: forced, grunn: forced, lopende: 0, stillas: 0, label: 'Rigg og nedrigg' };
  }

  var grunn = 2;
  var lopende = round1(direkteTimer / 8 * 0.5);

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
 */
function calculatePlanningTime(project, direkteTimer) {
  var ind = project.indirect || {};

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


// ── OPERASJONSBEREGNING ──────────────────────────────────────

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

  var indirect = calcIndirectTime(project, direkteTimer);
  var totalTimer = round1(direkteTimer + indirect.totalIndirekte);

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


// ── FINANSIELL KALKYLE (tidl. compute() i projects.js) ───────

function compute(project){
  const riskFactor={Lav:1,Normal:1.1,'Høy':1.2}[project.work.risk]||1.1;
  const hoursTotal=Number(project.work.hours)||0;
  const laborCost=hoursTotal*(Number(project.work.internalCost)||0);
  const laborSaleEx=hoursTotal*(Number(project.work.timeRate)||0)*riskFactor;
  let matCost=0, matSaleEx=0;
  project.materials.forEach(m=>{
    const qty=Number(m.qty)||0,cost=Number(m.cost)||0,waste=Number(m.waste)||0,markup=Number(m.markup)||0;
    const withWaste=qty*cost*(1+waste/100);
    matCost+=withWaste; matSaleEx+=withWaste*(1+markup/100);
  });
  const lhh=Number(project.work.laborHireHours)||0, lhr=Number(project.extras.laborHire)||0;
  const laborHireTotal=lhh>0?(lhr*lhh):lhr;
  const driftCost=hoursTotal*(Number(project.extras.driftRate)||0);
  const subTotal=(project.extras.subcontractors||[]).reduce((s,x)=>s+(Number(x.amount)||0),0);
  const extrasBase=(Number(project.extras.rental)||0)+(Number(project.extras.waste)||0)+subTotal+laborHireTotal+(Number(project.extras.misc)||0)+(Number(project.extras.scaffolding)||0)+(Number(project.extras.drawings)||0)+driftCost;
  const rigEx=(laborSaleEx+matSaleEx)*((Number(project.extras.rigPercent)||0)/100);
  const costPrice=laborCost+matCost+extrasBase+rigEx;
  const saleEx=laborSaleEx+matSaleEx+extrasBase+rigEx;
  const saleInc=saleEx*1.25, profit=saleEx-costPrice;
  const margin=saleEx?(profit/saleEx*100):0;

  let snapMatCost=0, snapMatSaleEx=0, snapHours=0, snapLaborSaleEx=0, snapLaborCost=0;
  (project.offerPosts||[]).forEach(post=>{
    if(post.snapshotCompute){
      snapMatCost+=post.snapshotCompute.matCost||0;
      snapMatSaleEx+=post.snapshotCompute.matSaleEx||0;
      const postHours=Number(post.hours)||post.snapshotCompute.hoursTotal||0;
      snapHours+=postHours;
      const riskFactor={Lav:1,Normal:1.1,'Høy':1.2}[project.work.risk]||1.1;
      const rate=post.snapshotCompute.laborSaleEx/(post.snapshotCompute.hoursTotal||1)/riskFactor;
      const internalRate=post.snapshotCompute.laborCost/(post.snapshotCompute.hoursTotal||1);
      snapLaborSaleEx+=postHours*rate*riskFactor;
      snapLaborCost+=postHours*internalRate;
    }
  });
  const totalMatCost=matCost+snapMatCost;
  const totalMatSaleEx=matSaleEx+snapMatSaleEx;
  const computedTotal=hoursTotal+snapHours;
  const totalHours=Number(project.work.hoursOverride)>0
    ? Number(project.work.hoursOverride)
    : computedTotal;
  const ratePerHour=(Number(project.work.timeRate)||0)*riskFactor;
  const costPerHour=(Number(project.work.internalCost)||0);
  const totalLaborSaleEx=hoursTotal*ratePerHour + snapLaborSaleEx;
  const totalLaborCost=hoursTotal*costPerHour + snapLaborCost;
  const totalCostPrice=totalLaborCost+totalMatCost+extrasBase+rigEx;
  const totalSaleEx=totalLaborSaleEx+totalMatSaleEx+extrasBase+rigEx;
  const totalProfit=totalSaleEx-totalCostPrice;
  const totalMargin=totalSaleEx?(totalProfit/totalSaleEx*100):0;

  return {hoursTotal,laborCost,laborSaleEx,matCost,matSaleEx,extrasBase,rigEx,costPrice,saleEx,saleInc,vat:saleEx*0.25,profit,margin,db:margin,driftCost,
    totalMatCost,totalMatSaleEx,totalHours,totalLaborSaleEx,totalLaborCost,totalCostPrice,totalSaleEx,totalProfit,totalMargin};
}


// ── TILBUDSPOST-SUMMERING (tidl. computeOfferPostsTotal() i app.js) ──

function computeOfferPostsTotal(p){
  if(!p.offerPosts||!p.offerPosts.length) return {fixed:0,options:0,total:0,hours:0};
  let fixed=0,options=0,hours=0;
  p.offerPosts.forEach(post=>{
    hours+=Number(post.snapshotCompute?.hoursTotal)||0;
    const price=Number(post.price)||0;
    if(post.type==='option'){if(post.enabled)options+=price;}else fixed+=price;
  });
  return {fixed,options,total:fixed+options,hours};
}


// ── HJELPEFUNKSJONER ─────────────────────────────────────────

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

/** Lagre brukerens erfaringsrate */
function saveCalcRate(type, val){
  state.calcRates=state.calcRates||{};
  state.calcRates[type]=parseFloat(val)||calcDefaults[type]?.tPerM2||1;
  saveState();
  runCalcWidget();
}


// ── WARNINGS ─────────────────────────────────────────────────

function generateWarnings(project, computeResult) {
  var w = [];
  var ops = project.operations || [];
  var ind = project.indirect || {};
  var c = computeResult || {};
  var type = (project.type || '').toLowerCase();
  var margin = c.totalMargin || c.margin || 0;

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

  var harVanskelig = ops.some(function(op) {
    return op.tilkomst === 'vanskelig' || op.tilkomst === 'svart';
  });
  if (harVanskelig && !(project.extras.scaffolding > 0) && !(project.extras.rental > 0)) {
    w.push({ severity: 'warning', text: 'Vanskelig tilkomst uten stillas eller utstyrsleie — vurder ekstra kostnad.' });
  }

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

  if (project.bebodd) {
    w.push({ severity: 'info', text: 'Bebodd bolig — husk stovtetting, tildekning og ekstra ryddetid.' });
    var oppryddingPct = ind.oppryddingPct != null ? Number(ind.oppryddingPct) : 3;
    if (oppryddingPct < 5) {
      w.push({ severity: 'warning', text: 'Bebodd bolig med kun ' + oppryddingPct + '% opprydding — anbefalt minst 5%.' });
    }
  }

  if (c.totalSaleEx > 0 && margin < 10) {
    w.push({ severity: 'danger', text: 'Margin under 10% (' + Math.round(margin) + '%) — hoy risiko for tap.' });
  } else if (c.totalSaleEx > 0 && margin < 20) {
    w.push({ severity: 'warning', text: 'Margin under 20% (' + Math.round(margin) + '%) — vurder om prisene dekker uforutsett.' });
  }

  var allMats = (project.materials || []).concat(
    (project.offerPosts || []).reduce(function(acc, post) {
      return acc.concat(post.snapshotMaterials || []);
    }, [])
  );
  var utenPris = allMats.filter(function(m) { return !m.cost || m.cost === 0; });
  if (utenPris.length > 0) {
    w.push({ severity: 'warning', text: utenPris.length + ' materiale(r) mangler pris — tilbudet kan bli for lavt.' });
  }

  var totalHours = c.totalHours || 0;
  if (totalHours === 0 && (project.offerPosts || []).length > 0) {
    w.push({ severity: 'danger', text: 'Tilbud uten timer — har du lagt inn arbeidstid?' });
  }

  if (!(ind.avstandKm > 0) && ops.length > 0) {
    w.push({ severity: 'info', text: 'Ingen avstand oppgitt — kjoring er ikke med i kalkylen.' });
  }

  if (ind.avstandKm > 60) {
    w.push({ severity: 'warning', text: 'Lang reisevei (' + ind.avstandKm + ' km) — vurder om kjoring dekkes i tilbudet.' });
  }

  if (!(project.offerPosts || []).length && (project.materials || []).length > 0) {
    w.push({ severity: 'info', text: 'Materialer finnes, men ingen tilbudsposter — husk a sende til tilbud.' });
  }

  var harEkstremt = ops.some(function(op) { return op.kompleksitet === 'ekstremt'; });
  if (harEkstremt && project.work.risk !== 'Høy') {
    w.push({ severity: 'warning', text: 'Ekstrem kompleksitet uten hoy risikofaktor — vurder a oke risiko.' });
  }

  var order = { danger: 0, warning: 1, info: 2 };
  w.sort(function(a, b) { return (order[a.severity] || 9) - (order[b.severity] || 9); });

  return w;
}


// ── EKSPORTER TIL GLOBALT SCOPE ──────────────────────────────

window.round1 = round1;
window.getBaseTime = getBaseTime;
window.getProductionRate = getProductionRate;
window.getCalcRate = getCalcRate;
window.calculateDrivingTime = calculateDrivingTime;
window.calculateRiggingTime = calculateRiggingTime;
window.calculatePlanningTime = calculatePlanningTime;
window.calcIndirectTime = calcIndirectTime;
window.calcOperationHours = calcOperationHours;
window.calcProject = calcProject;
window.compute = compute;
window.computeOfferPostsTotal = computeOfferPostsTotal;
window.blankOperation = blankOperation;
window.quickEstimate = quickEstimate;
window.saveCalcRate = saveCalcRate;
window.generateWarnings = generateWarnings;
