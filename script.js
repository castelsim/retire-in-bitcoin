// ===================================================
// Pensione in BTC - Calcolatore multi-paese
// Modello: annuity reale con decumulo fino a 100 anni
// Prezzo live: CoinGecko API (nessuna chiave richiesta)
// Dati spesa: ISTAT 2025, Numbeo 2025, Eurostat 2025
// ===================================================

const NOW_YEAR = new Date().getFullYear();

// Dati paese: valuta, inflazione target, stili di vita (importo annuo/persona)
// Fonti: ISTAT 2025 (IT), Numbeo 2025, GlobalCitizenSolutions 2025, Eurostat
const COUNTRIES = {
  "Italia": {
    currency: "EUR", sym: "€",
    infl: 0.015,  // BCE 2026: +1.4% perequazione; BCE target 2%
    btcDefault: null, // sovrascritta da live price
    styles: { essenziale: 12000, base: 18000, confortevole: 28000 }
  },
  "Germania": {
    currency: "EUR", sym: "€",
    infl: 0.022,  // Destatis 2025: ~2.2%
    btcDefault: null,
    styles: { essenziale: 16000, base: 24000, confortevole: 34000 }
  },
  "Spagna": {
    currency: "EUR", sym: "€",
    infl: 0.020,  // INE 2025
    btcDefault: null,
    styles: { essenziale: 12000, base: 18000, confortevole: 26000 }
  },
  "Portogallo": {
    currency: "EUR", sym: "€",
    infl: 0.020,  // INE Portugal 2025
    btcDefault: null,
    styles: { essenziale: 10000, base: 15000, confortevole: 22000 }
  },
  "Francia": {
    currency: "EUR", sym: "€",
    infl: 0.018,  // INSEE 2025
    btcDefault: null,
    styles: { essenziale: 15000, base: 22000, confortevole: 32000 }
  },
  "Polonia": {
    currency: "PLN", sym: "zł",
    infl: 0.025,  // NBP target 2.5%
    btcDefault: null,
    styles: { essenziale: 19803, base: 24924, confortevole: 32400 }
  }
};

// Scenari CAGR nominale BTC — basati su modelli power-law e analisi storiche
// Fonte: Bitcoin Magazine CAGR Calculator, Unchained Retirement Calculator
const SCENARIOS = [
  { key: "Conservativo", g: 0.10, color: "#9bb0c6" },
  { key: "Base",         g: 0.20, color: "#ffd166" },
  { key: "Ottimista",   g: 0.30, color: "#06d6a0" }
];

// ---------- Helpers matematici
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const fmt = n => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(n);
const fmtBTC = n => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);
const fmtPct = x => `${(x * 100).toFixed(1)}%`;

function annuityFactor(r, N) {
  if (!isFinite(r) || Math.abs(r) < 1e-9) return N;
  return (1 - Math.pow(1 + r, -N)) / r;
}

function annuityDue(r, N, drawStart) {
  const aOrd = annuityFactor(r, N);
  return drawStart ? aOrd * (1 + r) : aOrd;
}

function piecewiseAnnuity(N, r1, r2, T, drawStart) {
  const n1 = Math.min(N, Math.max(0, T));
  const n2 = Math.max(0, N - n1);
  const a1 = annuityDue(r1, n1, drawStart);
  if (n2 === 0) return a1;
  const discount = Math.pow(1 + r1, -n1);
  const a2 = annuityDue(r2, n2, drawStart);
  return a1 + discount * a2;
}

function yearsInRetirement(ageNow, retYear) {
  const ageAtRet = ageNow + Math.max(0, retYear - NOW_YEAR);
  return Math.max(0, 100 - ageAtRet);
}

function calcNeedBTC(countryKey, ageNow, retYear, annualBudget, gCagr, btcNow, opts = {}) {
  const c = COUNTRIES[countryKey];
  const infl = c.infl;
  const N = yearsInRetirement(ageNow, retYear);
  const yearsToRet = Math.max(0, retYear - NOW_YEAR);
  const btcRet = btcNow * Math.pow(1 + gCagr, yearsToRet);
  const spendRet = annualBudget * Math.pow(1 + infl, yearsToRet);
  const rReal = (1 + gCagr) / (1 + infl) - 1;
  const drawStart = opts.drawStart ?? true;
  const twoStage = opts.twoStage ?? false;
  const stageYears = Math.max(0, Math.min(N, opts.stageYears ?? 15));
  const stage2Real = opts.stage2Real ?? 0.05;

  let a;
  if (twoStage && N > 0) {
    a = piecewiseAnnuity(N, rReal, stage2Real, stageYears, drawStart);
  } else {
    a = annuityDue(rReal, N, drawStart);
  }

  const btcNeeded = (spendRet * a) / btcRet;
  return { btcNeeded, N, rReal, spendRet, btcRet, yearsToRet };
}

