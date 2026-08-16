// ============================================================
// Pensione in Bitcoin — calcolatore europeo con fiscalità reale
//
// Che cosa lo distingue: il capitale calcolato eroga il NETTO.
// Per avere 18.000 € in tasca in Italia devi venderne di più,
// perché il 33% colpisce la plusvalenza. In Germania e Portogallo,
// oltre l'anno di detenzione, non devi vendere niente in più.
//
// Modello: annuity reale a due fasi + test di tenuta su un crollo.
// Nessuna dipendenza esterna. Prezzo live: CoinGecko (senza chiave).
// ============================================================

const NOW_YEAR = new Date().getFullYear();
const ETA_MAX = 100;               // orizzonte del decumulo

// ------------------------------------------------------------
// FISCALITÀ — verificata ad agosto 2026, fonti in fondo alla pagina.
// `esenteOltreAnno`: la plusvalenza non è tassata se la tranche
// venduta è detenuta da più di 12 mesi (DE §23 EStG, PT 365 giorni).
// ------------------------------------------------------------
const FISCO = {
  Italia: {
    aliquota: 0.33,
    esenteOltreAnno: false,
    bollo: 0.002,
    etichetta: "33% sulla plusvalenza",
    nota: "Imposta sostitutiva salita al 33% il 1° gennaio 2026 (26% solo per stablecoin in euro MiCAR). Nessuna franchigia. In più il bollo dello 0,20% annuo sul controvalore.",
  },
  Germania: {
    aliquota: 0.45,
    esenteOltreAnno: true,
    bollo: 0,
    etichetta: "esente oltre 12 mesi",
    nota: "§23 EStG: la plusvalenza su cripto detenute da più di un anno non è tassata. Sotto l'anno entra nell'imposta sul reddito, fino al 45%.",
  },
  Francia: {
    aliquota: 0.314,
    esenteOltreAnno: false,
    bollo: 0,
    etichetta: "31,4% forfettario",
    nota: "PFU salito al 31,4% il 1° gennaio 2026: 12,8% di imposta più 18,6% di contributi sociali. Gli scambi cripto-cripto non sono tassati.",
  },
  Spagna: {
    scaglioni: [[6000, 0.19], [50000, 0.21], [200000, 0.23], [Infinity, 0.27]],
    esenteOltreAnno: false,
    bollo: 0,
    etichetta: "19–27% a scaglioni",
    nota: "La plusvalenza entra nella base del risparmio: 19% fino a 6.000 €, 21% fino a 50.000, 23% fino a 200.000, 27% oltre.",
  },
  Portogallo: {
    aliquota: 0.28,
    esenteOltreAnno: true,
    bollo: 0,
    etichetta: "esente oltre 365 giorni",
    nota: "Esente se la tranche è detenuta da 365 giorni o più; sotto l'anno l'aliquota è il 28%. L'esenzione non vale per token assimilati a strumenti finanziari.",
  },
  Polonia: {
    aliquota: 0.19,
    esenteOltreAnno: false,
    bollo: 0,
    etichetta: "19% piatta",
    nota: "Aliquota unica del 19% (PIT-38), identica per qualunque durata di detenzione e qualunque importo.",
  },
};

// Inflazione e costo della vita. Fonti: Eurostat, ISTAT, Destatis, INE, INSEE, NBP (2025).
const PAESI = {
  Italia:     { valuta: "EUR", sym: "€", infl: 0.020, stili: { essenziale: 12000, base: 18000, agiato: 28000 } },
  Germania:   { valuta: "EUR", sym: "€", infl: 0.022, stili: { essenziale: 16000, base: 24000, agiato: 34000 } },
  Spagna:     { valuta: "EUR", sym: "€", infl: 0.020, stili: { essenziale: 12000, base: 18000, agiato: 26000 } },
  Portogallo: { valuta: "EUR", sym: "€", infl: 0.020, stili: { essenziale: 10000, base: 15000, agiato: 22000 } },
  Francia:    { valuta: "EUR", sym: "€", infl: 0.018, stili: { essenziale: 15000, base: 22000, agiato: 32000 } },
  Polonia:    { valuta: "PLN", sym: "zł", infl: 0.025, stili: { essenziale: 19800, base: 24900, agiato: 32400 } },
};

