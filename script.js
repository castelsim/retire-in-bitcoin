// ================================
// Pensione in BTC – Italia & Polonia (MVP realistico)
// Modello: annuity reale con decumulo fino a 100 anni
// ================================

const NOW_YEAR = new Date().getFullYear();

// Dati paese (valute, inflazione target, prezzo BTC di base, stili di vita annui per persona)
const COUNTRIES = {
  "Italia": {
    currency: "EUR",
    infl: 0.02, // target BCE
    btcNow: 102000, // default, modificabile da UI
    styles: {
      essenziale: 12889,     // €/anno
      base: 23664,
      confortevole: 34419
    }
  },
  "Polonia": {
    currency: "PLN",
    infl: 0.025, // target NBP 2.5% ±1pp
    btcNow: 431000, // default, modificabile da UI
    styles: {
      essenziale: 19803,     // PLN/anno
      base: 24924,
      confortevole: 32400
    }
  }
};

const CUR_SYM = { EUR: "€", PLN: "zł" };

// Tre scenari di crescita BTC (CAGR nominale)
const SCENARIOS = [
  { key: "Conservativo", g: 0.10 },
  { key: "Base",         g: 0.20 },
  { key: "Aggressivo",   g: 0.30 }
];

// ---------- Helpers
const clamp = (x,min,max)=>Math.max(min,Math.min(max,x));
const fmt = (n)=> new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(n);
const fmtBTC = (n)=> new Intl.NumberFormat('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);
const fmtPct = (x)=> `${(x*100).toFixed(2)}%`;

function updateCustomPlaceholder(){
  const c = COUNTRIES[$country.value];
  if (!c) return;
  const sym = CUR_SYM[c.currency];
  const sugg = c.styles?.base;
  if (sugg && $customAnnual){
    $customAnnual.placeholder = `es. ${sym} ${fmt(sugg)}`;
  }
}

function annuityFactor(r, N){
  if (!isFinite(r) || Math.abs(r) < 1e-9) return N; // approssima a N se r≈0
  return (1 - Math.pow(1+r, -N)) / r;
}

function annuityDue(r, N, drawStart){
  const aOrd = annuityFactor(r, N);
  return drawStart ? aOrd * (1 + r) : aOrd; // inizio anno vs fine anno
}

function piecewiseAnnuity(N, r1, r2, T, drawStart){
  const n1 = Math.min(N, Math.max(0, T));
  const n2 = Math.max(0, N - n1);
  const a1 = annuityDue(r1, n1, drawStart);
  if (n2 === 0) return a1;
  const discount = Math.pow(1 + r1, -n1);
  const a2 = annuityDue(r2, n2, drawStart);
  return a1 + discount * a2;
}

function yearsInRetirement(ageNow, retYear){
  const yearsToRet = Math.max(0, retYear - NOW_YEAR);
  const ageAtRet = ageNow + yearsToRet;
  return Math.max(0, 100 - ageAtRet);
}

function calcNeedBTC(countryKey, ageNow, retYear, annualBudget, gCagr, btcNowOverride, opts = {}){
  const c = COUNTRIES[countryKey];
  const infl = c.infl;
  const btcNow = (Number.isFinite(btcNowOverride) && btcNowOverride > 0) ? btcNowOverride : c.btcNow;
  const N = yearsInRetirement(ageNow, retYear);
  const yearsToRet = Math.max(0, retYear - NOW_YEAR);

  // Prezzo BTC all'anno di pensione (nominale)
  const btcRet = btcNow * Math.pow(1 + gCagr, yearsToRet);

  // Spesa annua all'anno di pensione (nominale)
  const spendRet = annualBudget * Math.pow(1 + infl, yearsToRet);

  // Rendimento reale (BTC vs inflazione del paese)
  const rReal = (1 + gCagr) / (1 + infl) - 1;

  const drawStart = opts.drawStart ?? true;
  const twoStage = opts.twoStage ?? false;
  const stageYears = Math.max(0, Math.min(N, opts.stageYears ?? 15));
  const stage2Real = (opts.stage2Real ?? 0.05); // 5% reale di default

  let a; let r2 = rReal;
  if (twoStage && N > 0){
    r2 = stage2Real; // rendimento reale fase 2
    a = piecewiseAnnuity(N, rReal, r2, stageYears, drawStart);
  } else {
    a = annuityDue(rReal, N, drawStart);
  }

  const btcNeeded = (spendRet * a) / btcRet;
  return { btcNeeded, N, rReal, rReal2: r2, spendRet, btcRet, a };
}

// Trova il primo anno >= retYear in cui lo stack copre il fabbisogno
function earliestYearWithStack(countryKey, ageNow, retYear, annualBudget, gCagr, btcNow, stack){
  if (!stack || stack <= 0) return null;
  let y = retYear;
  for (; y <= 2100; y++){
    const { btcNeeded } = calcNeedBTC(countryKey, ageNow, y, annualBudget, gCagr, btcNow);
    if (stack >= btcNeeded) return y;
    // Stop se ormai l'età a y è già >=100: oltre non si va
    const yearsToY = Math.max(0, y - NOW_YEAR);
    const ageAtY = ageNow + yearsToY;
    if (ageAtY >= 100) break;
  }
  return null;
}

// ---------- UI wiring
const $country = document.getElementById('country');
const $age = document.getElementById('age');
const $ageVal = document.getElementById('ageVal');
const $retYear = document.getElementById('retYear');
const $lifestyle = document.getElementById('lifestyle');
const $customRow = document.getElementById('customRow');
const $customAnnual = document.getElementById('customAnnual');
const $btcNow = document.getElementById('btcNow');
const $drawStart = document.getElementById('drawStart');
const $drawEnd = document.getElementById('drawEnd');
const $safety = document.getElementById('safety');
const $twoStage = document.getElementById('twoStage');
const $twoStageRows = document.getElementById('twoStageRows');
const $stageYears = document.getElementById('stageYears');
const $stage2Real = document.getElementById('stage2Real');
const $curSym = document.getElementById('curSym');
const $curSymBtc = document.getElementById('curSymBtc');
const $stack = document.getElementById('stack');
const $form = document.getElementById('planner');
const $kpi = document.getElementById('kpi');
const $cards = document.getElementById('cards');

// Popola paesi
Object.keys(COUNTRIES).forEach(name=>{
  const opt = document.createElement('option');
  opt.value = name; opt.textContent = name;
  $country.appendChild(opt);
});
$country.value = 'Italia';

function refreshCurrencyUI(){
  const c = COUNTRIES[$country.value];
  const sym = CUR_SYM[c.currency];
  $curSym.textContent = sym;
  $curSymBtc.textContent = sym;
  $btcNow.value = c.btcNow;
  updateCustomPlaceholder();
}

function onLifestyleChange(){
  $customRow.classList.toggle('hidden', $lifestyle.value !== 'custom');
  if ($lifestyle.value === 'custom'){
    updateCustomPlaceholder();
    // reset stato validazione al cambio modalità
    $customAnnual.setAttribute('aria-invalid', 'false');
  } else {
    if ($customAnnual) $customAnnual.removeAttribute('aria-invalid');
  }
}

$age.addEventListener('input', ()=>{ $ageVal.textContent = $age.value; });
$country.addEventListener('change', ()=>{ refreshCurrencyUI(); });
$lifestyle.addEventListener('change', onLifestyleChange);

$twoStage.addEventListener('change', ()=>{
  $twoStageRows.classList.toggle('hidden', !$twoStage.checked);
});

refreshCurrencyUI();
onLifestyleChange();

$form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const country = $country.value;
  const age = parseInt($age.value,10);
  const retYear = clamp(parseInt($retYear.value,10)||NOW_YEAR, NOW_YEAR, 2100);
  const btcNow = parseFloat($btcNow.value);
  const stack = parseFloat($stack.value);

  const drawStart = $drawStart.checked; // true=inizio anno, false=fine anno
  const safety = parseFloat($safety.value || '0');
  const twoStage = $twoStage.checked;
  const stageYears = parseInt($stageYears.value||'15',10);
  const stage2Real = (parseFloat($stage2Real.value||'5')/100); // da % a quota

  const styles = COUNTRIES[country].styles;
  const sym = CUR_SYM[COUNTRIES[country].currency];

  let annualBudget;
  if ($lifestyle.value === 'custom'){
    annualBudget = parseFloat($customAnnual.value||'0');
  } else {
    annualBudget = styles[$lifestyle.value];
  }

  // Validazione UI per campo custom
  if ($lifestyle.value === 'custom'){
    const bad = !Number.isFinite(annualBudget) || annualBudget <= 0;
    $customAnnual.setAttribute('aria-invalid', bad ? 'true' : 'false');
  }

  if (!Number.isFinite(annualBudget) || annualBudget <= 0){
    $cards.innerHTML = '<p class="ko">Importo annuo non valido. Inserisci un numero positivo.</p>';
    return;
  }

  // KPI pill
  const yearsToRet = Math.max(0, retYear - NOW_YEAR);
  const ageAtRet = age + yearsToRet;
  const N = yearsInRetirement(age, retYear);
  $kpi.innerHTML = `
    <div class="pill"><strong>Paese:</strong> ${country}</div>
    <div class="pill"><strong>Età:</strong> ${age}</div>
    <div class="pill"><strong>Pensione:</strong> ${retYear} (età ${ageAtRet})</div>
    <div class="pill"><strong>Orizzonte:</strong> ${N} anni (fino a 100)</div>
    <div class="pill"><strong>Stile:</strong> ${$lifestyle.options[$lifestyle.selectedIndex].text}</div>
    <div class="pill"><strong>Budget annuo:</strong> ${sym} ${fmt(annualBudget)}</div>
  `;
  $kpi.innerHTML += `
    <div class="pill"><strong>Prelievi:</strong> ${drawStart? 'Inizio anno' : 'Fine anno'}</div>
    <div class="pill"><strong>Safety:</strong> ${Math.round(safety*100)}%</div>
    ${twoStage? `<div class="pill"><strong>Doppio rendimento:</strong> ${stageYears} anni → ${(stage2Real*100).toFixed(1)}% reale</div>` : ''}
  `;

  // Costruisci le 3 card scenario
  const cardsHTML = SCENARIOS.map(sc => {
    const { btcNeeded, rReal, rReal2, spendRet, btcRet } = calcNeedBTC(
      country, age, retYear, annualBudget, sc.g, btcNow,
      { drawStart, twoStage, stageYears, stage2Real }
    );
    const btcNeededSafe = btcNeeded * (1 + safety);
    const drawTxt = drawStart ? 'inizio' : 'fine';
    const rInfo = twoStage ? `r1 ${fmtPct(rReal)}, r2 ${fmtPct(rReal2)} per ${Math.min(stageYears, yearsInRetirement(age, retYear))} anni` : `r reale ${fmtPct(rReal)}`;
    const line2 = `<div class="meta">CAGR BTC ${(sc.g*100).toFixed(0)}% • ${rInfo} • prelievo ${drawTxt} anno</div>`;
    const line3 = `<div class="meta">Spesa annua a ${retYear}: ${sym} ${fmt(spendRet)} • Prezzo BTC stimato: ${sym} ${fmt(btcRet)}${safety>0? ` • safety +${Math.round(safety*100)}%` : ''}</div>`;

    let stackLine = '';
    if (Number.isFinite(stack) && stack > 0){
      const when = (function(){
        // Cerca l'anno in cui lo stack copre anche il margine di sicurezza
        let y = retYear;
        for (; y <= 2100; y++){
          const { btcNeeded: need } = calcNeedBTC(country, age, y, annualBudget, sc.g, btcNow, { drawStart, twoStage, stageYears, stage2Real });
          if (stack >= need * (1 + safety)) return y;
          const yearsToY = Math.max(0, y - NOW_YEAR);
          if (age + yearsToY >= 100) break;
        }
        return null;
      })();
      if (when === retYear){
        stackLine = `<div class="ok">Con i tuoi ${fmtBTC(stack)} BTC sei già pensionabile nel ${retYear}.</div>`;
      } else if (when){
        stackLine = `<div>Con ${fmtBTC(stack)} BTC diventi pensionabile dal <strong>${when}</strong>.</div>`;
      } else {
        stackLine = `<div class="ko">Con ${fmtBTC(stack)} BTC non diventi pensionabile entro i 100 anni in questo scenario.</div>`;
      }
    }

    return `
      <div class="card-scenario">
        <h3>${sc.key}</h3>
        <div class="big">≈ ${fmtBTC(btcNeededSafe)} BTC</div>
        ${line2}
        ${line3}
        ${stackLine}
      </div>
    `;
  }).join('');

  $cards.innerHTML = cardsHTML;
  updateCustomPlaceholder();
});