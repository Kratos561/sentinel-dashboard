/* Sentinel 0 dashboard: every figure comes from Sentinel's public feed or Jev's recorded decision. */
'use strict';

const DEFAULT_API='https://p01--sentinel-0--blnvcmgxk6zh.code.run';
const BAD=/^(X{4,}|xxxx|undefined|null|placeholder)/i;
const qs=new URLSearchParams(location.search);
const CANDS=[...new Set([qs.get('api'),localStorage.getItem('sentinel_api'),DEFAULT_API].filter(u=>u&&!BAD.test(u)))].map(u=>u.replace(/\/$/,''));
if(qs.get('api')&&!BAD.test(qs.get('api')))localStorage.setItem('sentinel_api',qs.get('api').replace(/\/$/,''));
let candidate=0,API=CANDS[0],LIVE=API.startsWith('http'),lastData=null,lastOk=0,fails=0,inflight=false,abortFetch=null,feedOn=true,selected='',query='';
const $=id=>document.getElementById(id);
const numeric=x=>x!==null&&x!==undefined&&Number.isFinite(Number(x))?Number(x):null;
const nf=(x,d=2)=>{const n=numeric(x);return n===null?'—':n.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d})};
const money=x=>{const n=numeric(x);return n===null?'—':`${nf(Math.abs(n))} USDT`};
const fmt=(x,d=2)=>{const n=numeric(x);return n===null?'—':n.toFixed(d)};
const sign=x=>{const n=numeric(x);return n===null?'':n>0?'+':n<0?'−':''};
const arrow=x=>{const n=numeric(x);return n===null?'':n>0?'▲':n<0?'▼':'·'};
const tone=x=>{const n=numeric(x);return n===null?'dim':n>0.0001?'pos':n<-.0001?'neg':'dim'};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SYM=s=>({BTCUSDT:'BTC',ETHUSDT:'ETH',SOLUSDT:'SOL',XRPUSDT:'XRP',XAUUSD:'ORO',PAXGUSDT:'ORO'}[s]||s||'—');
const dur=m=>{const n=numeric(m);return n===null?'—':n<60?`${Math.round(n)} min`:n<1440?`${(n/60).toFixed(1)} h`:`${(n/1440).toFixed(1)} d`};
const ago=s=>{const n=numeric(s);return n===null?'—':n<60?`${Math.max(0,Math.round(n))} s`:n<3600?`${Math.round(n/60)} min`:`${Math.round(n/3600)} h`};
const HUES=['#77c8ef','#f3ba57','#bb79ef','#61cda9','#e879aa'];
const hue=s=>HUES[[...String(s||'')].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7)%HUES.length];