// ------------------------------------------------------------
// SCENARI DI CRESCITA
// Perché non 20% e 30%: nel 2026 ogni revisione degli istituzionali
// è stata al ribasso (Citi 143k→112k→82k$, Standard Chartered
// 150k→100k, Bernstein 200k→150k). Persino lo scenario BEAR di ARK
// per il 2030 implica il 43% annuo. Un modello che parte dal 20%
// come "base" non è prudente: è una scommessa travestita da default.
// ------------------------------------------------------------
const SCENARI = [
  { key: "fermo",     nome: "Prezzo fermo", g: 0.00, tono: "var(--zero)",  desc: "Bitcoin non sale mai più. Il numero che non dipende da nessuna previsione." },
  { key: "prudente",  nome: "Prudente",     g: 0.05, tono: "var(--calm)",  desc: "Cresce come un indice azionario mediocre." },
  { key: "base",      nome: "Base",         g: 0.10, tono: "var(--keep)",  desc: "Poco sotto le azioni storiche. È l'ipotesi su cui conviene decidere." },
  { key: "ottimista", nome: "Ottimista",    g: 0.15, tono: "var(--hope)",  desc: "Bitcoin batte le azioni per decenni. Possibile, non pianificabile." },
];

// ------------------------------------------------------------
// Matematica
// ------------------------------------------------------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = n => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(n);
const fmtBTC = n => new Intl.NumberFormat("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);
const fmtPct = x => `${(x * 100).toFixed(1).replace(".", ",")}%`;

/** Valore attuale di 1 unità di spesa per N anni al tasso reale r. */
function annuity(r, N, inizioAnno = true) {
  if (N <= 0) return 0;
  const a = Math.abs(r) < 1e-9 ? N : (1 - Math.pow(1 + r, -N)) / r;
  return inizioAnno ? a * (1 + r) : a;
}

/** Due fasi: r1 per i primi T anni, poi r2. Bitcoin non può rendere il 13% reale a 90 anni. */
function annuityDueFasi(N, r1, r2, T, inizioAnno) {
  const n1 = clamp(T, 0, N);
  const n2 = N - n1;
  const a1 = annuity(r1, n1, inizioAnno);
  if (n2 <= 0) return a1;
  return a1 + Math.pow(1 + r1, -n1) * annuity(r2, n2, inizioAnno);
}

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
 * La plusvalenza è la parte del ricavo che eccede il costo di carico:
 * vendendo X con prezzo p e costo medio c, la plusvalenza è X·(1 − c/p).
 * Con gli scaglioni spagnoli serve un giro di punto fisso: due passate bastano.
 */
function lordoPerNetto(paese, netto, prezzo, costoMedio, oltreUnAnno) {
  const quotaPlus = Math.max(0, 1 - (costoMedio || 0) / prezzo);
  if (quotaPlus === 0) return { lordo: netto, aliquotaEff: 0 };
  let lordo = netto;
  for (let i = 0; i < 6; i++) {
    const t = imposta(paese, lordo * quotaPlus, oltreUnAnno);
    lordo = netto + t;
  }
  const aliquotaEff = 1 - netto / lordo;
  return { lordo, aliquotaEff };
}

/**
 * BTC necessari alla data di pensione.
 * Il capitale deve erogare il NETTO ogni anno, indicizzato, fino a 100 anni.
 */
function calcolaFabbisogno(p) {
  const paese = PAESI[p.paese];
  const infl = paese.infl;
  const anniAllaPensione = Math.max(0, p.annoPensione - NOW_YEAR);
  const etaPensione = p.eta + anniAllaPensione;
  const N = Math.max(0, ETA_MAX - etaPensione);

  const prezzoPensione = p.prezzoOggi * Math.pow(1 + p.g, anniAllaPensione);
  // Il costo medio cresce se continui ad accumulare: chi compra ogni mese
  // paga in media un prezzo intermedio. Media geometrica del percorso.
  const costoMedio = p.accumulaAncora
    ? p.costoMedio * 0.5 + p.prezzoOggi * Math.pow(1 + p.g, anniAllaPensione / 2) * 0.5
    : p.costoMedio;

  const spesaNettaPensione = p.spesaAnnua * p.frequenza * Math.pow(1 + infl, anniAllaPensione);
  const { lordo, aliquotaEff } = lordoPerNetto(p.paese, spesaNettaPensione, prezzoPensione, costoMedio, p.oltreUnAnno);

  // Rendimento reale, al netto di inflazione e bollo.
  const bollo = FISCO[p.paese].bollo || 0;
  const rReale = (1 + p.g) / (1 + infl) - 1 - bollo;
  const r2 = p.rFase2 - bollo;

  const a = annuityDueFasi(N, rReale, r2, p.anniFase1, p.inizioAnno);
  const btcNecessari = (lordo * a) / prezzoPensione;

  return {
    btcNecessari: btcNecessari * (1 + p.margine),
    N, rReale, r2, prezzoPensione, costoMedio,
    spesaNettaPensione, lordoPensione: lordo, aliquotaEff,
    etaPensione, anniAllaPensione,
  };
}

/**
 * TEST DI TENUTA — quello che i calcolatori lisci non fanno.
 * Bitcoin non sale in linea retta: fa −70% e ci mette anni a tornare.
 * Se il crollo arriva subito dopo che hai smesso di lavorare, vendi
 * molti più sat allo stesso prezzo e quei sat non tornano più.
 * Qui simuliamo anno per anno con un crollo all'anno `annoShock`.
 */
function testTenuta(p, btcIniziali) {
  const paese = PAESI[p.paese];
  const infl = paese.infl;
  const bollo = FISCO[p.paese].bollo || 0;
  const anniAllaPensione = Math.max(0, p.annoPensione - NOW_YEAR);
  const N = Math.max(0, ETA_MAX - (p.eta + anniAllaPensione));

  let btc = btcIniziali;
  let prezzo = p.prezzoOggi * Math.pow(1 + p.g, anniAllaPensione);
  let netto = p.spesaAnnua * p.frequenza * Math.pow(1 + infl, anniAllaPensione);
  const costo = p.costoMedio;

  for (let t = 0; t < N; t++) {
    // Percorso del prezzo: tendenza dello scenario, con un crollo del 70%
    // all'anno `annoShock` e un recupero lineare nei 4 anni seguenti.
    let shock = 1;
    const d = t - p.annoShock;
    if (d >= 0 && d < 4) shock = 0.30 + 0.70 * (d / 4);
    const prezzoAnno = prezzo * shock;

    const { lordo } = lordoPerNetto(p.paese, netto, prezzoAnno, costo, p.oltreUnAnno);
    const venduti = lordo / prezzoAnno;
    btc -= venduti;
    if (btc <= 0) return { regge: false, annoRottura: t, etaRottura: p.eta + anniAllaPensione + t };

    btc *= (1 - bollo);
    prezzo *= (1 + p.g);
    netto *= (1 + infl);
  }
  return { regge: true, btcResidui: btc };
}

/** Quanto capitale servirebbe per reggere il crollo. Bisezione sul moltiplicatore. */
function capitaleAntiCrollo(p, btcBase) {
  if (testTenuta(p, btcBase).regge) return btcBase;
  let lo = 1, hi = 8;
  if (!testTenuta(p, btcBase * hi).regge) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (testTenuta(p, btcBase * mid).regge) hi = mid; else lo = mid;
  }
  return btcBase * hi;
}

