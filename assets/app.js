/* ============================================================================
   SENTINEL 0 — aplicación
   Jev propone, el código dispone. Igual que el bot.
   ============================================================================ */
'use strict';

const DEFAULT_API = 'https://p01--sentinel-0--blnvcmgxk6zh.code.run';
const BAD = /^(X{4,}|xxxx|undefined|null|placeholder)/i;
const qs = new URLSearchParams(location.search);
const CANDS = [...new Set([qs.get('api'), localStorage.getItem('sentinel_api'), DEFAULT_API]
  .filter(u => u && !BAD.test(u)))].map(u => u.replace(/\/$/, ''));
if (qs.get('api')) localStorage.setItem('sentinel_api', qs.get('api'));

let ci = 0, API = CANDS[0], LIVE = API.startsWith('http');
let lastOk = 0, lastData = null, fails = 0;
let sel = localStorage.getItem('sentinel_sel') || '', q = '', feedOn = true, rot = 0;

const $ = id => document.getElementById(id);
const nf = (n, d = 2) => (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (n, d = 2) => (n ?? 0).toFixed(d);
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '');
const arrow = n => (n > 0 ? '▲' : n < 0 ? '▼' : '·');
const cls = n => (n > 0.0001 ? 'pos' : n < -0.0001 ? 'neg' : 'dim');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = s => (s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`);
const SYM = s => ({ BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL', XRPUSDT: 'XRP', XAUUSD: 'ORO', PAXGUSDT: 'ORO' }[s] || s);
const dur = m => (m == null ? '—' : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`);

const HUES = ['#3ECF8E', '#60A5FA', '#E08B45', '#B48EEA', '#F5C08A', '#4FC3C7', '#FF6B6B'];
const coin = s => HUES[[...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];

/* ------------------------------------------------------------- TEMA */
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('sentinel_theme', t);
  $('themeIcon').innerHTML = t === 'light'
    ? '<path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a7 7 0 0 0 10.8 10.8z"/>'
    : '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>';
  if (lastData) render(lastData);
}
(function initTheme() {
  const saved = localStorage.getItem('sentinel_theme');
  setTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
})();
$('btnTheme').onclick = () => setTheme($('themeIcon').innerHTML.includes('M20.5') ? 'dark' : 'light');

/* --------------------------------------------------------------- POPOVER */
function close() { $('profileMenu').hidden = true; $('profile').setAttribute('aria-expanded', 'false'); }
$('profile').onclick = e => {
  e.stopPropagation();
  const m = $('profileMenu'); m.hidden = !m.hidden;
  $('profile').setAttribute('aria-expanded', String(!m.hidden));
};
document.addEventListener('click', close);
document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

