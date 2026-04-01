// ============================================================
// productionData.js — All ren data for kalkylemotoren
// ============================================================
// Ingen logikk her — bare datastrukturer og faktorer.
// Lastes for calcEngine.js i script-rekkefolgen.
// ============================================================

// ── PRODUKSJONSTALL (basistimer per enhet) ───────────────────
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

// ── MATERIALKALKULATORENS VANSKELIGHETSGRADER ────────────────

const difficultyFactors = {
  enkel:    {label:'Enkel',   factor:0.85, desc:'God tilkomst, rett flate'},
  normal:   {label:'Normal',  factor:1.0,  desc:'Standard forhold'},
  vanskelig:{label:'Vanskelig',factor:1.25, desc:'Høyde, skråtak, trangt'},
  ekstremt: {label:'Ekstremt',factor:1.5,  desc:'Særlig krevende forhold'},
};

// ── STANDARDRATER FOR MATERIALKALKULATOR ─────────────────────

const calcDefaults = {
  terrasse:      {tPerM2:2.5,  label:'t/m²'},
  kledning:      {tPerM2:1.3,  label:'t/m²'},
  tak:           {tPerM2:1.8,  label:'t/m²'},
  lettvegg:      {tPerM2:1.0,  label:'t/m²'},
  etterisolering:{tPerM2:0.9,  label:'t/m²'},
  vindu:         {tPerM2:4.0,  label:'t/stk'},
  gulv:          {tPerM2:0.8,  label:'t/m²'},
  panel:         {tPerM2:1.1,  label:'t/m²'},
  dor:           {tPerM2:3.0,  label:'t/stk'},
  trapp:         {tPerM2:16.0, label:'t/stk'},
  bad:           {tPerM2:2.5,  label:'t/m²'},
};

// ── MATERIALKALKULATORENS DEFINISJONER ───────────────────────
// calcDefs inneholder material-templates med beregningsfunksjoner.
// Disse bruker getCalcRate() fra calcEngine.js, som lastes etter
// denne filen men for UI-filene som kaller calcDefs[type].calc().