/** Il primo anno in cui lo stack posseduto basta. */
function primoAnnoSufficiente(p, stack) {
  if (!stack || stack <= 0) return null;
  for (let anno = Math.max(NOW_YEAR, p.annoPensione); anno <= NOW_YEAR + 60; anno++) {
    const r = calcolaFabbisogno({ ...p, annoPensione: anno });
    if (stack >= r.btcNecessari) return anno;
    if (p.eta + (anno - NOW_YEAR) >= ETA_MAX) break;
  }
  return null;
}

// ------------------------------------------------------------
// Prezzo live
// ------------------------------------------------------------
let prezziLive = { eur: null, pln: null };
let prezzoManuale = false;

/** `forzato` = l'ha chiesto l'utente: riporta il campo al prezzo di mercato
 *  anche se lo aveva scritto a mano, altrimenti il pulsante sembra rotto. */
async function caricaPrezzo(forzato = false) {
  const badge = document.getElementById("badgePrezzo");
  badge.textContent = "aggiorno…";
  badge.className = "badge badge-wait";
  badge.disabled = true;
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur,pln&_=" + Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    prezziLive.eur = d.bitcoin.eur;
    prezziLive.pln = d.bitcoin.pln;
    if (forzato) prezzoManuale = false;
    if (!prezzoManuale) applicaPrezzoLive();
    badge.textContent = "live " + new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    badge.className = "badge badge-live";
    badge.title = "Rileggi il prezzo da CoinGecko";
  } catch (e) {
    // Nessun prezzo inventato: un valore di ripiego sbagliato falsa
    // ogni numero della pagina senza che si veda.
    badge.textContent = "non arriva — riprova";
    badge.className = "badge badge-off";
    badge.title = "CoinGecko non ha risposto. Premi per riprovare, oppure scrivi il prezzo a mano.";
    if (!prezzoManuale && !$prezzo.value) $prezzo.focus();
  } finally {
    badge.disabled = false;
  }
}