// DCA mensile stimato per raggiungere il target
// Approssimazione: usa prezzo medio geometrico (sqrt tra ora e pensione)
function calcMonthlyDCA(btcNeeded, stack, btcNow, gCagr, yearsToRet) {
  if (yearsToRet <= 0) return null;
  const btcStillNeeded = Math.max(0, btcNeeded - (stack || 0));
  if (btcStillNeeded <= 0) return 0;
  const avgBtcPrice = btcNow * Math.pow(1 + gCagr, yearsToRet / 2);
  return (btcStillNeeded * avgBtcPrice) / (12 * yearsToRet);
}

// Primo anno in cui lo stack copre il fabbisogno
function earliestYearWithStack(countryKey, ageNow, retYear, annualBudget, gCagr, btcNow, stack, safety, opts) {
  if (!stack || stack <= 0) return null;
  for (let y = retYear; y <= 2100; y++) {
    const { btcNeeded } = calcNeedBTC(countryKey, ageNow, y, annualBudget, gCagr, btcNow, opts);
    if (stack >= btcNeeded * (1 + safety)) return y;
    if (ageNow + Math.max(0, y - NOW_YEAR) >= 100) break;
  }
  return null;
}

// ---------- Fetch prezzo live da CoinGecko
let livePrices = { eur: null, pln: null };

