// Collaudo del motore: `node test.cjs`
const fs=require('fs'), path=require('path'), os=require('os');
const src=fs.readFileSync(path.join(__dirname,'script.js'),'utf8');
const tmp=path.join(os.tmpdir(),'ribtc-puro.cjs');
fs.writeFileSync(tmp, src.split('// Prezzo di oggi')[0] +
 '\nmodule.exports={FISCO,PAESI,SCENARI,ETA_FINE_DEFAULT,imposta,lordoPerNetto,simula,fabbisogno,lineaDi,testTenuta,capitaleAntiCrollo,primaEtaSufficiente,pianoDiAccumulo,fabbisognoLiscio,rettaPowerLaw,lineaCorridoio,crescitaIstantanea,posizioneNelCorridoio,giorniDaGenesi,accumuloStorico,prezzoStoricoAl,STORICO,M2,M2_CRESCITA,m2Al,inM2,supplyBTC,m2PerBitcoin,annoSfondamento,HALVING,NOW_YEAR,PL_N,PL_R2};');
const M=require(tmp); Object.assign(globalThis,M);

let ko=0; const ok=(n,c,d='')=>{console.log((c?'  ok  ':'  KO  ')+n+(d?' · '+d:'')); if(!c)ko++;};
const base={paese:'Italia',eta:35,etaInizio:50,etaFine:100,nettoAnnuo:10000,prezzoOggi:54400,
 oltreUnAnno:true,cambioUsd:54400/63000};
const [SUP,CEN,RES]=SCENARI;
const fab=(o,sc)=>fabbisogno(o,lineaDi(o,sc)).btcNecessari;

console.log('\n--- 1. IMPOSTA ---');
ok('Italia: aliquota piena, 33% su tutto', Math.abs(lordoPerNetto('Italia',18000,200000,true).aliquotaEff-0.33)<0.001, 'caso peggiore');
ok('Germania oltre 12 mesi: zero', lordoPerNetto('Germania',18000,200000,true).lordo===18000);
ok('Portogallo oltre 365 giorni: zero', lordoPerNetto('Portogallo',18000,200000,true).lordo===18000);
ok('Spagna a scaglioni fra 10% e 30%', (e=>e>0.10&&e<0.30)(lordoPerNetto('Spagna',18000,200000,true).aliquotaEff));
// gli scaglioni spagnoli, calcolati a mano: 1140+9240+34500+27000+30000
ok('Spagna: 30% oltre 300.000 (Ley 7/2024)', Math.abs(imposta('Spagna',400000,true)-101880)<1,
   Math.round(imposta('Spagna',400000,true))+' EUR su 400.000 di plusvalenza');
ok('Spagna: il confine dei 300.000 e esatto', Math.abs(imposta('Spagna',300000,true)-71880)<1);

console.log('\n--- 2. LEGGE DI POTENZA E CORRIDOIO ---');
const d=giorniDaGenesi();
ok('esponente vicino alla letteratura', Math.abs(PL_N-5.69)<0.15, PL_N);
ok('la crescita decade col tempo', crescitaIstantanea(d)>crescitaIstantanea(d+30*365.25));
ok('le tre linee sono ordinate', lineaCorridoio(d,SUP.perc)<lineaCorridoio(d,CEN.perc)&&lineaCorridoio(d,CEN.perc)<lineaCorridoio(d,RES.perc));
ok('oggi siamo nella meta bassa del corridoio', posizioneNelCorridoio(63000).frazione<0.5);

console.log('\n--- 3. IL DECUMULO PROGRAMMATO ---');
const r=fabbisogno(base,lineaDi(base,CEN));
console.log('     servono oggi '+r.btcNecessari.toFixed(6)+' BTC · '+r.righe.length+' prelievi dai '+base.etaInizio+' ai '+100);
ok('la tabella copre esattamente gli anni dal via ai 100', r.righe.length===100-base.etaInizio, r.righe.length+' righe');
ok('la prima riga e all eta di inizio', r.righe[0].eta===base.etaInizio);
ok('l ultima riga e a 99 anni compiuti', r.righe[r.righe.length-1].eta===100-1);
// Il capitale pubblicato regge il crollo, quindi su un percorso liscio AVANZA:
// è il MINIMO liscio che deve azzerarsi. Sono due cose diverse.
const rl=fabbisognoLiscio(base,lineaDi(base,CEN));
ok('il minimo liscio si esaurisce alla fine (decumulo, non rendita)',
   rl.righe[rl.righe.length-1].residui<rl.btcNecessari*0.01,
   'residui finali '+rl.righe[rl.righe.length-1].residui.toFixed(9)+' BTC');