function prezzoPerPaese(nome) {
  return PAESI[nome].valuta === "PLN" ? prezziLive.pln : prezziLive.eur;
}

function applicaPrezzoLive() {
  const p = prezzoPerPaese($paese.value);
  if (p) $prezzo.value = Math.round(p);
}

// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------
const $ = id => document.getElementById(id);
const $paese = $("paese"), $eta = $("eta"), $etaVal = $("etaVal"), $anno = $("annoPensione");
const $stile = $("stile"), $spesaCustom = $("spesaCustom"), $rigaCustom = $("rigaCustom");
const $prezzo = $("prezzoOggi"), $costo = $("costoMedio"), $stack = $("stack");
const $freq = $("frequenza"), $oltreAnno = $("oltreUnAnno");
const $margine = $("margine"), $fase1 = $("anniFase1"), $rFase2 = $("rFase2"), $shock = $("annoShock");
const $form = $("planner"), $out = $("risultati");

Object.keys(PAESI).forEach(n => {
  const o = document.createElement("option");
  o.value = n; o.textContent = n;
  $paese.appendChild(o);
});
$paese.value = "Italia";

function aggiornaValuta() {
  const c = PAESI[$paese.value];
  document.querySelectorAll(".sym").forEach(e => (e.textContent = c.sym));
  if (!prezzoManuale) applicaPrezzoLive();
  const f = FISCO[$paese.value];
  $("fiscoEtichetta").textContent = f.etichetta;
  $("fiscoNota").textContent = f.nota;
  $("rigaOltreAnno").classList.toggle("hidden", !f.esenteOltreAnno);
  aggiornaStili();
  if (document.getElementById("investito")) calcolaCostoMedio();
}

function aggiornaStili() {
  const c = PAESI[$paese.value];
  [...$stile.options].forEach(o => {
    if (c.stili[o.value]) o.textContent = `${o.dataset.nome} — ${c.sym} ${fmt(c.stili[o.value])}/anno`;
  });
  $spesaCustom.placeholder = `es. ${fmt(c.stili.base)}`;
}

$eta.addEventListener("input", () => ($etaVal.textContent = $eta.value));
$paese.addEventListener("change", aggiornaValuta);
$stile.addEventListener("change", () => $rigaCustom.classList.toggle("hidden", $stile.value !== "custom"));
$prezzo.addEventListener("input", () => { prezzoManuale = true; });
$("badgePrezzo").addEventListener("click", () => caricaPrezzo(true));

/** Chi ha meno di un Bitcoin ragiona in satoshi: 28392600 sono 0,283926 BTC.
 *  Nessuno che usa questo calcolatore possiede mille Bitcoin, quindi la soglia è netta. */
function stackInBTC() {
  const v = parseFloat($stack.value || "0");
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > 1000 ? v / 1e8 : v;
}

