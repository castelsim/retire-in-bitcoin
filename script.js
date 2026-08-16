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
const ETA_MAX = 100;               // fin dove deve durare il capitale

// ------------------------------------------------------------
// FISCALITÀ — verificata ad agosto 2026, fonti in fondo alla pagina.
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
    scaglioni: [[6000, 0.19], [50000, 0.21], [200000, 0.23], [Infinity, 0.27]],
    esenteOltreAnno: false, bollo: 0,
    etichetta: "19–27% a scaglioni",
    nota: "La plusvalenza entra nella base del risparmio: 19% fino a 6.000 €, 21% fino a 50.000, 23% fino a 200.000, 27% oltre.",
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
//   A  = −16,239   coefficiente  (la letteratura dice −16,493)
//   R² = 0,9598                  (la letteratura dice 0,961)
//
// Santostasi non indica un prezzo: indica un CORRIDOIO. Il prezzo oscilla
// attorno alla retta, e i residui della regressione dicono di quanto.
// I tre scenari sono le tre linee di quel corridoio, ai percentili misurati:
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
const giorniDaGenesi = (data = new Date()) => (data.getTime() - GENESI) / 86400000;

/** La retta della regressione, in dollari. */
const rettaPowerLaw = giorni => Math.pow(10, PL_A + PL_N * Math.log10(giorni));

/** Una linea del corridoio, in dollari: la retta per il suo scarto. */
const lineaCorridoio = (giorni, perc) => rettaPowerLaw(giorni) * Math.pow(10, perc);

/** La crescita istantanea della curva: n/t. Rallenta sempre, per costruzione. */
const crescitaIstantanea = giorni => PL_N * 365.25 / giorni;