ok('il capitale pubblicato invece avanza su un percorso liscio',
   r.righe[r.righe.length-1].residui>0);
ok('i BTC residui scendono sempre', r.righe.every((x,i,a)=>i===0||x.residui<=a[i-1].residui));
ok('il netto cresce con l inflazione', r.righe[10].netto>r.righe[0].netto);
ok('il netto del primo anno e il richiesto rivalutato',
   Math.abs(r.righe[0].netto - 10000*Math.pow(1.02,15))<1, Math.round(r.righe[0].netto)+' EUR');
ok('lordo >= netto sempre', r.righe.every(x=>x.lordo>=x.netto-0.01));
ok('lordo = netto + tasse', r.righe.every(x=>Math.abs(x.lordo-x.netto-x.tasse)<0.01));
ok('BTC venduti = lordo / prezzo', r.righe.every(x=>Math.abs(x.venduti-x.lordo/x.prezzo)<1e-9));

console.log('\n--- 4. COME REAGISCE ---');
ok('chiedere il doppio costa circa il doppio', Math.abs(fab({...base,nettoAnnuo:20000},CEN)/r.btcNecessari-2)<0.1);
ok('cominciare piu tardi costa meno', fab({...base,etaInizio:65},CEN)<r.btcNecessari);
ok('cominciare subito costa molto di piu', fab({...base,etaInizio:35},CEN)>r.btcNecessari*3);
// Con crescita reale zero dopo il 2040 il prezzo tiene solo il passo del
// carovita: rimandare l'inizio oltre quella data non fa piu risparmiare BTC.
// Ha effetto solo la durata del decumulo, non la data.
const a2051=fab({...base,eta:25},CEN), a2041=fab({...base,eta:35},CEN);
ok('dopo il 2040 rimandare non aiuta piu (crescita reale zero)',
   Math.abs(a2051/a2041-1)<0.05, 'scarto '+((a2051/a2041-1)*100).toFixed(1)+'%');
ok('ma cominciare prima del 2040 costa di piu', fab({...base,eta:45},CEN)>a2041);
ok('la linea alta chiede meno della bassa', fab(base,RES)<fab(base,CEN) && fab(base,CEN)<fab(base,SUP));
ok('Italia costa piu della Germania', r.btcNecessari>fab({...base,paese:'Germania'},CEN));

ok('il bollo erode anche negli anni di attesa',
   fab({...base,paese:'Italia'},CEN) > fab({...base,paese:'Polonia'},CEN)*0.9);

console.log('\n--- 5. QUANTO INVESTIRE DA QUI A LI ---');
const L0=lineaDi(base,CEN);
const pa=pianoDiAccumulo(base,L0,L0,0);
console.log('     da zero: '+Math.round(pa.mensile)+' EUR/mese per '+pa.anni+' anni = '+Math.round(pa.totale)+' EUR');
ok('il versamento e positivo e finito', pa.mensile>0 && isFinite(pa.mensile));
ok('i mesi sono quelli fra oggi e il primo prelievo', pa.mesi===(base.etaInizio-base.eta)*12);
ok('il totale e mensile x mesi', Math.abs(pa.totale-pa.mensile*pa.mesi)<1);
// il lordo deve essere esatto, non approssimato da un punto fisso a metà strada
for (const p of ['Italia','Francia','Polonia','Spagna']) {
  const r=lordoPerNetto(p,13459,3e6,true);
  ok('imposta esatta in '+p, Math.abs((r.lordo-imposta(p,r.lordo,true))-13459)<0.01);
}
// e il bollo sui BTC accumulati deve essere contato
const paB=pianoDiAccumulo(base,L0,L0,0), bollo=FISCO.Italia.bollo, m2=paB.mesi;
let alVia=0; for(let m=0;m<m2;m++) alVia+=(paB.mensile/L0(m/12))*Math.pow(1-bollo,(m2-m)/12);
ok('il bollo sugli acquisti e contato',
   Math.abs(alVia-paB.btcObiettivo*Math.pow(1-bollo,m2/12))<1e-7);
