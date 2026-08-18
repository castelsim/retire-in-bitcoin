// ============================================================
// Integrazione in Bitcoin
//
// Quanti bitcoin servono OGGI per incassare un importo netto ogni anno,
// dall'età che scegli fino ai cento: un decumulo programmato.
//
// Un solo modello di prezzo: la legge di potenza di Giovanni Santostasi.
// Un solo modello di imposta: quella del paese in cui vivi, sulla
// plusvalenza. Niente altro.
//
// Nessuna dipendenza esterna. Prezzo di oggi: CoinGecko, senza chiave.
// ============================================================

const NOW_YEAR = new Date().getFullYear();
const ETA_FINE_DEFAULT = 100;      // fin dove deve durare il capitale, se non lo cambi

// ------------------------------------------------------------
// FISCALITÀ — verificata ad agosto 2026 su fonti pubbliche (vedi progress.md).
// `esenteOltreAnno`: la plusvalenza non è tassata se la tranche venduta
// è detenuta da più di un anno (DE §23 EStG, PT 365 giorni).
// ------------------------------------------------------------
const FISCO = {
  Italia: {
    aliquota: 0.33, esenteOltreAnno: false, bollo: 0.002,
    etichetta: "33% sulla plusvalenza",
    nota: "Imposta sostitutiva salita al 33% il 1° gennaio 2026 (26% solo per stablecoin in euro MiCAR). Nessuna franchigia. In più il bollo dello 0,20% annuo sul controvalore.",
  },
  Germania: {
    aliquota: 0.45, esenteOltreAnno: true, bollo: 0,
    etichetta: "esente oltre 12 mesi",
    nota: "§23 EStG: la plusvalenza su cripto detenute da più di un anno non è tassata. Sotto l'anno entra nell'imposta sul reddito, fino al 45%.",
  },
  Francia: {
    aliquota: 0.314, esenteOltreAnno: false, bollo: 0,
    etichetta: "31,4% forfettario",
    nota: "PFU salito al 31,4% il 1° gennaio 2026: 12,8% di imposta più 18,6% di contributi sociali. Gli scambi cripto-cripto non sono tassati.",
  },
  Spagna: {
    scaglioni: [[6000, 0.19], [50000, 0.21], [200000, 0.23], [300000, 0.27], [Infinity, 0.30]],
    esenteOltreAnno: false, bollo: 0,
    etichetta: "19–30% a scaglioni",
    nota: "La plusvalenza entra nella base del risparmio: 19% fino a 6.000 €, 21% fino a 50.000, 23% fino a 200.000, 27% fino a 300.000, 30% oltre (Ley 7/2024, in vigore dal 1° gennaio 2025).",
  },
  Portogallo: {
    aliquota: 0.28, esenteOltreAnno: true, bollo: 0,
    etichetta: "esente oltre 365 giorni",
    nota: "Esente se la tranche è detenuta da 365 giorni o più; sotto l'anno l'aliquota è il 28%. L'esenzione non vale per token assimilati a strumenti finanziari.",
  },
  Polonia: {
    aliquota: 0.19, esenteOltreAnno: false, bollo: 0,
    etichetta: "19% piatta",
    nota: "Aliquota unica del 19% (PIT-38), identica per qualunque durata di detenzione e qualunque importo.",
  },
};

// Inflazione e costo della vita. Fonti: Eurostat, ISTAT, Destatis, INE, INSEE, NBP (2025).
const PAESI = {
  Italia:     { valuta: "EUR", sym: "€", infl: 0.020, base: 18000 },
  Germania:   { valuta: "EUR", sym: "€", infl: 0.022, base: 24000 },
  Spagna:     { valuta: "EUR", sym: "€", infl: 0.020, base: 18000 },
  Portogallo: { valuta: "EUR", sym: "€", infl: 0.020, base: 15000 },
  Francia:    { valuta: "EUR", sym: "€", infl: 0.018, base: 22000 },
  Polonia:    { valuta: "PLN", sym: "zł", infl: 0.025, base: 24900 },
};

// ------------------------------------------------------------
// IL MODELLO: la legge di potenza di Giovanni Santostasi, e basta.
//
//   prezzo(t) = 10^(A + n·log10(t))       t = giorni dal blocco genesi
//
// I parametri non sono copiati da nessuno: sono rifatti il 16 agosto 2026
// sulla serie storica completa di Bitcoin (5.843 giorni, dal 18 agosto 2010
// a oggi, fonte blockchain.info). Vengono
//
//   n  = 5,611     esponente     (la letteratura dice 5,69 ± 0,05)
//   A  = −16,239   coefficiente  (la letteratura dice −16,509)
//   R² = 0,9598                  (la letteratura dice 0,961)
//
// Il CORRIDOIO invece non è suo: lui pubblica bande a ±1σ e ±2σ. Le tre
// linee qui sono percentili dei residui della nostra regressione — una
// scelta nostra, non un'attribuzione:
//
//   supporto     5° percentile   sotto ci è stato 5 giorni su 100
//   centro      50° percentile   metà della storia sopra, metà sotto
//   resistenza  95° percentile   i massimi delle bolle
// ------------------------------------------------------------
const PL_A = -16.2394;
const PL_N = 5.6114;
const PL_R2 = 0.9598;
const PL_PUNTI = 5843;
const PL_DATA_FIT = "16 agosto 2026";
const GENESI = Date.UTC(2009, 0, 3);

const SCENARI = [
  { key: "supporto",   nome: "Supporto",   perc: -0.3592, q: "5°",  tono: "var(--zero)",
    desc: "Il fondo del corridoio: nella storia di Bitcoin il prezzo è stato più in basso solo cinque giorni su cento." },
  { key: "centro",     nome: "Centro",     perc: -0.0620, q: "50°", tono: "var(--keep)",
    desc: "La mediana: metà della storia sta sopra questa linea e metà sotto. È l'ipotesi su cui conviene decidere." },
  { key: "resistenza", nome: "Resistenza", perc:  0.5531, q: "95°", tono: "var(--hope)",
    desc: "Il tetto del corridoio, dove arrivano i massimi delle bolle. Ci si passa, non ci si resta." },
];