/** Il costo medio non si chiede: si ricava da quanto hai speso in tutto. */
function calcolaCostoMedio() {
  const speso = parseFloat($("investito").value || "0");
  const btc = stackInBTC();
  const nota = $("notaCosto");
  if (speso > 0 && btc > 0) {
    const medio = speso / btc;
    $costo.value = Math.round(medio);
    const p = parseFloat($prezzo.value || "0");
    const segno = p > 0
      ? (medio > p
          ? ` Oggi Bitcoin sta sotto: sei in perdita del ${fmtPct(1 - p / medio)} e su una vendita non pagheresti imposta.`
          : ` Il ${fmtPct(1 - medio / p)} del valore attuale è plusvalenza tassabile.`)
      : "";
    nota.innerHTML = `Calcolato: <b>${PAESI[$paese.value].sym} ${fmt(medio)}</b> per Bitcoin.${segno}`;
    nota.classList.add("nota-viva");
  } else {
    nota.textContent = "Si compila da solo se riempi i due campi qui accanto. Serve per l'imposta: si paga solo sulla differenza fra prezzo di vendita e prezzo di acquisto.";
    nota.classList.remove("nota-viva");
  }
}

$("investito").addEventListener("input", calcolaCostoMedio);
$stack.addEventListener("input", calcolaCostoMedio);
$costo.addEventListener("input", () => {
  // Se lo scrive a mano vince lui: smetto di sovrascriverlo.
  $("investito").value = "";
  calcolaCostoMedio();
});

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function leggiInput() {
  const c = PAESI[$paese.value];
  const spesa = $stile.value === "custom"
    ? parseFloat($spesaCustom.value || "0")
    : c.stili[$stile.value];
  return {
    paese: $paese.value,
    eta: parseInt($eta.value, 10),
    annoPensione: clamp(parseInt($anno.value, 10) || NOW_YEAR, NOW_YEAR, 2100),
    spesaAnnua: spesa,
    frequenza: parseFloat($freq.value),
    prezzoOggi: parseFloat($prezzo.value),
    costoMedio: parseFloat($costo.value || "0"),
    accumulaAncora: $("accumulaAncora").checked,
    oltreUnAnno: $oltreAnno.checked,
    margine: parseFloat($margine.value),
    anniFase1: parseInt($fase1.value, 10),
    rFase2: parseFloat($rFase2.value) / 100,
    annoShock: parseInt($shock.value, 10),
    inizioAnno: true,
  };
}

function barra(frazione) {
  const pct = clamp(frazione * 100, 0, 100);
  return `<div class="bar"><span style="width:${pct}%"></span></div>`;
}