async function fetchLiveBTC() {
  const indicator = document.getElementById('priceIndicator');
  if (indicator) indicator.textContent = 'Aggiornamento prezzo...';
  try {
    const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur,pln');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    livePrices.eur = data.bitcoin.eur;
    livePrices.pln = data.bitcoin.pln;
    updateBtcInputFromLive();
    if (indicator) indicator.textContent = `Live ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (e) {
    if (indicator) indicator.textContent = 'Prezzo offline';
    // Fallback
    livePrices.eur = 95000;
    livePrices.pln = 405000;
    updateBtcInputFromLive();
  }
}

function getLiveBtcForCountry(countryKey) {
  const c = COUNTRIES[countryKey];
  if (c.currency === 'PLN') return livePrices.pln || 405000;
  return livePrices.eur || 95000;
}

function updateBtcInputFromLive() {
  const country = $country.value;
  const price = getLiveBtcForCountry(country);
  if (price && $btcNow) $btcNow.value = price;
}

// ---------- DOM refs
const $country    = document.getElementById('country');
const $age        = document.getElementById('age');
const $ageVal     = document.getElementById('ageVal');
const $retYear    = document.getElementById('retYear');
const $lifestyle  = document.getElementById('lifestyle');
const $customRow  = document.getElementById('customRow');
const $customAnnual = document.getElementById('customAnnual');
const $btcNow     = document.getElementById('btcNow');
const $drawStart  = document.getElementById('drawStart');
const $safety     = document.getElementById('safety');
const $twoStage   = document.getElementById('twoStage');
const $twoStageRows = document.getElementById('twoStageRows');
const $stageYears = document.getElementById('stageYears');
const $stage2Real = document.getElementById('stage2Real');
const $curSym     = document.getElementById('curSym');
const $curSymBtc  = document.getElementById('curSymBtc');
const $stack      = document.getElementById('stack');
const $form       = document.getElementById('planner');
const $kpi        = document.getElementById('kpi');
const $cards      = document.getElementById('cards');

// Popola paesi
Object.keys(COUNTRIES).forEach(name => {
  const opt = document.createElement('option');
  opt.value = name; opt.textContent = name;
  $country.appendChild(opt);
});
$country.value = 'Italia';

function refreshCurrencyUI() {
  const c = COUNTRIES[$country.value];
  $curSym.textContent = c.sym;
  $curSymBtc.textContent = c.sym;
  $btcNow.value = getLiveBtcForCountry($country.value);
  updateCustomPlaceholder();
}

function updateCustomPlaceholder() {
  const c = COUNTRIES[$country.value];
  if (!c || !$customAnnual) return;
  $customAnnual.placeholder = `es. ${c.sym} ${fmt(c.styles.base)}`;
}

function onLifestyleChange() {
  $customRow.classList.toggle('hidden', $lifestyle.value !== 'custom');
  if ($lifestyle.value !== 'custom' && $customAnnual) {
    $customAnnual.removeAttribute('aria-invalid');
  }
}

$age.addEventListener('input', () => { $ageVal.textContent = $age.value; });
$country.addEventListener('change', refreshCurrencyUI);
$lifestyle.addEventListener('change', onLifestyleChange);
$twoStage.addEventListener('change', () => {
  $twoStageRows.classList.toggle('hidden', !$twoStage.checked);
});

refreshCurrencyUI();
onLifestyleChange();

// Fetch prezzo all'avvio
fetchLiveBTC();

// ---------- Submit
$form.addEventListener('submit', e => {
  e.preventDefault();
  const country   = $country.value;
  const c         = COUNTRIES[country];
  const age       = parseInt($age.value, 10);
  const retYear   = clamp(parseInt($retYear.value, 10) || NOW_YEAR, NOW_YEAR, 2100);
  const btcNow    = parseFloat($btcNow.value);
  const stack     = parseFloat($stack.value) || 0;
  const drawStart = $drawStart.checked;
  const safety    = parseFloat($safety.value || '0');
  const twoStage  = $twoStage.checked;
  const stageYears = parseInt($stageYears.value || '15', 10);
  const stage2Real = parseFloat($stage2Real.value || '5') / 100;

  let annualBudget;
  if ($lifestyle.value === 'custom') {
    annualBudget = parseFloat($customAnnual.value || '0');
    const bad = !Number.isFinite(annualBudget) || annualBudget <= 0;
    $customAnnual.setAttribute('aria-invalid', bad ? 'true' : 'false');
  } else {
    annualBudget = c.styles[$lifestyle.value];
  }

  if (!Number.isFinite(annualBudget) || annualBudget <= 0) {
    $cards.innerHTML = '<p class="ko">Importo annuo non valido.</p>';
    return;
  }

  const yearsToRet = Math.max(0, retYear - NOW_YEAR);
  const ageAtRet   = age + yearsToRet;
  const N          = yearsInRetirement(age, retYear);
  const opts       = { drawStart, twoStage, stageYears, stage2Real };

  // KPI
  $kpi.innerHTML = `
    <div class="pill"><strong>Paese:</strong> ${country}</div>
    <div class="pill"><strong>Eta:</strong> ${age} anni</div>
    <div class="pill"><strong>Pensione:</strong> ${retYear} (eta ${ageAtRet})</div>
    <div class="pill"><strong>Orizzonte:</strong> ${N} anni (fino a 100)</div>
    <div class="pill"><strong>Budget:</strong> ${c.sym} ${fmt(annualBudget)}/anno</div>
    <div class="pill"><strong>BTC oggi:</strong> ${c.sym} ${fmt(btcNow)}</div>
    <div class="pill"><strong>Inflazione ${country}:</strong> ${fmtPct(c.infl)}</div>
    ${safety > 0 ? `<div class="pill"><strong>Safety:</strong> +${Math.round(safety * 100)}%</div>` : ''}
  `;

  // Stack progress (rispetto allo scenario base)
  if (stack > 0) {
    const { btcNeeded: baseNeed } = calcNeedBTC(country, age, retYear, annualBudget, SCENARIOS[1].g, btcNow, opts);
    const baseNeedSafe = baseNeed * (1 + safety);
    const pct = Math.min(100, (stack / baseNeedSafe) * 100);
    $kpi.innerHTML += `
      <div class="progress-wrap">
        <div class="progress-label">Il tuo stack (${fmtBTC(stack)} BTC) copre il <strong>${pct.toFixed(1)}%</strong> del target scenario Base</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }

  // Cards scenari
  $cards.innerHTML = SCENARIOS.map(sc => {
    const { btcNeeded, rReal, spendRet, btcRet, yearsToRet: yRet } = calcNeedBTC(
      country, age, retYear, annualBudget, sc.g, btcNow, opts
    );
    const btcNeededSafe = btcNeeded * (1 + safety);

    // DCA mensile stimato
    const dca = calcMonthlyDCA(btcNeededSafe, stack, btcNow, sc.g, yearsToRet);
    const dcaLine = dca === null ? '' :
      dca === 0 ? `<div class="ok meta">Stack sufficiente - DCA non necessario</div>` :
      `<div class="meta dca-line">DCA stimato: <strong>${c.sym} ${fmt(dca)}/mese</strong> <span class="hint-dca">(prezzo medio stimato)</span></div>`;

    // Stack analysis
    let stackLine = '';
    if (stack > 0) {
      const when = earliestYearWithStack(country, age, retYear, annualBudget, sc.g, btcNow, stack, safety, opts);
      if (when === retYear) {
        stackLine = `<div class="ok">Sei gia pensionabile nel ${retYear} con ${fmtBTC(stack)} BTC.</div>`;
      } else if (when) {
        stackLine = `<div class="meta">Con ${fmtBTC(stack)} BTC: pensionabile dal <strong>${when}</strong>.</div>`;
      } else {
        stackLine = `<div class="ko meta">Stack insufficiente in questo scenario entro i 100 anni.</div>`;
      }
    }

    return `
      <div class="card-scenario" style="--accent-sc:${sc.color}">
        <div class="scenario-header">
          <h3>${sc.key}</h3>
          <span class="cagr-badge">${(sc.g * 100).toFixed(0)}% CAGR</span>
        </div>
        <div class="big">${fmtBTC(btcNeededSafe)} BTC</div>
        <div class="meta">${c.sym} ${fmt(btcNeededSafe * btcNow)} oggi &middot; ${c.sym} ${fmt(btcNeededSafe * btcRet)} a ${retYear}</div>
        <div class="meta">Spesa ${retYear}: ${c.sym} ${fmt(spendRet)} &middot; P<sub>BTC</sub>: ${c.sym} ${fmt(btcRet)}</div>
        <div class="meta">r reale: ${fmtPct(rReal)}</div>
        ${dcaLine}
        ${stackLine}
      </div>
    `;
  }).join('');

  // Disclaimer dinamico
  document.getElementById('disclaimerInfl').textContent =
    `Inflazione ${country}: ${fmtPct(c.infl)} (fonte: BCE/Eurostat 2025). CAGR BTC: 10% / 20% / 30%. Non e consulenza finanziaria.`;
});
