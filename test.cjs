// Collaudo del motore: `node test.cjs`
// Estrae la parte pura di script.js (tutto quel che sta prima del DOM) e la prova.
const fs=require('fs'), path=require('path'), os=require('os');
const src=fs.readFileSync(path.join(__dirname,'script.js'),'utf8');
const tmp=path.join(os.tmpdir(),'ribtc-puro.cjs');
fs.writeFileSync(tmp, src.split('// Prezzo live')[0] +
 '\nmodule.exports={FISCO,PAESI,SCENARI,imposta,lordoPerNetto,fabbisognoSimulato,curvaDi,prezzoSantostasi,tettoSaturazione,crescitaIstantanea,testTenuta,capitaleAntiCrollo,primoAnnoSufficiente,fmtPct,cagrPowerLaw,prezzoPowerLaw,giorniDaGenesi,scartoDallaCurva};');
const M=require(tmp); Object.assign(globalThis,M);
let ko=0; const ok=(n,c,d='')=>{console.log((c?'  ok  ':'  KO  ')+n+(d?' · '+d:'')); if(!c)ko++;};
const base={paese:'Italia',eta:40,annoPensione:2041,spesaAnnua:18000,frequenza:0.5,prezzoOggi:54400,
 costoMedio:0,accumulaAncora:true,oltreUnAnno:true,margine:0.1,annoShock:2,inizioAnno:true,
 cambioUsd:54400/62900,quotaMax:0.10};
const scPL=SCENARI.find(s=>s.key==='powerlaw');
const fab=(o,sc)=>fabbisognoSimulato(o,curvaDi(o,sc)).btcNecessari;

console.log('\n--- 1. IMPOSTA ---');
ok('Italia: aliquota effettiva sotto il 33% nominale', lordoPerNetto('Italia',18000,200000,66000,true).aliquotaEff<0.33);
ok('Germania oltre 12 mesi: zero', lordoPerNetto('Germania',18000,200000,66000,true).lordo===18000);
ok('Portogallo oltre 365gg: zero', lordoPerNetto('Portogallo',18000,200000,66000,true).lordo===18000);
ok('Spagna a scaglioni fra 10% e 27%', (e=>e>0.10&&e<0.27)(lordoPerNetto('Spagna',18000,200000,66000,true).aliquotaEff));
ok('costo medio = prezzo -> nessuna imposta', lordoPerNetto('Italia',18000,100000,100000,true).lordo===18000);

console.log('\n--- 2. LEGGE DI POTENZA (Santostasi) ---');
const d0=giorniDaGenesi();
ok('esponente e coefficiente riproducono ~1M$ a 8 anni',
   (v=>v>0.9e6&&v<1.5e6)(prezzoPowerLaw(d0+8*365.25)), '$'+Math.round(prezzoPowerLaw(d0+8*365.25)/1e6*10)/10+'M');
ok('e ~10M$ a 20 anni', (v=>v>8e6&&v<14e6)(prezzoPowerLaw(d0+20*365.25)));
ok('la crescita DECADE col tempo (n/t)', crescitaIstantanea(d0)>crescitaIstantanea(d0+30*365.25));
ok('a 30 anni la crescita e circa 12%', Math.abs(crescitaIstantanea(d0+30*365.25)-0.119)<0.02);
ok('il tetto cresce ma resta finito', tettoSaturazione(60)<1e8 && tettoSaturazione(60)>tettoSaturazione(10));
const senza=prezzoSantostasi(54400,60,null), con=prezzoSantostasi(54400,60,54400/62900);
ok('il tetto morde sul lungo periodo', con<senza, 'con '+Math.round(con/1e6)+'M contro '+Math.round(senza/1e6)+'M');
ok('nel breve il tetto non morde', prezzoSantostasi(54400,3,54400/62900)===prezzoSantostasi(54400,3,null));

console.log('\n--- 3. IL MOTORE SIMULATO ---');
const pl=fab(base,scPL), fermo=fab({...base,g:0},null), base10=fab({...base,g:0.10},null);
console.log('     prezzo fermo '+fermo.toFixed(4)+' · base 10% '+base10.toFixed(4)+' · Santostasi '+pl.toFixed(4));
ok('piu crescita ipotizzi, meno BTC servono', fermo>base10 && base10>pl);
ok('la simulazione col tetto chiede piu della simulazione senza',
   fab(base,scPL) > fab({...base,quotaMax:1},scPL));
ok('spendere il doppio richiede circa il doppio',
   Math.abs(fab({...base,spesaAnnua:36000},scPL)/pl - 2)<0.15);
ok('prelevare 1 anno su 3 costa circa un terzo di prelevare ogni anno',
   Math.abs(fab({...base,frequenza:0.33},scPL)/fab({...base,frequenza:1},scPL)-0.33)<0.05);
ok('Italia costa piu della Germania', fab(base,scPL)>fab({...base,paese:'Germania'},scPL));
ok('il margine di sicurezza si vede', fab({...base,margine:0.3},scPL)>fab({...base,margine:0},scPL));

console.log('\n--- 4. TEST DI TENUTA ---');
const c=curvaDi({...base,g:0.10},null);
ok('un capitale minuscolo non regge', !testTenuta({...base,g:0.10},0.001,c).regge);
ok('un capitale enorme regge', testTenuta({...base,g:0.10},50,c).regge);
const r10=fab({...base,g:0.10},null);
const serve=capitaleAntiCrollo({...base,g:0.10},r10,c);
ok('capitaleAntiCrollo restituisce piu del fabbisogno', serve===null||serve>=r10);

console.log('\n--- 5. CONFRONTO FRA I SEI PAESI ---');
const tab=Object.keys(PAESI).map(n=>({n, v:fab({...base,paese:n},scPL)})).sort((a,b)=>a.v-b.v);
tab.forEach(x=>console.log('     '+x.n.padEnd(11)+x.v.toFixed(4)+' BTC'));
ok('nessun paese e fuori scala (max/min sotto 2)', tab[tab.length-1].v/tab[0].v<2,
   'rapporto '+(tab[tab.length-1].v/tab[0].v).toFixed(2));
ok('i due esenti sono i piu economici', ['Portogallo','Germania'].includes(tab[0].n)&&['Portogallo','Germania'].includes(tab[1].n));

console.log(ko===0?'\nTUTTI I CONTROLLI PASSATI\n':'\n'+ko+' CONTROLLI FALLITI\n');
process.exit(ko?1:0);