// Serie storica reale di Bitcoin, un punto al mese (fonte blockchain.info, 16/08/2026).
// Serve a far vedere che la curva descrive dei dati, non un'idea.
// eslint-disable-next-line prefer-const
let STORICO = [[605,0.07],[635,0.06],[666,0.19],[696,0.28],[727,0.3],[758,0.48],[786,0.96],[817,0.8],[847,3.05],[878,9.12],[908,17.35],[939,14.06],[970,9.11],[1000,4.94],[1031,3.59],[1061,2.98],[1092,4.47],[1123,5.61],[1152,4.98],[1183,4.86],[1213,5.01],[1244,5.18],[1274,6.67],[1305,9.22],[1336,10.91],[1366,12.49],[1397,10.92],[1427,12.61],[1458,13.57],[1489,20.11],[1517,31.27],[1548,92.5],[1578,145],[1609,129],[1639,94.99],[1670,108],[1701,125],[1731,127],[1762,206],[1792,1134],[1823,736],[1854,800],[1882,583],[1913,459],[1943,448],[1974,621],[2004,600],[2035,563],[2066,501],[2096,374],[2127,345],[2157,376],[2188,311],[2219,227],[2247,252],[2278,248],[2308,226],[2339,232],[2369,256],[2400,288],[2431,228],[2461,237],[2492,328],[2522,371],[2553,428],[2584,377],[2613,432],[2644,414],[2674,456],[2705,526],[2735,636],[2766,655],[2797,576],[2827,604],[2858,697],[2888,730],[2919,958],[2950,920],[2978,1194],[3009,1035],[3039,1333],[3070,2205],[3100,2542],[3131,2739],[3162,4583],[3192,4164],[3223,6133],[3253,9646],[3284,12613],[3315,10083],[3343,10629],[3374,6854],[3404,9398],[3435,7387],[3465,6223],[3496,8171],[3527,6987],[3557,6593],[3588,6302],[3618,4279],[3649,3865],[3680,3470],[3708,3833],[3739,4114],[3769,5261],[3800,8272],[3830,11890],[3861,9589],[3892,9578],[3922,8057],[3953,9165],[3983,7757],[4014,7220],[4045,9502],[4074,8712],[4105,6405],[4135,8778],[4166,9698],[4196,9185],[4227,11115],[4258,11708],[4288,10841],[4319,13565],[4349,18192],[4380,28857],[4411,34318],[4439,46156],[4470,58730],[4500,53584],[4531,35685],[4561,35848],[4592,42214],[4623,47075],[4653,41522],[4684,61731],[4714,57828],[4745,47133],[4776,37919],[4804,37705],[4835,47064],[4865,38596],[4896,31716],[4926,20086],[4957,23648],[4988,19793],[5018,19599],[5049,20628],[5079,16433],[5110,16600],[5141,22836],[5169,23498],[5200,28033],[5230,29245],[5261,27704],[5291,30449],[5322,29275],[5353,27301],[5383,26917],[5414,34501],[5444,37867],[5475,42148],[5506,42951],[5535,62499],[5566,69651],[5596,63833],[5627,68352],[5657,60871],[5688,66180],[5719,59108],[5749,65621],[5780,72330],[5810,97504],[5841,92653],[5872,104744],[5900,84646],[5931,82338],[5961,94275],[5992,104028],[6022,108386],[6053,117829],[6084,108791],[6114,114404],[6145,108303],[6175,90831],[6206,88424],[6237,84120],[6265,65867],[6296,66694],[6326,75782],[6357,73755],[6387,60136],[6418,64721],[6434,63024]];
// ------------------------------------------------------------
// La massa monetaria (M2 degli Stati Uniti, fonte FRED serie M2SL,
// miliardi di dollari, un punto al mese dal 2010, scaricata il 18/08/2026).
//
// NON entra in nessun conto: serve solo a cambiare l'unita' di misura del
// grafico. Misurato il 18/08/2026 su 193 mesi, M2 non predice Bitcoin —
// il rendimento a tre mesi contro la variazione di M2 da +0,10 al massimo
// su qualunque ritardo fra 0 e 12 mesi, e su osservazioni non sovrapposte
// resta sotto la soglia di significativita'. Chi la usa come previsione
// sceglie il ritardo dopo aver visto i dati. Qui fa un'altra cosa: dice
// quanta parte della salita in dollari erano dollari in piu'.
// ------------------------------------------------------------
const M2 = [[363,8473],[394,8523],[422,8519],[453,8554],[483,8612],[514,8631],[544,8642],[575,8690],[606,8720],[636,8770],[667,8790],[697,8822],[728,8844],[759,8910],[787,8968],[818,9034],[848,9109],[879,9184],[909,9347],[940,9532],[971,9553],[1001,9586],[1032,9640],[1062,9684],[1093,9753],[1124,9806],[1153,9849],[1184,9905],[1214,9952],[1245,10024],[1275,10076],[1306,10148],[1337,10228],[1367,10294],[1398,10366],[1428,10485],[1459,10502],[1490,10523],[1518,10579],[1549,10609],[1579,10646],[1610,10706],[1640,10743],[1671,10804],[1702,10866],[1732,10989],[1763,11000],[1793,11062],[1824,11128],[1855,11192],[1883,11229],[1914,11276],[1944,11343],[1975,11398],[2005,11452],[2036,11478],[2067,11521],[2097,11596],[2128,11639],[2158,11721],[2189,11806],[2220,11921],[2248,11919],[2279,11953],[2309,11982],[2340,12021],[2370,12064],[2401,12110],[2432,12173],[2462,12228],[2493,12323],[2523,12394],[2554,12522],[2585,12604],[2614,12662],[2645,12742],[2675,12801],[2706,12849],[2736,12907],[2767,12987],[2798,13053],[2828,13124],[2859,13214],[2889,13241],[2920,13319],[2951,13395],[2979,13465],[3010,13520],[3040,13567],[3071,13577],[3101,13638],[3132,13695],[3163,13743],[3193,13802],[3224,13849],[3254,13887],[3285,13902],[3316,13950],[3344,14014],[3375,14035],[3405,14091],[3436,14133],[3466,14170],[3497,14221],[3528,14244],[3558,14258],[3589,14288],[3619,14392],[3650,14460],[3681,14507],[3709,14560],[3740,14594],[3770,14703],[3801,14799],[3831,14883],[3862,14974],[3893,15047],[3923,15186],[3954,15301],[3984,15352],[4015,15425],[4046,15493],[4075,16034],[4106,17064],[4136,17932],[4167,18180],[4197,18331],[4228,18413],[4259,18605],[4289,18760],[4320,19002],[4350,19119],[4381,19375],[4412,19641],[4440,19874],[4471,20174],[4501,20457],[4532,20472],[4562,20629],[4593,20843],[4624,20984],[4654,21163],[4685,21340],[4715,21502],[4746,21646],[4777,21725],[4805,21787],[4836,21768],[4866,21717],[4897,21647],[4927,21649],[4958,21642],[4989,21541],[5019,21464],[5050,21409],[5080,21293],[5111,21274],[5142,21240],[5170,20942],[5201,20758],[5231,20830],[5262,20799],[5292,20792],[5323,20782],[5354,20754],[5384,20738],[5415,20750],[5445,20780],[5476,20836],[5507,20922],[5536,20966],[5567,20956],[5597,21022],[5628,21071],[5658,21099],[5689,21192],[5720,21276],[5750,21337],[5781,21455],[5811,21488],[5842,21539],[5873,21607],[5901,21684],[5932,21771],[5962,21836],[5993,21943],[6023,22026],[6054,22092],[6085,22176],[6115,22250],[6146,22280],[6176,22355],[6207,22420],[6238,22620],[6266,22676],[6297,22800],[6327,23056],[6358,23155]];

// Il tasso per il futuro si ricava dalla serie stessa, non si sceglie:
// e' la sua crescita media sul tratto incorporato (+6,3%/anno).
const M2_CRESCITA = Math.pow(M2[M2.length - 1][1] / M2[0][1],
                             365.25 / (M2[M2.length - 1][0] - M2[0][0])) - 1;

// Quanta massa monetaria c'era (o ci sara') in un dato giorno. Fra due punti
// si interpola; oltre l'ultimo si prosegue al tasso medio, dichiarato in
// legenda; prima del primo si resta fermi al primo, che e' il 2010.
function m2Al(giorni) {
  if (giorni <= M2[0][0]) return M2[0][1];
  const ultimo = M2[M2.length - 1];
  if (giorni >= ultimo[0]) return ultimo[1] * Math.pow(1 + M2_CRESCITA, (giorni - ultimo[0]) / 365.25);
  let lo = 0, hi = M2.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (M2[mid][0] <= giorni) lo = mid; else hi = mid; }
  const [g0, v0] = M2[lo], [g1, v1] = M2[hi];
  return v0 + (v1 - v0) * (giorni - g0) / (g1 - g0);
}

// Il fattore che riporta un prezzo di allora alla massa monetaria di oggi:
// «quel prezzo, se i dollari fossero quelli di adesso».
function inM2(giorni) { return m2Al(giorniDaGenesi()) / m2Al(giorni); }

// Primo anno intero coperto dai prezzi veri: la serie parte ad agosto 2010,
// quindi il 2010 sarebbe un anno mozzo e il grafico comincia dal successivo.
const STORICO_ANNO_DA = new Date(GENESI + STORICO[0][0] * 86400000).getUTCFullYear() + 1;
/**
 * LO SCENARIO DI RIFERIMENTO È IL PEGGIORE.
 * Tutti i numeri della pagina escono dalla linea di SUPPORTO, il 5° percentile:
 * il fondo del corridoio. Se il prezzo farà meglio ti troverai con più di
 * quello che ti serve, che è l'errore giusto da fare.
 */
const RIFERIMENTO = 0;   // indice in SCENARI: 0 supporto · 1 centro · 2 resistenza

/**
 * PER ACCUMULARE, INVECE, LA MEDIANA.
 * La prudenza ha verso opposto nelle due fasi: nel decumulo conviene
 * temere il prezzo basso (serve più capitale), nell'accumulo il prezzo
 * alto (i bitcoin costano di più). Ma comprare per quindici anni ai
 * prezzi del tetto è uno scenario che il corridoio non contempla — e
 * pretenderebbe che il prezzo poi scivoli sul fondo giusto quando
 * cominci a vendere.
 *
 * Su centottanta versamenti il prezzo medio pagato tende alla mediana,
 * per costruzione. Il caso avverso si prende dove non hai margine di
 * manovra — il decumulo — non dove fai molti tentativi.
 */
const ACCUMULO = 1;

// Come si guarda il grafico: "euro" e' il prezzo nominale, "m2" lo riporta
// alla massa monetaria di oggi. Cambia solo il disegno, mai i conti.
let VISTA = "euro";

// ------------------------------------------------------------
// IL LIMITE CHE PONE L'AUTORE STESSO
//
// Santostasi scrive che la legge di potenza «non andrebbe usata per fare
// previsioni oltre il 2040». Estrapolata comunque, al 2090 darebbe circa
// 700 milioni di dollari per bitcoin: una trentina di volte la ricchezza
// del pianeta, una cifra che non descrive più niente.
//
// Qui la curva segue la legge di potenza fino al 2040. Dopo, il prezzo
// cresce solo col carovita: in potere d'acquisto resta fermo. Non è
// pessimismo, è smettere di prevedere dove l'autore stesso smette.
// ------------------------------------------------------------
const ANNO_LIMITE = 2040;

const giorniDaGenesi = (data = new Date()) => (data.getTime() - GENESI) / 86400000;

/** La retta della regressione pura, senza limiti: serve al grafico storico. */
const rettaPura = giorni => Math.pow(10, PL_A + PL_N * Math.log10(giorni));

/** Il giorno in cui scade la validità dichiarata dal modello. */
const GIORNI_LIMITE = (Date.UTC(ANNO_LIMITE, 0, 1) - GENESI) / 86400000;

/**
 * La retta usata dai conti: legge di potenza fino al 2040, poi la stessa
 * pendenza che aveva lì, in decadimento. Non riaccelera mai.
 */
/**
 * DOPO IL 2040: CRESCITA REALE ZERO.
 *
 * Il prezzo continua a salire col carovita e basta: in potere d'acquisto
 * resta fermo. È l'ipotesi che non chiede di credere a niente — un bene
 * che ha finito di guadagnare terreno e si limita a conservare valore.
 *
 * Prima qui c'era una power law smorzata con un esponente scelto a mano,
 * che dava ancora l'8% reale nei primi dieci anni: un parametro arbitrario
 * travestito da modello. Una crescita reale dichiarata si legge e si cambia.
 */
