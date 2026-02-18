
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcXh2c2dkZ3hndG5oeHh4Y2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcwNTM0NCwiZXhwIjoyMDg0MjgxMzQ0fQ.mUKPJvTeG2MU4Fxfddcbcx2Q7H8EDuXcDtWAbHGvT48';
const SECRET_SEED = 'OMEGA_ZETA_99_QUANTUM_HASH_KEY_V1';
const START_BALANCE = 15.00;  // v9.5: Used for drawdown calculation

async function generateSignature(timestamp, nonce, sql) {
    const msg = SECRET_SEED + timestamp + nonce + sql;
    const encoder = new TextEncoder();
    const data = encoder.encode(msg);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function query(sql) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(2, 15);
    const signature = await generateSignature(timestamp, nonce, sql);

    const body = { p_timestamp: timestamp, p_nonce: nonce, p_signature: signature, p_payload: sql, p_mode: 'R' };

    try {
        const response = await fetch('https://udqxvsgdgxgtnhxxxcgv.supabase.co/rest/v1/rpc/_sys_kernel_opt_v9', {
            method: 'POST',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const textData = await response.text();
        try {
            const firstParse = JSON.parse(textData);
            if (typeof firstParse === 'string') return JSON.parse(firstParse);
            return firstParse;
        } catch (e) { console.error("Parse error:", e); return []; }
    } catch (e) { console.error("Fetch error:", e); return null; }
}

function getSessionName() {
    const h = new Date().getUTCHours();
    if (h >= 13 && h <= 16) return '🔥 OVERLAP (Golden Window)';
    if (h >= 7 && h < 13) return '🇬🇧 LONDON';
    if (h > 16 && h <= 22) return '🇺🇸 NEW YORK';
    return '😴 CLOSED';
}

function timeSince(dateStr) {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    if (min < 60) return `${min}m`;
    const hrs = Math.floor(min / 60);
    return `${hrs}h ${min % 60}m`;
}

async function updateDashboard() {
    document.getElementById('timestamp').innerText = `Última actualización: ${new Date().toLocaleTimeString('es-VE', { timeZone: 'America/Caracas' })}`;
    document.getElementById('session-badge').innerText = getSessionName();

    // 1. Portfolio
    const portfolio = await query("SELECT balance, start_balance, total_trades, wins, losses FROM public.ghost_portfolio ORDER BY id DESC LIMIT 1");
    if (portfolio && portfolio[0]) {
        const p = portfolio[0];
        const balance = parseFloat(p.balance);
        const startBal = parseFloat(p.start_balance) || START_BALANCE;
        const totalPnL = balance - startBal;
        const pnlPct = ((totalPnL / startBal) * 100);
        const wr = (parseInt(p.wins) + parseInt(p.losses)) > 0
            ? ((parseInt(p.wins) / (parseInt(p.wins) + parseInt(p.losses))) * 100)
            : 0;

        document.getElementById('balance').innerText = `$${balance.toFixed(2)}`;
        const balPctEl = document.getElementById('balance-pct');
        balPctEl.innerText = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% desde inicio`;

        const pnlEl = document.getElementById('total-pnl');
        pnlEl.innerText = `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`;
        pnlEl.className = `stat-value ${totalPnL >= 0 ? 'positive' : 'negative'}`;

        const pnlPctEl = document.getElementById('pnl-pct');
        pnlPctEl.innerText = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`;

        document.getElementById('winrate').innerText = `${wr.toFixed(0)}%`;
        document.getElementById('winrate').className = `stat-value ${wr >= 50 ? 'positive' : wr > 0 ? 'negative' : ''}`;
        document.getElementById('win-loss').innerText = `${p.wins}W / ${p.losses}L`;
        document.getElementById('total-trades').innerText = p.total_trades;

        // Risk per trade
        const riskDollars = balance * 0.01;
        document.getElementById('risk-dollars').innerText = `$${riskDollars.toFixed(4)} por trade`;

        // Drawdown calculations
        const totalDD = Math.max(0, ((startBal - balance) / startBal) * 100);
        const totalDDBar = document.getElementById('total-dd-bar');
        const totalDDVal = document.getElementById('total-dd-val');
        totalDDVal.innerText = `${totalDD.toFixed(1)}%`;
        totalDDBar.style.width = `${Math.min(totalDD * 10, 100)}%`; // 10% max = 100% bar
        totalDDBar.className = `progress-fill ${totalDD < 5 ? 'green' : totalDD < 8 ? 'yellow' : 'red'}`;
        totalDDVal.style.color = totalDD < 5 ? 'var(--accent-green)' : totalDD < 8 ? 'var(--accent-orange)' : 'var(--accent-red)';
    }

    // 2. Open Trades
    const openTrades = await query("SELECT id, asset, direction, entry_price, size, opened_at FROM public.ghost_trades WHERE status = 'OPEN' ORDER BY opened_at DESC");
    const tradesBody = document.getElementById('trades-body');
    document.getElementById('open-count').innerText = `${openTrades ? openTrades.length : 0} abiertos`;

    if (openTrades && openTrades.length > 0) {
        tradesBody.innerHTML = openTrades.map(t => {
            const typeClass = t.direction === 'LONG' ? 'long' : 'short';
            const icon = t.direction === 'LONG' ? '🟢' : '🔴';
            return `
                <tr>
                    <td><b>${icon} ${t.asset}</b></td>
                    <td><span class="trade-type ${typeClass}">${t.direction}</span></td>
                    <td>$${parseFloat(t.entry_price).toFixed(4)}</td>
                    <td>${parseFloat(t.size).toFixed(6)}</td>
                    <td style="color: var(--text-secondary)">—</td>
                    <td style="font-size:11px; color:#888">${timeSince(t.opened_at)}</td>
                </tr>
            `;
        }).join('');
    } else {
        tradesBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#666;">Sin posiciones abiertas — Sentinel esperando señal perfecta</td></tr>`;
    }

    // 3. Closed Trades History
    const closedTrades = await query("SELECT asset, direction, entry_price, exit_price, pnl, closed_at FROM public.ghost_trades WHERE status = 'CLOSED' ORDER BY closed_at DESC LIMIT 10");
    const historyList = document.getElementById('history-list');

    if (closedTrades && closedTrades.length > 0) {
        // Track daily losses for kill switch
        let dailyLosses = 0;
        const today = new Date().toDateString();

        historyList.innerHTML = closedTrades.map(t => {
            const pnl = parseFloat(t.pnl);
            const isWin = pnl >= 0;
            const icon = isWin ? '💰' : '💸';
            const pnlColor = isWin ? 'var(--accent-green)' : 'var(--accent-red)';
            const dir = t.direction === 'LONG' ? '🟢' : '🔴';

            if (!isWin && t.closed_at && new Date(t.closed_at).toDateString() === today) dailyLosses++;

            return `
                <div class="trade-history-item">
                    <div>
                        <span class="asset">${dir} ${t.asset}</span>
                        <span style="font-size:11px; color:#666; margin-left:8px;">$${parseFloat(t.entry_price).toFixed(2)} → $${parseFloat(t.exit_price).toFixed(2)}</span>
                    </div>
                    <span class="pnl" style="color:${pnlColor}">${icon} ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(4)}</span>
                </div>
            `;
        }).join('');

        // Update loss kill switch
        const lossBar = document.getElementById('loss-bar');
        const lossVal = document.getElementById('loss-count-val');
        lossVal.innerText = `${dailyLosses}/5`;
        lossBar.style.width = `${(dailyLosses / 5) * 100}%`;
        lossBar.className = `progress-fill ${dailyLosses < 3 ? 'green' : dailyLosses < 5 ? 'yellow' : 'red'}`;
        lossVal.style.color = dailyLosses < 3 ? 'var(--accent-green)' : dailyLosses < 5 ? 'var(--accent-orange)' : 'var(--accent-red)';
    } else {
        historyList.innerHTML = `<div style="padding:16px; text-align:center; color:#555;">Sin trades cerrados aún</div>`;
    }

    // 4. AI Reflections
    const reflections = await query("SELECT analysis, recommendation, win_rate, total_pnl, created_at FROM public.ghost_reflections ORDER BY created_at DESC LIMIT 3");
    const refList = document.getElementById('reflections-list');

    if (reflections && reflections.length > 0) {
        refList.innerHTML = reflections.map(r => {
            const analysis = r.analysis || '';
            const short = analysis.length > 200 ? analysis.substring(0, 200) + '...' : analysis;
            return `
                <div class="reflection-card">
                    <div class="reflection-text">${short}</div>
                    <div class="reflection-meta">WR: ${r.win_rate || 'N/A'}% | PnL: $${parseFloat(r.total_pnl || 0).toFixed(2)} | ${timeSince(r.created_at)} ago</div>
                </div>
            `;
        }).join('');
    } else {
        refList.innerHTML = `<div style="padding:16px; text-align:center; color:#555;">Sin reflexiones de IA aún</div>`;
    }
}

// Start and refresh every 5 seconds
updateDashboard();
setInterval(updateDashboard, 5000);
