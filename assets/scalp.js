/* ===================================================================
   SCALP SHADOW
   El panel se redisenio porque la estrategia diario fue retirada: todos los
   campos que existed (equity, trades, decisiones por activo, calibracion de
   Jev) vienen vacios porque ya no se producen. Esta seccion dibuja lo que el
   shadow SI mide: estado del feed, senales, labels y bps.

   El grafico de equity no tiene serie. Como el panel consulta cada segundo,
   la serie se construye en el cliente con las lecturas consecutivas, de modo
   que la curva muestra el bps neto acumulado real, no una cuenta imaginaria.
   =================================================================== */

const SCALP_COST_BPS = 8.5;          // 2 maker + 5 taker + 1.5 x 1.0 de slippage
const SCALP_MAX_PTS = 900;           // ~15 min a una muestra por segundo
const SCALP_LABEL_PATH_S = 120;       // trayectorias que guarda el shadow

function isScalp(d){
  const s=d&&(d.strategy||{});            // { name, max_concurrent, ... }
  if(String(s.name||'').toLowerCase()==='scalp')return true;
  return !!(d&&d.scalp&&d.scalp.feed_state!==undefined);
}

/* Serie temporal construida con las lecturas del propio panel. */
let scalpSeries=[];
let lastSampleT=0;
function pushScalpSample(d){
  const s=d.scalp||{};
  const t=Date.now();
  if(lastSampleT&&t-lastSampleT<400)return;      // no dupliques por captura extra
  lastSampleT=t;
  const net=numeric(s.net_bps_sum);
  const labels=Number(s.labels||0);
  scalpSeries.push({
    t,
    net:net===null?null:net,
    // El acumulado son cientos de miles de bps y aplasta la escala: lo que se
    // necesita ver es si la media por operacion mejora o empeora.
    porOp:net===null||!labels?null:net/labels,
    labels,
    signals:Number(s.signals||0),
    spread:numeric(s.spread_bps),
    imbalance:numeric(s.imbalance),
    open:Number(s.open_probes||0)
  });
  if(scalpSeries.length>SCALP_MAX_PTS)scalpSeries.shift();
}

/* Media neta por operacion a lo largo del tiempo. Se construye con las lecturas
   del propio panel, que consulta cada segundo: asi hay una serie real aunque el
   backend no entregue ninguna. Pasa por cero y por el coste supuesto, que son
   las dos referencias que importan. */