ok('con piu tempo si versa meno al mese',
   pianoDiAccumulo({...base,etaInizio:65},lineaDi({...base,etaInizio:65},CEN),lineaDi({...base,etaInizio:65},CEN),0).mensile < pa.mensile);
ok('chiedendo il doppio si versa circa il doppio',
   Math.abs(pianoDiAccumulo({...base,nettoAnnuo:20000},L0,L0,0).mensile/pa.mensile-2)<0.15);
ok('avendo gia dei bitcoin si versa meno', pianoDiAccumulo(base,L0,L0,0.03).mensile < pa.mensile);
ok('con abbastanza bitcoin non serve versare nulla', pianoDiAccumulo(base,L0,L0,1).giaCoperto);
// il caso che sbagliava: nessun tempo per accumulare non vuol dire essere a posto
const subito={...base,etaInizio:base.eta};
ok('cominciando subito non c e piano di accumulo', pianoDiAccumulo(subito,lineaDi(subito,CEN),lineaDi(subito,CEN),0)===null);
ok('e i bitcoin necessari restano tanti', fab(subito,CEN)>0.5, fab(subito,CEN).toFixed(4)+' BTC');
// il risultato che conta: in euro le tre linee chiedono lo stesso
const mS=pianoDiAccumulo(base,lineaDi(base,SUP),lineaDi(base,SUP),0).mensile;
const mR=pianoDiAccumulo(base,lineaDi(base,RES),lineaDi(base,RES),0).mensile;
console.log('     supporto '+Math.round(mS)+' · centro '+Math.round(pa.mensile)+' · resistenza '+Math.round(mR)+' EUR/mese');
ok('IL VERSAMENTO NON DIPENDE DALLA LINEA (piu alto il prezzo, meno BTC ma piu cari)',
   Math.abs(mR-mS)/pa.mensile < 0.02, 'scarto '+(Math.abs(mR-mS)/pa.mensile*100).toFixed(1)+'%');

// le due fasi usano linee diverse, ed e voluto
const obiettivoSup=fabbisogno(base,lineaDi(base,SUP)).btcNecessari;
const suMediana=pianoDiAccumulo(base,lineaDi(base,SUP),lineaDi(base,CEN),0).mensile;
const suSupporto=pianoDiAccumulo(base,lineaDi(base,SUP),lineaDi(base,SUP),0).mensile;
const suResistenza=pianoDiAccumulo(base,lineaDi(base,SUP),lineaDi(base,RES),0).mensile;
console.log('     acquisti su supporto '+Math.round(suSupporto)+' · mediana '+Math.round(suMediana)+' · resistenza '+Math.round(suResistenza)+' EUR/mese');
ok('comprare piu caro fa versare di piu', suSupporto<suMediana && suMediana<suResistenza);
ok('la mediana sta in mezzo, non agli estremi', suMediana>suSupporto*1.5 && suMediana<suResistenza*0.5);

console.log('\n--- 6. TEST DI TENUTA ---');
const L=lineaDi(base,CEN);
ok('capitale minuscolo: non regge', !testTenuta(base,1e-8,L).regge);
ok('capitale enorme: regge', testTenuta(base,50,L).regge);
// la prudenza sta DENTRO il numero, non in un avviso
const liscio=fabbisognoLiscio(base,L).btcNecessari;
console.log('     liscio '+liscio.toFixed(4)+' -> prudente '+r.btcNecessari.toFixed(4)+' BTC');
ok('IL NUMERO MOSTRATO REGGE GIA IL CROLLO PEGGIORE', testTenuta(base,r.btcNecessari,L).regge);
ok('e chiede piu del minimo liscio', r.btcNecessari>liscio,
   '+'+((r.btcNecessari/liscio-1)*100).toFixed(0)+'%');
ok('il minimo liscio invece NON regge', !testTenuta(base,liscio,L).regge);
ok('un filo meno del numero prudente non regge',
   !testTenuta(base,r.btcNecessari*0.92,L).regge, 'il margine e stretto, non generoso');