const CRESCITA_REALE_DOPO = 0.00;
const INFLAZIONE_LUNGA = 0.02;   // il carovita che si assume oltre l'orizzonte del modello

// Il corridoio è tarato in dollari e va portato in euro. Se CoinGecko non
// risponde non abbiamo il cambio: usare 1 significherebbe leggere dollari
// come euro e sbagliare i bitcoin necessari del 14%, senza che si veda.
// Meglio un cambio dichiarato, misurato il 17 agosto 2026, e dirlo in pagina.
const CAMBIO_RIPIEGO = 0.868;    // euro per un dollaro

function rettaPowerLaw(giorni) {
  if (giorni <= GIORNI_LIMITE) return rettaPura(giorni);
  const anni = (giorni - GIORNI_LIMITE) / 365.25;
  const nominale = (1 + CRESCITA_REALE_DOPO) * (1 + INFLAZIONE_LUNGA) - 1;
  return rettaPura(GIORNI_LIMITE) * Math.pow(1 + nominale, anni);
}

/** Una linea del corridoio, in dollari: la retta per il suo scarto. */
const lineaCorridoio = (giorni, perc) => rettaPowerLaw(giorni) * Math.pow(10, perc);

/** La crescita istantanea della curva: n/t. Rallenta sempre, per costruzione. */
const crescitaIstantanea = giorni => PL_N * 365.25 / giorni;

/**
 * Dove sta il prezzo dentro il corridoio, e quanto valgono le tre linee.
 *
 * `giornoDelleLinee` cambia solo i tre PREZZI restituiti — la fascia segue la
 * barra del grafico e mostra quelli dell'anno in cui si comincia a vendere.
 * La posizione dell'indicatore resta invece quella di OGGI, e va bene: il
 * corridoio è un multiplo della retta, quindi «a che punto della fascia siamo»
 * non dipende dalla data.
 */
function posizioneNelCorridoio(prezzoUsd, giornoDelleLinee) {
  const d = giornoDelleLinee || giorniDaGenesi();
  const basso = SCENARI[0].perc, alto = SCENARI[2].perc;
  const scarto = Math.log10(prezzoUsd / rettaPowerLaw(giorniDaGenesi()));
  return {
    rapporto: prezzoUsd / rettaPowerLaw(giorniDaGenesi()),
    frazione: Math.max(0, Math.min(1, (scarto - basso) / (alto - basso))),
    // la scala è lineare nei logaritmi: il 50° percentile non cade a metà
    fraz50: (SCENARI[1].perc - basso) / (alto - basso),
    supporto: lineaCorridoio(d, basso),
    centro: lineaCorridoio(d, SCENARI[1].perc),
    resistenza: lineaCorridoio(d, alto),
  };
}

// ------------------------------------------------------------
// Conti
// ------------------------------------------------------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = n => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(n);
// Un anno solo non sono «1 anni»: il verdetto lo legge una persona.
const inAnni = n => n === 1 ? "1 anno" : fmt(n) + " anni";
const fmtBTC = n => new Intl.NumberFormat("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);
const fmtPct = x => `${(x * 100).toFixed(1).replace(".", ",")}%`;

/** Imposta dovuta su una plusvalenza annua, secondo il regime del paese. */
function imposta(paese, plusvalenza, oltreUnAnno) {
  const f = FISCO[paese];
  if (plusvalenza <= 0) return 0;
  if (f.esenteOltreAnno && oltreUnAnno) return 0;
  if (f.scaglioni) {
    let dovuta = 0, resto = plusvalenza, base = 0;
    for (const [tetto, aliq] of f.scaglioni) {
      const quota = Math.min(resto, tetto - base);
      if (quota <= 0) break;
      dovuta += quota * aliq;
      resto -= quota; base = tetto;
      if (resto <= 0) break;
    }
    return dovuta;
  }
  return plusvalenza * f.aliquota;
}

/**
 * Quanto devo vendere (lordo) per ritrovarmi `netto` in tasca.
 *
 * L'imposta si calcola sul CASO PEGGIORE: tutto l'importo venduto è
 * plusvalenza, come se i bitcoin li avessi avuti a costo zero. Chi li ha
 * pagati qualcosa pagherà meno di così — mai di più.
 *
 * Con gli scaglioni spagnoli serve un punto fisso: poche passate bastano.
 */
function lordoPerNetto(paese, netto, prezzo, oltreUnAnno) {
  const f = FISCO[paese];
  if (f.esenteOltreAnno && oltreUnAnno) return { lordo: netto, aliquotaEff: 0 };

  // Aliquota piatta: la formula è esatta, lordo = netto / (1 − aliquota).
  // Prima qui c'erano sei giri di punto fisso, che si fermavano allo 0,04%
  // di distanza dal valore vero: piccolo, ma sbagliato per niente.
  if (!f.scaglioni) {
    const lordo = netto / (1 - f.aliquota);
    return { lordo, aliquotaEff: f.aliquota };
  }

  if (!(netto > 0)) return { lordo: 0, aliquotaEff: 0 };
  // A scaglioni non c'è formula chiusa: bisezione, che converge davvero.
  let lo = netto, hi = netto * 3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mid - imposta(paese, mid, oltreUnAnno) < netto) lo = mid; else hi = mid;
  }
  return { lordo: hi, aliquotaEff: 1 - netto / hi };
}

/**
 * La simulazione, anno per anno, di un decumulo programmato.
 *
 * Si parte da `btc0` bitcoin posseduti OGGI. Fino all'età di inizio non si
 * vende niente, ma il bollo — dove c'è — erode comunque. Da lì in poi ogni
 * anno si vende quanto serve per avere in mano l'importo netto, rivalutato
 * all'inflazione, al prezzo che la linea del corridoio dà per quell'anno.
 *
 * Restituisce anche la tabella anno per anno: non è mostrata, ma serve ai test.
 */
function simula(p, linea, btc0) {
  const infl = PAESI[p.paese].infl;
  const bollo = FISCO[p.paese].bollo || 0;
  const attesa = Math.max(0, p.etaInizio - p.eta);
  const anni = Math.max(0, p.etaFine - p.etaInizio);

  let btc = btc0;
  // Gli anni di attesa: nessuna vendita, ma il bollo si paga lo stesso.
  for (let t = 0; t < attesa; t++) btc *= (1 - bollo);

  const righe = [];
  for (let t = 0; t < anni; t++) {
    const anniDaOggi = attesa + t;
    const prezzo = linea(anniDaOggi);
    // L'importo è il potere d'acquisto di oggi: si rivaluta ogni anno.
    const netto = p.nettoAnnuo * Math.pow(1 + infl, anniDaOggi);
    const { lordo } = lordoPerNetto(p.paese, netto, prezzo, p.oltreUnAnno);
    const venduti = lordo / prezzo;
    const prima = btc;
    btc -= venduti;
    const esaurito = btc < 0;
    if (!esaurito) btc *= (1 - bollo);
    righe.push({
      eta: p.eta + anniDaOggi, anno: NOW_YEAR + anniDaOggi, prezzo,
      netto, lordo, tasse: lordo - netto, venduti,
      residui: Math.max(0, btc), prima, esaurito,
    });
    if (esaurito) return { righe, bastano: false };
  }
  return { righe, bastano: true };
}

/**
 * Quanti bitcoin servono OGGI, senza margini: il minimo che arriva ai cento
 * anni se il prezzo segue la linea senza scossoni. Serve come base di calcolo;
 * il numero che si mostra è quello prudente, qui sotto.
 */
function fabbisognoLiscio(p, linea) {
  const attesa = Math.max(0, p.etaInizio - p.eta);
  const anni = Math.max(0, p.etaFine - p.etaInizio);
  const prezzoInizio = linea(attesa);
  const nettoInizio = p.nettoAnnuo * Math.pow(1 + PAESI[p.paese].infl, attesa);
  const { lordo, aliquotaEff } = lordoPerNetto(p.paese, nettoInizio, prezzoInizio, p.oltreUnAnno);

  let lo = 0, hi = (anni * lordo) / prezzoInizio + 1e-8;
  if (!simula(p, linea, hi).bastano) hi *= 4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (simula(p, linea, mid).bastano) hi = mid; else lo = mid;
  }
  const sim = simula(p, linea, hi);
  return { btcNecessari: hi, anni, attesa, prezzoInizio,
           nettoInizio, lordoInizio: lordo, aliquotaEff, righe: sim.righe };
}

/**
 * Quanto devi mettere da parte ogni mese, da oggi fino al primo prelievo,
 * per arrivare ai bitcoin che ti servono.
 *
 * Comprando P ogni mese al prezzo che la linea dà per quel mese, i bitcoin
 * accumulati sono P × Σ(1/prezzo). Quindi P si ricava per divisione, senza
 * cercarlo a tentoni.
 *
 */
