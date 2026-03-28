// ── Konstanter og standardverdier ─────────────────────────────────────────
export const STORAGE_KEY = 'kalkyleapp_round6';

export const defaultSettings = {
  timeRate: 850,
  internalCost: 450,
  materialMarkup: 20,
  driveCost: 650,
  vatMode: 'ex'
};

export const defaultCompany = {
  name: '', address: '', zip: '', city: '', phone: '', email: '',
  website: '', orgNr: '', vatRegistered: true, logo: '', color: '#2e75b6', extraInfo: ''
};

export const builtinTemplates = [
  { id:'tpl_terrasse', name:'Terrasse', builtIn:true, materials:[
    {name:'Terrassebord 28x120 impregnert', unit:'lm', waste:10},
    {name:'Bjelkelag 48x198 C24', unit:'lm', waste:8},
    {name:'Terrasseskruer A2', unit:'pk', waste:0},
    {name:'Fundament / stolpesko', unit:'stk', waste:0}
  ]},
  { id:'tpl_lettvegg', name:'Lettvegg', builtIn:true, materials:[
    {name:'Stender 48x98 C24', unit:'stk', waste:8},
    {name:'Gips 13 mm std', unit:'pl', waste:10},
    {name:'Mineralull 100 mm', unit:'pk', waste:5},
    {name:'Gipsskruer båndet', unit:'pk', waste:0}
  ]},
  { id:'tpl_vindu', name:'Vindu', builtIn:true, materials:[
    {name:'Karmskruer 90 mm', unit:'pk', waste:0},
    {name:'Fugeskum proff', unit:'stk', waste:0},
    {name:'Lister malt 15x58', unit:'lm', waste:10},
    {name:'Beslag / tetting', unit:'pakke', waste:0}
  ]},
  { id:'tpl_listing', name:'Listing', builtIn:true, materials:[
    {name:'Fotlist 12x58 hvitmalt', unit:'lm', waste:10},
    {name:'Dykkert 1,6x50', unit:'pk', waste:0},
    {name:'Acryl/fug hvit', unit:'stk', waste:0}
  ]},
  { id:'tpl_kledning', name:'Kledning', builtIn:true, materials:[
    {name:'D-fals 19x148 grunnet', unit:'lm', waste:12},
    {name:'Lekter 23x48', unit:'lm', waste:10},
    {name:'Vindsperre', unit:'rull', waste:5},
    {name:'Spiker / skruer utvendig', unit:'pk', waste:0}
  ]},
  { id:'tpl_etterisolering', name:'Etterisolering', builtIn:true, materials:[
    {name:'Isolasjon 50 mm', unit:'pk', waste:8},
    {name:'Lekt 48x48', unit:'lm', waste:10},
    {name:'Dampsperre', unit:'rull', waste:5},
    {name:'Tape / mansjetter', unit:'pakke', waste:0}
  ]},
  { id:'tpl_tak', name:'Tak', builtIn:true, materials:[
    {name:'Takstein / platetak', unit:'m²', waste:10},
    {name:'Sløyfer og lekter', unit:'lm', waste:8},
    {name:'Undertaksduk', unit:'rull', waste:5},
    {name:'Beslag', unit:'pakke', waste:0}
  ]}
];

export const addOnPackages = [
  {name:'Sparkelpakke', desc:'Sparkel, papirremse, slipepapir', items:[
    {name:'Sparkel', qty:3, unit:'spann', waste:0, markup:20},
    {name:'Papirremse', qty:2, unit:'rull', waste:0, markup:20},
    {name:'Slipepapir', qty:1, unit:'pk', waste:0, markup:20}
  ]},
  {name:'Listverkspakke', desc:'Lister og festemidler', items:[
    {name:'Listverk standard', qty:20, unit:'lm', waste:10, markup:20},
    {name:'Dykkert', qty:1, unit:'pk', waste:0, markup:20}
  ]},
  {name:'Fug og tetting', desc:'Skum, fug og tetting', items:[
    {name:'Fugemasse', qty:4, unit:'stk', waste:0, markup:20},
    {name:'Fugeskum', qty:2, unit:'stk', waste:0, markup:20}
  ]},
  {name:'Riving og avfall', desc:'Bortkjøring og avfall', items:[
    {name:'Avfallshåndtering', qty:1, unit:'jobb', waste:0, markup:10}
  ]},
  {name:'Underlagspakke', desc:'Duk, tape og overganger', items:[
    {name:'Underlagsduk', qty:1, unit:'rull', waste:5, markup:20},
    {name:'Tape / mansjetter', qty:1, unit:'pakke', waste:0, markup:20}
  ]}
];