$form.addEventListener("submit", e => {
  e.preventDefault();
  const base = leggiInput();
  const c = PAESI[base.paese];
  const stack = stackInBTC();

  if (!Number.isFinite(base.spesaAnnua) || base.spesaAnnua <= 0) {
    $out.innerHTML = `<p class="errore">Manca l'importo annuo. Scegli uno stile di vita o scrivi quanto ti costa un anno.</p>`;
    return;
  }
  if (!Number.isFinite(base.prezzoOggi) || base.prezzoOggi <= 0) {
    $out.innerHTML = `<p class="errore">Manca il prezzo di Bitcoin. Scrivilo nel campo qui sopra.</p>`;
    return;
  }

  const rBase = calcolaFabbisogno({ ...base, g: 0.10 });
  const rFermo = calcolaFabbisogno({ ...base, g: 0.0 });

  // — Il numero
  const testa = `
    <div class="verdetto">
      <p class="occhiello">Per vivere con ${c.sym} ${fmt(base.spesaAnnua)} l'anno${base.frequenza < 1 ? ` (usati ${$freq.selectedOptions[0].textContent.toLowerCase()})` : ""},
      dal ${base.annoPensione}, fino a ${ETA_MAX} anni</p>
      <p class="cifra">${fmtBTC(rBase.btcNecessari)}<span class="unita">BTC</span></p>
      <p class="sotto">nell'ipotesi base, crescita 10% l'anno · ${fmtBTC(rFermo.btcNecessari)} BTC se il prezzo non salisse mai più</p>
    </div>`;

  // — Che cosa ci toglie il fisco
  const f = FISCO[base.paese];
  const extra = rBase.lordoPensione - rBase.spesaNettaPensione;
  const fiscoBox = `
    <section class="blocco">
      <h2>Quanto devi vendere per averne ${c.sym} ${fmt(rBase.spesaNettaPensione)} in mano</h2>
      <div class="fisco-riga">
        <div class="fisco-quota">
          <div class="bar bar-split">
            <span class="q-keep" style="width:${100 * rBase.spesaNettaPensione / rBase.lordoPensione}%"></span>
            <span class="q-tax" style="width:${100 * extra / rBase.lordoPensione}%"></span>
          </div>
          <p class="legenda">
            <b class="k">${c.sym} ${fmt(rBase.spesaNettaPensione)}</b> a te ·
            <b class="t">${c.sym} ${fmt(extra)}</b> di imposta ·
            aliquota effettiva <b>${fmtPct(rBase.aliquotaEff)}</b>
          </p>
        </div>
      </div>
      <p class="nota">${f.nota}</p>
      <p class="nota">L'aliquota effettiva è più bassa di quella nominale: l'imposta colpisce solo la plusvalenza, cioè la parte di prezzo che eccede quanto avevi pagato (${c.sym} ${fmt(rBase.costoMedio)} di costo medio stimato alla data).</p>
    </section>`;

  // — Confronto fra paesi: la tesi della pagina
  // Confronto a parità di potere d'acquisto: la spesa dell'utente viene convertita
  // nella valuta di ogni paese passando per il prezzo di Bitcoin, così l'unica
  // differenza che resta fra le righe è il regime fiscale.
  const confronto = Object.keys(PAESI)
    .map(n => {
      const pz = prezzoPerPaese(n) || (PAESI[n].valuta === c.valuta ? base.prezzoOggi : null);
      if (!pz) return null;
      const fattore = PAESI[n].valuta === c.valuta ? 1 : pz / base.prezzoOggi;
      const r = calcolaFabbisogno({
        ...base, paese: n, g: 0.10,
        spesaAnnua: base.spesaAnnua * fattore,
        prezzoOggi: pz,
        costoMedio: base.costoMedio * fattore,
      });
      return { n, btc: r.btcNecessari, eff: r.aliquotaEff, et: FISCO[n].etichetta };
    })
    .filter(Boolean)
    .sort((a, b) => a.btc - b.btc);
  const maxBtc = Math.max(...confronto.map(x => x.btc));
  const righeConfronto = confronto.map(x => `
    <tr class="${x.n === base.paese ? "tuo" : ""}">
      <td class="pa">${x.n}${x.n === base.paese ? " <span class='tag'>tu</span>" : ""}</td>
      <td class="reg">${x.et}</td>
      <td class="num">${fmtBTC(x.btc)}</td>
      <td class="viz">${barra(x.btc / maxBtc)}</td>
    </tr>`).join("");

  const paesiBox = `
    <section class="blocco">
      <h2>Stesso obiettivo, ${confronto.length} paesi</h2>
      <p class="intro">A parità di spesa, di età e di scenario, cambia solo il regime fiscale: fra il primo e l'ultimo della lista ballano <b>${fmtBTC(maxBtc - confronto[0].btc)} BTC</b>, il ${(100 * (maxBtc / confronto[0].btc - 1)).toFixed(0)}% in più. È il pezzo che i calcolatori americani non hanno.</p>
      <table class="tabella">
        <thead><tr><th>Paese</th><th>Regime</th><th class="num">BTC</th><th></th></tr></thead>
        <tbody>${righeConfronto}</tbody>
      </table>
      <p class="nota">Le spese sono convertite fra valute al prezzo di Bitcoin, così le righe differiscono solo per il fisco. Non è corretto per il diverso costo della vita: vivere a Lisbona costa meno che a Monaco, e questo confronto non lo dice.</p>
    </section>`;

  // — Scenari
  const cards = SCENARI.map(sc => {
    const r = calcolaFabbisogno({ ...base, g: sc.g });
    const anno = primoAnnoSufficiente({ ...base, g: sc.g }, stack);
    const cop = stack > 0 ? stack / r.btcNecessari : 0;
    const tenuta = testTenuta({ ...base, g: sc.g }, r.btcNecessari);
    return `
      <article class="scenario" style="--tono:${sc.tono}">
        <header>
          <h3>${sc.nome}</h3>
          <span class="cagr">${(sc.g * 100).toFixed(0)}%/anno</span>
        </header>
        <p class="scenario-cifra">${fmtBTC(r.btcNecessari)} <span>BTC</span></p>
        <p class="scenario-eq">${c.sym} ${fmt(r.btcNecessari * base.prezzoOggi)} ai prezzi di oggi · BTC a ${c.sym} ${fmt(r.prezzoPensione)} nel ${base.annoPensione}</p>
        <p class="scenario-desc">${sc.desc}</p>
        ${stack > 0 ? `
          <div class="cop">
            ${barra(cop)}
            <p>${fmtBTC(stack)} BTC coprono il <b>${fmtPct(cop)}</b>${anno ? ` · basterebbero dal <b>${anno}</b>` : " · non bastano entro i 100 anni"}</p>
          </div>` : ""}
        <p class="tenuta ${tenuta.regge ? "ok" : "ko"}">
          ${tenuta.regge
            ? `Regge un crollo del 70% nel ${base.annoPensione + base.annoShock}: restano ${fmtBTC(tenuta.btcResidui)} BTC alla fine.`
            : (() => {
                const serve = capitaleAntiCrollo({ ...base, g: sc.g }, r.btcNecessari);
                return `Un crollo del 70% nel ${base.annoPensione + base.annoShock} lo esaurisce a ${tenuta.etaRottura} anni.`
                  + (serve ? ` Per reggerlo servirebbero <b>${fmtBTC(serve)} BTC</b> (+${((serve / r.btcNecessari - 1) * 100).toFixed(0)}%).` : "");
              })()}
        </p>
      </article>`;
  }).join("");

  const scenariBox = `
    <section class="blocco">
      <h2>Quattro ipotesi, quattro numeri</h2>
      <p class="intro">Nessuno sa quanto crescerà Bitcoin. Il modo onesto di usarlo è decidere sull'ipotesi base e verificare di sopravvivere all'ipotesi peggiore.</p>
      <div class="scenari">${cards}</div>
    </section>`;

  // — Ipotesi in chiaro
  const ipotesi = `
    <section class="blocco piede">
      <h2>Che cosa ho assunto</h2>
      <ul class="ipotesi">
        <li><b>Orizzonte</b> — copre la spesa fino a ${ETA_MAX} anni: ${rBase.N} anni di prelievi da ${base.annoPensione} (a ${rBase.etaPensione} anni).</li>
        <li><b>Due fasi</b> — lo scenario vale per i primi ${base.anniFase1} anni, poi il rendimento reale scende a ${fmtPct(base.rFase2)}. Senza questo, l'annuity assume che Bitcoin renda il ${fmtPct(rBase.rReale)} reale anche quando avrai novant'anni.</li>
        <li><b>Inflazione ${base.paese}</b> — ${fmtPct(c.infl)} annuo, applicato sia prima sia durante la pensione.</li>
        <li><b>Imposta</b> — ${f.etichetta}${f.bollo ? `, più il bollo dello ${fmtPct(f.bollo)} annuo che erode il rendimento` : ""}. Si paga solo sulla differenza fra prezzo di vendita e prezzo di acquisto.</li>
        <li><b>Prelievo a inizio anno</b> — la spesa esce prima che il capitale lavori. Un anno di margine in più.</li>
        ${base.margine > 0 ? `<li><b>Margine di sicurezza</b> — +${(base.margine * 100).toFixed(0)}% sopra il fabbisogno calcolato.</li>` : ""}
      </ul>
      <p class="avvertenza">Il modello non prevede il futuro: mette in fila delle ipotesi. Cambiare la crescita dal 10% al 15% sposta il numero più di qualunque altra scelta in questa pagina, e la crescita è la sola cosa che non controlli. Non è consulenza finanziaria.</p>
    </section>`;

  $out.innerHTML = testa + fiscoBox + paesiBox + scenariBox + ipotesi;
  $out.classList.add("visibile");
  $out.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ------------------------------------------------------------
// Avvio
// ------------------------------------------------------------
aggiornaValuta();
caricaPrezzo();
$anno.value = NOW_YEAR + 15;