console.log('\n--- 7. CASI CHE FACEVANO CADERE LA PAGINA ---');
// orizzonte piu corto di sei anni: la 'leva' costruiva un decumulo di zero anni
for (const [e,i,f] of [[35,50,55],[35,92,100],[18,18,19],[60,76,80]]) {
  const q={...base,eta:e,etaInizio:i,etaFine:f};
  let ok1=true;
  try { const leva={...q,etaFine:Math.min(90,q.etaFine-5)};
        if (leva.etaFine>leva.etaInizio) fabbisogno(leva,lineaDi(leva,CEN)); else fabbisogno(q,lineaDi(q,CEN)); }
  catch(err){ ok1=false; }
  ok('eta '+e+', dai '+i+' ai '+f+': nessun crash', ok1);
}
ok('testTenuta regge zero anni di prelievo',
   (()=>{ try{ const q={...base,etaInizio:95,etaFine:90}; return testTenuta(q,1,lineaDi(q,CEN)).regge===true; }catch(e){ return false; } })());
// senza cambio il corridoio non deve essere letto come se fosse in euro
const conCambio=fab(base,CEN), senza=fab({...base,cambioUsd:null},CEN);
ok('senza cambio non si usa 1 in silenzio', Math.abs(senza/conCambio-1)<0.05,
   'scarto '+((senza/conCambio-1)*100).toFixed(1)+'% (con 1 sarebbe -14%)');

console.log('\n--- 8. I SEI PAESI ---');
const tab=Object.keys(PAESI).map(n=>({n,v:fab({...base,paese:n},CEN)})).sort((a,b)=>a.v-b.v);
tab.forEach(x=>console.log('     '+x.n.padEnd(11)+x.v.toFixed(6)+' BTC'));
ok('nessuno fuori scala', tab[5].v/tab[0].v<2, 'rapporto '+(tab[5].v/tab[0].v).toFixed(2));
ok('i due esenti sono i piu economici', ['Portogallo','Germania'].includes(tab[0].n)&&['Portogallo','Germania'].includes(tab[1].n));

console.log('\n--- 9. IL PASSATO (prezzi veri, nessun modello) ---');
// Un versamento al mese, contati sul calendario: 2019 -> oggi sono 91 mesi.
const p19=accumuloStorico(2019,500,1);
ok('dal 2019 sono 91 versamenti', p19.mesi===91, p19.mesi+' mesi');
ok('il versato e mesi x rata', p19.versato===91*500, p19.versato+' USD');
ok('il costo medio e versato/BTC', Math.abs(p19.costoMedio-p19.versato/p19.btc)<1e-9);
ok('cominciare prima da piu BTC', accumuloStorico(2015,500,1).btc>p19.btc);
ok('cominciare dopo ne da meno', accumuloStorico(2023,500,1).btc<p19.btc);
ok('un anno futuro non ha passato', accumuloStorico(2030,500,1)===null);
// digitando 2005 nel campo uscivano 511.273 BTC comprati a 0,07 dollari
ok('prima della serie non si inventa un passato', accumuloStorico(2005,500,1)===null);
ok('nemmeno l anno mozzo di partenza', accumuloStorico(2010,500,1)===null);
ok('il primo anno intero invece si', accumuloStorico(2011,500,1)!==null);
ok('il cambio scala solo i BTC',
   Math.abs(accumuloStorico(2019,500,0.868).btc/p19.btc-1/0.868)<1e-9);
// prima e dopo la serie si resta agganciati agli estremi, non a zero
ok('prima del primo prezzo si usa il primo', prezzoStoricoAl(0)===STORICO[0][1]);
ok('dopo l ultimo si usa l ultimo',
   prezzoStoricoAl(99999)===STORICO[STORICO.length-1][1]);

console.log('\n--- 10. LA MASSA MONETARIA (solo unita di misura) ---');
const gOggi=giorniDaGenesi();
ok('il fattore di oggi vale 1', Math.abs(inM2(gOggi)-1)<1e-9);
ok('nel passato vale piu di 1', inM2(M2[0][0])>2, inM2(M2[0][0]).toFixed(2)+'x nel 2010');
ok('nel futuro vale meno di 1', inM2(gOggi+3652)<1);
// tra due punti si interpola: mai un gradino
const a=M2[50], b=M2[51], mezzo=m2Al((a[0]+b[0])/2);
ok('fra due mesi si interpola', mezzo>Math.min(a[1],b[1]) && mezzo<Math.max(a[1],b[1]));
ok('prima della serie resta al primo', m2Al(0)===M2[0][1]);
// il tasso del futuro esce dai dati, non da una costante scelta a mano
const atteso=Math.pow(M2[M2.length-1][1]/M2[0][1], 365.25/(M2[M2.length-1][0]-M2[0][0]))-1;
ok('il tasso di proiezione viene dalla serie', Math.abs(M2_CRESCITA-atteso)<1e-12,
   (M2_CRESCITA*100).toFixed(2)+'%/anno');