const calcDefs = {
  terrasse: {
    label:'Terrasse',
    materialOptions:[
      {id:'bord',label:'Terrassebord',options:['28×120 impregnert','28×120 trykkimpregnert','28×145 impregnert','45×120 kebony','Kompositt 25×140']},
      {id:'fundament',label:'Fundamenttype',options:['Punktfundament betong','Skruefundament','Bjelkesko på plate']},
    ],
    inputs:[
      {id:'lengde',label:'Lengde (m)',default:4},
      {id:'bredde',label:'Bredde (m)',default:3},
    ],
    calc(v,mats){
      const areal=v.lengde*v.bredde;
      const bordValg=mats.bord||'28×120 impregnert';
      const breddemm=bordValg.includes('145')?145:bordValg.includes('140')?140:120;
      const lmPerM2=1000/breddemm*1.05;
      const bordLm=Math.ceil(areal*lmPerM2*1.1);
      const bjelkeLm=Math.ceil((v.bredde/0.6)*v.lengde*1.1);
      const antFund=Math.ceil(areal/2.5);
      return {
        areal:areal.toFixed(1)+' m²',
        info:`Bord: ${bordValg}`,
        materialer:[
          {name:`Terrassebord ${bordValg}`,qty:bordLm,unit:'lm',waste:10},
          {name:'Bjelkelag 48×198 C24',qty:bjelkeLm,unit:'lm',waste:8},
          {name:'Fundament / stolpesko',qty:antFund,unit:'stk',waste:0},
          {name:'Terrasseskruer A2',qty:Math.ceil(areal/4),unit:'pk',waste:0},
        ],
        timer:Math.round(areal*getCalcRate('terrasse')),
      };
    }
  },
  kledning: {
    label:'Kledning',
    materialOptions:[
      {id:'type',label:'Kledningstype',options:['D-fals 19×148','D-fals 19×120','Stående kledning 19×148','Liggende kledning 19×98','Villmarkspanel 19×148']},
      {id:'isolasjon',label:'Etterisolering',options:['Ingen','50 mm','100 mm']},
    ],
    inputs:[
      {id:'bredde',label:'Veggbredde (m)',default:6},
      {id:'hoyde',label:'Vegghøyde (m)',default:2.5},
      {id:'vinduer',label:'Antall åpninger',default:1},
    ],
    calc(v,mats){
      const brutto=v.bredde*v.hoyde;
      const netto=Math.max(brutto-v.vinduer*1.8,1);
      const kledType=mats.type||'D-fals 19×148';
      const breddemm=kledType.includes('98')?98:kledType.includes('120')?120:148;
      const lmPerM2=1000/breddemm*1.12;
      const kledningLm=Math.ceil(netto*lmPerM2);
      const lekterLm=Math.ceil(netto/0.6*1.1);
      const isolasjon=mats.isolasjon||'Ingen';
      const ekstraMat=isolasjon!=='Ingen'?[
        {name:`Isolasjon ${isolasjon}`,qty:Math.ceil(netto/5.76),unit:'pk',waste:5},
      ]:[];
      return {
        areal:netto.toFixed(1)+' m² netto',
        info:`${kledType}${isolasjon!=='Ingen'?' + '+isolasjon:''}`,
        materialer:[
          {name:kledType,qty:kledningLm,unit:'lm',waste:12},
          {name:'Lekter 23×48',qty:lekterLm,unit:'lm',waste:10},
          {name:'Vindsperre',qty:Math.ceil(netto/50),unit:'rull',waste:5},
          {name:'Spiker / skruer utvendig',qty:Math.ceil(netto/10),unit:'pk',waste:0},
          ...ekstraMat,
        ],
        timer:Math.round(netto*getCalcRate('kledning')),
      };
    }
  },
  tak: {
    label:'Tak',
    materialOptions:[
      {id:'type',label:'Taktype',options:['Takstein betong','Takstein leire','Ståltak / platetak','Shingel','Papp/folie flatt tak']},
    ],
    inputs:[
      {id:'lengde',label:'Takkjelens lengde (m)',default:8},
      {id:'bredde',label:'Takflatens bredde (m)',default:5},
      {id:'helning',label:'Takvinkel (grader)',default:22},
    ],
    calc(v,mats){
      const faktor=1/Math.cos(v.helning*Math.PI/180);
      const areal=v.lengde*v.bredde*faktor;
      const takType=mats.type||'Takstein betong';
      return {
        areal:areal.toFixed(1)+' m²',
        info:takType,
        materialer:[
          {name:takType,qty:Math.ceil(areal*1.1),unit:'m²',waste:10},
          {name:'Sløyfer og lekter',qty:Math.ceil(areal*1.6),unit:'lm',waste:8},
          {name:'Undertaksduk',qty:Math.ceil(areal/50),unit:'rull',waste:5},
          {name:'Beslag / renner',qty:Math.ceil(v.lengde*2/10),unit:'pakke',waste:0},
        ],
        timer:Math.round(areal*getCalcRate('tak')),
      };
    }
  },
  lettvegg: {
    label:'Lettvegg',
    materialOptions:[
      {id:'gips',label:'Gipstype',options:['Standard 13 mm','Brannhemmende 15 mm','Fuktbestandig 13 mm']},
      {id:'isolasjon',label:'Isolasjon',options:['100 mm mineralull','150 mm mineralull','Ingen']},
    ],
    inputs:[
      {id:'lengde',label:'Vegglengde (m)',default:4},
      {id:'hoyde',label:'Vegghøyde (m)',default:2.4},
    ],
    calc(v,mats){
      const areal=v.lengde*v.hoyde;
      const stendere=Math.ceil(v.lengde/0.6)+2;
      const gipsType=mats.gips||'Standard 13 mm';
      const gipsPlater=Math.ceil(areal/2.88*2*1.1);
      const isolType=mats.isolasjon||'100 mm mineralull';
      const isolMat=isolType!=='Ingen'?[{name:`Mineralull ${isolType.replace(' mineralull','')}`,qty:Math.ceil(areal/5.76),unit:'pk',waste:5}]:[];
      return {
        areal:areal.toFixed(1)+' m²',
        info:`${gipsType} • ${isolType}`,
        materialer:[
          {name:'Stender 48×98 C24',qty:stendere,unit:'stk',waste:8},
          {name:`Gips ${gipsType}`,qty:gipsPlater,unit:'pl',waste:10},
          ...isolMat,
          {name:'Gipsskruer båndet',qty:Math.ceil(areal/20),unit:'pk',waste:0},
        ],
        timer:Math.round(areal*getCalcRate('lettvegg')),
      };
    }
  },
  etterisolering: {
    label:'Etterisolering',
    materialOptions:[
      {id:'type',label:'Isolasjonstype',options:['Mineralull','Steinull','Isopor EPS','Trefiberisolasjon']},
    ],
    inputs:[
      {id:'areal',label:'Areal (m²)',default:20},
      {id:'tykkelse',label:'Tykkelse (mm)',default:50},
    ],
    calc(v,mats){
      const isolType=mats.type||'Mineralull';
      return {
        areal:v.areal+' m²',
        info:`${isolType} ${v.tykkelse} mm`,
        materialer:[
          {name:`${isolType} ${v.tykkelse} mm`,qty:Math.ceil(v.areal/5.76),unit:'pk',waste:8},
          {name:'Lekt 48×48',qty:Math.ceil(v.areal/0.6*1.1),unit:'lm',waste:10},
          {name:'Vindsperre',qty:Math.ceil(v.areal/50),unit:'rull',waste:5},
          {name:'Tape / mansjetter',qty:1,unit:'pakke',waste:0},
        ],
        timer:Math.round(v.areal*getCalcRate('etterisolering')),
      };
    }
  },
  vindu: {
    label:'Vindu',
    materialOptions:[
      {id:'type',label:'Vindustype',options:['Standard 2-lags','Energi 3-lags','Fastkarm','Kippvindu']},
      {id:'foring',label:'Foring',options:['Inkludert foring og lister','Kun montering']},
    ],
    inputs:[
      {id:'antall',label:'Antall vinduer',default:1},
      {id:'bredde',label:'Bredde (cm)',default:100},
      {id:'hoyde',label:'Høyde (cm)',default:120},
    ],
    calc(v,mats){
      const omfar=Math.ceil((v.bredde*2+v.hoyde*2)/100*1.2);
      const foringType=mats.foring||'Inkludert foring og lister';
      const ekstraMat=foringType.includes('foring')?[
        {name:'Listverk / foring',qty:omfar*v.antall,unit:'lm',waste:10},
      ]:[];
      return {
        areal:v.antall+' vindu(er)',
        info:`${mats.type||'Standard 2-lags'} • ${foringType}`,
        materialer:[
          {name:'Karmskruer 90 mm',qty:v.antall,unit:'pk',waste:0},
          {name:'Fugeskum proff',qty:v.antall*2,unit:'stk',waste:0},
          {name:'Beslag / tetting',qty:v.antall,unit:'pakke',waste:0},
          ...ekstraMat,
        ],
        timer:Math.round(v.antall*getCalcRate('vindu')),
      };
    }
  },
  gulv: {
    label:'Gulvlegging',
    materialOptions:[
      {id:'type',label:'Gulvtype',options:['Laminat 8 mm','Laminat 12 mm','Parkett 14 mm','Vinyl/LVT','Fliser keramikk','Fliser naturstein']},
      {id:'underlag',label:'Underlag',options:['Trinnlyd + PE-folie','Selvutjevnende masse','Eksisterende ok']},
    ],
    inputs:[
      {id:'areal',label:'Areal (m²)',default:20},
    ],
    calc(v,mats){
      const gulvType=mats.type||'Laminat 8 mm';
      const erFlis=gulvType.includes('Flis');
      const underlagType=mats.underlag||'Trinnlyd + PE-folie';
      const underlagMat=underlagType.includes('Trinnlyd')?[
        {name:'Trinnlydmatte',qty:Math.ceil(v.areal*1.1),unit:'m²',waste:5},
      ]:underlagType.includes('Selvutjevnende')?[
        {name:'Selvutjevnende masse',qty:Math.ceil(v.areal/20),unit:'sekk',waste:5},
      ]:[];
      return {
        areal:v.areal+' m²',
        info:gulvType,
        materialer:[
          {name:gulvType,qty:Math.ceil(v.areal*1.1),unit:'m²',waste:8},
          ...underlagMat,
          {name:erFlis?'Flisklister / fugemasse':'Gulvlister',qty:Math.ceil(Math.sqrt(v.areal)*4),unit:'lm',waste:10},
        ],
        timer:Math.round(v.areal*getCalcRate('gulv')),
      };
    }
  },
  panel: {
    label:'Innvendig panel',
    materialOptions:[
      {id:'type',label:'Paneltype',options:['Kledningspanel 14×121','Furupanel 14×95','Sponplate','Gipsplate 13 mm']},
      {id:'område',label:'Område',options:['Vegg','Tak','Vegg og tak']},
    ],
    inputs:[
      {id:'areal',label:'Areal (m²)',default:15},
    ],
    calc(v,mats){
      const panelType=mats.type||'Kledningspanel 14×121';
      const breddemm=panelType.includes('95')?95:panelType.includes('121')?121:120;
      const lmPerM2=1000/breddemm*1.08;
      return {
        areal:v.areal+' m²',
        info:panelType,
        materialer:[
          {name:panelType,qty:Math.ceil(v.areal*lmPerM2),unit:'lm',waste:10},
          {name:'Lekter 23×48',qty:Math.ceil(v.areal/0.6),unit:'lm',waste:8},
          {name:'Listverk fotlist',qty:Math.ceil(Math.sqrt(v.areal)*4),unit:'lm',waste:10},
          {name:'Spiker / dykkert',qty:Math.ceil(v.areal/15),unit:'pk',waste:0},
        ],
        timer:Math.round(v.areal*getCalcRate('panel')),
      };
    }
  },
  dor: {
    label:'Dørmontering',
    materialOptions:[
      {id:'type',label:'Dørtype',options:['Innvendig fyllingsdør','Innvendig glatt dør','Ytterdør','Skyvedør','Dobbeldør']},
      {id:'arbeid',label:'Arbeidsomfang',options:['Kun montering i åpning','Montering + karmsetting','Komplett inkl. listverk']},
    ],
    inputs:[
      {id:'antall',label:'Antall dører',default:1},
    ],
    calc(v,mats){
      const arbeid=mats.arbeid||'Komplett inkl. listverk';
      const ekstraMat=arbeid.includes('listverk')?[
        {name:'Dørlistverk',qty:v.antall*5,unit:'lm',waste:10},
      ]:[];
      return {
        areal:v.antall+' dør(er)',
        info:`${mats.type||'Innvendig fyllingsdør'} • ${arbeid}`,
        materialer:[
          {name:'Karmskruer',qty:v.antall,unit:'pk',waste:0},
          {name:'Skum / tetting',qty:v.antall,unit:'stk',waste:0},
          ...ekstraMat,
        ],
        timer:Math.round(v.antall*getCalcRate('dor')),
      };
    }
  },
  trapp: {
    label:'Trapp',
    materialOptions:[
      {id:'type',label:'Trappetype',options:['Enkel rettløpstrapp','L-trapp','Svingt trapp','Spiraltrapp']},
      {id:'materiale',label:'Materiale',options:['Furu ubehandlet','Eik','Hvitmalt MDF','Stål med tretrinn']},
    ],
    inputs:[
      {id:'antall',label:'Antall etg. steg',default:14},
      {id:'bredde',label:'Trappens bredde (cm)',default:90},
    ],
    calc(v,mats){
      const trappType=mats.type||'Enkel rettløpstrapp';
      const mat=mats.materiale||'Furu ubehandlet';
      return {
        areal:v.antall+' trinn',
        info:`${trappType} • ${mat}`,
        materialer:[
          {name:`Trinn ${mat}`,qty:v.antall,unit:'stk',waste:2},
          {name:'Bærebjelke / vange',qty:2,unit:'stk',waste:0},
          {name:'Rekkverk',qty:Math.ceil(v.antall*0.18),unit:'lm',waste:5},
          {name:'Håndlist',qty:Math.ceil(v.antall*0.18)+1,unit:'lm',waste:5},
          {name:'Skruer og festemateriell',qty:1,unit:'pakke',waste:0},
        ],
        timer:Math.round(getCalcRate('trapp')),
      };
    }
  },
  bad: {
    label:'Bad / våtrom',
    materialOptions:[
      {id:'flis',label:'Flisvalg',options:['Standard keramikk','Naturstein','Storformat 60×60','Mosaikk']},
      {id:'arbeid',label:'Arbeidsomfang',options:['Kun flislegging','Membran + flislegging','Full rehabilitering']},
    ],
    inputs:[
      {id:'areal',label:'Gulvareal (m²)',default:5},
      {id:'vegghøyde',label:'Vegghøyde (m)',default:2.4},
      {id:'vegger',label:'Antall vegger å flise',default:4},
    ],
    calc(v,mats){
      const veggAreal=Math.ceil(v.vegghøyde*Math.sqrt(v.areal)*v.vegger);
      const totAreal=v.areal+veggAreal;
      const flisType=mats.flis||'Standard keramikk';
      const arbeid=mats.arbeid||'Membran + flislegging';
      const ekstraMat=arbeid.includes('Membran')||arbeid.includes('Full')?[
        {name:'Membran / slukmansjett',qty:1,unit:'pakke',waste:0},
        {name:'Membranmasse',qty:Math.ceil(totAreal/10),unit:'spann',waste:5},
      ]:[];
      return {
        areal:`${v.areal} m² gulv + ${veggAreal} m² vegg`,
        info:`${flisType} • ${arbeid}`,
        materialer:[
          {name:`Flis ${flisType}`,qty:Math.ceil(totAreal*1.1),unit:'m²',waste:10},
          {name:'Flislim',qty:Math.ceil(totAreal/5),unit:'sekk',waste:5},
          {name:'Fugmasse',qty:Math.ceil(totAreal/10),unit:'pk',waste:5},
          {name:'Plater / underlag',qty:Math.ceil(totAreal*1.05),unit:'m²',waste:8},
          ...ekstraMat,
        ],
        timer:Math.round(v.areal*getCalcRate('bad')),
      };
    }
  },
};

// ── EKSPORTER TIL GLOBALT SCOPE ──────────────────────────────

window.productionRates = productionRates;
window.accessFactors = accessFactors;
window.heightFactors = heightFactors;
window.complexityFactors = complexityFactors;
window.difficultyFactors = difficultyFactors;
window.calcDefaults = calcDefaults;
window.calcDefs = calcDefs;