function pianoDiAccumulo(p, lineaObiettivo, lineaAcquisto, stack) {
  const mesi = Math.max(0, Math.round((p.etaInizio - p.eta) * 12));
  if (mesi === 0) return null;

  // Il conto si fa alla data del primo prelievo, non a oggi: i bitcoin
  // comprati fra dieci anni pagano dieci anni di bollo in meno di quelli
  // comprati domani, e ignorarlo sovrastimava il versamento.
  const bollo = FISCO[p.paese].bollo || 0;
  const anniAttesa = mesi / 12;
  let btcPerEuroMensile = 0;
  for (let m = 0; m < mesi; m++) {
    const erosione = Math.pow(1 - bollo, (mesi - m) / 12);   // dall'acquisto al via
    btcPerEuroMensile += erosione / lineaAcquisto(m / 12);
  }

  // L'obiettivo esce dalla linea del decumulo, più bassa, ed è riferito a
  // oggi: al via sarà già eroso dal bollo, come lo sarà quello che hai già.
  const obiettivo = fabbisogno(p, lineaObiettivo).btcNecessari;
  const alVia = Math.pow(1 - bollo, anniAttesa);
  const mancano = Math.max(0, (obiettivo - stack) * alVia);
  const mensile = mancano / btcPerEuroMensile;
  return {
    mensile, mesi, anni: anniAttesa,
    totale: mensile * mesi,
    btcObiettivo: obiettivo,
    btcDaComprare: mancano / alVia,   // riportati a oggi, per leggibilità
    giaCoperto: mancano === 0,
  };
}

/**
 * IL NUMERO CHE CONTA: quanti bitcoin servono davvero.
 *
 * Il fabbisogno liscio non basta, perché la realtà non è liscia: Bitcoin
 * scende del 70% e ci mette anni a tornare, e se capita mentre stai vendendo
 * liquidi molti più satoshi allo stesso prezzo. Quel capitale, al primo
 * scossone, finisce prima dei cento anni.
 *
 * Qui il crollo si fa succedere in OGNI anno del decumulo, uno alla volta, e
 * il capitale restituito è quello che regge anche nel caso peggiore. Non è un
 * avviso da leggere: è già dentro il numero.
 */
function fabbisogno(p, linea) {
  const base = fabbisognoLiscio(p, linea);
  const conCrollo = capitaleAntiCrollo(p, base.btcNecessari, linea);
  // 10/3 e non 3: nel caso peggiore si vende al 30% del prezzo, quindi il
  // fattore massimo davvero necessario è 1/0,3. Con 3 il numero pubblicato
  // non avrebbe retto il crollo.
  const necessari = conCrollo || base.btcNecessari * (10 / 3);
  // Le righe vanno risimulate col numero vero: quelle della simulazione
  // liscia appartenevano a un capitale più piccolo e lo contraddicevano.
  return { ...base, btcNecessari: necessari, btcLiscio: base.btcNecessari,
           righe: simula(p, linea, necessari).righe };
}

/**
 * IL PASSATO, COI PREZZI VERI.
 *
 * «Se avessi cominciato nel 2019, quanti bitcoin avrei oggi?» — e la risposta
 * NON usa il modello. La curva è tarata sui dati fino a oggi, quindi per il
 * 2019 «conosce il futuro»: usarla sarebbe finzione, e sbaglia i bitcoin
 * accumulati fra il −31% e il +38% a seconda del periodo (misurato).
 * Qui si usano i prezzi che Bitcoin ha avuto davvero, quelli della linea
 * bianca del grafico.
 *
 * `cambio` porta i dollari della serie storica nella valuta dell'utente. È il
 * cambio di oggi applicato a tutto il passato: un'approssimazione, dichiarata
 * in pagina, che sposta il risultato di qualche punto percentuale — molto
 * meno del rumore che introdurrebbe il modello.
 */
function prezzoStoricoAl(giorni) {
  // Il prezzo più vicino nella serie: i punti non sono equispaziati (la coda
  // dell'ultimo anno arriva da CoinGecko più densa), quindi non si può
  // scorrere la serie come se fosse un calendario.
  let migliore = null, distanza = Infinity;
  for (const [g, p] of STORICO) {
    const d = Math.abs(g - giorni);
    if (d < distanza) { distanza = d; migliore = p; }
  }
  return migliore;
}

function accumuloStorico(annoDa, mensile, cambio) {
  if (!(mensile > 0) || !(annoDa > 0)) return null;
  // Prima della serie non ci sono prezzi da usare: chi digita 2005 nel campo
  // (min/max nell'HTML non impediscono di scriverlo) otterrebbe mezzo milione
  // di BTC comprati a 0,07 $, cifra falsa. Si parte dal primo anno coperto.
  if (annoDa < STORICO_ANNO_DA) return null;
  const oggi = giorniDaGenesi();
  const inizio = (Date.UTC(annoDa, 0, 1) - GENESI) / 86400000;
  if (inizio >= oggi) return null;

  // Un versamento al mese, contato sul calendario e non sui punti della serie:
  // prima si contava un acquisto per punto, e con la coda densa dell'ultimo
  // anno risultavano 106 versamenti invece di 92.
  const mesi = Math.floor((oggi - inizio) / (365.25 / 12));
  let btc = 0;
  for (let m = 0; m < mesi; m++) {
    const prezzo = prezzoStoricoAl(inizio + m * (365.25 / 12)) * cambio;
    if (prezzo > 0) btc += mensile / prezzo;
  }
  if (!mesi || !btc) return null;
  const versato = mensile * mesi;
  return { btc, versato, versamenti: mesi, mesi,
           costoMedio: versato / btc, anni: mesi / 12 };
}

/**
 * LA DOMANDA INVERSA: verso quello che posso, cosa ottengo?
 *
 * Il tool risponde «servono 2.166 € al mese», cifra che quasi nessuno può
 * versare. Girata al contrario diventa utile: dato quanto riesci a mettere,
 * quale integrazione netta ne esce. Bisezione sull'importo annuo, perché la
 * relazione è monotona (chiedere più soldi richiede sempre più versamento).
 */
function integrazioneOttenibile(p, lineaObiettivo, lineaAcquisto, stack, mensileDisponibile) {
  if (!(mensileDisponibile > 0)) return 0;
  // L'estremo alto si allarga finché serve: fissarlo a un milione faceva
  // dire «arrivi a 1.000.000» a chi poteva permettersi di più.
  let lo = 0, hi = 1e5;
  for (let g = 0; g < 12; g++) {
    const pa = pianoDiAccumulo({ ...p, nettoAnnuo: hi }, lineaObiettivo, lineaAcquisto, stack);
    if (pa && pa.mensile > mensileDisponibile) break;
    hi *= 4;
  }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const q = { ...p, nettoAnnuo: mid };
    const pa = pianoDiAccumulo(q, lineaObiettivo, lineaAcquisto, stack);
    if (!pa || pa.mensile <= mensileDisponibile) lo = mid; else hi = mid;
  }
  return lo;
}

/** La linea del corridoio di uno scenario, portata nella valuta locale. */
function lineaDi(p, sc) {
  const d0 = giorniDaGenesi();
  const cambio = p.cambioUsd || CAMBIO_RIPIEGO;
  return anni => lineaCorridoio(d0 + anni * 365.25, sc.perc) * cambio;
}

/**
 * PROVA DEL CROLLO — la legge di potenza è una linea liscia, la realtà no.
 * Bitcoin scende del 70% e ci mette anni a tornare. Se succede appena hai
 * cominciato a vendere, liquidi molti più sat allo stesso prezzo e quei sat
 * non tornano più: è il rischio di sequenza.
 *
 * Quando arriverà il crollo non lo sa nessuno — non lo si chiede all'utente:
 * si provano TUTTI gli anni del decumulo e si tiene il peggiore. È l'unico
 * modo onesto di rispondere a «e se capitasse nel momento sbagliato?».
 */
function crolloDaAnno(p, linea, quando) {
  const attesa = p.etaInizio - p.eta;
  return anni => {
    const d = anni - attesa - quando;
    const s = (d >= 0 && d < 4) ? 0.30 + 0.70 * (d / 4) : 1;
    return linea(anni) * s;
  };
}

function testTenuta(p, btcIniziali, linea) {
  const anni = Math.max(1, p.etaFine - p.etaInizio);
  let peggiore = null;
  for (let quando = 0; quando < anni; quando++) {
    const sim = simula(p, crolloDaAnno(p, linea, quando), btcIniziali);
    if (!sim.bastano) {
      const etaRottura = sim.righe[sim.righe.length - 1].eta;
      // Il caso peggiore è quello che ti lascia a secco prima.
      if (!peggiore || etaRottura < peggiore.etaRottura) {
        peggiore = { regge: false, etaRottura, annoCrollo: quando };
      }
    }
  }
  if (peggiore) return peggiore;
  // Regge ovunque: si riporta quanto resta nel caso in cui il crollo arriva subito.
  const sim = simula(p, crolloDaAnno(p, linea, 0), btcIniziali);
  const ultima = sim.righe[sim.righe.length - 1];
  // Senza anni di prelievo non c'è nessuna riga: il capitale resta intero.
  return { regge: true, btcResidui: ultima ? ultima.residui : btcIniziali };
}

/** Quanto capitale servirebbe per reggere il crollo. */
function capitaleAntiCrollo(p, btcBase, linea) {
  if (testTenuta(p, btcBase, linea).regge) return btcBase;
  let lo = 1, hi = 8;
  if (!testTenuta(p, btcBase * hi, linea).regge) return null;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (testTenuta(p, btcBase * mid, linea).regge) hi = mid; else lo = mid;
  }
  return btcBase * hi;
}

/** La prima età di inizio in cui i bitcoin che hai già basterebbero. */
function primaEtaSufficiente(p, stack, sc) {
  if (!stack || stack <= 0) return null;
  for (let eta = Math.max(p.eta, p.etaInizio); eta <= p.etaFine - 1; eta++) {
    const q = { ...p, etaInizio: eta };
    if (stack >= fabbisogno(q, lineaDi(q, sc)).btcNecessari) return eta;
  }
  return null;
}