/** Dove sta il prezzo, adesso, dentro il corridoio. */
function posizioneNelCorridoio(prezzoUsd) {
  const d = giorniDaGenesi();
  const basso = SCENARI[0].perc, alto = SCENARI[2].perc;
  const scarto = Math.log10(prezzoUsd / rettaPowerLaw(d));
  return {
    rapporto: prezzoUsd / rettaPowerLaw(d),
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
 * Vendendo X al prezzo p con costo medio c, la plusvalenza è X·(1 − c/p).
 * Con gli scaglioni spagnoli serve un punto fisso: poche passate bastano.
 */
function lordoPerNetto(paese, netto, prezzo, costoMedio, oltreUnAnno) {
  const quotaPlus = Math.max(0, 1 - (costoMedio || 0) / prezzo);
  if (quotaPlus === 0) return { lordo: netto, aliquotaEff: 0 };
  let lordo = netto;
  for (let i = 0; i < 6; i++) lordo = netto + imposta(paese, lordo * quotaPlus, oltreUnAnno);
  return { lordo, aliquotaEff: 1 - netto / lordo };
}

/**
 * La simulazione, anno per anno, di un decumulo programmato.
 *
 * Si parte da `btc0` bitcoin posseduti OGGI. Fino all'età di inizio non si
 * vende niente, ma il bollo — dove c'è — erode comunque. Da lì in poi ogni
 * anno si vende quanto serve per avere in mano l'importo netto, rivalutato
 * all'inflazione, al prezzo che la linea del corridoio dà per quell'anno.
 *
 * Restituisce la tabella completa: è quella che spiega il numero.
 */
function simula(p, linea, btc0) {
  const infl = PAESI[p.paese].infl;
  const bollo = FISCO[p.paese].bollo || 0;
  const attesa = Math.max(0, p.etaInizio - p.eta);
  const anni = Math.max(0, ETA_MAX - p.etaInizio);

  let btc = btc0;
  // Gli anni di attesa: nessuna vendita, ma il bollo si paga lo stesso.
  for (let t = 0; t < attesa; t++) btc *= (1 - bollo);

  const righe = [];
  for (let t = 0; t < anni; t++) {
    const anniDaOggi = attesa + t;
    const prezzo = linea(anniDaOggi);
    // L'importo è il potere d'acquisto di oggi: si rivaluta ogni anno.
    const netto = p.nettoAnnuo * Math.pow(1 + infl, anniDaOggi);
    const { lordo } = lordoPerNetto(p.paese, netto, prezzo, p.costoMedio, p.oltreUnAnno);
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
 * Quanti bitcoin servono OGGI. Bisezione sulla simulazione: il minimo che
 * arriva ai cento anni senza esaurirsi.
 */
function fabbisogno(p, linea) {
  const attesa = Math.max(0, p.etaInizio - p.eta);
  const anni = Math.max(0, ETA_MAX - p.etaInizio);
  const prezzoInizio = linea(attesa);
  const nettoInizio = p.nettoAnnuo * Math.pow(1 + PAESI[p.paese].infl, attesa);
  const { lordo, aliquotaEff } = lordoPerNetto(p.paese, nettoInizio, prezzoInizio, p.costoMedio, p.oltreUnAnno);

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
 * C'è un giro: quello che compri adesso alza il tuo costo medio, il costo medio
 * abbassa l'imposta futura, e con meno imposta servono meno bitcoin. Tre passate
 * di punto fisso bastano a chiudere il cerchio.
 */
function pianoDiAccumulo(p, linea, stack) {
  const mesi = Math.max(0, Math.round((p.etaInizio - p.eta) * 12));
  if (mesi === 0) return null;

  // Quanti bitcoin compra un euro al mese, lungo tutto il percorso.
  let btcPerEuroMensile = 0;
  for (let m = 0; m < mesi; m++) btcPerEuroMensile += 1 / linea(m / 12);

  let obiettivo = fabbisogno(p, linea).btcNecessari;
  let mensile = 0, costoMedio = p.costoMedio;

  for (let giro = 0; giro < 3; giro++) {
    const mancano = Math.max(0, obiettivo - stack);
    mensile = mancano / btcPerEuroMensile;
    const speso = mensile * mesi;
    const btcComprati = mancano;
    // Media pesata fra quello che avevi già e quello che comprerai.
    costoMedio = (stack + btcComprati) > 0
      ? (stack * p.costoMedio + speso) / (stack + btcComprati)
      : p.costoMedio;
    obiettivo = fabbisogno({ ...p, costoMedio }, linea).btcNecessari;
  }

  const mancano = Math.max(0, obiettivo - stack);
  return {
    mensile, mesi, anni: mesi / 12,
    totale: mensile * mesi,
    btcObiettivo: obiettivo,
    btcDaComprare: mancano,
    costoMedioFinale: costoMedio,
    giaCoperto: mancano === 0,
  };
}

/** La linea del corridoio di uno scenario, portata nella valuta locale. */
function lineaDi(p, sc) {
  const d0 = giorniDaGenesi();
  const cambio = p.cambioUsd || 1;
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
  const anni = Math.max(1, ETA_MAX - p.etaInizio);
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
  return { regge: true, btcResidui: sim.righe[sim.righe.length - 1].residui };
}

/** Quanto capitale servirebbe per reggere il crollo. */
function capitaleAntiCrollo(p, btcBase, linea) {
  if (testTenuta(p, btcBase, linea).regge) return btcBase;
  let lo = 1, hi = 8;
  if (!testTenuta(p, btcBase * hi, linea).regge) return null;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (testTenuta(p, btcBase * mid, linea).regge) hi = mid; else lo = mid;
  }
  return btcBase * hi;
}

/** La prima età di inizio in cui i bitcoin che hai già basterebbero. */
function primaEtaSufficiente(p, stack, sc) {
  if (!stack || stack <= 0) return null;
  for (let eta = Math.max(p.eta, p.etaInizio); eta <= ETA_MAX - 1; eta++) {
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
    if (!prezzoManuale && !$prezzo.value) $prezzo.focus();
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
    if (typeof adattaTutti === "function") adattaTutti();
  }
}

// ------------------------------------------------------------
// INTERFACCIA
// Il modulo è una frase da completare e il risultato si aggiorna
// mentre scrivi: niente pulsante fra la domanda e la risposta.
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
const $paese = $("paese"), $eta = $("eta"), $etaInizio = $("etaInizio"), $netto = $("netto");
const $prezzo = $("prezzoOggi"), $costo = $("costoMedio"), $stack = $("stack"), $investito = $("investito");
const $oltreAnno = $("oltreUnAnno");
const $out = $("risultati"), $grafico = $("grafico"), $verdetto = $("verdetto");

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
  document.querySelectorAll(".frase input.inline, .frase select, .stato-prezzo input.inline")
    .forEach(adattaLarghezza);

function aggiornaValuta() {
  const c = PAESI[$paese.value];
  document.querySelectorAll(".sym").forEach(e => (e.textContent = c.sym));
  $("paeseNome").textContent = $paese.value;
  const f = FISCO[$paese.value];
  $("fiscoEtichetta").textContent = f.etichetta;
  // La durata di detenzione conta solo dove esiste un'esenzione: altrove
  // la domanda non ha senso e la casella sparisce.
  $("rigaOltreAnno").classList.toggle("hidden", !f.esenteOltreAnno);
  if (f.esenteOltreAnno) {
    const durata = $paese.value === "Portogallo" ? "365 giorni" : "dodici mesi";
    const senza = $paese.value === "Portogallo" ? "il 28%" : "fino al 45%";
    $("notaOltreAnno").innerHTML =
      `In ${$paese.value} l'imposta si azzera solo sui lotti tenuti per più di ${durata}: `
      + `togliendo la spunta si paga ${senza} sulla plusvalenza. `
      + `Se accumuli da tempo e comincerai a vendere fra anni, è così — lasciala com'è.`;
  }
  if (!prezzoManuale) applicaPrezzoLive();
  calcolaCostoMedio();
  adattaTutti();
}

/** Chi ha meno di un bitcoin ragiona in satoshi: 28392600 sono 0,283926 BTC. */
function stackInBTC() {
  const v = parseFloat($stack.value || "0");
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > 1000 ? v / 1e8 : v;
}

/**
 * I tre campi del tuo Bitcoin sono legati da una relazione sola:
 *
 *     quanto hai investito = prezzo medio di carico × bitcoin posseduti
 *
 * Quindi non si chiedono tutti e tre: se ne scrivi due, il terzo esce da solo,
 * in qualunque combinazione. `toccati` tiene i due campi che hai scritto per
 * ultimi: il terzo è quello che viene calcolato, così non ti si riscrive mai
 * sotto le dita quello su cui stai lavorando.
 */
const CAMPI_BTC = ["stack", "investito", "costo"];
let toccati = ["investito", "costo"];

function sincronizzaCosto(origine) {
  if (CAMPI_BTC.includes(origine)) {
    toccati = [origine, ...toccati.filter(x => x !== origine)].slice(0, 2);
  }
  const daCalcolare = CAMPI_BTC.find(x => !toccati.includes(x));

  const btc = stackInBTC();
  const speso = parseFloat($investito.value || "0");
  const medio = parseFloat($costo.value || "0");

  if (daCalcolare === "stack" && speso > 0 && medio > 0) {
    const q = speso / medio;
    // Sotto un bitcoin si scrive volentieri in satoshi, ma qui il campo
    // accetta entrambi: si mostra in BTC con otto decimali, senza zeri inutili.
    $stack.value = parseFloat(q.toFixed(8));
  } else if (daCalcolare === "investito" && btc > 0 && medio > 0) {
    $investito.value = Math.round(medio * btc);
  } else if (daCalcolare === "costo" && btc > 0 && speso > 0) {
    $costo.value = Math.round(speso / btc);
  }
  mostraNotaCosto(daCalcolare);
}

function mostraNotaCosto(calcolato) {
  const btc = stackInBTC();
  const medio = parseFloat($costo.value || "0");
  const speso = parseFloat($investito.value || "0");
  const nota = $("notaCosto");
  const sym = PAESI[$paese.value].sym;

  if (medio > 0 && btc > 0) {
    const p = parseFloat($prezzo.value || "0");
    const segno = p > 0
      ? (medio > p
          ? ` Oggi Bitcoin sta sotto: sei in perdita del ${fmtPct(1 - p / medio)} e su una vendita non pagheresti imposta.`
          : ` Plusvalenza tassabile: ${fmtPct(1 - medio / p)} del valore attuale.`)
      : "";
    const detto = calcolato === "stack" ? `Vengono <b>${fmtBTC(btc)} BTC</b>.`
                : calcolato === "investito" ? `Hai investito in tutto <b>${sym} ${fmt(speso)}</b>.`
                : `Prezzo medio: <b>${sym} ${fmt(medio)}</b> per bitcoin.`;
    nota.innerHTML = detto + segno;
    nota.classList.add("nota-viva");
  } else {
    nota.textContent = "Scrivine due qualunque e il terzo si compila da solo: la spesa totale è il prezzo medio moltiplicato per i bitcoin che hai. Serve per l'imposta, che si paga solo sulla differenza fra prezzo di vendita e prezzo di acquisto.";
    nota.classList.remove("nota-viva");
  }
  $("suntoStack").textContent = btc > 0 ? `${fmtBTC(btc)} BTC` : "niente";
}

/** Compatibilità: l'avvio e il cambio paese chiamano ancora questo nome. */
const calcolaCostoMedio = () => mostraNotaCosto(null);

function leggiInput() {
  const eta = clamp(parseInt($eta.value, 10) || 35, 18, 95);
  return {
    paese: $paese.value,
    eta,
    // Non si può cominciare a prelevare prima di adesso, né dopo i 99.
    etaInizio: clamp(parseInt($etaInizio.value, 10) || eta, eta, ETA_MAX - 1),
    nettoAnnuo: parseFloat($netto.value || "0"),
    prezzoOggi: parseFloat($prezzo.value),
    costoMedio: parseFloat($costo.value || "0"),
    oltreUnAnno: $oltreAnno.checked,
    // Il corridoio è in dollari: serve il cambio per portarlo nella valuta locale.
    cambioUsd: prezziLive.usd ? parseFloat($prezzo.value) / prezziLive.usd : null,
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
  const W = 980, H = 320, ML = 62, MR = 16, MT = 18, MB = 32;
  const annoFine = NOW_YEAR + (ETA_MAX - base.eta);
  const annoDa = 2011;
  const px = a => ML + (a - annoDa) / (annoFine - annoDa) * (W - ML - MR);
  const minP = 0.05, maxP = lineaCorridoio(giorniDaGenesi() + (annoFine - NOW_YEAR) * 365.25, SCENARI[2].perc);
  const py = v => {
    const l = Math.log10(Math.max(v, minP)), lo = Math.log10(minP), hi = Math.log10(maxP);
    return MT + (1 - (l - lo) / (hi - lo)) * (H - MT - MB);
  };
  const giorniDi = a => giorniDaGenesi() + (a - NOW_YEAR) * 365.25;

  // le tre linee, campionate ogni anno
  const anni = [];
  for (let a = annoDa; a <= annoFine; a++) anni.push(a);
  const linea = perc => anni.map(a => `${px(a).toFixed(1)},${py(lineaCorridoio(giorniDi(a), perc) * cambio).toFixed(1)}`);
  const sup = linea(SCENARI[0].perc), cen = linea(SCENARI[1].perc), res = linea(SCENARI[2].perc);
  const banda = `M${res.join("L")}L${sup.slice().reverse().join("L")}Z`;

  // la storia vera
  const st = STORICO.filter(([g]) => g / 365.25 + 2009 >= annoDa)
    .map(([g, v]) => `${px(2009 + g / 365.25).toFixed(1)},${py(v * cambio).toFixed(1)}`);

  const oggiX = px(NOW_YEAR + 0.6), inizioX = px(NOW_YEAR + (base.etaInizio - base.eta));
  const tacche = [1, 100, 10000, 1e6, 1e8].filter(v => v <= maxP);
  const etichettaP = v => v >= 1e6 ? (v / 1e6) + " mln" : v >= 1000 ? (v / 1000) + "k" : String(v);
  const anniAsse = anni.filter(a => a % 10 === 0);

  return `
    <section class="blocco">
      <figure class="gfx">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Prezzo storico di Bitcoin e corridoio della legge di potenza, dal 2011 al ${annoFine}. Trascina la riga verticale per cambiare l'anno del primo prelievo." preserveAspectRatio="xMidYMid meet"
               data-da="${annoDa}" data-a="${annoFine}" data-ml="${ML}" data-mr="${MR}" data-w="${W}">
          <rect x="${inizioX.toFixed(1)}" y="${MT}" width="${(W - MR - inizioX).toFixed(1)}" height="${H - MT - MB}" class="g-decumulo" />
          ${tacche.map(v => `<line x1="${ML}" y1="${py(v).toFixed(1)}" x2="${W - MR}" y2="${py(v).toFixed(1)}" class="g-griglia" />
             <text x="${ML - 8}" y="${(py(v) + 4).toFixed(1)}" class="g-tacca" text-anchor="end">${etichettaP(v)}</text>`).join("")}
          ${anniAsse.map(a => `<text x="${px(a).toFixed(1)}" y="${H - 12}" class="g-tacca" text-anchor="middle">${a}</text>`).join("")}
          <path d="${banda}" class="g-banda" />
          <polyline points="${cen.join(" ")}" class="g-centro" />
          <polyline points="${st.join(" ")}" class="g-storico" />
          <line x1="${inizioX.toFixed(1)}" y1="${MT}" x2="${inizioX.toFixed(1)}" y2="${H - MB}" class="g-inizio" />
          <text x="${(inizioX + 6).toFixed(1)}" y="${MT + 12}" class="g-nota-inizio">vendi da qui (${base.etaInizio} anni) ⇄</text>
          <rect class="g-presa" x="${(inizioX - 11).toFixed(1)}" y="${MT}" width="22" height="${H - MT - MB}" />
          <g class="g-maniglia" transform="translate(${inizioX.toFixed(1)},${H - MB})">
            <circle r="7" /><path d="M-3.5 -3 L-6 0 L-3.5 3 M3.5 -3 L6 0 L3.5 3" />
          </g>
          ${(() => {
            // Su dieci ordini di grandezza la banda si vede sottile: i tre valori
            // all'anno d'inizio si scrivono, così il range si legge in numeri.
            const g = giorniDi(NOW_YEAR + (base.etaInizio - base.eta));
            const sym = PAESI[base.paese].sym;
            const breve = v => v >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " mln" : fmt(v);
            return SCENARI.map((sc, i) => {
              const v = lineaCorridoio(g, sc.perc) * cambio;
              const y = py(v) + (i === 0 ? 13 : i === 2 ? -6 : 4);
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
          <span class="g-leg"><i class="l-centro"></i>mediana del modello</span>
          <span class="g-leg"><i class="l-banda"></i>corridoio, dal 5° al 95° percentile</span>
          <span class="g-scala">prezzi in scala logaritmica</span>
        </figcaption>
      </figure>
    </section>`;
}

function render() {
  const base = leggiInput();
  const c = PAESI[base.paese];
  const stack = stackInBTC();

  if (!Number.isFinite(base.nettoAnnuo) || base.nettoAnnuo <= 0) {
    $out.innerHTML = `<p class="errore">Scrivi di quanto hai bisogno ogni anno: senza quello non c'è niente da calcolare.</p>`;
    return;
  }
  if (!Number.isFinite(base.prezzoOggi) || base.prezzoOggi <= 0) {
    $out.innerHTML = `<p class="errore">Manca il prezzo di Bitcoin. Premi ↻ per rileggerlo, oppure scrivilo a mano.</p>`;
    return;
  }

  const [SUP, CEN, RES] = SCENARI;
  const rCentro = fabbisogno(base, lineaDi(base, CEN));
  const rBasso = fabbisogno(base, lineaDi(base, SUP));
  const rAlto = fabbisogno(base, lineaDi(base, RES));
  const cambio = base.cambioUsd || 1;
  const annoInizio = NOW_YEAR + rCentro.attesa;

  // — Il numero
  const pa = pianoDiAccumulo(base, lineaDi(base, CEN), stack);
  const testa = `
    <div class="verdetto">
      <p class="occhiello">Per incassare ${c.sym} ${fmt(base.nettoAnnuo)} netti ogni anno,
      dai ${base.etaInizio} anni (nel ${annoInizio}) fino ai ${ETA_MAX}, devi mettere da parte</p>
      ${!pa
        ? // Cominci subito: non c'è nessun mese per accumulare, servono adesso.
          (stack >= rCentro.btcNecessari
            ? `<p class="cifra">niente<span class="unita">basta quello che hai</span></p>
               <p class="sotto">cominci subito, e i tuoi ${fmtBTC(stack)} BTC coprono già l'obiettivo di ${fmtBTC(rCentro.btcNecessari)}</p>`
            : `<p class="cifra">${fmtBTC(rCentro.btcNecessari)}<span class="unita">BTC, adesso</span></p>
               <p class="sotto">cominciando a prelevare subito non c'è tempo per accumulare: quei bitcoin devi averli già${stack > 0 ? `, e ne hai ${fmtBTC(stack)}` : ""}. Sposta più avanti l'età da cui prelevi e comparirà quanto versare ogni mese.</p>`)
        : pa.giaCoperto
        ? `<p class="cifra">niente<span class="unita">basta quello che hai</span></p>
           <p class="sotto">i tuoi ${fmtBTC(stack)} BTC coprono già l'obiettivo di ${fmtBTC(rCentro.btcNecessari)}</p>`
        : `<p class="cifra">${c.sym} ${fmt(pa.mensile)}<span class="unita">al mese</span></p>
           <p class="sotto">per ${Math.round(pa.anni)} anni · ${c.sym} ${fmt(pa.totale)} in tutto · così arrivi a <b>${fmtBTC(rCentro.btcNecessari)} BTC</b>, che è quello che ti serve${stack > 0 ? ` (ne hai già ${fmtBTC(stack)})` : ""}</p>`}
    </div>`;

  // — Il dettaglio del versamento
  let accumuloBox = "";
  if (pa) {
    const paSup = pianoDiAccumulo(base, lineaDi(base, SUP), stack);
    const paRes = pianoDiAccumulo(base, lineaDi(base, RES), stack);
    const scartoFraLinee = Math.abs(paRes.mensile - paSup.mensile) / Math.max(1, pa.mensile);
    accumuloBox = pa.giaCoperto
      ? `<section class="blocco">
           <h2>Non devi investire altro</h2>
           <p class="intro">I ${fmtBTC(stack)} BTC che hai già superano l'obiettivo di ${fmtBTC(pa.btcObiettivo)}. Da qui in poi basta non venderli.</p>
         </section>`
      : `<section class="blocco">
      <h2>Perché quella cifra, e non un'altra</h2>
      ${scartoFraLinee < 0.02 ? `
      <p class="intro sorpresa">E qui c'è la cosa che non ti aspetti: <b>la cifra è la stessa su tutte e tre le linee del corridoio</b>.
      Se Bitcoin salirà molto te ne serviranno meno, ma li pagherai di più; se salirà poco te ne serviranno di più, e costeranno meno.
      In euro i due effetti si annullano. <b>Quanto devi versare non dipende da quale scenario si avvererà</b> — dipende solo da quanto ti serve e da quanto tempo hai.</p>`
      : `<p class="intro">Sulla linea bassa servirebbero ${c.sym} ${fmt(paSup.mensile)} al mese, su quella alta ${c.sym} ${fmt(paRes.mensile)}: la differenza è piccola perché i due effetti — più bitcoin necessari, prezzo più basso — quasi si annullano.</p>`}
      <p class="nota">Il conto assume che tu compri ai prezzi della linea centrale, che oggi sta sopra il mercato: al momento Bitcoin vale meno di quanto il modello dica, quindi i primi acquisti costeranno meno e la cifra qui sopra è prudente. Comprare ogni mese la stessa cifra è l'ipotesi più semplice, e serve a dare un ordine di grandezza — non è un consiglio su come farlo.</p>
    </section>`;
  }

  // — La timeline: è questa che spiega il numero
  const righe = rCentro.righe;
  const ogniQuanti = righe.length > 26 ? 2 : 1;   // sopra i 26 anni si mostra un anno sì e uno no
  const corpo = righe.filter((_, k) => k % ogniQuanti === 0 || k === righe.length - 1).map(r => `
    <tr>
      <td class="num">${r.eta}</td>
      <td class="num anno">${r.anno}</td>
      <td class="num">${c.sym} ${fmt(r.prezzo)}</td>
      <td class="num k">${c.sym} ${fmt(r.netto)}</td>
      <td class="num">${c.sym} ${fmt(r.lordo)}</td>
      <td class="num">${r.venduti < 0.001 ? (r.venduti * 1e8).toFixed(0) + " sat" : fmtBTC(r.venduti)}</td>
      <td class="num t">${r.tasse > 0 ? c.sym + " " + fmt(r.tasse) : "—"}</td>
      <td class="num residui">${fmtBTC(r.residui)}</td>
    </tr>`).join("");

  const tasseTot = righe.reduce((a, r) => a + r.tasse, 0);
  const nettoTot = righe.reduce((a, r) => a + r.netto, 0);

  // Il decumulo disegnato: quanti bitcoin ti restano, anno dopo anno, fino a zero.
  const GW = 760, GH = 220, GML = 46, GMR = 14, GMT = 14, GMB = 30;
  const maxBtc2 = righe[0].prima;
  const gx = eta => GML + (eta - base.etaInizio) / Math.max(1, ETA_MAX - base.etaInizio) * (GW - GML - GMR);
  const gy = v => GMT + (1 - v / maxBtc2) * (GH - GMT - GMB);
  const areaPunti = righe.map(r => `${gx(r.eta).toFixed(1)},${gy(r.residui).toFixed(1)}`);
  const area = `M${gx(base.etaInizio).toFixed(1)},${gy(maxBtc2).toFixed(1)}L${areaPunti.join("L")}L${gx(ETA_MAX).toFixed(1)},${(GH - GMB).toFixed(1)}L${GML},${(GH - GMB).toFixed(1)}Z`;
  const etaTacche = righe.map(r => r.eta).filter(e => e % 10 === 0);

  const timelineBox = `
    <section class="blocco">
      <h2>Come si consuma, anno dopo anno</h2>
      <p class="intro">Ogni anno vendi quello che serve, e alla fine non resta niente: è un decumulo programmato, non una rendita. L'importo cresce con l'inflazione, perché ${c.sym} ${fmt(base.nettoAnnuo)} di oggi non compreranno le stesse cose fra ${rCentro.attesa} anni.</p>
      <figure class="gfx gfx-decumulo">
        <svg viewBox="0 0 ${GW} ${GH}" role="img" aria-label="I bitcoin residui scendono da ${fmtBTC(maxBtc2)} a zero fra i ${base.etaInizio} e i ${ETA_MAX} anni" preserveAspectRatio="xMidYMid meet">
          ${[0.5, 1].map(f => `<line x1="${GML}" y1="${gy(maxBtc2 * f).toFixed(1)}" x2="${GW - GMR}" y2="${gy(maxBtc2 * f).toFixed(1)}" class="g-griglia" />
            <text x="${GML - 7}" y="${(gy(maxBtc2 * f) + 4).toFixed(1)}" class="g-tacca" text-anchor="end">${fmtBTC(maxBtc2 * f)}</text>`).join("")}
          <line x1="${GML}" y1="${(GH - GMB).toFixed(1)}" x2="${GW - GMR}" y2="${(GH - GMB).toFixed(1)}" class="g-griglia" />
          <text x="${GML - 7}" y="${(GH - GMB + 4).toFixed(1)}" class="g-tacca" text-anchor="end">0</text>
          <path d="${area}" class="g-area" />
          <polyline points="${areaPunti.join(" ")}" class="g-linea" />
          ${etaTacche.map(e => `<text x="${gx(e).toFixed(1)}" y="${GH - 10}" class="g-tacca" text-anchor="middle">${e} anni</text>`).join("")}
          <circle cx="${gx(base.etaInizio).toFixed(1)}" cy="${gy(maxBtc2).toFixed(1)}" r="3.5" class="g-oggi" />
          <text x="${(gx(base.etaInizio) + 9).toFixed(1)}" y="${(gy(maxBtc2) + 4).toFixed(1)}" class="g-valore">${fmtBTC(maxBtc2)} BTC</text>
          <text x="${(gx(ETA_MAX) - 4).toFixed(1)}" y="${(GH - GMB - 8).toFixed(1)}" class="g-valore" text-anchor="end">0</text>
        </svg>
      </figure>
      <p class="nota">In tutto incassi <b class="k">${c.sym} ${fmt(nettoTot)}</b> netti e paghi <b class="t">${c.sym} ${fmt(tasseTot)}</b> di imposta, su ${righe.length} anni.</p>
      <details class="cassetto cassetto-tabella">
        <summary>I numeri, anno per anno <span class="sunto">${righe.length} righe</span></summary>
        <div class="tabellone">
          <table class="tabella timeline">
            <thead><tr>
              <th class="num">Età</th><th class="num">Anno</th><th class="num">Bitcoin a</th>
              <th class="num">Ti resta netto</th><th class="num">Vendita lorda</th>
              <th class="num">BTC venduti</th><th class="num">Imposta</th><th class="num">BTC residui</th>
            </tr></thead>
            <tbody>${corpo}</tbody>
          </table>
        </div>
        <p class="nota">${ogniQuanti > 1 ? `Per non allungare troppo la tabella si mostra un anno ogni ${ogniQuanti}; il calcolo li usa tutti. ` : ""}I prezzi sono quelli della linea centrale del corridoio: guardali, e decidi tu se sono credibili.</p>
      </details>
    </section>`;

  // — Dove sta il prezzo, adesso
  let corridoioBox = "";
  if (prezziLive.usd) {
    const pos = posizioneNelCorridoio(prezziLive.usd);
    corridoioBox = `
    <section class="blocco">
      <h2>Dove sta Bitcoin adesso, dentro il corridoio</h2>
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
      <p class="nota">Il prezzo di adesso è il <b>${fmtPct(pos.rapporto)}</b> della retta di regressione. Il corridoio non dice quando: dice dove il prezzo è stato per il novanta per cento della sua storia.</p>
    </section>`;
  }

  // — Le tre linee
  const carte = SCENARI.map(sc => {
    const linea = lineaDi(base, sc);
    const r = fabbisogno(base, linea);
    const eta = primaEtaSufficiente(base, stack, sc);
    const cop = stack > 0 ? stack / r.btcNecessari : 0;
    const tenuta = testTenuta(base, r.btcNecessari, linea);
    return `
      <article class="scenario" style="--tono:${sc.tono}">
        <header><h3>${sc.nome}</h3><span class="cagr">${sc.q} percentile</span></header>
        <p class="scenario-cifra">${fmtBTC(r.btcNecessari)} <span>BTC oggi</span></p>
        <p class="scenario-eq">${c.sym} ${fmt(r.btcNecessari * base.prezzoOggi)} ai prezzi di adesso · bitcoin a ${c.sym} ${fmt(r.prezzoInizio)} quando cominci</p>
        <p class="scenario-desc">${sc.desc}</p>
        ${stack > 0 ? `<div class="cop">${barra(cop)}<p>i tuoi ${fmtBTC(stack)} BTC coprono il <b>${fmtPct(cop)}</b>${eta ? ` · basterebbero cominciando a <b>${eta} anni</b>` : " · non bastano nemmeno rimandando"}</p></div>` : ""}
        <p class="tenuta ${tenuta.regge ? "ok" : "ko"}">
          ${tenuta.regge
            ? `Regge un crollo del 70% in qualunque anno arrivi: nel caso peggiore restano ${fmtBTC(tenuta.btcResidui)} BTC.`
            : (() => {
                const serve = capitaleAntiCrollo(base, r.btcNecessari, linea);
                const quando = tenuta.annoCrollo === 0 ? "appena cominci" : `${tenuta.annoCrollo} anni dopo l'inizio`;
                return `Il momento peggiore per un crollo del 70% è <b>${quando}</b>: ti lascerebbe a secco a ${tenuta.etaRottura} anni.`
                  + (serve ? ` Per reggerlo servirebbero <b>${fmtBTC(serve)} BTC</b> (+${((serve / r.btcNecessari - 1) * 100).toFixed(0)}%).` : "");
              })()}
        </p>
      </article>`;
  }).join("");

  const scenariBox = `
    <section class="blocco">
      <h2>Le tre linee del corridoio</h2>
      <p class="intro">La legge di potenza non dà un prezzo: dà una fascia. Questi sono i suoi tre bordi, presi dai residui della regressione — non sono ipotesi scelte a mano.</p>
      <div class="scenari">${carte}</div>
    </section>`;

  // — Il fisco
  const f = FISCO[base.paese];
  const extra = rCentro.lordoInizio - rCentro.nettoInizio;
  const fiscoBox = `
    <section class="blocco">
      <h2>Il primo prelievo, quando avrai ${base.etaInizio} anni</h2>
      <div class="bar bar-split">
        <span class="q-keep" style="width:${100 * rCentro.nettoInizio / rCentro.lordoInizio}%"></span>
        <span class="q-tax" style="width:${100 * extra / rCentro.lordoInizio}%"></span>
      </div>
      <p class="legenda">
        vendi <b>${c.sym} ${fmt(rCentro.lordoInizio)}</b> ·
        <b class="k">${c.sym} ${fmt(rCentro.nettoInizio)}</b> a te ·
        <b class="t">${c.sym} ${fmt(extra)}</b> di imposta · effettiva <b>${fmtPct(rCentro.aliquotaEff)}</b>
      </p>
      <p class="nota">Il netto è più alto dei ${c.sym} ${fmt(base.nettoAnnuo)} che hai chiesto perché è rivalutato: fra ${rCentro.attesa} anni serviranno più soldi per comprare le stesse cose. ${f.nota}</p>
    </section>`;

  // — I sei paesi
  const confronto = Object.keys(PAESI).map(n => {
    const pz = prezzoPerPaese(n) || (PAESI[n].valuta === c.valuta ? base.prezzoOggi : null);
    if (!pz) return null;
    const fattore = PAESI[n].valuta === c.valuta ? 1 : pz / base.prezzoOggi;
    const q = { ...base, paese: n, nettoAnnuo: base.nettoAnnuo * fattore,
                prezzoOggi: pz, costoMedio: base.costoMedio * fattore,
                cambioUsd: prezziLive.usd ? pz / prezziLive.usd : null };
    return { n, btc: fabbisogno(q, lineaDi(q, CEN)).btcNecessari, et: FISCO[n].etichetta };
  }).filter(Boolean).sort((a, b) => a.btc - b.btc);
  const maxBtc = Math.max(...confronto.map(x => x.btc));

  const paesiBox = `
    <section class="blocco">
      <h2>La stessa integrazione, ${confronto.length} paesi</h2>
      <p class="intro">Stesso importo, stessa età, stessa linea del corridoio: cambia solo il fisco. Fra il primo e l'ultimo ballano <b>${fmtBTC(maxBtc - confronto[0].btc)} BTC</b>, il ${(100 * (maxBtc / confronto[0].btc - 1)).toFixed(0)}% in più.</p>
      <table class="tabella">
        <thead><tr><th>Paese</th><th>Regime</th><th class="num">BTC oggi</th><th></th></tr></thead>
        <tbody>${confronto.map(x => `
          <tr class="${x.n === base.paese ? "tuo" : ""}">
            <td class="pa">${x.n}${x.n === base.paese ? " <span class='tag'>tu</span>" : ""}</td>
            <td class="reg">${x.et}</td>
            <td class="num">${fmtBTC(x.btc)}</td>
            <td class="viz">${barra(x.btc / maxBtc)}</td>
          </tr>`).join("")}</tbody>
      </table>
      <p class="nota">Gli importi sono convertiti fra valute al prezzo di Bitcoin, così le righe differiscono solo per il fisco. Non è corretto per il diverso costo della vita: a Lisbona si spende meno che a Monaco, e questo confronto non lo dice.</p>
    </section>`;

  // — Le ipotesi
  const d0 = giorniDaGenesi();
  const ipotesi = `
    <section class="blocco piede">
      <h2>Che cosa ho assunto</h2>
      <ul class="ipotesi">
        <li><b>Un solo modello di prezzo</b> — la legge di potenza, coi parametri rifatti il ${PL_DATA_FIT} su ${fmt(PL_PUNTI)} giorni di storia: esponente ${String(PL_N).replace(".", ",")}, R² ${String(PL_R2).replace(".", ",")}. Nessun tasso di crescita scelto a mano.</li>
        <li><b>La crescita rallenta</b> — vale n/t, per costruzione: ${fmtPct(crescitaIstantanea(d0))} adesso, ${fmtPct(crescitaIstantanea(d0 + 10 * 365.25))} fra dieci anni, ${fmtPct(crescitaIstantanea(d0 + 30 * 365.25))} fra trenta.</li>
        <li><b>Decumulo programmato</b> — ${rCentro.anni} prelievi dai ${base.etaInizio} ai ${ETA_MAX} anni. Alla fine non resta niente: è voluto, non è una rendita perpetua.</li>
        <li><b>Potere d'acquisto di oggi</b> — i ${c.sym} ${fmt(base.nettoAnnuo)} che hai chiesto vengono rivalutati del ${fmtPct(c.infl)} l'anno, prima e durante il decumulo.</li>
        <li><b>Imposta</b> — ${f.etichetta}${f.bollo ? `, più il bollo dello ${fmtPct(f.bollo)} annuo, che erode i sat anche nei ${rCentro.attesa} anni in cui non vendi niente` : ""}, sempre e solo sulla plusvalenza.</li>
      </ul>
      <p class="avvertenza">
        Il limite da tenere presente: la legge di potenza descrive bene sedici anni di storia, ma
        estrapolarla fino ai tuoi cento anni è un'altra cosa. Nessuna regressione sa quello che non
        è ancora successo, e su orizzonti lunghi la curva arriva a valori che il mondo potrebbe non
        sostenere — la tabella qui sopra te li mostra apposta. Il risultato è una fascia, non una
        cifra. Non è consulenza finanziaria.
      </p>
    </section>`;

  $grafico.innerHTML = grafico(base, cambio);
  $verdetto.innerHTML = testa;
  $out.innerHTML = accumuloBox + timelineBox + corridoioBox + scenariBox + fiscoBox + paesiBox + ipotesi;
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

function trascina(svg, clientX) {
  const eta = clamp(
    parseInt($eta.value, 10) + (annoDallaX(svg, clientX) - NOW_YEAR),
    parseInt($eta.value, 10), ETA_MAX - 1);
  if (String(eta) !== $etaInizio.value) {
    $etaInizio.value = eta;
    adattaLarghezza($etaInizio);
    render();
  }
}

let inTrascinamento = false;
document.addEventListener("pointerdown", e => {
  const svg = e.target.closest && e.target.closest(".gfx svg");
  if (!svg) return;
  // Col dito si parte solo dalla maniglia: altrimenti il tocco per scorrere
  // la pagina sposterebbe l'anno senza che tu l'abbia chiesto. Col mouse,
  // dove il gesto non è ambiguo, si può cliccare in qualunque punto.
  const sullaPresa = !!(e.target.closest(".g-presa") || e.target.closest(".g-maniglia"));
  if (e.pointerType !== "mouse" && !sullaPresa) return;
  e.preventDefault();
  inTrascinamento = true;
  document.body.classList.add("sto-trascinando");
  trascina(svg, e.clientX);
});
document.addEventListener("pointermove", e => {
  if (!inTrascinamento) return;
  // Il grafico viene ridisegnato a ogni movimento: il nodo di partenza non è
  // più nel documento e misurarlo darebbe coordinate sbagliate. Si ripesca.
  const svg = document.querySelector(".gfx svg");
  if (!svg) return;
  e.preventDefault();
  trascina(svg, e.clientX);
}, { passive: false });
document.addEventListener("pointerup", () => {
  inTrascinamento = false;
  document.body.classList.remove("sto-trascinando");
});

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
$("planner").addEventListener("change", e => {
  if (e.target.tagName === "SELECT") adattaLarghezza(e.target);
  ridisegna();
});

$paese.addEventListener("change", aggiornaValuta);
$eta.addEventListener("change", () => {
  // Non si comincia a prelevare prima di adesso.
  if (parseInt($etaInizio.value, 10) < parseInt($eta.value, 10)) {
    $etaInizio.value = $eta.value;
    adattaLarghezza($etaInizio);
  }
});
$prezzo.addEventListener("input", () => { prezzoManuale = true; mostraNotaCosto(); });
$("badgePrezzo").addEventListener("click", () => caricaPrezzo(true).then(render));
$investito.addEventListener("input", () => sincronizzaCosto("investito"));
$costo.addEventListener("input", () => sincronizzaCosto("costo"));
$stack.addEventListener("input", () => sincronizzaCosto("stack"));

// ------------------------------------------------------------
// Avvio: la pagina apre già con una risposta, non con un modulo vuoto
// ------------------------------------------------------------
aggiornaValuta();
caricaPrezzo().then(render);
aggiornaCodaStorica().then(render);
