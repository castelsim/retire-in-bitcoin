// Collaudo del motore: `node test.cjs`
const fs=require('fs'), path=require('path'), os=require('os');
const src=fs.readFileSync(path.join(__dirname,'script.js'),'utf8');
const tmp=path.join(os.tmpdir(),'ribtc-puro.cjs');
fs.writeFileSync(tmp, src.split('// Prezzo di oggi')[0] +
 '\nmodule.exports={FISCO,PAESI,SCENARI,ETA_MAX,imposta,lordoPerNetto,simula,fabbisogno,lineaDi,testTenuta,capitaleAntiCrollo,primaEtaSufficiente,pianoDiAccumulo,fabbisognoLiscio,rettaPowerLaw,lineaCorridoio,crescitaIstantanea,posizioneNelCorridoio,giorniDaGenesi,PL_N,PL_R2};');
const M=require(tmp); Object.assign(globalThis,M);

let ko=0; const ok=(n,c,d='')=>{console.log((c?'  ok  ':'  KO  ')+n+(d?' · '+d:'')); if(!c)ko++;};
const base={paese:'Italia',eta:35,etaInizio:50,nettoAnnuo:10000,prezzoOggi:54400,
 oltreUnAnno:true,cambioUsd:54400/63000};
const [SUP,CEN,RES]=SCENARI;
const fab=(o,sc)=>fabbisogno(o,lineaDi(o,sc)).btcNecessari;

console.log('\n--- 1. IMPOSTA ---');
ok('Italia: aliquota piena, 33% su tutto', Math.abs(lordoPerNetto('Italia',18000,200000,true).aliquotaEff-0.33)<0.001, 'caso peggiore');
ok('Germania oltre 12 mesi: zero', lordoPerNetto('Germania',18000,200000,true).lordo===18000);
ok('Portogallo oltre 365 giorni: zero', lordoPerNetto('Portogallo',18000,200000,true).lordo===18000);
ok('Spagna a scaglioni fra 10% e 27%', (e=>e>0.10&&e<0.27)(lordoPerNetto('Spagna',18000,200000,true).aliquotaEff));

console.log('\n--- 2. LEGGE DI POTENZA E CORRIDOIO ---');
const d=giorniDaGenesi();
ok('esponente vicino alla letteratura', Math.abs(PL_N-5.69)<0.15, PL_N);
ok('la crescita decade col tempo', crescitaIstantanea(d)>crescitaIstantanea(d+30*365.25));
ok('le tre linee sono ordinate', lineaCorridoio(d,SUP.perc)<lineaCorridoio(d,CEN.perc)&&lineaCorridoio(d,CEN.perc)<lineaCorridoio(d,RES.perc));
ok('oggi siamo nella meta bassa del corridoio', posizioneNelCorridoio(63000).frazione<0.5);

console.log('\n--- 3. IL DECUMULO PROGRAMMATO ---');
const r=fabbisogno(base,lineaDi(base,CEN));
console.log('     servono oggi '+r.btcNecessari.toFixed(6)+' BTC · '+r.righe.length+' prelievi dai '+base.etaInizio+' ai '+ETA_MAX);
ok('la tabella copre esattamente gli anni dal via ai 100', r.righe.length===ETA_MAX-base.etaInizio, r.righe.length+' righe');
ok('la prima riga e all eta di inizio', r.righe[0].eta===base.etaInizio);
ok('l ultima riga e a 99 anni compiuti', r.righe[r.righe.length-1].eta===ETA_MAX-1);
ok('il patrimonio si esaurisce alla fine (decumulo, non rendita)', r.righe[r.righe.length-1].residui<r.btcNecessari*0.02,
   'residui finali '+r.righe[r.righe.length-1].residui.toFixed(8)+' BTC');
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

console.log('\n--- 7. I SEI PAESI ---');
const tab=Object.keys(PAESI).map(n=>({n,v:fab({...base,paese:n},CEN)})).sort((a,b)=>a.v-b.v);
tab.forEach(x=>console.log('     '+x.n.padEnd(11)+x.v.toFixed(6)+' BTC'));
ok('nessuno fuori scala', tab[5].v/tab[0].v<2, 'rapporto '+(tab[5].v/tab[0].v).toFixed(2));
ok('i due esenti sono i piu economici', ['Portogallo','Germania'].includes(tab[0].n)&&['Portogallo','Germania'].includes(tab[1].n));

console.log(ko===0?'\nTUTTI I CONTROLLI PASSATI\n':'\n'+ko+' CONTROLLI FALLITI\n');
process.exit(ko?1:0);