// ------------------------------------------------------------
// Prezzo di oggi
// ------------------------------------------------------------
let prezziLive = { eur: null, pln: null, usd: null };
let prezzoManuale = false;
let avviato = false;   // prima dell'avvio le funzioni dell'interfaccia non esistono ancora

async function caricaPrezzo(forzato = false) {
  const badge = document.getElementById("badgePrezzo");
  badge.textContent = "aggiorno…";
  badge.className = "badge badge-wait";
  badge.disabled = true;
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur,pln,usd&_=" + Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    prezziLive = { eur: d.bitcoin.eur, pln: d.bitcoin.pln, usd: d.bitcoin.usd };
    if (forzato) prezzoManuale = false;
    if (!prezzoManuale) applicaPrezzoLive();
    badge.textContent = "live " + new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    badge.className = "badge badge-live";
    badge.title = "Rileggi il prezzo da CoinGecko";
  } catch (e) {
    // Nessun prezzo inventato: un valore di ripiego sbagliato falsa ogni
    // cifra della pagina senza che si veda.
    badge.textContent = "non arriva — riprova";
    badge.className = "badge badge-off";
    badge.title = "CoinGecko non ha risposto. Premi per riprovare, oppure scrivi il prezzo a mano.";
    // Niente focus() qui: rubava il cursore mentre l'utente scriveva l'età,
    // e quello che digitava finiva nel campo del prezzo. Il badge dice già
    // «non arriva — riprova».
  } finally {
    badge.disabled = false;
  }
}

/**
 * La serie storica incorporata è ferma al giorno in cui è stata generata.
 * Il pezzo che invecchia — l'ultimo anno — si riprende da CoinGecko a ogni
 * caricamento, così la linea bianca arriva sempre a oggi.
 *
 * Tutta la storia non si può riscaricare: blockchain.info non apre il CORS,
 * e CoinGecko senza chiave dà al massimo 365 giorni. I parametri della
 * regressione restano quelli misurati, e la pagina dichiara quando.
 */
async function aggiornaCodaStorica() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily");
    if (!r.ok) return;
    const d = await r.json();
    if (!d.prices || !d.prices.length) return;
    const primoNuovo = (d.prices[0][0] - GENESI) / 86400000;
    const tenuti = STORICO.filter(([g]) => g < primoNuovo);
    // un punto ogni due settimane: il disegno non cambia e il percorso resta corto
    const nuovi = d.prices
      .filter((_, i) => i % 14 === 0 || i === d.prices.length - 1)
      .map(([ms, v]) => [Math.round((ms - GENESI) / 86400000), Math.round(v)]);
    STORICO.length = 0;
    STORICO.push(...tenuti, ...nuovi);
  } catch (e) { /* si tiene quella incorporata: è meglio di niente */ }
}

const prezzoPerPaese = nome => PAESI[nome].valuta === "PLN" ? prezziLive.pln : prezziLive.eur;

function applicaPrezzoLive() {
  const p = prezzoPerPaese($paese.value);
  if (p) {
    $prezzo.value = Math.round(p);
    if (avviato) adattaTutti();
  }
}

// ------------------------------------------------------------
// INTERFACCIA
// Il modulo è una frase da completare e il risultato si aggiorna
// mentre scrivi: niente pulsante fra la domanda e la risposta.
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
const $paese = $("paese"), $eta = $("eta"), $etaInizio = $("etaInizio"), $netto = $("netto"), $etaFine = $("etaFine"), $disponibile = $("disponibile"), $annoDa = $("annoDa");
const $prezzo = $("prezzoOggi"), $stack = $("stack");
const $grafico = $("grafico"), $corridoio = $("corridoio"), $verdetto = $("verdetto");

Object.keys(PAESI).forEach(n => {
  const o = document.createElement("option");
  o.value = n; o.textContent = n;
  $paese.appendChild(o);
});
$paese.value = "Italia";

/** Gli input e i menu dentro la frase si stringono sul testo che contengono. */
const righello = document.createElement("span");
righello.style.cssText = "position:absolute;visibility:hidden;white-space:pre;top:-9999px";
document.body.appendChild(righello);

function adattaLarghezza(el) {
  const s = getComputedStyle(el);
  righello.style.font = s.font || `${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${s.fontFamily}`;
  righello.style.letterSpacing = s.letterSpacing;
  righello.textContent = (el.tagName === "SELECT"
    ? (el.selectedOptions[0] ? el.selectedOptions[0].textContent : "")
    : String(el.value || el.placeholder || "")) || "0";
  const bordi = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight)
              + parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
  const respiro = el.tagName === "SELECT" ? 4 : 3;
  el.style.width = Math.ceil(righello.offsetWidth + bordi + respiro) + "px";
  if (el.tagName !== "SELECT" && el.scrollWidth > el.clientWidth) {
    el.style.width = Math.ceil(el.scrollWidth + bordi + respiro) + "px";
  }
}
const adattaTutti = () =>
  document.querySelectorAll(".frase input.inline, .frase select, .prezzo-live input.inline")
    .forEach(adattaLarghezza);

function aggiornaValuta() {
  const c = PAESI[$paese.value];
  document.querySelectorAll(".sym").forEach(e => (e.textContent = c.sym));
  const f = FISCO[$paese.value];
  // La durata di detenzione conta solo dove esiste un'esenzione: altrove
  // la domanda non ha senso e la casella sparisce.
  if (!prezzoManuale) applicaPrezzoLive();
  adattaTutti();
}

/** Chi ha meno di un bitcoin ragiona in satoshi: 28392600 sono 0,283926 BTC. */
function stackInBTC() {
  const v = parseFloat($stack.value || "0");
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > 1000 ? v / 1e8 : v;
}

function leggiInput() {
  const eta = clamp(parseInt($eta.value, 10) || 35, 18, 95);
  return {
    paese: $paese.value,
    eta,
    // Non si può cominciare a prelevare prima di adesso, né dopo i 99.
    etaFine: clamp(parseInt($etaFine.value, 10) || ETA_FINE_DEFAULT, eta + 1, 120),
    etaInizio: clamp(parseInt($etaInizio.value, 10) || eta, eta,
                     clamp(parseInt($etaFine.value, 10) || ETA_FINE_DEFAULT, eta + 1, 120) - 1),
    nettoAnnuo: Math.min(parseFloat($netto.value || "0") || 0, 1e9),
    prezzoOggi: parseFloat($prezzo.value),
    // Chi accumula e vende dopo anni ha per forza lotti vecchi: si assume,
    // e lo si dichiara qui.
    oltreUnAnno: true,
    // Il corridoio è in dollari: serve il cambio per portarlo nella valuta locale.
    cambioUsd: prezziLive.usd ? parseFloat($prezzo.value) / prezziLive.usd : null,
    disponibile: parseFloat($disponibile.value || "0"),
    annoDa: parseInt($annoDa.value, 10) || 0,
  };
}

const barra = f => `<div class="bar"><span style="width:${clamp(f * 100, 0, 100)}%"></span></div>`;