function scalpChart(el){
  const pts=scalpSeries.filter(p=>p.porOp!==null);
  if(pts.length<2){el.innerHTML='<text x="50%" y="58%" text-anchor="middle" class="chart-empty">Midiendo la primera serie…</text>';return;}
  const W=el.clientWidth||720,H=el.clientHeight||180,P={l:8,r:8,t:14,b:18};
  const vals=pts.map(p=>p.porOp);
  const lo=Math.min(0,...vals,SCALP_COST_BPS*-1),hi=Math.max(0,...vals);
  const span=(hi-lo)||1;
  const x=i=>P.l+(i/(pts.length-1))*(W-P.l-P.r);
  const y=v=>P.t+(hi-v)/span*(H-P.t-P.b);
  const y0=y(0),yCost=y(-SCALP_COST_BPS);
  const dLine=pts.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.porOp).toFixed(1)}`).join('');
  const dArea=`${dLine}L${x(pts.length-1).toFixed(1)},${y0.toFixed(1)}L${x(0).toFixed(1)},${y0.toFixed(1)}Z`;
  const negativo=vals[vals.length-1]<0;
  const col=negativo?'var(--negative)':'var(--gain)';
  el.innerHTML=`
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
         aria-label="Media del resultado neto por operacion, en basis points">
      <line x1="${P.l}" y1="${yCost.toFixed(1)}" x2="${W-P.r}" y2="${yCost.toFixed(1)}"
            stroke="var(--warning)" stroke-dasharray="4 4" stroke-width="1" opacity="0.75"></line>
      <line x1="${P.l}" y1="${y0.toFixed(1)}" x2="${W-P.r}" y2="${y0.toFixed(1)}"
            stroke="var(--border-strong)" stroke-dasharray="3 4" stroke-width="1"></line>
      <path d="${dArea}" fill="${col}" opacity="0.12"></path>
      <path d="${dLine}" fill="none" stroke="${col}" stroke-width="1.8"
            stroke-linejoin="round" stroke-linecap="round"></path>
      <text x="${W-P.r}" y="${(yCost-4).toFixed(1)}" text-anchor="end"
            class="chart-ref">coste ${SCALP_COST_BPS.toFixed(1)} bps</text>
      <text x="${W-P.r}" y="${(y0-4).toFixed(1)}" text-anchor="end" class="chart-ref">0</text>
    </svg>`;
}

function scalpStat(label,value,sub,state){
  return `<article class="stat"><div class="k">${esc(label)}</div><div class="v ${state||''}">${value}</div><div class="sub">${esc(sub||'')}</div></article>`;
}

function renderScalp(d){
  lastData=d;
  const s=d.scalp||{};
  const net=numeric(s.net_bps_sum),labels=Number(s.labels||0),wins=Number(s.wins||0),
        losses=Number(s.losses||0),signals=Number(s.signals||0),
        open=Number(s.open_probes||0),rows=Number(s.capture_rows||0);
  const spread=numeric(s.spread_bps),imbalance=numeric(s.imbalance),
        age=numeric(s.data_age_ms),gaps=Number(s.book_gaps||0),
        recon=Number(s.websocket_reconnects||0),errors=Number(s.capture_errors||0);
  const synced=s.book_synced===true,inst=s.inst_id||'BTC-USDT-SWAP';
  const netPorOp=labels?net/labels:null;
  const bruta=netPorOp===null?null:netPorOp+SCALP_COST_BPS;
  const winRate=labels?wins/labels:null;
  const cobertura=bruta===null?null:bruta/SCALP_COST_BPS;
  const posiciones=Number((d.strategy||{}).max_concurrent||2);

  /* --- reloj y cabecera --- */
  const rawNow=String(d.now||''),parts=rawNow.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if(parts){
    const dt=new Date(Number(parts[1]),Number(parts[2])-1,Number(parts[3]));
    $('dateLabel').textContent=dt.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});
    $('timeLabel').textContent=`${parts[4]}:${parts[5]} · hora de Nueva York`;
    const h=Number(parts[4]);
    $('welcomeTitle').innerHTML=`${h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'}, MSI<span class="heading-period">.</span>`;
  }
  $('lastUpdated').textContent=lastOk?`actualizado hace ${ago(Date.now()/1000-lastOk)}`:'recibiendo datos';
  $('decisionFreshness').textContent=age===null?'—':`feed ${age} ms`;

  /* --- las cuatro cifras de arriba: lo que el operador mira primero --- */
  // La cifra guia es la media por operacion: el acumulado son cientos de miles
  // de bps y no se puede leer de un vistazo.
  const netTxt=netPorOp===null?'—':`${sign(netPorOp)}${fmt(Math.abs(netPorOp),2)}`;
  $('balNum').textContent=netTxt;
  $('balNum').className=`stat-value ${netPorOp===null?'':tone(netPorOp)}`;
  $('balanceLarge').textContent=net===null?'—':`${sign(net)}${fmt(Math.abs(net),0)} bps`;
  $('balanceLarge').className=`stat-value ${net===null?'':tone(net)}`;
  $('balDelta').innerHTML=netPorOp===null?'sin mediciones cerradas':
    `${arrow(netPorOp)} media por operación · ${labels} labels · bruto ${bruta>=0?'+':''}${bruta.toFixed(3)} bps`;
  $('balDelta').className=`stat-change ${tone(netPorOp)}`;
  $('ledgerTag').textContent='SHADOW';
  $('ledgerTag').dataset.state='ok';
  $('balanceState').textContent=`${labels} label${labels===1?'':'s'} cerrado${labels===1?'':'s'} · acumulado ${net===null?'—':fmt(net,0)+' bps'}`;
  $('eqReal').textContent=bruta===null?'—':`${sign(bruta)}${fmt(Math.abs(bruta),3)} bps`;
  $('eqReal').className=bruta===null?'':tone(bruta);
  $('eqUnreal').textContent=winRate===null?'—':`${fmt(winRate*100,2)}%`;
  $('eqUnreal').className=winRate===null?'':tone(winRate*100-50);
  $('eqDD').textContent=cobertura===null?'—':`${fmt(cobertura*100,1)}%`;
  $('eqDD').className=cobertura!==null&&cobertura<1?'warn':'';
  $('startingCapital').textContent=`${SCALP_COST_BPS.toFixed(1)} bps coste por operación`;
  $('chartSub').textContent=`media neta por operación · ${scalpSeries.length} lecturas del panel · contra el coste supuesto`;

  /* --- estado del feed: lo que estuvo roto horas, tiene que verse --- */
  const feedState=synced&&!recon&&!errors?'ok':synced?'warn':'error';
  $('exposureValue').textContent=spread===null?'—':`${fmt(spread,4)} bps`;
  $('exposureCount').textContent=`coste por operación ${SCALP_COST_BPS.toFixed(1)} bps`;
  $('providerValue').textContent=synced?'sincronizado':'sin sincronizar';
  $('providerNote').textContent=errors?`${errors} errores de captura`:`${gaps} huecos · ${recon} reconexiones`;
  $('providerIndicator').style.background=feedState==='ok'?'var(--gain)':feedState==='warn'?'var(--warning)':'var(--negative)';
  $('providerCompact').textContent=synced?'sync':'sin sync';
  $('agentStatus').textContent=`${s.feed||'—'} · ${s.book_source||'libro'}`;
  $('positionLimit').textContent='0 · ninguna';
  $('riskMeterLabel').textContent=`${open} abiertas · ${labels} cerradas`;
  $('riskMeterBar').style.width=`${labels>0?Math.min(100,open/Math.max(open,1)*100):0}%`;
  $('riskMeterBar').dataset.state='';
  $('riskStatusRow').dataset.state=feedState;
  $('navPositionCount').textContent='0';   // el shadow no tiene posiciones reales
  $('posSub').textContent=synced?`${open} trayectorias en curso`:`libro sin sincronizar`;
  $('positionsTotal').textContent=`${labels} labels`;

  /* --- trayectorias abiertas: el shadow si tiene algo "en curso" --- */
  $('posList').innerHTML=open>0
    ? `<div class="position-row"><span class="coin">${esc(inst.slice(0,2))}</span>
       <span class="position-info"><b>${open} trayectorias midiendo</b>
       <small>el shadow mide ${SCALP_LABEL_PATH_S}s por señal antes de cerrar la trayectoria</small></span>
       <span class="position-change">${esc(String(open))}</span></div>`
    : '<div class="empty">Ninguna trayectoria abierta en este momento.</div>';

  const liveLabel=synced?'Libro en vivo':s.feed_state==='reconnecting'?'Reconectando':'Sin sincronizar';
  $('liveLabel').textContent=liveLabel;
  $('liveMeta').textContent=`${s.feed||'feed'} · ${inst}`;
  $('sidebarLive').dataset.state=feedState;
  $('heroState').textContent=s.orders_enabled?'PAPER':'SHADOW · SIN ÓRDENES';
  $('heroTitle').textContent=synced
    ? `Mid quieto en ${rows.toLocaleString('es-ES')} filas capturadas`
    : `El feed no sincroniza: ${s.feed_error||s.snapshot_error||s.last_error||'sin detalle'}`;
  $('heroCopy').textContent=synced
    ? `${inst} por ${s.feed||'—'}. El shadow mide el resultado en basis points y lo resta del coste de cada operación.`
    : 'Sin libro sincronizado no hay spread, ni desequilibrio, ni medir nada. Revisa la fuente de datos.';
  $('fVerdict').textContent=synced?'SHADOW':'ESPERA';
  $('fVerdict').className=`verdict ${synced?'HOLD':'SELL'}`;
  $('fSym').textContent=inst;
  $('fPrice').textContent=spread===null?'spread —':`${fmt(spread,4)} bps de spread`;
  $('fDecisionTime').textContent=`${signals} señales · ${labels} labels medidas`;
  $('fFacts').textContent=[
    netPorOp===null?'':`bruta ${bruta>=0?'+':''}${bruta.toFixed(3)} bps`,
    cobertura===null?'':`cobertura ${fmt(cobertura*100,1)}%`,
    s.orders_enabled===false?'órdenes off':''
  ].filter(Boolean).join(' · ')||'sin mediciones todavía';

  /* --- telemetría: lo que se ve en el libro ahora mismo --- */
  const LIMITE_FRESCA=Number((d.scalp||{}).SCALP_MAX_STALE_MS||500);
  const tel=[
    ['IMB',imbalance===null?'—':fmt(imbalance,4),'desequilibrio: profundidad de compra contra venta'],
    ['OFI',numeric(s.ofi)===null?'—':fmt(s.ofi,3),'flujo dentro del libro'],
    ['FLJ',numeric(s.flow_nq)===null?'—':fmt(s.flow_nq,3),'volumen agresivo del último segundo'],
    ['EDAD',age===null?'—':`${age} ms`,`edad de la última lectura · límite ${LIMITE_FRESCA} ms`,age!==null&&age>LIMITE_FRESCA]
  ];
  $('activityList').innerHTML=tel.map(([k,v,sub,alerta])=>
    `<div class="activity-row"><span class="activity-symbol">${esc(k)}</span>
     <span class="activity-main"><b>${alerta?'<span class="warn">dato viejo</span>':'lectura del libro'}</b><small>${esc(sub||'')}</small></span>
     <span class="activity-price${alerta?' warn':''}">${esc(v)}</span></div>`).join('');

  /* --- gráfico: la serie se arma con las lecturas del panel --- */
  scalpChart($('chart'));
  const alert=$('ledgerAlert');
  if(!synced){
    alert.hidden=false;
    alert.innerHTML=`<b>Feed sin sincronizar.</b> ${esc(String(s.snapshot_error||s.feed_error||s.last_error||'sin detalle').slice(0,120))} Mientras el libro no llegue no hay spread ni señal, y todo lo demás queda en cero por falta de datos, no por falta de actividad.`;
  }else if(cobertura!==null&&cobertura<1){
    alert.hidden=false;
    alert.innerHTML=`<b>La bruta no llega al coste.</b> El shadow gana ${fmt(Math.abs(bruta||0),3)} bps por operación frente a ${SCALP_COST_BPS.toFixed(1)} bps de coste: ${fmt(cobertura*100,1)}%. No es una estrategia mala, es aritmética: ${labels} labels con ${wins} ganadoras.`;
  }else{alert.hidden=true;alert.textContent='';}

  /* --- chips: el estado de un vistazo --- */
  $('eqChips').innerHTML=[
    [synced?'libro sincronizado':'libro sin sincronizar',synced?'ok':'neg'],
    [`${s.feed||'feed'}`,''],
    [`ordenes ${s.orders_enabled?'ACTIVAS':'deshabilitadas'}`,s.orders_enabled?'neg':'ok'],
    [`${labels} labels`,''],
    [`bruta cubre ${cobertura===null?'—':fmt(cobertura*100,1)+'%'}`,cobertura!==null&&cobertura<1?'warn':'ok'],
    [`${rows.toLocaleString('es-ES')} filas`,'']
  ].map(([l,c])=>`<span class="chip ${c}">${esc(l)}</span>`).join('');

  /* --- instrumento: hay uno solo --- */
  $('assetsSub').textContent=`1 instrumento · ${s.feed||'—'} · shadow`;
  $('assets').innerHTML=`<button class="asset-card" aria-selected="true" role="tab">
    <span class="asset-card-top"><span class="coin">${esc(inst.slice(0,2))}</span>
    <span class="asset-tag ${synced?'BUY':'SELL'}">${synced?'SYNC':'SIN SYNC'}</span></span>
    <strong>${esc(inst)}</strong>
    <span class="asset-price">${spread===null?'—':fmt(spread,4)+' bps'}</span>
    <span class="asset-meta">${esc(s.book_source||'libro')}</span></button>`;

  /* --- cobertura del coste, que sustituye a la calibración de Jev --- */
  $('calibSub').textContent=labels?`sobre ${labels} labels del shadow`:'sin labels todavía';
  $('calibBody').innerHTML=`<div class="calib-grid">
    ${calibCell('Bruta por operación',bruta===null?'—':`${sign(bruta)}${fmt(Math.abs(bruta),3)} bps`,'antes de comisiones y slippage')}
    ${calibCell('Coste por operación',`${SCALP_COST_BPS.toFixed(1)} bps`,'supuesto sin verificar contra la cuenta','warn')}
    ${calibCell('Cobertura',cobertura===null?'—':`${fmt(cobertura*100,1)}%`,`1,00x es el punto de equilibrio`,cobertura!==null&&cobertura<1?'warn':'pos')}
    ${calibCell('Aciertos',winRate===null?'—':`${wins} / ${labels}`,`${fmt(winRate*100,1)}% de las labels`)}
  </div><p class="calib-note">El shadow no ejecuta órdenes: mide qué daría el movimiento bruto contra el coste asumido por operación. Un valor por debajo de 100% en cobertura significa que la señal no cubre el coste, con independencia del activo.</p>`;

  /* --- vistas de detalle --- */
  $('tabs').innerHTML='';
  $('decLat').textContent=`${s.feed||'feed'} · ${s.feed_ws_url||''}`;
  $('decBody').innerHTML=`<div class="plan-summary"><span class="verdict ${synced?'HOLD':'SELL'}">${synced?'SHADOW':'SIN SYNC'}</span><span><strong>${esc(inst)}</strong><small>Libro de ordenes en tiempo real, sin ejecucion</small></span></div><div class="plan-stats">
    <div class="plan-stat"><span>Estado del feed</span><b>${esc(s.feed_state||'—')}</b></div>
    <div class="plan-stat"><span>Libro sincronizado</span><b>${synced?'sí':'no'}</b></div>
    <div class="plan-stat"><span>Última lectura</span><b>${s.last_book_ms?new Date(Number(s.last_book_ms)).toLocaleTimeString('es-ES'):'—'}</b></div>
    <div class="plan-stat"><span>Huecos de libro</span><b>${gaps}</b></div>
    <div class="plan-stat"><span>Reconexiones</span><b>${recon}</b></div>
    <div class="plan-stat"><span>Errores de captura</span><b>${errors}</b></div></div>`;
  $('stateJson').textContent=JSON.stringify({feed:s.feed,inst_id:inst,book_source:s.book_source,
    feed_state:s.feed_state,book_synced:synced,spread_bps:spread,imbalance,
    signals,labels,net_bps_sum:net,orders_enabled:s.orders_enabled,
    kill_reasons:s.kill_reasons},null,2);
  $('stateBytes').textContent=`${new Blob([JSON.stringify(s)]).size} B`;

  $('marketGrid').innerHTML=[
    scalpStat('Spread',spread===null?'—':`${fmt(spread,4)} bps`,`coste ${SCALP_COST_BPS.toFixed(1)} bps`),
    scalpStat('Desequilibrio',imbalance===null?'—':fmt(imbalance,4),'profundidad'),
    scalpStat('OFI',numeric(s.ofi)===null?'—':fmt(s.ofi,3),'flujo en el libro'),
    scalpStat('Flujo agresivo',numeric(s.flow_nq)===null?'—':fmt(s.flow_nq,3),'último segundo'),
    scalpStat('Edad del dato',age===null?'—':`${age} ms`,'límite de frescura'),
    scalpStat('Filas capturadas',rows.toLocaleString('es-ES'),'mensajes del feed')
  ].join('');

  const salud=[
    ['Estado del feed',synced?'en vivo':(s.feed_state||'—'),synced?'libro sincronizado':'sin sincronizar',synced?'ok':'warn'],
    ['Ordenes',s.orders_enabled?'ACTIVAS':'deshabilitadas','modo shadow',s.orders_enabled?'warn':'ok'],
    ['Huecos de libro',String(gaps),gaps?'secuencias incompletas':'sin huecos',gaps?'warn':'ok'],
    ['Reconexiones',String(recon),'estabilidad del websocket',recon?'warn':'ok'],
    ['Errores de captura',String(errors),'escritura en Parquet',errors?'warn':'ok'],
    ['Señales',String(signals),`${open} trayectorias abiertas`,''],
    ['Labels',String(labels),`${wins} ganadoras / ${losses} perdedoras`,labels&&!wins?'warn':''],
    ['Coste supuesto',`${SCALP_COST_BPS.toFixed(1)} bps`,'sin verificar contra la cuenta','warn']
  ];
  $('healthGrid').innerHTML=salud.map(([k,v,sub,st])=>scalpStat(k,esc(v),sub,st)).join('');

  $('positionsTbl').innerHTML=`<tr><td colspan="10" class="empty">El shadow no ejecuta órdenes. No hay posiciones reales ni nocional en riesgo.</td></tr>`;
  $('tradesTbl').innerHTML=labels?[
    `<tr><td>${esc(inst)}</td><td>LONG/SHORT</td><td>${labels}</td><td>—</td><td>—</td>
     <td class="${tone(winRate===null?0:(winRate-0.5)*100)}">${winRate===null?'—':fmt(winRate*100,1)+'%'}</td>
     <td class="${tone(netPorOp)}">${netPorOp===null?'—':signedValue(netPorOp)+' bps'}</td>
     <td>horizon</td><td>${SCALP_COST_BPS.toFixed(1)} bps</td></tr>`].join(''):
    '<tr><td colspan="9" class="empty">Sin labels cerradas todavía.</td></tr>';
  $('cyclesTbl').innerHTML=`<tr><td colspan="8" class="empty">Sentinel ya no registra ciclos diarios: el scalp no tiene ciclo. Lo que se registra son señales continuas y sus trayectorias.</td></tr>`;
}

function calibCell(k,v,sub,state){
  return `<div class="calib-cell"${state?` data-state="${state}"`:''}><span class="k">${esc(k)}</span><b class="v">${esc(String(v))}</b><span class="sub">${esc(sub||'')}</span></div>`;
}