/* ---------------------------------------------------------- GRAFICO */
function chart(series, liveTotal) {
  const el = $('chart'); let pts = (series || []).slice();
  if (liveTotal != null && pts.length) pts = pts.concat([{ t: Date.now() / 1000, e: liveTotal }]);
  if (pts.length < 2) { el.innerHTML = '<div class="empty">Sin historial todavía</div>'; return; }
  const P = pts.slice(-400);
  const W = 900, H = 176, pl = 52, pr = 12, pt = 12, pb = 20;
  const ys = P.map(p => p.e);
  const start = (lastData && lastData.equity && lastData.equity.start) || null;
  let mn = Math.min(...ys), mx = Math.max(...ys);
  if (start != null) { mn = Math.min(mn, start); mx = Math.max(mx, start); }
  const pad = (mx - mn) * 0.12 || Math.max(.01, mx * .01); mn -= pad; mx += pad;
  const X = i => pl + i * (W - pl - pr) / (P.length - 1);
  const Y = v => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
  const D = P.map((p, i) => ({ x: X(i), y: Y(p.e), e: p.e }));
  let d = 'M ' + D[0].x + ' ' + D[0].y;
  for (let i = 0; i < D.length - 1; i++) {
    const a = D[i - 1] || D[i], b = D[i], c = D[i + 1], e = D[i + 2] || c;
    d += ` C ${b.x + (c.x - a.x) / 6} ${b.y + (c.y - a.y) / 6} ${c.x - (e.x - b.x) / 6} ${c.y - (e.y - b.y) / 6} ${c.x} ${c.y}`;
  }
  const area = d + ` L ${D[D.length - 1].x} ${H - pb} L ${D[0].x} ${H - pb} Z`;
  const last = D[D.length - 1];
  const up = start != null && last.e >= start;
  const ticks = [mx, mn + (mx - mn) / 2, mn].map(v => {
    const y = Y(v);
    return `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="var(--line-soft)" stroke-width="1" stroke-dasharray="2 4"/>
      <text x="${pl - 6}" y="${y + 3.5}" text-anchor="end" font-size="11" fill="var(--fg-ghost)" font-family="var(--font-num)">$${nf(v)}</text>`;
  }).join('');
  const base = (start != null)
    ? `<line x1="${pl}" y1="${Y(start)}" x2="${W - pr}" y2="${Y(start)}" stroke="var(--${up ? 'pos' : 'neg'})" stroke-width="1.2" opacity=".75" stroke-dasharray="5 3"/>
       <text x="${W - pr}" y="${Y(start) - 5}" text-anchor="end" font-size="11" fill="var(--fg-ghost)" font-family="var(--font-num)">capital $${nf(start)}</text>` : '';
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Balance acumulado de ${P.length} puntos, de $${nf(ys[0])} a $${nf(last.e)}">
    ${ticks}${base}
    <path d="${area}" fill="url(#g)"/>
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round"/>
    <circle cx="${last.x}" cy="${last.y}" r="3" fill="var(--accent)"/>
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--accent)" stop-opacity=".2"/>
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
  </svg>`;
  const w = el;
  const show = i => {
    const b = D[i], t = $('ctip'), dt = new Date((P[i].t || 0) * 1000);
    t.style.display = 'block'; t.style.left = (b.x / W * 100) + '%'; t.style.top = (b.y / H * 100) + '%';
    const rel = start ? ((b.e / start - 1) * 100) : null;
    t.innerHTML = `<small>${dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</small>$${nf(b.e)}`
      + (rel != null ? `<em class="${rel >= 0 ? 'pos' : 'neg'}">${rel >= 0 ? '+' : '−'}${Math.abs(rel).toFixed(2)}%</em>` : '');
  };
  const near = e => {
    const r = w.getBoundingClientRect(), rx = (e.clientX - r.left) / r.width * W;
    let b = 0, bd = 1e9; D.forEach((p, i) => { const t = Math.abs(p.x - rx); if (t < bd) { bd = t; b = i; } });
    show(b);
  };
  w.onmousemove = near;
  w.ontouchstart = e => { if (e.touches && e.touches[0]) near(e.touches[0]); };
  w.ontouchmove = e => { if (e.touches && e.touches[0]) near(e.touches[0]); };
  w.onmouseleave = () => { $('ctip').style.display = 'none'; };
}

/* ------------------------------------------------------------- RENDER */
function render(d) {
  lastData = d;
  const eq = d.equity || {}, pos = d.positions || [], trades = d.trades || [];
  const dec = d.decisions || {}, met = d.metrics || {}, st = d.strategy || {};
  const ctx = d.context || {}, px = d.providers?.prices || {}, pr = d.providers?.sources || [];
  const syms = (st.symbols || []).filter(s => !q || s.toLowerCase().includes(q));
  if (!syms.includes(sel)) sel = syms[0] || '';
  const total = eq.total ?? eq.equity ?? 0;
  const pct = eq.start ? (total / eq.start - 1) * 100 : 0;
  const unreal = pos.reduce((a, p) => {
    const t = px[p.symbol]?.price ?? p.entry;
    return a + (t - p.entry) * (p.qty || 0);
  }, 0);

  /* --- barra superior --- */
  $('greetSub').textContent = (st.session || '').replace('Diario ', '');
  $('pfSub').textContent = '@jev · ' + (d.provider || '');

  /* --- decision --- */
  const cd = dec[sel] || {};
  $('fVerdict').className = 'verdict ' + (cd.choice || 'HOLD');
  $('fVerdict').textContent = cd.choice || '—';
  $('fSym').textContent = SYM(sel);
  $('fPrice').textContent = cd.price ? '$' + nf(cd.price) : '—';
  const c = ctx[sel] || {};
  const mm = c.market_ctx || {}, ob = mm.orderbook || {}, dv = mm.derivs || {}, pc = (cd.state_sent?.portfolio) || {};
  $('fFacts').innerHTML = [
    c.dist_sma50_pct != null && `${sgn(c.dist_sma50_pct)}${fmt(c.dist_sma50_pct, 2)}% s/ media` || '',
    c.ret_30d_pct != null && `30 d ${sgn(c.ret_30d_pct)}${fmt(c.ret_30d_pct, 1)}%` || '',
    c.vol_30d != null && `vol ${fmt(c.vol_30d, 0)}%` || '',
    cd.state_sent?.atr_pct != null && `ATR ${fmt(cd.state_sent.atr_pct, 2)}%` || '',
    cd.plan?.sl_pct != null && `stop −${fmt(cd.plan.sl_pct, 1)}%` || '',
    cd.execute != null && `ejecutar ${Math.round(cd.execute * 100)}%` || '',
  ].filter(Boolean).map(f => `<span class="fact">${esc(f)}</span>`).join('');
  $('dots').innerHTML = syms.map(s => `<i role="tab" tabindex="0" aria-current="${s === sel}" data-s="${s}" aria-label="${SYM(s)}"></i>`).join('');

  /* --- balance --- */
  $('balNum').textContent = '$' + nf(total);
  const bd = $('balDelta'); bd.className = 'balance-delta ' + cls(pct);
  bd.textContent = sgn(pct) + fmt(Math.abs(pct), 2) + '% ' + arrow(pct) + (eq.start ? `  desde $${nf(eq.start)}` : '');
  $('eqReal').textContent = ((total - eq.start) < 0 ? '−' : '') + '$' + nf(Math.abs(total - eq.start));
  const eu = $('eqUnreal'); eu.className = 'v ' + cls(unreal);
  eu.textContent = sgn(unreal) + '$' + nf(Math.abs(unreal));
  const dd = $('eqDD');
  const ddv = eq.max_dd_pct != null ? fmt(eq.max_dd_pct, 2) + '%' : '—';
  dd.textContent = ddv;
  dd.className = 'v ' + (ddv !== '—' && eq.max_dd_pct > 0 ? 'warn' : '');

  const slo = (met.slo && met.slo.length) || 0, errs = d.data_errors || 0;
  const maxc = st.max_concurrent || 5, over = pos.length > maxc;
  $('eqChips').innerHTML = [
    [over ? `⚠ posiciones ${pos.length}/${maxc} (excede el límite)` : `posiciones ${pos.length}/${maxc}`, over ? 'warn' : ''],
    [`decisiones ${d.cycles || 0}`, ''],
    [`errores ${errs}`, errs ? 'neg' : ''],
    [`latencia ${met.lat_p50_ms ? fmt(met.lat_p50_ms, 0) + ' ms' : '—'}`, ''],
    [slo ? `⚠ SLO ${slo}` : '✓ SLO en verde', slo ? 'neg' : 'ok'],
  ].map(([t, cl]) => `<span class="chip ${cl || ''}">${esc(t)}</span>`).join('');

  /* --- posiciones --- */
  $('posSub').textContent = pos.length ? `${pos.length} de ${maxc}` : 'ninguna';
  $('posList').innerHTML = pos.length ? pos.slice(0, 4).map(p => {
    const t = px[p.symbol]?.price ?? p.entry;
    const u = p.side === 'LONG' ? (t - p.entry) / p.entry * 100 : (p.entry - t) / p.entry * 100;
    const sgn2 = u > 0.005 ? 'pos' : u < -0.005 ? 'neg' : 'flat';
    return `<div class="posrow" data-s="${p.symbol}" data-sign="${sgn2}" tabindex="0" role="button" aria-label="${SYM(p.symbol)} ${p.side}, ${sgn(u)}${fmt(Math.abs(u), 2)} por ciento">
      <span class="coin" style="background:${coin(p.symbol)}" aria-hidden="true">${SYM(p.symbol).slice(0, 2)}</span>
      <span class="info"><b>${SYM(p.symbol)} · ${esc(p.side)}</b>
        <span>$${nf(p.qty)} @ ${nf(p.entry)} · ${dur(p.age_min)}</span></span>
      <span class="chg ${cls(u)}">${sgn(u)}${fmt(Math.abs(u), 2)}% ${arrow(u)}</span></div>`;
  }).join('') : '<div class="empty">Sin posiciones abiertas.</div>';

  $('positionsTbl').innerHTML = pos.length ? pos.map(p => {
    const t = px[p.symbol]?.price ?? p.entry;
    const u = (t - p.entry) / p.entry * 100;
    return `<tr><td>${SYM(p.symbol)}</td><td>${esc(p.side)}</td><td>${nf(p.entry)}</td>
      <td>${nf(t)}</td><td>$${nf(p.qty)}</td><td>${nf(p.sl)}</td><td>${nf(p.tp)}</td>
      <td class="${cls(u)}">${sgn(u)}${fmt(Math.abs(u), 2)}% ${arrow(u)}</td>
      <td>${dur(p.age_min)}</td>
      <td class="dim">${fmt(p.mfe_pct, 2)}% / ${fmt(p.mae_pct, 2)}%</td></tr>`;
  }).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--fg-dim)">Sin posiciones abiertas</td></tr>';

  /* --- calibracion --- */
  const cali = d.calibration || {};
  const nEval = cali.n_evaluated || 0;
  const bk = Object.keys(cali.buckets || {});
  const caliOk = (cali.brier != null && cali.brier <= 0.311);
  $('calibSub').textContent = nEval ? `medido sobre ${nEval} resultado${nEval === 1 ? '' : 's'}` : 'acumulando muestras';
  const cell = (k, v, sub, state, bar) => `<div class="calib-cell"${state ? ` data-state="${state}"` : ''}>
    <span class="k">${k}</span><span class="v">${v}</span>
    ${bar ? `<span class="bar"><i style="width:${bar}%;background:var(--${state || 'fg-ghost'})"></i></span>` : ''}
    ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</div>`;
  $('calibBody').innerHTML = !nEval
    ? `<div class="calib-grid">
        ${cell('Brier score', '—', 'sin muestras aún')}
        ${cell('Tasa base', '0.311', 'la referencia para comparar')}
        ${cell('Decisiones medidas', '0', 'horizontes de 1, 5 y 20 días')}
        ${cell('Estado', 'midiendo', 'el primer resultado llega tras el primer horizonte')}
      </div>
      <p class="calib-note">Las decisiones se evalúan a <b>1, 5 y 20 días</b>: hasta que un horizonte madura no hay resultado contra el que medir la probabilidad que declara Jev. Mientras tanto el número no se inventa.</p>`
    : `<div class="calib-grid">
        ${cell('Brier score', fmt(cali.brier, 3), caliOk ? 'mejor que la tasa base' : 'peor que la tasa base', caliOk ? 'pos' : 'warn', (1 - Math.min(1, cali.brier / .6)) * 100)}
        ${cell('Tasa base', '0.311', 'sin referencia valida')}
        ${cell('Buckets de execute', String(bk.length), 'tramos con resultado medido')}
        ${cell('Decisiones medidas', String(nEval), 'resultados maduros')}
      </div>
      <p class="calib-note">${caliOk
        ? '<b>Calibrado.</b> El "execute" de Jev ordena los resultados: se puede usar como umbral.'
        : '<b>Sin calibrar.</b> El "execute" no supera a la tasa base, así que el umbral 0.65 es heurístico, no probabilístico. El motor sigue siendo el que decide.'}</p>`;

  /* --- activos --- */
  $('assetsSub').textContent = `${syms.length} activos vigilados · Jev decide 1× al día`;
  $('assets').innerHTML = syms.map(s => {
    const cc = dec[s] || {};
    const pr2 = px[s]?.price ?? cc.price ?? c.price;
    const vol = ctx[s]?.vol_30d;
    return `<button class="acard" data-s="${s}" aria-current="${s === sel}" role="tab">
      <span class="top">
        <span class="coin" style="background:${coin(s)}" aria-hidden="true">${SYM(s).slice(0, 1)}</span>
        <span class="tag ${cc.choice || 'HOLD'}">${cc.choice || '—'}</span>
      </span>
      <span class="sym">${SYM(s)}</span>
      <span class="px">${pr2 != null ? '$' + nf(pr2) : '—'}</span>
      <span class="meta">${vol != null ? 'vol ' + fmt(vol, 0) + '%' : ''}${ctx[s]?.dist_sma50_pct != null ? ' · ' + sgn(ctx[s].dist_sma50_pct) + fmt(ctx[s].dist_sma50_pct, 1) + '%' : ''}</span>
    </button>`;
  }).join('') || '<div class="empty">Sin activos</div>';

  /* --- detalle: ciclo --- */
  $('tabs').innerHTML = syms.map(s => `<button class="tab" role="tab" data-s="${s}" aria-current="${s === sel}">${SYM(s)}</button>`).join('');
  const ss = cd.state_sent;
  if (ss) {
    const j = JSON.stringify(ss, null, 1);
    $('stateBytes').textContent = (new Blob([j]).size) + ' B';
    $('stateJson').innerHTML = esc(j)
      .replace(/&quot;([^&]*?)&quot;:/g, '<span class="jkey">"$1"</span>:')
      .replace(/: &quot;(.*?)&quot;/g, ': <span class="jstr">"$1"</span>')
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="jnum">$1</span>')
      .replace(/: (null|true|false)/g, ': <span class="jnull">$1</span>');
  }
  $('decLat').textContent = cd.lat ? `latencia ${cd.lat} ms` : '';
  const pl = cd.plan;
  $('decBody').innerHTML = pl ? `<div class="kv">
      <span><b>stop</b>−${fmt(pl.sl_pct, 1)}%</span>
      <span><b>objetivo</b>+${fmt(pl.tp_pct, 1)}%</span>
      <span><b>R:R</b>${pl.rr}:1</span>
      <span><b>confianza stop</b>${fmt(pl.stop_conf, 2)}</span>
      <span><b>máx</b>${dur(pl.hold_min || 20160)}</span>
    </div>` : '<div class="empty">Jev no devolvió plan para este ciclo.</div>';

  /* --- detalle: mercado --- */
  $('marketGrid').innerHTML = syms.map(s => {
    const cc = ctx[s] || {}, m = cc.market_ctx || {}, o = m.orderbook || {}, v = m.derivs || {};
    return `<div class="stat"><div class="k">${SYM(s)}</div>
      <div class="v">${cc.price != null ? '$' + nf(cc.price) : '—'}</div>
      ${m.fear_greed ? `<div class="sub">${esc(m.fear_greed.label || '')} · ${m.fear_greed.value ?? '—'}</div>` : ''}
      ${o.imb != null ? `<div class="sub">desequilibrio ${fmt(o.imb, 3)}</div>` : ''}
      ${v.funding_rate != null ? `<div class="sub">funding ${v.funding_rate}</div>` : ''}
      ${m.xexch_premium_bps != null ? `<div class="sub">otra plaza ${sgn(m.xexch_premium_bps)}${fmt(Math.abs(m.xexch_premium_bps), 2)} bps</div>` : ''}
      ${cc.vol_30d != null ? `<div class="sub">volatilidad 30 d ${fmt(cc.vol_30d, 1)}%</div>` : ''}</div>`;
  }).join('') || '<div class="empty">esperando contexto…</div>';

  /* --- detalle: salud --- */
  $('healthGrid').innerHTML = [
    ['Calibración de Jev', cali.brier != null ? fmt(cali.brier, 3) : '—', cali.n_evaluated ? `${cali.n_evaluated} evaluadas` : 'aún sin resultados'],
    ['Decisiones', d.cycles || 0, 'hoy, una por activo'],
    ['Latencia p50', met.lat_p50_ms ? fmt(met.lat_p50_ms, 0) + ' ms' : '—', ''],
    ['Latencia p95', met.lat_p95_ms ? fmt(met.lat_p95_ms, 0) + ' ms' : '—', ''],
    ['Aperturas / cierres', `${met.opens || 0} / ${met.closes || 0}`, ''],
    ['Vetos de riesgo', met.vetoes || 0, 'por tope de correlación'],
    ['Errores de datos', d.data_errors || 0, ''],
    ['Proveedores en vivo', pr.filter(x => x.ok).length + '/' + pr.length, 'muestreados cada 30 s'],
    ['SLO', (met.slo && met.slo.length) ? '⚠ ' + met.slo.length : '✓ en verde', ''],
    ['Límite de posiciones', `${pos.length}/${maxc}`, over ? 'excede el límite' : 'dentro del límite'],
  ].map(([k, v, sub]) => `<div class="stat"><div class="k">${k}</div>
      <div class="v">${esc(String(v))}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`).join('');

  /* --- detalle: trades y ciclos --- */
  $('tradesTbl').innerHTML = trades.length ? trades.map(t => `<tr>
      <td>${esc(t.trade_id || '')}</td><td>${SYM(t.symbol || '')}</td><td>${esc(t.side || '')}</td>
      <td>${nf(t.entry)}</td><td>${nf(t.exit)}</td>
      <td class="${cls(t.pnl_pct)}">${sgn(t.pnl_pct)}${fmt(Math.abs(t.pnl_pct), 2)}% ${arrow(t.pnl_pct)}</td>
      <td class="${cls(t.pnl_usdt)}">${sgn(t.pnl_usdt)}${fmt(Math.abs(t.pnl_usdt), 3)}</td>
      <td class="dim">${esc(t.exit_reason || '')}</td>
      <td class="dim">${dur(t.duration_min)}</td></tr>`).join('')
    : '<tr><td colspan="9" style="text-align:center;color:var(--fg-dim)">Sin operaciones cerradas</td></tr>';

  const cyc = d.cycles_influx || [];
  $('cyclesTbl').innerHTML = cyc.length ? cyc.slice(0, 40).map(c => `<tr>
      <td class="dim">${esc(c.cycle_id || '')}</td><td>${SYM(c.symbol || '')}</td>
      <td class="dim">${c.time ? new Date(c.time).toISOString().slice(11, 16) : '—'}</td>
      <td>${c.price != null ? nf(c.price) : '—'}</td>
      <td><span class="tag ${c.jev_choice || 'HOLD'}">${c.jev_choice || '—'}</span></td>
      <td>${c.jev_execute != null ? Math.round(c.jev_execute * 100) + '%' : '—'}</td>
      <td class="dim">${c.latency_ms ? c.latency_ms + ' ms' : '—'}</td>
      <td class="dim">${esc(c.jev_setup || '')}</td></tr>`).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--fg-dim)">Sin ciclos registrados</td></tr>';

  /* --- grafico --- */
  const fresh = px[sel]?.age_s;
  $('chartSub').textContent = (pos.length && fresh != null) ? `marcado a mercado · hace ${Math.round(fresh)} s` : 'equidad por operación';
  chart(d.equity_curve, total);
}

/* ---------------------------------------------------------- DATOS */
let _inflight = false, _abort = null;
async function tick() {
  if (!feedOn || _inflight) return;
  _inflight = true;
  try {
    const url = LIVE ? (API + '/api/public') : ('./snapshot.json?t=' + Date.now());
    const ctl = new AbortController(); _abort = ctl;
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw 0;
    const data = await r.json();
    render(data); fails = 0; lastOk = Date.now() / 1000;
    $('apihint').textContent = `datos en vivo · ${API}/api/public · 1 s`;
  } catch (e) {
    if (e && e.name === 'AbortError') { /* cancelado: no es fallo */ }
    else {
      fails++;
      if (fails >= 3 && LIVE && CANDS.length > 1) { ci = (ci + 1) % CANDS.length; API = CANDS[ci]; LIVE = API.startsWith('http'); }
      if (lastData) $('apihint').textContent = `conexión interrumpida · último dato hace ${ago(Date.now() / 1000 - lastOk)}`;
    }
  } finally { _inflight = false; _abort = null; }
}
$('btnFeed').onclick = () => {
  feedOn = !feedOn;
  $('btnFeed').setAttribute('aria-pressed', String(!feedOn));
  $('feedIcon').innerHTML = feedOn ? '<path d="M8 5v14l11-7z"/>' : '<path d="M7 4v16M17 4v16"/>';
  if (!feedOn && _abort) { try { _abort.abort(); } catch (e) { } }
};

/* ---------------------------------------------------------- RUTEO */
const VIEWS = ['market', 'health', 'positions', 'trades', 'cycles'];
function route() {
  const h = (location.hash || '').replace('#', '');
  const isRes = !h || h === 'top';
  $('v-resumen').classList.toggle('on', isRes);
  $('v-det').classList.toggle('on', !isRes);
  document.querySelectorAll('.nv').forEach(b => {
    if (b.dataset.go === (h || 'top')) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (!isRes && VIEWS.includes(h)) { const t = document.getElementById(h); if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 30); }
}
addEventListener('hashchange', route);
document.querySelectorAll('.nv').forEach(b => b.onclick = () => { location.hash = b.dataset.go === 'top' ? 'top' : b.dataset.go; });

/* ---------------------------------------------------------- EVENTOS */
document.addEventListener('click', e => {
  const t = e.target.closest('#dots i, [data-s]');
  if (!t) return;
  sel = t.dataset.s; localStorage.setItem('sentinel_sel', sel);
  if (lastData) render(lastData);
});
document.addEventListener('keydown', e => {
  const t = document.activeElement;
  if (t && t.matches('#dots i, .acard, .posrow') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault(); sel = t.dataset.s; localStorage.setItem('sentinel_sel', sel); if (lastData) render(lastData);
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('q').focus(); }
  if (e.key === 'Escape') close();
});
$('q').oninput = e => { q = e.target.value.trim().toLowerCase(); if (lastData) render(lastData); };

/* ------------------------------------------------------- CRISTAL 3D */
function boot3D() {
  const cvs = $('glHero'); if (!cvs || cvs.dataset.on) return; cvs.dataset.on = '1';
  import('three').then(async T => {
    const { GLTFLoader } = await import('./vendor/three/GLTFLoader.js');
    const r = new T.WebGLRenderer({ canvas: cvs, alpha: true, antialias: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    const sc = new T.Scene(), cam = new T.PerspectiveCamera(38, 1, .1, 100);
    cam.position.set(0, 0, 4.4);
    sc.add(new T.AmbientLight(0xffffff, .45));
    const k1 = new T.DirectionalLight(0xE08B45, 2.4); k1.position.set(2, 3, 3); sc.add(k1);
    const k2 = new T.DirectionalLight(0x8B7CF6, 1.5); k2.position.set(-3, -1, -2); sc.add(k2);
    new GLTFLoader().load('assets/models/crystal-big.glb', g => {
      const box = new T.Box3().setFromObject(g.scene), sz = new T.Vector3(); box.getSize(sz);
      g.scene.scale.setScalar(2.6 / Math.max(sz.x, sz.y, sz.z));
      const b2 = new T.Box3().setFromObject(g.scene), c = new T.Vector3(); b2.getCenter(c); g.scene.position.sub(c);
      g.scene.traverse(o => { if (o.isMesh) { o.material.color.set(0xE08B45); o.material.metalness = .55; o.material.roughness = .18; } });
      sc.add(g.scene);
      let rx = 0, ry = 0, dr = false, px0 = 0, py0 = 0;
      cvs.onpointerdown = e => { dr = true; px0 = e.clientX; py0 = e.clientY; };
      addEventListener('pointerup', () => dr = false);
      cvs.onpointermove = e => { if (!dr) return; ry += (e.clientX - px0) * .01; rx += (e.clientY - py0) * .01; px0 = e.clientX; py0 = e.clientY; };
      const fit = () => { const w = cvs.clientWidth || 168; r.setSize(w, w, false); cam.aspect = 1; cam.updateProjectionMatrix(); };
      fit(); addEventListener('resize', fit);
      cvs.classList.add('ready');
      let t0 = performance.now();
      (function loop(t) {
        requestAnimationFrame(loop); const dt = (t - t0) / 1000; t0 = t;
        if (!dr) ry += dt * .4; g.scene.rotation.y = ry; g.scene.rotation.x = rx * .6; r.render(sc, cam);
      })(t0);
    });
  }).catch(() => { /* sin WebGL o asset caido: el emblema SVG queda */ });
}

route(); tick(); setInterval(tick, 1000);
/* rotacion automatica del activo en foco: se detiene si el usuario elige uno */
setInterval(() => {
  if (!lastData || !feedOn) return;
  const h = (location.hash || '').replace('#', '');
  if (h && h !== 'top') return;
  const s = (lastData.strategy || {}).symbols || [];
  if (s.length > 1) { rot++; sel = s[rot % s.length]; render(lastData); }
}, 9000);

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); boot3D(); } }), { rootMargin: '250px' });
  io.observe($('focus'));
} else addEventListener('load', boot3D, { once: true });