// ------------------------------------------------------------
// IL GRAFICO
// Asse del tempo lineare in anni (si deve capire *quando*), asse dei prezzi
// logaritmico (si va da 7 centesimi a centinaia di milioni). In log-log la
// legge di potenza sarebbe una retta e direbbe «crescita costante»: qui la
// curva si appiattisce, che è quello che il modello dice davvero.
//
// Il corridoio è UNA cosa, non tre serie: una banda con la mediana marcata.
// Il colore distingue il fatto (storico, in ink neutro) dal modello (in verde,
// tratteggiato) — e il tratteggio è il secondo segnale, così l'identità non
// dipende dal solo colore.
// ------------------------------------------------------------
function grafico(base, cambio) {
  // Il viewBox coincide coi pixel veri sullo schermo: cosi un'unita e un
  // pixel, e le scritte e le aree da toccare restano della misura che
  // dichiarano. Con un viewBox fisso a 1100 rimpicciolito su un telefono
  // le scritte scendevano a 3,5 px e la maniglia a 4,3: illeggibili e
  // intoccabili, pur essendo scritte 10 px e 22 nel codice.
  const larghezzaVera = $grafico.clientWidth || Math.min(window.innerWidth - 40, 992);
  const W = Math.max(320, Math.round(larghezzaVera));
  const H = W < 560 ? 300 : 400;
  const stretto = W < 560;
  const ML = stretto ? 44 : 64, MR = stretto ? 10 : 18, MT = 18, MB = 34;
  const annoFine = NOW_YEAR + (base.etaFine - base.eta);
  const annoAsseDa = STORICO_ANNO_DA;
  const px = a => ML + (a - annoAsseDa) / (annoFine - annoAsseDa) * (W - ML - MR);
  // In unita' di M2 ogni prezzo viene riportato alla massa monetaria di oggi:
  // il fattore vale 1 nella vista in euro, cosi' il resto del disegno non cambia.
  const fatM2 = g => VISTA === "m2" ? inM2(g) : 1;
  // Il fondo scala e' il punto piu' alto della curva, non il suo ultimo punto:
  // in unita' di M2 il massimo cade verso il 2040 e la banda usciva dal riquadro.
  // Va calcolato nella stessa unita' dei dati, cambio compreso: prima era in
  // dollari mentre i punti erano in euro, e lasciava un 13% vuoto in cima.
  let maxP = 0;
  for (let a = annoAsseDa; a <= annoFine; a++) {
    const g = giorniDaGenesi() + (a - NOW_YEAR) * 365.25;
    maxP = Math.max(maxP, lineaCorridoio(g, SCENARI[2].perc) * cambio * fatM2(g));
  }
  const minP = 0.05;
  const py = v => {
    const l = Math.log10(Math.max(v, minP)), lo = Math.log10(minP), hi = Math.log10(maxP);
    return MT + (1 - (l - lo) / (hi - lo)) * (H - MT - MB);
  };
  const giorniDi = a => giorniDaGenesi() + (a - NOW_YEAR) * 365.25;

  // le tre linee, campionate ogni anno
  const anni = [];
  for (let a = annoAsseDa; a <= annoFine; a++) anni.push(a);
  const linea = perc => anni.map(a => {
    const g = giorniDi(a);
    return `${px(a).toFixed(1)},${py(lineaCorridoio(g, perc) * cambio * fatM2(g)).toFixed(1)}`;
  });
  const sup = linea(SCENARI[0].perc), cen = linea(SCENARI[1].perc), res = linea(SCENARI[2].perc);
  // La mediana si spezza al 2040: prima è il modello, dopo è la prosecuzione.
  const iLimite = Math.max(1, anni.findIndex(a => a >= ANNO_LIMITE));
  const cenModello = cen.slice(0, iLimite + 1), cenOltre = cen.slice(iLimite);
  const banda = `M${res.join("L")}L${sup.slice().reverse().join("L")}Z`;

  // la storia vera
  const st = STORICO.filter(([g]) => g / 365.25 + 2009 >= annoAsseDa)
    .map(([g, v]) => `${px(2009 + g / 365.25).toFixed(1)},${py(v * cambio * fatM2(g)).toFixed(1)}`);

  // Oggi non è "l'inizio del 2026": è il punto dell'anno in cui siamo davvero.
  // La riga del primo prelievo parte da lì, così quando la porti al minimo
  // finisce esattamente sul pallino di oggi, senza scarti.
  const oggiFraz = NOW_YEAR + (giorniDaGenesi() - giorniDaGenesi(new Date(NOW_YEAR, 0, 1))) / 365.25;
  const oggiX = px(oggiFraz), inizioX = px(oggiFraz + (base.etaInizio - base.eta));
  const tacche = (stretto ? [1, 10000, 1e8] : [1, 100, 10000, 1e6, 1e8]).filter(v => v <= maxP);
  const etichettaP = v => v >= 1e6 ? (v / 1e6) + " mln" : v >= 1000 ? (v / 1000) + "k" : String(v);
  const anniAsse = anni.filter(a => a % (stretto ? 20 : 10) === 0);

  return `
    <section class="blocco">
      <figure class="gfx">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Prezzo storico di Bitcoin e corridoio della legge di potenza, dal 2011 al ${annoFine}. Il primo prelievo e fissato al ${NOW_YEAR + (base.etaInizio - base.eta)}; si cambia dal campo «Eta da cui iniziare a prelevare», oppure trascinando la riga verticale." preserveAspectRatio="xMidYMid meet"
               data-da="${annoAsseDa}" data-a="${annoFine}" data-ml="${ML}" data-mr="${MR}" data-w="${W}">
          <rect x="${inizioX.toFixed(1)}" y="${MT}" width="${(W - MR - inizioX).toFixed(1)}" height="${H - MT - MB}" class="g-decumulo" />
          ${tacche.map(v => `<line x1="${ML}" y1="${py(v).toFixed(1)}" x2="${W - MR}" y2="${py(v).toFixed(1)}" class="g-griglia" />
             <text x="${ML - 8}" y="${(py(v) + 4).toFixed(1)}" class="g-tacca" text-anchor="end">${etichettaP(v)}</text>`).join("")}
          ${anniAsse.map(a => `<text x="${px(a).toFixed(1)}" y="${H - 12}" class="g-tacca" text-anchor="middle">${a}</text>`).join("")}
          <path d="${banda}" class="g-banda" />
          <polyline points="${cenModello.join(" ")}" class="g-centro" />
          <polyline points="${cenOltre.join(" ")}" class="g-centro-oltre" />
          <polyline points="${st.join(" ")}" class="g-storico" />
          ${(() => {
            const xl = px(ANNO_LIMITE);
            return xl > ML && xl < W - MR
              ? `<line x1="${xl.toFixed(1)}" y1="${MT}" x2="${xl.toFixed(1)}" y2="${H - MB}" class="g-limite" />`
              : "";
          })()}
          ${(() => {
            // Il secondo segno: da quando compri. Sta a sinistra di oggi e
            // lavora sui prezzi veri, non sul modello.
            if (!(base.annoDa > 0) || base.annoDa >= Math.floor(oggiFraz)) return "";
            const xd = px(base.annoDa);
            if (xd < ML || xd > W - MR) return "";
            return `<line x1="${xd.toFixed(1)}" y1="${MT}" x2="${xd.toFixed(1)}" y2="${H - MB}" class="g-compro" />
              <g class="g-maniglia g-maniglia-passato" transform="translate(${xd.toFixed(1)},${MT})">
                <circle r="11" /><path d="M-4 -4 L-8 0 L-4 4 M4 -4 L8 0 L4 4" />
              </g>
              <rect class="g-presa g-presa-passato" x="${(xd - 22).toFixed(1)}" y="${MT}" width="44" height="${H - MT - MB}" />
              <text x="${(xd + 10).toFixed(1)}" y="${MT + 26}" class="g-nota-compro">compro dal ${base.annoDa} ⇄</text>`;
          })()}
          <line x1="${inizioX.toFixed(1)}" y1="${MT}" x2="${inizioX.toFixed(1)}" y2="${H - MB}" class="g-inizio" />
          ${(() => {
            // L'etichetta sta accanto alla maniglia, in basso: è la cosa che
            // trascini, e lì il disegno è vuoto. In alto invece i tre prezzi
            // del corridoio si stringono quando la curva si appiattisce, e
            // qualunque scritta finirebbe sopra di loro.
            const testo = `vendi dal ${NOW_YEAR + (base.etaInizio - base.eta)} · ${base.etaInizio} anni ⇄`;
            const yEt = H - MB - 12;
            // Se la riga è troppo a destra, la scritta va a sinistra.
            const aSinistra = inizioX > W - MR - 190;
            return aSinistra
              ? `<text x="${(inizioX - 10).toFixed(1)}" y="${yEt}" class="g-nota-inizio" text-anchor="end">${testo}</text>`
              : `<text x="${(inizioX + 10).toFixed(1)}" y="${yEt}" class="g-nota-inizio">${testo}</text>`;
          })()}
          <rect class="g-presa" x="${(inizioX - 22).toFixed(1)}" y="${MT}" width="44" height="${H - MT - MB}" />
          <g class="g-maniglia" transform="translate(${inizioX.toFixed(1)},${H - MB})">
            <circle r="11" /><path d="M-4 -4 L-8 0 L-4 4 M4 -4 L8 0 L4 4" />
          </g>
          ${(() => {
            // Su dieci ordini di grandezza la banda si vede sottile: i tre valori
            // all'anno d'inizio si scrivono, così il range si legge in numeri.
            const g = giorniDi(NOW_YEAR + (base.etaInizio - base.eta));
            const sym = PAESI[base.paese].sym;
            const breve = v => v >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " mln" : fmt(v);
            return SCENARI.map((sc, i) => {
              const v = lineaCorridoio(g, sc.perc) * cambio * fatM2(g);
              const y = py(v) + (i === 0 ? 14 : i === 2 ? -7 : 4);
              // A destra della riga: è lì che guardi mentre la trascini verso il futuro.
              return `<circle cx="${inizioX.toFixed(1)}" cy="${py(v).toFixed(1)}" r="2.5" class="g-punto" />
                      <text x="${(inizioX + 10).toFixed(1)}" y="${y.toFixed(1)}" class="g-valore">${sym} ${breve(v)}</text>`;
            }).join("");
          })()}
          <circle cx="${oggiX.toFixed(1)}" cy="${py(base.prezzoOggi).toFixed(1)}" r="4" class="g-oggi" />
          ${// Se la riga del primo prelievo è addosso a «oggi», l'etichetta passa a sinistra.
            (() => {
              const vicino = Math.abs(inizioX - oggiX) < 90;
              return vicino
                ? `<text x="${(oggiX - 9).toFixed(1)}" y="${(py(base.prezzoOggi) + 14).toFixed(1)}" class="g-nota-oggi" text-anchor="end">oggi</text>`
                : `<text x="${(oggiX + 8).toFixed(1)}" y="${(py(base.prezzoOggi) - 8).toFixed(1)}" class="g-nota-oggi">oggi</text>`;
            })()}
        </svg>
        <figcaption>
          <span class="g-leg"><i class="l-storico"></i>prezzo reale</span>
          <span class="g-leg"><i class="l-banda"></i>corridoio, 5°–95° percentile</span>
          <span class="g-leg"><i class="l-centro"></i>mediana, fino al ${ANNO_LIMITE}</span>
          <span class="g-leg"><i class="l-oltre"></i>dopo: solo carovita</span>
          <span class="g-scala">${VISTA === "m2"
            ? `prezzi riportati alla massa monetaria di oggi (M2 Stati Uniti; oltre l'ultimo dato, proiettata al +${(M2_CRESCITA * 100).toFixed(1).replace(".", ",")}%/anno, la sua media dal 2010) · scala logaritmica`
            : "prezzi in scala logaritmica"}</span>
        </figcaption>
      </figure>
    </section>`;
}

function render() {
  const base = leggiInput();
  const c = PAESI[base.paese];
  const stack = stackInBTC();

  // I messaggi d'errore vanno dove starebbe il risultato: dentro il grafico.
  const errore = testo => {
    $verdetto.innerHTML = `<div class="verdetto"><p class="errore" role="alert">${testo}</p></div>`;
    $grafico.innerHTML = "";
    $corridoio.innerHTML = "";
  };
  if (!Number.isFinite(base.nettoAnnuo) || base.nettoAnnuo <= 0) {
    return errore("Scrivi di quanto hai bisogno ogni anno: senza quello non c'è niente da calcolare.");
  }
  if (!Number.isFinite(base.prezzoOggi) || base.prezzoOggi <= 0) {
    return errore("Manca il prezzo di Bitcoin. Premi ↻ per rileggerlo, oppure scrivilo a mano.");
  }

  const RIF = SCENARI[RIFERIMENTO], CEN = SCENARI[1];
  const r = fabbisogno(base, lineaDi(base, RIF));
  const pa = pianoDiAccumulo(base, lineaDi(base, RIF), lineaDi(base, SCENARI[ACCUMULO]), stack);
  const cambio = base.cambioUsd || CAMBIO_RIPIEGO;
  const annoInizio = NOW_YEAR + r.attesa;

  // — Il passato: cosa sarebbe successo cominciando prima. Sta nel pannello,
  // accanto alla rata da versare: è il termine di confronto naturale.
  let passatoBox = "";
  if (base.annoDa > 0 && base.annoDa < NOW_YEAR) {
    const rata = base.disponibile > 0 ? base.disponibile : 500;
    const st = accumuloStorico(base.annoDa, rata, cambio);
    if (st) {
      const valoreOggi = st.btc * base.prezzoOggi;
      const guadagno = valoreOggi / st.versato - 1;
      passatoBox = `
        <div class="passato">
          <p class="passato-riga">Dal <b>${base.annoDa}</b>, ${c.sym} ${fmt(rata)} al mese:
            <b class="k">${fmtBTC(st.btc)} BTC</b></p>
          <p class="passato-conti">${c.sym} ${fmt(st.versato)} versati in
            ${st.mesi < 24 ? st.mesi + " mesi" : inAnni(Math.round(st.anni))}, oggi
            <b>${c.sym} ${fmt(valoreOggi)}</b>
            (${guadagno >= 0 ? "+" : "−"}${Math.abs(guadagno * 100).toFixed(0)}%,
            costo medio ${c.sym} ${fmt(st.costoMedio)})</p>
          <button type="button" id="usaPassato" class="badge badge-live">usa questi ${fmtBTC(st.btc)} BTC</button>
          <span class="passato-nota">prezzi reali, non del modello</span>
        </div>`;
    }
  }

  // — Il numero
  const testa = `
    <div class="verdetto">
      <p class="occhiello">Devi mettere da parte</p>
      ${!pa
        ? // Cominci subito: non c'è nessun mese per accumulare, servono adesso.
          (stack >= r.btcNecessari
            ? `<p class="cifra">niente<span class="unita">basta quello che hai</span></p>
               <p class="sotto">cominci subito, e i tuoi ${fmtBTC(stack)} BTC superano l'obiettivo di ${fmtBTC(r.btcNecessari)}</p>`
            : `<p class="cifra">${fmtBTC(r.btcNecessari)}<span class="unita">BTC, adesso</span></p>
               <p class="sotto">cominci subito: quei bitcoin devi averli già${stack > 0 ? `, e ne hai ${fmtBTC(stack)}` : ""}. Sposta più avanti l'età da cui prelevi e comparirà quanto versare al mese.</p>`)
        : pa.giaCoperto
        ? `<p class="cifra">niente<span class="unita">basta quello che hai</span></p>
           <p class="sotto">i tuoi ${fmtBTC(stack)} BTC superano l'obiettivo di ${fmtBTC(r.btcNecessari)}</p>`
        : `<p class="cifra">${c.sym} ${fmt(pa.mensile)} <span class="unita">al mese</span></p>
           <p class="sotto">${inAnni(Math.round(pa.anni))} · ${c.sym} ${fmt(pa.totale)} · <b>${fmtBTC(r.btcNecessari)} BTC</b>${stack > 0 ? ` · ne hai ${fmtBTC(stack)}` : ""}<br /><span class="prudente">obiettivo sul fondo del corridoio, acquisti alla mediana</span></p>`}
      ${(() => {
        // La domanda inversa: se hai detto quanto puoi versare, si dice cosa ne esce.
        if (!(base.disponibile > 0) || !pa || pa.giaCoperto) return "";
        const ott = integrazioneOttenibile(base, lineaDi(base, RIF), lineaDi(base, SCENARI[ACCUMULO]), stack, base.disponibile);
        const basta = base.disponibile >= pa.mensile;
        return `<p class="inversa ${basta ? "basta" : ""}">
          Con <b>${c.sym} ${fmt(base.disponibile)}</b> al mese ${basta
            ? `ci arrivi, e ti avanza: prenderesti <b>${c.sym} ${fmt(ott)}</b> netti l'anno invece di ${c.sym} ${fmt(base.nettoAnnuo)}.`
            : `arrivi a <b>${c.sym} ${fmt(ott)}</b> netti l'anno, non ${c.sym} ${fmt(base.nettoAnnuo)}.`}
        </p>`;
      })()}
      ${passatoBox}
    </div>`;

  // — Dove sta il prezzo, adesso: la fascia sotto il grafico
  let corridoioBox = "";
  {
    // La fascia segue la barra: mostra le tre linee all'anno del primo prelievo.
    const giornoBarra = giorniDaGenesi() + r.attesa * 365.25;
    const pos = posizioneNelCorridoio((prezziLive.usd || base.prezzoOggi / CAMBIO_RIPIEGO), giornoBarra);
    corridoioBox = `
    <div class="corridoio-testa">
      <div class="corridoio">
        <div class="corr-scala">
          <span class="corr-tacca" style="left:${(pos.fraz50 * 100).toFixed(1)}%"></span>
          <span class="corr-ora" style="left:${(pos.frazione * 100).toFixed(1)}%"></span>
        </div>
        <div class="corr-etichette">
          <span class="lo">supporto<br /><b>${c.sym} ${fmt(pos.supporto * cambio)}</b></span>
          <span class="mid" style="left:${(pos.fraz50 * 100).toFixed(1)}%">centro<br /><b>${c.sym} ${fmt(pos.centro * cambio)}</b></span>
          <span class="hi">resistenza<br /><b>${c.sym} ${fmt(pos.resistenza * cambio)}</b></span>
        </div>
      </div>
      <p class="nota">${!prezziLive.usd ? `<b>Cambio non disponibile</b>: si assume ${fmtPct(CAMBIO_RIPIEGO - 1).replace("−", "")} — cioè ${CAMBIO_RIPIEGO.toString().replace(".", ",")} euro per dollaro, il valore del 17 agosto 2026. ` : ""}${r.attesa > 0
        ? `Le tre linee sono i prezzi che il modello dà per il <b>${annoInizio}</b>, l'anno in cui cominci a vendere: muovi la barra sul grafico e cambiano. Oggi Bitcoin sta al <b>${fmtPct(pos.rapporto)}</b> della retta, cioè nella parte bassa della fascia.${annoInizio > ANNO_LIMITE ? ` Dal <b>${ANNO_LIMITE}</b> in poi Santostasi dice di non usare la legge di potenza: da lì il prezzo cresce solo col carovita, quindi ogni anno di prelievo costa sempre la stessa quantità di bitcoin: il totale scende solo perché gli anni da coprire sono meno.` : ""}`
        : `Le tre linee sono i prezzi di oggi. Bitcoin sta al <b>${fmtPct(pos.rapporto)}</b> della retta di regressione, nella parte bassa della fascia.`}</p>
    </div>`;
  }

  // — Quali ipotesi spostano il numero, e di quanto: si vede che il
  //   risultato dipende da scelte, non da fatti.
  const senzaCrollo = fabbisognoLiscio(base, lineaDi(base, RIF)).btcNecessari;
  const suMediana = fabbisogno(base, lineaDi(base, CEN)).btcNecessari;
  const rif = r.btcNecessari;
  const etaLeva = Math.min(90, base.etaFine - 5);
  const leve = [
    ["sulla mediana invece che sul fondo", suMediana / rif - 1],
    ["senza tenere il crollo del 70%", senzaCrollo / rif - 1],
  ];
  // La terza leva solo se accorciare l'orizzonte lascia almeno un prelievo.
  if (etaLeva > base.etaInizio) {
    leve.push([`fino a ${etaLeva} anni invece di ${base.etaFine}`,
      fabbisogno({ ...base, etaFine: etaLeva }, lineaDi(base, RIF)).btcNecessari / rif - 1]);
  }
  const leveBox = `
    <p class="leve">Il numero dipende da tre scelte, non da fatti: ${leve
      .map(([n, d]) => `<span>${n} <b>${d < 0 ? "−" : "+"}${Math.abs(d * 100).toFixed(0)}%</b></span>`)
      .join(" · ")}</p>`;

  segnaVista();
  $grafico.innerHTML = grafico(base, cambio);
  $verdetto.innerHTML = testa;
  $corridoio.innerHTML = corridoioBox + leveBox;
}


// ------------------------------------------------------------
// Il grafico si manovra: trascinando la riga verticale si sposta l'anno
// del primo prelievo. L'ascoltatore sta sul contenitore, non sull'SVG,
// perché l'SVG viene ridisegnato a ogni modifica.
// ------------------------------------------------------------
function annoDallaX(svg, clientX) {
  const r = svg.getBoundingClientRect();
  const da = +svg.dataset.da, a = +svg.dataset.a;
  const ml = +svg.dataset.ml, mr = +svg.dataset.mr, w = +svg.dataset.w;
  // dalle coordinate dello schermo a quelle del viewBox, poi ad anni
  const x = (clientX - r.left) / r.width * w;
  const frazione = (x - ml) / (w - ml - mr);
  return Math.round(da + frazione * (a - da));
}

// Il segno di sinistra muove l'anno da cui avresti comprato: sta nel passato,
// quindi si ferma al primo anno intero di prezzi e all'anno scorso.
function muovi(svg, clientX) {
  (quale === "passato" ? trascinaPassato : trascina)(svg, clientX);
}

function trascinaPassato(svg, clientX) {
  const anno = clamp(annoDallaX(svg, clientX), STORICO_ANNO_DA, NOW_YEAR - 1);
  if (String(anno) === $annoDa.value) return;
  $annoDa.value = anno;
  adattaLarghezza($annoDa);
  render();
  scriviIndirizzo();
}

function trascina(svg, clientX) {
  const eta = clamp(
    parseInt($eta.value, 10) + (annoDallaX(svg, clientX) - NOW_YEAR),
    parseInt($eta.value, 10), (parseInt($etaFine.value, 10) || ETA_FINE_DEFAULT) - 1);
  if (String(eta) !== $etaInizio.value) {
    $etaInizio.value = eta;
    adattaLarghezza($etaInizio);
    render();
    scriviIndirizzo();     // se no il link copiato conserva l'anno vecchio
  }
}

let inTrascinamento = false;
let quale = "futuro";
document.addEventListener("pointerdown", e => {
  const svg = e.target.closest && e.target.closest(".gfx svg");
  if (!svg) return;
  // Due segni, due prese: quella del passato muove l'anno da cui compri.
  quale = e.target.closest(".g-presa-passato") || e.target.closest(".g-maniglia-passato")
    ? "passato" : "futuro";
  // Col dito si parte solo dalla maniglia: altrimenti il tocco per scorrere
  // la pagina sposterebbe l'anno senza che tu l'abbia chiesto. Col mouse,
  // dove il gesto non è ambiguo, si può cliccare in qualunque punto.
  const sullaPresa = !!(e.target.closest(".g-presa") || e.target.closest(".g-maniglia"));
  if (e.pointerType !== "mouse" && !sullaPresa) return;
  e.preventDefault();
  inTrascinamento = true;
  document.body.classList.add("sto-trascinando");
  muovi(svg, e.clientX);
});
document.addEventListener("pointermove", e => {
  if (!inTrascinamento) return;
  // Se nessun tasto è più premuto il gesto è finito, anche se il rilascio
  // è avvenuto fuori dalla finestra o il browser si è preso il tocco.
  if (e.buttons === 0) { fineTrascinamento(); return; }
  // Il grafico viene ridisegnato a ogni movimento: il nodo di partenza non è
  // più nel documento e misurarlo darebbe coordinate sbagliate. Si ripesca.
  const svg = document.querySelector(".gfx svg");
  if (!svg) return;
  e.preventDefault();
  muovi(svg, e.clientX);
}, { passive: false });
function fineTrascinamento() {
  inTrascinamento = false;
  document.body.classList.remove("sto-trascinando");
}
document.addEventListener("pointerup", fineTrascinamento);
document.addEventListener("pointercancel", fineTrascinamento);

// ------------------------------------------------------------
// Ascolto: ogni modifica ridisegna, senza aspettare un pulsante
// ------------------------------------------------------------
let attesa = null;
const ridisegna = () => { clearTimeout(attesa); attesa = setTimeout(render, 120); };

$("planner").addEventListener("submit", e => { e.preventDefault(); render(); });
$("planner").addEventListener("input", e => {
  if (e.target.classList.contains("inline")) adattaLarghezza(e.target);
  ridisegna();
});
$("planner").addEventListener("input", scriviIndirizzo);
$("planner").addEventListener("change", scriviIndirizzo);
$("planner").addEventListener("change", e => {
  if (e.target.tagName === "SELECT") adattaLarghezza(e.target);
  ridisegna();
});

// I limiti del campo dipendono dall'anno corrente e dalla serie: scriverli
// nell'HTML li avrebbe congelati al 2025.
$annoDa.min = STORICO_ANNO_DA;
$annoDa.max = NOW_YEAR - 1;
// Un anno fuori portata non va ignorato in silenzio: il campo lo riporta
// dentro, cosi' si vede perche' il segno sul grafico non si e' mosso.
$annoDa.addEventListener("change", () => {
  const v = parseInt($annoDa.value, 10);
  if (!v) return;
  const dentro = clamp(v, STORICO_ANNO_DA, NOW_YEAR - 1);
  if (dentro !== v) {
    $annoDa.value = dentro;
    adattaLarghezza($annoDa);
    render();
    scriviIndirizzo();
  }
});

// L'interruttore dell'unita': cambia il disegno, non i conti.
document.querySelectorAll(".uv").forEach(b => b.addEventListener("click", () => {
  if (VISTA === b.dataset.vista) return;
  VISTA = b.dataset.vista;
  segnaVista();
  render();
  scriviIndirizzo();
}));
function segnaVista() {
  document.querySelectorAll(".uv").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.vista === VISTA)));
}
segnaVista();

let attesaResize = null;
window.addEventListener("resize", () => {
  clearTimeout(attesaResize);
  attesaResize = setTimeout(() => { adattaTutti(); render(); }, 150);
});

// Il passato riempie il campo dei bitcoin che hai: da lì continua il modello.
$verdetto.addEventListener("click", e => {
  if (!e.target.closest("#usaPassato")) return;
  const cambio = prezziLive.usd ? parseFloat($prezzo.value) / prezziLive.usd : CAMBIO_RIPIEGO;
  const st = accumuloStorico(parseInt($annoDa.value, 10),
    parseFloat($disponibile.value || "0") > 0 ? parseFloat($disponibile.value) : 500, cambio);
  if (!st) return;
  $stack.value = parseFloat(st.btc.toFixed(8));
  $annoDa.value = "";
  adattaTutti();
  render();
  scriviIndirizzo();
});

$paese.addEventListener("change", aggiornaValuta);
$etaFine.addEventListener("change", () => {
  // Non si prelevano soldi dopo la fine.
  if (parseInt($etaInizio.value, 10) >= parseInt($etaFine.value, 10)) {
    $etaInizio.value = String(parseInt($etaFine.value, 10) - 1);
    adattaLarghezza($etaInizio);
  }
});
$eta.addEventListener("change", () => {
  // Non si comincia a prelevare prima di adesso.
  if (parseInt($etaInizio.value, 10) < parseInt($eta.value, 10)) {
    $etaInizio.value = $eta.value;
    adattaLarghezza($etaInizio);
  }
});
$prezzo.addEventListener("input", () => { prezzoManuale = true; adattaLarghezza($prezzo); ridisegna(); });
$("badgePrezzo").addEventListener("click", () => caricaPrezzo(true).then(render));

// ------------------------------------------------------------
// Lo stato sta nell'indirizzo: ricaricando la pagina i dati restano, e il
// link si può salvare o mandare a qualcuno. Niente cookie, niente server.
// ------------------------------------------------------------
const CAMPI_URL = { e: "eta", p: "paese", n: "netto", i: "etaInizio", f: "etaFine", b: "stack", d: "disponibile", a: "annoDa" };

function leggiIndirizzo() {
  const q = new URLSearchParams(location.search);
  let trovato = false;
  for (const [chiave, id] of Object.entries(CAMPI_URL)) {
    const v = q.get(chiave);
    const el = $(id);
    if (v === null || !el) continue;
    // Un paese che non conosciamo azzererebbe il menu e farebbe cadere tutto:
    // meglio ignorarlo e restare su quello di partenza.
    if (id === "paese" && !PAESI[v]) continue;
    el.value = v; trovato = true;
  }
  if (q.get("u") === "m2") VISTA = "m2";
  return trovato;
}

let scritturaIndirizzo = null;
function scriviIndirizzo() {
  clearTimeout(scritturaIndirizzo);
  scritturaIndirizzo = setTimeout(() => {
    const q = new URLSearchParams();
    for (const [chiave, id] of Object.entries(CAMPI_URL)) {
      const el = $(id);
      if (el && el.value !== "") q.set(chiave, el.value);
    }
    if (VISTA === "m2") q.set("u", "m2");
    // replaceState e non pushState: non si riempie la cronologia a ogni tasto.
    history.replaceState(null, "", location.pathname + "?" + q.toString());
  }, 400);
}

// ------------------------------------------------------------
// Avvio: la pagina apre già con una risposta, non con un modulo vuoto
// ------------------------------------------------------------
avviato = true;
const daIndirizzo = leggiIndirizzo();
aggiornaValuta();
// Un solo render quando entrambe le richieste hanno finito: altrimenti la
// più veloce disegnava «manca il prezzo» prima che il prezzo arrivasse.
Promise.allSettled([caricaPrezzo(), aggiornaCodaStorica()]).then(render);
