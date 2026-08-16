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

/** La linea del corridoio di uno scenario, portata nella valuta locale. */
function lineaDi(p, sc) {
  const d0 = giorniDaGenesi();
  const cambio = p.cambioUsd || 1;
  return anni => lineaCorridoio(d0 + anni * 365.25, sc.perc) * cambio;
}

/**
 * TEST DI TENUTA — la legge di potenza è una linea liscia, la realtà no.
 * Bitcoin scende del 70% e ci mette anni a tornare. Se succede subito dopo
 * che hai smesso di lavorare, vendi molti più sat allo stesso prezzo e quei
 * sat non tornano più. Qui il prezzo della linea viene moltiplicato per un
 * crollo che scende a 0,30 e recupera in quattro anni.
 */
function testTenuta(p, btcIniziali, linea) {
  const shockato = anni => {
    const d = anni - (p.etaInizio - p.eta) - p.annoShock;
    const s = (d >= 0 && d < 4) ? 0.30 + 0.70 * (d / 4) : 1;
    return linea(anni) * s;
  };
  const sim = simula(p, shockato, btcIniziali);
  if (sim.bastano) return { regge: true, btcResidui: sim.righe[sim.righe.length - 1].residui };
  return { regge: false, etaRottura: sim.righe[sim.righe.length - 1].eta };
}

/** Quanto capitale servirebbe per reggere il crollo. */
function capitaleAntiCrollo(p, btcBase, linea) {
  if (testTenuta(p, btcBase, linea).regge) return btcBase;
  let lo = 1, hi = 8;
  if (!testTenuta(p, btcBase * hi, linea).regge) return null;
  for (let i = 0; i < 40; i++) {
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
const $oltreAnno = $("oltreUnAnno"), $shock = $("annoShock");
const $out = $("risultati");

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
  $("fiscoNota").textContent = f.nota;
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
    annoShock: parseInt($shock.value, 10) || 0,
    // Il corridoio è in dollari: serve il cambio per portarlo nella valuta locale.
    cambioUsd: prezziLive.usd ? parseFloat($prezzo.value) / prezziLive.usd : null,
  };
}

const barra = f => `<div class="bar"><span style="width:${clamp(f * 100, 0, 100)}%"></span></div>`;

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
  const testa = `
    <div class="verdetto">
      <p class="occhiello">Per incassare ${c.sym} ${fmt(base.nettoAnnuo)} netti ogni anno,
      dai ${base.etaInizio} anni (nel ${annoInizio}) fino ai ${ETA_MAX}, ti servono oggi</p>
      <p class="cifra">${fmtBTC(rCentro.btcNecessari)}<span class="unita">BTC</span></p>
      <p class="sotto">${c.sym} ${fmt(rCentro.btcNecessari * base.prezzoOggi)} ai prezzi di oggi · fra ${fmtBTC(rAlto.btcNecessari)} e ${fmtBTC(rBasso.btcNecessari)} BTC dal tetto al fondo del corridoio</p>
      ${stack > 0 ? `<div class="cop-testa">${barra(stack / rCentro.btcNecessari)}<p>ne hai ${fmtBTC(stack)}: sei al <b>${fmtPct(stack / rCentro.btcNecessari)}</b></p></div>` : ""}
    </div>`;

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
  const timelineBox = `
    <section class="blocco">
      <h2>Anno per anno, fino ai ${ETA_MAX}</h2>
      <p class="intro">Il decumulo è programmato: ogni anno vendi quello che serve, e alla fine il patrimonio è esaurito per costruzione. L'importo cresce con l'inflazione, perché ${c.sym} ${fmt(base.nettoAnnuo)} di oggi non compreranno le stesse cose fra ${rCentro.attesa} anni.</p>
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
      <p class="nota">${ogniQuanti > 1 ? `Per non allungare troppo la tabella si mostra un anno ogni ${ogniQuanti}; il calcolo li usa tutti. ` : ""}In totale incassi <b class="k">${c.sym} ${fmt(nettoTot)}</b> netti e paghi <b class="t">${c.sym} ${fmt(tasseTot)}</b> di imposta, su ${righe.length} anni. I prezzi sono quelli della linea centrale del corridoio: guardali, e decidi tu se sono credibili.</p>
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
            ? `Regge un crollo del 70% ${base.annoShock === 0 ? "appena cominci" : `${base.annoShock} anni dopo l'inizio`}: restano ${fmtBTC(tenuta.btcResidui)} BTC.`
            : (() => {
                const serve = capitaleAntiCrollo(base, r.btcNecessari, linea);
                return `Un crollo del 70% ${base.annoShock === 0 ? "appena cominci" : `${base.annoShock} anni dopo l'inizio`} lo esaurisce a ${tenuta.etaRottura} anni.`
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

  $out.innerHTML = testa + timelineBox + corridoioBox + scenariBox + fiscoBox + paesiBox + ipotesi;
}

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