/* --------------------------------------------------------------- TEMA */
function paintTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#fcfbfe':'#252731');
  $('btnTheme').setAttribute('aria-label',theme==='dark'?'Cambiar a tema claro':'Cambiar a tema oscuro');
  $('themeIcon').innerHTML=theme==='dark'
    ?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
    :'<path d="M20.3 15.3A8.5 8.5 0 0 1 8.7 3.7 8.6 8.6 0 1 0 20.3 15.3Z"/>';
}
function setTheme(theme){
  localStorage.setItem('sentinel_theme',theme);
  const b=$('btnTheme').getBoundingClientRect();
  document.documentElement.style.setProperty('--theme-x',`${((b.left+b.width/2)/innerWidth)*100}%`);
  document.documentElement.style.setProperty('--theme-y',`${((b.top+b.height/2)/innerHeight)*100}%`);
  if(document.startViewTransition){
    document.documentElement.classList.add('theme-reveal');
    const t=document.startViewTransition(()=>paintTheme(theme));
    t.finished.finally(()=>document.documentElement.classList.remove('theme-reveal'));
  }else paintTheme(theme);
  if(lastData)render(lastData);
}
paintTheme(localStorage.getItem('sentinel_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));
$('btnTheme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');

/* ------------------------------------------------------ INTEGRIDAD DE DATOS */
function auditLedger(d){
  const eq=d.equity||{},trades=Array.isArray(d.trades)?d.trades:[],cycles=Array.isArray(d.cycles_influx)?d.cycles_influx:[],issues=[];
  for(const t of trades){
    const id=String(t.trade_id||'');
    const c=cycles.find(x=>x.cycle_id&&(id===x.cycle_id||id.startsWith(`${x.cycle_id}:`)));
    const entry=numeric(t.entry),cyclePrice=numeric(c?.price);
    if(c&&entry!==null&&cyclePrice>0&&Math.abs(entry-cyclePrice)/cyclePrice>.01){
      issues.push({trade:t,cycle:c,kind:'entry-cycle',message:`${SYM(t.symbol)}: entrada ${money(entry)}; el ciclo de Sentinel registró ${nf(cyclePrice)}.`});
    }
  }
  const start=numeric(eq.start),realized=numeric(eq.equity);
  if(start!==null&&realized!==null&&numeric(eq.closed)!==null&&Number(eq.closed)===trades.length&&trades.length){
    const pnl=trades.reduce((sum,t)=>sum+(numeric(t.pnl_usdt)??0),0);
    if(Math.abs((start+pnl)-realized)>.03)issues.push({kind:'equity-sum',message:`La suma del historial difiere del equity de Sentinel por ${money((start+pnl)-realized)}.`});
  }
  if(start!==null&&start<=0)issues.push({kind:'capital',message:'El capital inicial informado no es válido.'});
  if(realized!==null&&realized<0)issues.push({kind:'equity',message:'El equity informado es negativo.'});
  return {issues,trusted:issues.length===0};
}

function markedPositions(d){
  const px=d.providers?.prices||{};
  return (Array.isArray(d.positions)?d.positions:[]).map(p=>{
    const price=numeric(px[p.symbol]?.price),entry=numeric(p.entry),notional=numeric(p.qty),age=numeric(px[p.symbol]?.age_s);
    const fresh=price!==null&&(age===null||age<=180);
    let pct=null,pnl=null;
    if(fresh&&entry>0&&notional!==null){
      const raw=(price-entry)/entry*100;
      pct=p.side==='SHORT'?-raw:raw;
      pnl=notional*pct/100;
    }
    return {...p,mark:price,fresh,changePct:pct,pnlUsdt:pnl,priceAge:age,notional};
  });
}
function signedValue(n){const v=numeric(n);return v===null?'—':`${arrow(v)} ${sign(v)}${money(v)}`}

/* -------------------------------------------------------------- GRÁFICO */
function chart(series,currentTotal,start){
  const el=$('chart');let points=Array.isArray(series)?series.filter(p=>numeric(p.e)!==null):[];
  if(currentTotal!==null&&points.length)points=points.concat([{t:Date.now()/1000,e:currentTotal}]);
  points=points.slice(-90);
  if(points.length<2){el.innerHTML='<div class="empty">Sentinel aún no tiene suficientes cierres verificados para dibujar la curva.</div>';return;}
  const W=820,H=112,pl=42,pr=12,pt=10,pb=17,values=points.map(p=>Number(p.e));
  let min=Math.min(...values),max=Math.max(...values);if(start!==null){min=Math.min(min,start);max=Math.max(max,start)}
  const pad=(max-min)*.14||Math.max(.01,Math.abs(max)*.01);min-=pad;max+=pad;
  const X=i=>pl+i*(W-pl-pr)/(points.length-1),Y=v=>pt+(1-(v-min)/(max-min))*(H-pt-pb);
  const coords=points.map((p,i)=>({x:X(i),y:Y(Number(p.e)),e:Number(p.e)}));let path=`M ${coords[0].x} ${coords[0].y}`;
  for(let i=1;i<coords.length;i++)path+=` L ${coords[i].x} ${coords[i].y}`;
  const area=`${path} L ${coords.at(-1).x} ${H-pb} L ${coords[0].x} ${H-pb} Z`;
  const ticks=[max,(max+min)/2,min].map(v=>`<line x1="${pl}" y1="${Y(v)}" x2="${W-pr}" y2="${Y(v)}" stroke="var(--border-soft)" stroke-dasharray="2 4"/><text x="${pl-6}" y="${Y(v)+3}" text-anchor="end" fill="var(--text-dim)" font-size="8" font-family="var(--font-num)">${nf(v)}</text>`).join('');
  const base=start===null?'':`<line x1="${pl}" y1="${Y(start)}" x2="${W-pr}" y2="${Y(start)}" stroke="var(--purple)" stroke-dasharray="4 3" opacity=".8"/>`;
  const last=coords.at(-1);el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Trayectoria de equidad verificada, ${points.length} puntos"><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--purple)" stop-opacity=".2"/><stop offset="1" stop-color="var(--purple)" stop-opacity="0"/></linearGradient></defs>${ticks}${base}<path d="${area}" fill="url(#equityFill)"/><path d="${path}" fill="none" stroke="var(--purple)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"/><circle cx="${last.x}" cy="${last.y}" r="3.1" fill="var(--purple)"/></svg>`;
  const tooltip=$('ctip');
  const show=clientX=>{const box=el.getBoundingClientRect(),x=(clientX-box.left)/box.width*W;let ix=0,dist=Infinity;coords.forEach((p,i)=>{const delta=Math.abs(p.x-x);if(delta<dist){dist=delta;ix=i}});const p=coords[ix],when=new Date((numeric(points[ix].t)||0)*1000);tooltip.style.display='block';tooltip.style.left=`${(p.x/W)*100}%`;tooltip.style.top=`${(p.y/H)*100}%`;tooltip.innerHTML=`<small>${Number.isNaN(when.getTime())?'':when.toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</small>${money(p.e)}${start===null?'':`<em class="${tone(p.e-start)}">${sign(p.e-start)}${fmt(Math.abs((p.e/start-1)*100))}% ${arrow(p.e-start)}</em>`}`};
  el.onpointermove=e=>show(e.clientX);el.onpointerleave=()=>tooltip.style.display='none';el.onpointerdown=e=>{if(e.pointerType==='touch')show(e.clientX)};
}

/* --------------------------------------------------------------- RENDER */
function render(d){
  lastData=d;
  if(isScalp(d))return renderScalp(d);
  const eq=d.equity||{},positions=markedPositions(d),trades=Array.isArray(d.trades)?d.trades:[],decisions=d.decisions||{},strategy=d.strategy||{},metrics=d.metrics||{},providers=d.providers?.sources||[],cycles=Array.isArray(d.cycles_influx)?d.cycles_influx:[],context=d.context||{};
  const symbols=(strategy.symbols||Object.keys(decisions)).filter(s=>!query||`${s} ${SYM(s)}`.toLowerCase().includes(query));
  if(!symbols.includes(selected))selected=symbols[0]||Object.keys(decisions)[0]||'';
  const max=numeric(strategy.max_concurrent)??5,used=positions.length,over=used>max,exposure=positions.reduce((n,p)=>n+(p.notional??0),0);
  const audit=auditLedger(d),start=numeric(eq.start),reportedEquity=numeric(eq.equity),reportedTotal=numeric(eq.total),reportedUnreal=numeric(eq.unrealized),realized=reportedEquity??(reportedTotal!==null&&reportedUnreal!==null?reportedTotal-reportedUnreal:reportedTotal),marksComplete=positions.every(p=>p.pnlUsdt!==null),unrealized=marksComplete?positions.reduce((n,p)=>n+p.pnlUsdt,0):null;
  const totalTrusted=audit.trusted&&realized!==null&&start!==null&&unrealized!==null;
  const total=totalTrusted?realized+unrealized:null,pnl=totalTrusted?total-start:null;
  const cd=decisions[selected]||{},choice=String(cd.choice||'HOLD').toUpperCase(),lastCycle=cycles[0]||null;

  /* fecha y frescura: los datos pueden actualizarse cada 5 s; Jev decide una vez al día */
  const rawNow=String(d.now||''),parts=rawNow.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if(parts){const dt=new Date(Number(parts[1]),Number(parts[2])-1,Number(parts[3]));$('dateLabel').textContent=dt.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});$('timeLabel').textContent=`${parts[4]}:${parts[5]} · hora de Nueva York`;const h=Number(parts[4]);$('welcomeTitle').innerHTML=`${h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'}, MSI<span class="heading-period">.</span>`;}
  $('lastUpdated').textContent=lastOk?`actualizado hace ${ago(Date.now()/1000-lastOk)}`:'recibiendo datos';
  $('decisionFreshness').textContent=lastCycle?.time?cycleClock(lastCycle.time):cd.ts||'—';

  /* diagnóstico de cuenta: nunca convertir el nocional USDT de una posición en unidades del activo */
  $('startingCapital').textContent=start===null?'—':money(start);
  $('balNum').textContent=totalTrusted?money(total):'No verificado';
  $('balanceLarge').textContent=totalTrusted?money(total):'No verificado';
  $('balDelta').textContent=totalTrusted?`${arrow(pnl)} ${sign(pnl)}${fmt(Math.abs(pnl))}%`:'historial con una discrepancia';
  $('balDelta').className=`stat-change ${totalTrusted?tone(pnl):'warn'}`;
  $('ledgerTag').textContent=audit.trusted?'ledger consistente':'revisar registro';$('ledgerTag').dataset.state=audit.trusted?'ok':'warn';
  $('balanceState').textContent=!audit.trusted?'P&L histórico no verificado':marksComplete?'marcado con precios en vivo':'falta un precio vigente';
  $('eqReal').textContent=audit.trusted&&realized!==null?money(realized-start):'No verificado';$('eqReal').className=`${audit.trusted?'':'warn'}`;
  $('eqUnreal').textContent=unrealized===null?'—':signedValue(unrealized);$('eqUnreal').className=unrealized===null?'':tone(unrealized);
  const dd=numeric(eq.max_dd_pct);$('eqDD').textContent=audit.trusted&&dd!==null?`${fmt(dd)}%`:'No verificado';$('eqDD').className=audit.trusted&&dd!==null&&dd>2?'warn':'';
  const alert=$('ledgerAlert');
  if(audit.issues.length){alert.hidden=false;alert.innerHTML=`<b>Balance en revisión.</b> ${esc(audit.issues[0].message)} El P&amp;L acumulado y el drawdown quedan ocultos hasta reconciliar ese registro. La posición abierta sí se marca con el precio vigente de Sentinel.`;}
  else{alert.hidden=true;alert.textContent='';}
  $('chartSub').textContent=totalTrusted?'cierres registrados · línea punteada: capital inicial':'curva pausada hasta verificar el ledger';
  chart(totalTrusted?d.equity_curve:[],total,start);

  /* resumen del motor y advertencias de riesgo */
  $('exposureValue').textContent=money(exposure);$('exposureCount').textContent=`${used} ${used===1?'posición':'posiciones'}`;
  const providerOk=providers.filter(p=>p.ok===true).length,providerTotal=providers.length;
  $('providerValue').textContent=providerTotal?`${providerOk}/${providerTotal}`:'—';$('providerCompact').textContent=providerTotal?`${providerOk}/${providerTotal}`:'—';
  $('providerNote').textContent=providerTotal?`${d.data_errors||0} errores de datos`:'fuente pendiente';$('providerIndicator').style.background=providerTotal&&providerOk===providerTotal?'var(--gain)':providerOk?'var(--warning)':'var(--negative)';
  $('positionLimit').textContent=`${used}/${max}`;$('riskStatusRow').dataset.state=over?'warn':'ok';$('riskMeterLabel').textContent=over?'límite excedido':`${used} de ${max}`;
  $('riskMeterBar').style.width=`${max>0?Math.min(100,used/max*100):0}%`;$('riskMeterBar').dataset.state=over?'warn':'';
  $('navPositionCount').textContent=String(used);$('posSub').textContent=`${used} de ${max} posiciones${over?' · límite excedido':''}`;$('positionsTotal').textContent=money(exposure);
  $('agentStatus').textContent=providerTotal&&providerOk===providerTotal?'Jev conectado · Sentinel activo':'Jev · estado de conexión pendiente';
  const feedState=providerTotal===0?'warn':providerOk===providerTotal?'ok':'error';$('sidebarLive').dataset.state=feedState;$('liveLabel').textContent=feedState==='ok'?'Datos en vivo':feedState==='warn'?'Conectando':'Revisar fuentes';$('liveMeta').textContent=providerTotal?`${providerOk}/${providerTotal} proveedores`:'fuente Sentinel';
  $('heroState').textContent=`PAPER · USDT · ${feedState==='ok'?'EN LÍNEA':'REVISAR'}`;$('heroTitle').textContent=choice==='HOLD'?'La señal, bajo control.':`${choice==='BUY'?'Señal de compra':'Señal de venta'} · ${SYM(selected)}`;
  $('heroCopy').textContent=choice==='HOLD'?'Jev mantiene la recomendación. Sentinel continúa validando mercado y riesgo.':'Jev propone la dirección; Sentinel valida exposición y límites antes de ejecutar.';
  $('fVerdict').textContent=choice;$('fVerdict').className=`verdict ${['BUY','SELL'].includes(choice)?choice:'HOLD'}`;$('fSym').textContent=SYM(selected);const decisionPrice=numeric(cd.price??context[selected]?.price??providersPrice(d,selected));$('fPrice').textContent=decisionPrice===null?'precio —':nf(decisionPrice);
  $('fDecisionTime').textContent=lastCycle?.time?`último ciclo ${cycleClock(lastCycle.time)}`:cd.ts?`decisión ${cd.ts}`:'decisión aún no registrada';
  const execute=numeric(cd.execute),plan=cd.plan||{};const factBits=[execute===null?'':`score de ejecución ${Math.round(execute*100)}% · heurístico`,plan.sl_pct==null?'':`stop ${fmt(plan.sl_pct,1)}%`,plan.tp_pct==null?'':Number(plan.tp_pct)===0?'sin objetivo fijo':`objetivo ${fmt(plan.tp_pct,1)}%`].filter(Boolean);$('fFacts').textContent=factBits.join(' · ')||'Jev evalúa el ciclo diario por activo';
  $('providerValue').setAttribute('aria-label',providerTotal?`${providerOk} de ${providerTotal} proveedores en vivo`:'proveedores sin información');
  renderActivity(cycles);renderPositions(positions);renderAssetCards(symbols,decisions,context,d);
  renderCalibration(d.calibration||{});renderDetails(d,positions,trades,cycles,symbols,selected,max,over,audit,providerOk,providerTotal);
  renderChips({over,max,used,providerOk,providerTotal,metrics,dataErrors:d.data_errors||0,cycles:d.cycles||0});
}

function providersPrice(d,s){return d.providers?.prices?.[s]?.price??null}
function cycleClock(value){const s=String(value||'');const m=s.match(/(?:T|\s)(\d{2}):(\d{2})/);return m?`${m[1]}:${m[2]} NY`:s.slice(0,16)}
function renderActivity(cycles){
  const list=$('activityList');
  if(!cycles.length){list.innerHTML='<div class="loading-row">Sentinel todavía no ha publicado ciclos recientes.</div>';return}
  list.innerHTML=cycles.slice(0,3).map(c=>`<div class="activity-row"><span class="activity-symbol">${esc(SYM(c.symbol).slice(0,3))}</span><span class="activity-main"><b>${esc(SYM(c.symbol))} · ${esc(c.jev_choice||'HOLD')} <span class="tag ${esc(c.jev_choice||'HOLD')}">${esc(c.jev_choice||'—')}</span></b><small>${esc(c.jev_setup||'ciclo de Sentinel')}</small></span><span class="activity-price">${numeric(c.price)===null?'—':nf(c.price)}</span><span class="activity-time">${esc(c.time?cycleClock(c.time):'—')}</span></div>`).join('');
}
function renderPositions(positions){
  const list=$('posList');if(!positions.length){list.innerHTML='<div class="empty">Sentinel no tiene posiciones abiertas.</div>';return;}
  list.innerHTML=positions.slice(0,6).map(p=>`<a class="position-row" data-sign="${tone(p.changePct)}" href="#positions"><span class="coin" style="color:${hue(p.symbol)}">${esc(SYM(p.symbol).slice(0,2))}</span><span class="position-info"><b>${esc(SYM(p.symbol))} · ${esc(p.side||'—')}</b><small>${money(p.notional)} · ${p.fresh?`precio ${nf(p.mark)}`:'precio pendiente'}</small></span><span class="position-change ${tone(p.changePct)}">${p.changePct===null?'—':`${sign(p.changePct)}${fmt(Math.abs(p.changePct))}% ${arrow(p.changePct)}`}</span></a>`).join('');
}
function renderAssetCards(symbols,decisions,context,d){
  const grid=$('assets');$('assetsSub').textContent=`${symbols.length} activos · Jev renueva la decisión una vez al día`;
  if(!symbols.length){grid.innerHTML='<div class="empty">Ningún activo coincide con la búsqueda.</div>';return;}
  grid.innerHTML=symbols.map(s=>{const c=decisions[s]||{},choice=String(c.choice||'HOLD').toUpperCase(),price=numeric(providersPrice(d,s)??c.price??context[s]?.price),age=numeric(d.providers?.prices?.[s]?.age_s),vol=numeric(context[s]?.vol_30d);return `<button class="asset-card" data-s="${esc(s)}" aria-selected="${s===selected}" tabindex="${s===selected?0:-1}" role="tab"><span class="asset-card-top"><span class="coin" style="color:${hue(s)}">${esc(SYM(s).slice(0,2))}</span><span class="asset-tag ${['BUY','SELL'].includes(choice)?choice:'HOLD'}">${esc(choice)}</span></span><strong>${esc(SYM(s))}</strong><span class="asset-price ${age!==null&&age>180?'asset-price-stale':''}">${price===null?'—':nf(price)}</span><span class="asset-meta">${age!==null&&age>180?'precio desactualizado':vol===null?'decisión diaria':`volatilidad ${nf(vol,0)}%`}</span></button>`}).join('');
}
function renderChips({over,max,used,providerOk,providerTotal,metrics,dataErrors,cycles}){
  const slo=Array.isArray(metrics.slo)?metrics.slo.length:0;const items=[[over?`⚠ posiciones ${used}/${max} · excede`: `posiciones ${used}/${max}`,over?'warn':''],[`ciclos hoy ${cycles}`,''],[`errores de datos ${dataErrors}`,dataErrors?'neg':''],[`proveedores ${providerTotal?`${providerOk}/${providerTotal}`:'—'}`,providerTotal&&providerOk===providerTotal?'ok':'warn'],[slo?`⚠ SLO ${slo}`:'SLO en verde',slo?'neg':'ok']];
  $('eqChips').innerHTML=items.map(([label,cl])=>`<span class="chip ${cl}">${esc(label)}</span>`).join('');
}

function renderCalibration(c){
  const count=numeric(c.n_evaluated)||0,baseline=numeric(c.baseline_brier),brier=numeric(c.brier),rate=numeric(c.base_rate_up),better=brier!==null&&baseline!==null&&brier<baseline;
  $('calibSub').textContent=count?`evaluación sobre ${count} resultado${count===1?'':'s'} maduro${count===1?'':'s'}`:'acumulando resultados a 1 día';
  const cell=(k,v,sub,state='')=>`<div class="calib-cell"${state?` data-state="${state}"`:''}><span class="k">${k}</span><b class="v">${v}</b><span class="sub">${esc(sub||'')}</span></div>`;
  if(!count){$('calibBody').innerHTML=`<div class="calib-grid">${cell('Brier direccional · 1 d','—','sin resultados maduros')}${cell('Tasa base BUY',rate===null?'—':fmt(rate,3),'se calcula sobre la misma muestra')}${cell('Decisiones medidas','0','retornos pendientes')}${cell('Score de ejecución','heurístico','0.65 no es probabilidad','warn')}</div><p class="calib-note">Sentinel compara la dirección de Jev con retornos que ya maduraron. El score de ejecución es una regla heurística; no representa una probabilidad calibrada.</p>`;return;}
  $('calibBody').innerHTML=`<div class="calib-grid">${cell('Brier direccional · 1 d',brier===null?'—':fmt(brier,3),baseline===null?'sin referencia':better?'mejor que la tasa base':'no supera la tasa base',baseline===null?'':better?'pos':'warn')}${cell('Tasa base BUY',rate===null?'—':fmt(rate,3),baseline===null?'muestra insuficiente':`Brier base ${fmt(baseline,3)}`)}${cell('Buckets BUY',String(Object.keys(c.buckets||{}).length),'tramos de probabilidad direccional')}${cell('Decisiones medidas',String(count),'resultados maduros')}</div><p class="calib-note">${better?'<b>Mejora observada frente a la referencia.</b> Es evidencia histórica de esta muestra, no una garantía.':'<b>Sin mejora demostrada.</b> El score de ejecución de Jev sigue siendo heurístico y el umbral 0.65 no es una probabilidad calibrada.'}</p>`;
}

function renderDetails(d,positions,trades,cycles,symbols,selected,max,over,audit,providerOk,providerTotal){
  const cd=d.decisions?.[selected]||{},plan=cd.plan||{},state=cd.state_sent;
  $('decLat').textContent=cd.lat?`latencia de Jev ${cd.lat} ms · ${cd.ts||'ciclo diario'}`:`${cd.ts||'decisión diaria'} · score de ejecución heurístico`;
  $('tabs').innerHTML=symbols.map(s=>`<button class="tab" role="tab" data-s="${esc(s)}" aria-selected="${s===selected}" tabindex="${s===selected?0:-1}">${esc(SYM(s))}</button>`).join('');
  $('decBody').innerHTML=`<div class="plan-summary"><span class="verdict ${['BUY','SELL'].includes(cd.choice)?esc(cd.choice):'HOLD'}">${esc(cd.choice||'HOLD')}</span><span><strong>${esc(SYM(selected))}</strong><small>Decisión registrada por Jev</small></span></div><div class="plan-stats"><div class="plan-stat"><span>Stop de Jev</span><b>${plan.sl_pct==null?'—':`−${fmt(plan.sl_pct,1)}%`}</b></div><div class="plan-stat"><span>Objetivo</span><b>${plan.tp_pct==null?'—':Number(plan.tp_pct)===0?'abierto':`+${fmt(plan.tp_pct,1)}%`}</b></div><div class="plan-stat"><span>Score ejecutar</span><b>${cd.execute==null?'—':`${Math.round(Number(cd.execute)*100)}% · heurístico`}</b></div><div class="plan-stat"><span>R:R</span><b>${plan.rr==null?'—':`${fmt(plan.rr,2)}:1`}</b></div><div class="plan-stat"><span>Vigencia máxima</span><b>${dur(plan.hold_min)}</b></div><div class="plan-stat"><span>Latencia</span><b>${cd.lat?`${cd.lat} ms`:'—'}</b></div></div>`;
  $('stateJson').textContent=state?JSON.stringify(state,null,2):'Sentinel no ha enviado un estado para este ciclo.';$('stateBytes').textContent=state?`${new Blob([JSON.stringify(state)]).size} B`:'—';
  $('marketGrid').innerHTML=symbols.map(s=>{const c=d.context?.[s]||{},m=c.market_ctx||{},ob=m.orderbook||{},dv=m.derivs||{};return `<article class="stat"><div class="k">${esc(SYM(s))}</div><div class="v">${numeric(c.price)===null?'—':nf(c.price)}</div>${m.fear_greed?`<div class="sub">${esc(m.fear_greed.label||'Fear & Greed')} · ${esc(m.fear_greed.value??'—')}</div>`:''}${ob.imb!=null?`<div class="sub">desequilibrio ${fmt(ob.imb,3)}</div>`:''}${dv.funding_rate!=null?`<div class="sub">funding ${esc(dv.funding_rate)}</div>`:''}${m.xexch_premium_bps!=null?`<div class="sub">otra plaza ${sign(m.xexch_premium_bps)}${fmt(Math.abs(Number(m.xexch_premium_bps)),2)} bps</div>`:''}${c.vol_30d!=null?`<div class="sub">volatilidad 30 d ${fmt(c.vol_30d,1)}%</div>`:''}</article>`}).join('')||'<div class="empty">Esperando contexto de mercado…</div>';
  const slo=Array.isArray(d.metrics?.slo)?d.metrics.slo.length:0;
  const health=[['Estado de ledger',audit.trusted?'consistente':'revisión requerida',audit.trusted?'sin discrepancias verificadas':'P&L histórico oculto'],['Proveedores en vivo',providerTotal?`${providerOk}/${providerTotal}`:'—','pulso de Sentinel'],['Decisiones de hoy',d.cycles??0,'ciclos registrados'],['Latencia p50',d.metrics?.lat_p50_ms?`${fmt(d.metrics.lat_p50_ms,0)} ms`:'—','Jev + proveedores'],['Latencia p95',d.metrics?.lat_p95_ms?`${fmt(d.metrics.lat_p95_ms,0)} ms`:'—',''],['Aperturas / cierres',`${d.metrics?.opens||0} / ${d.metrics?.closes||0}`,'observabilidad'],['Vetos de riesgo',d.metrics?.vetoes||0,'reglas deterministas'],['Errores de datos',d.data_errors||0,'último estado de Sentinel'],['SLO',slo?`⚠ ${slo}`:'en verde',slo?'incidentes registrados':'sin incidentes registrados'],['Posiciones',`${positions.length}/${max}`,over?'límite excedido':'dentro del límite']];
  $('healthGrid').innerHTML=health.map(([k,v,sub])=>`<article class="stat"><div class="k">${esc(k)}</div><div class="v ${String(v).includes('revisión')||String(v).includes('⚠')?'warn':''}">${esc(v)}</div><div class="sub">${esc(sub)}</div></article>`).join('');
  $('positionsTbl').innerHTML=positions.length?positions.map(p=>`<tr><td>${esc(SYM(p.symbol))}</td><td>${esc(p.side||'—')}</td><td>${nf(p.entry)}</td><td>${p.mark===null?'—':`${nf(p.mark)}${p.fresh?'':` <span class="warn">· viejo</span>`}`}</td><td>${money(p.notional)}</td><td>${nf(p.sl)}${p.trail_pct?`<span class="audit-note">trailing ${fmt(p.trail_pct,1)}%</span>`:''}</td><td>${p.tp==null?'abierto':nf(p.tp)}</td><td class="${tone(p.changePct)}">${p.changePct===null?'—':`${sign(p.changePct)}${fmt(Math.abs(p.changePct))}% ${arrow(p.changePct)} · ${signedValue(p.pnlUsdt)}`}</td><td>${dur(p.age_min)}</td><td class="dim">${fmt(p.mfe_pct)}% / ${fmt(p.mae_pct)}%</td></tr>`).join(''):'<tr><td colspan="10" class="empty">Sentinel no tiene posiciones abiertas.</td></tr>';
  const audits=new Map(audit.issues.filter(x=>x.trade).map(x=>[x.trade.trade_id,x]));
  $('tradesTbl').innerHTML=trades.length?trades.map(t=>{const issue=audits.get(t.trade_id);return `<tr class="${issue?'row-warning':''}"><td>${esc(t.trade_id||'—')}</td><td>${esc(SYM(t.symbol))}</td><td>${esc(t.side||'—')}</td><td>${nf(t.entry)}</td><td>${nf(t.exit)}</td><td class="${tone(t.pnl_pct)}">${numeric(t.pnl_pct)===null?'—':`${sign(t.pnl_pct)}${fmt(Math.abs(t.pnl_pct))}% ${arrow(t.pnl_pct)}`}</td><td class="${tone(t.pnl_usdt)}">${signedValue(t.pnl_usdt)}</td><td>${esc(t.exit_reason||'—')}${issue?`<span class="audit-note">⚠ ${esc(issue.message)}</span>`:''}</td><td>${dur(t.duration_min)}</td></tr>`}).join(''):'<tr><td colspan="9" class="empty">Sentinel aún no registra operaciones cerradas.</td></tr>';
  $('cyclesTbl').innerHTML=cycles.length?cycles.slice(0,40).map(c=>`<tr><td>${esc(c.cycle_id||'—')}</td><td>${esc(SYM(c.symbol))}</td><td>${esc(c.time?cycleClock(c.time):'—')}</td><td>${numeric(c.price)===null?'—':nf(c.price)}</td><td><span class="tag ${esc(c.jev_choice||'HOLD')}">${esc(c.jev_choice||'—')}</span></td><td>${c.jev_execute==null?'—':`${Math.round(Number(c.jev_execute)*100)}% · heurístico`}</td><td>${c.latency_ms?`${esc(c.latency_ms)} ms`:'—'}</td><td class="dim">${esc(c.jev_setup||'—')}</td></tr>`).join(''):'<tr><td colspan="8" class="empty">Sentinel aún no publica ciclos en Influx.</td></tr>';
}

/* --------------------------------------------------------------- DATOS */
async function tick(){
  if(!feedOn||inflight||document.hidden)return;inflight=true;
  try{
    const ctl=new AbortController();abortFetch=ctl;const timer=setTimeout(()=>ctl.abort(),15000);
    const url=LIVE?`${API}/api/public`:`./snapshot.json?t=${Date.now()}`;
    const response=await fetch(url,{cache:'no-store',signal:ctl.signal});clearTimeout(timer);if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();if(!data||typeof data!=='object'||!data.equity||!data.strategy)throw new Error('Respuesta incompleta de Sentinel');
    lastOk=Date.now()/1000;render(data);if(isScalp(data))pushScalpSample(data);fails=0;$('apihint').textContent=`Sentinel en vivo · ${API.replace(/^https?:\/\//,'')} · actualización cada segundo`;
  }catch(e){
    if(e?.name!=='AbortError'){fails++;if(fails>=3&&LIVE&&candidate<CANDS.length-1){candidate++;API=CANDS[candidate];LIVE=API.startsWith('http')}if(lastData)$('apihint').textContent=`conexión interrumpida · último dato hace ${ago(Date.now()/1000-lastOk)}`;else $('apihint').textContent='Sentinel no está disponible; reintentando';}
  }finally{inflight=false;abortFetch=null;}
}
$('btnFeed').onclick=()=>{feedOn=!feedOn;$('btnFeed').setAttribute('aria-pressed',String(!feedOn));$('btnFeed').setAttribute('aria-label',feedOn?'Pausar actualizaciones':'Reanudar actualizaciones');$('feedIcon').innerHTML=feedOn?'<path d="M8 5v14l11-7z"/>':'<path d="M7 4v16M17 4v16"/>';if(!feedOn&&abortFetch)abortFetch.abort();if(feedOn)tick()};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});

/* --------------------------------------------------------------- RUTAS */
const DETAIL_IDS=['loopTitle','market','health','positions','trades','cycles'];
const routeNames={top:'Resumen',loopTitle:'Ciclo de Jev',market:'Mercado',health:'Salud',positions:'Posiciones',trades:'Operaciones',cycles:'Ciclos'};
function route(){
  const hash=(location.hash||'').slice(1),detail=DETAIL_IDS.includes(hash),name=routeNames[hash]||'Resumen';
  $('v-resumen').classList.toggle('on',!detail);$('v-det').classList.toggle('on',detail);$('crumbCurrent').textContent=name;
  document.querySelectorAll('.nav-link').forEach(a=>{const current=(a.dataset.go===(hash||'top'))||(!detail&&a.dataset.go==='top');if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(detail){requestAnimationFrame(()=>document.getElementById(hash)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));}
  $('sidebar')?.classList.remove('sidebar-open');$('mobileMenu').setAttribute('aria-expanded','false');
}
addEventListener('hashchange',route);route();
$('mobileMenu').onclick=()=>{const open=!$('sidebar').classList.contains('sidebar-open');$('sidebar').classList.toggle('sidebar-open',open);$('mobileMenu').setAttribute('aria-expanded',String(open))};
$('profile').onclick=e=>{e.stopPropagation();const menu=$('profileMenu');menu.hidden=!menu.hidden;$('profile').setAttribute('aria-expanded',String(!menu.hidden))};
document.addEventListener('click',e=>{if(!e.target.closest('#profileMenu,#profile')){$('profileMenu').hidden=true;$('profile').setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('q').focus()}if(e.key==='Escape'){$('profileMenu').hidden=true;$('sidebar').classList.remove('sidebar-open');$('mobileMenu').setAttribute('aria-expanded','false')}});
document.addEventListener('click',e=>{const item=e.target.closest('[data-s]');if(!item)return;selected=item.dataset.s;localStorage.setItem('sentinel_sel',selected);if(lastData)render(lastData)});
$('q').oninput=e=>{query=e.target.value.trim().toLowerCase();if(lastData)render(lastData)};

tick();setInterval(tick,1000);