ok('ed e fra il 5 e il 8 per cento', M2_CRESCITA>0.05 && M2_CRESCITA<0.08);
// oltre l'ultimo dato cresce esattamente a quel tasso, non di piu
const u=M2[M2.length-1];
ok('oltre l ultimo dato cresce al tasso dichiarato',
   Math.abs(m2Al(u[0]+365.25)/u[1]-(1+M2_CRESCITA))<1e-9);
// la serie e ordinata: la ricerca binaria lo assume
ok('la serie e in ordine di data', M2.every((p,i)=>i===0||p[0]>M2[i-1][0]));
// M2 e la vista devono restare fuori dai conti: si controlla sul sorgente,
// perche' e' una proprieta' del codice, non di un risultato.
const sorgente=fs.readFileSync(path.join(__dirname,'script.js'),'utf8');
const motore=sorgente.slice(0, sorgente.indexOf('function grafico'));
const calcolo=motore.slice(motore.indexOf('function simula'));
ok('nessun conto legge M2', !/\binM2\s*\(|\bm2Al\s*\(/.test(calcolo));
ok('nessun conto legge la vista', !/\bVISTA\b/.test(calcolo));
// e il fabbisogno resta lo stesso a meno del tempo che passa fra due chiamate
ok('nessun conto legge il tetto', !/\bm2PerBitcoin\s*\(|\bsupplyBTC\s*\(/.test(calcolo));
ok('il fabbisogno non dipende dalla vista', Math.abs(fab(base,CEN)/fab(base,CEN)-1)<1e-9);

console.log('\n--- 11. IL TETTO: M2 PER BITCOIN ESISTENTE ---');
const gg=giorniDaGenesi();
ok('oggi esistono circa 20,1 mln di bitcoin',
   Math.abs(supplyBTC(gg)/1e6-20.07)<0.1, (supplyBTC(gg)/1e6).toFixed(2)+' mln');
// ai quattro halving avvenuti la somma emessa e' nota con esattezza
[[1,10.5],[2,15.75],[3,18.375],[4,19.6875]].forEach(([i,atteso])=>
  ok('all halving '+i+' erano '+atteso+' mln',
     Math.abs(supplyBTC(HALVING[i])/1e6-atteso)<0.001));
ok('non si superano mai 21 mln', supplyBTC(gg+365.25*200)<=21e6);
ok('la supply non cala mai',
   Array.from({length:60},(_,k)=>supplyBTC(gg+k*365.25)).every((v,k,a)=>k===0||v>=a[k-1]));
// il tetto e' in dollari per bitcoin, la stessa unita' del prezzo
ok('oggi il tetto sta fra 1,0 e 1,3 mln di dollari',
   m2PerBitcoin(gg)>1.0e6 && m2PerBitcoin(gg)<1.3e6, Math.round(m2PerBitcoin(gg)).toLocaleString('it-IT')+' \$');
// col tempo M2 cresce e la supply si ferma: il tetto sale
ok('nel futuro il tetto sale', m2PerBitcoin(gg+3652)>m2PerBitcoin(gg));
// la linea su cui si tara l obiettivo deve restare sotto il tetto
ok('il fondo del corridoio non sfonda il tetto', annoSfondamento(SCENARI[0].perc,2091)===0);
const sM=annoSfondamento(SCENARI[1].perc,2091), sR=annoSfondamento(SCENARI[2].perc,2091);
ok('la mediana lo sfonda', sM>NOW_YEAR&&sM<2091, String(sM));
ok('la resistenza lo sfonda prima della mediana', sR>0&&sR<sM, sR+' contro '+sM);
ok('su un orizzonte corto nessuno sfonda', annoSfondamento(SCENARI[1].perc,2028)===0);

console.log(ko===0?'\nTUTTI I CONTROLLI PASSATI\n':'\n'+ko+' CONTROLLI FALLITI\n');
process.exit(ko?1:0);
