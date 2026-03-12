import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getChartPrices, getLatestSignal } from '../lib/influxdb';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity, Terminal, BrainCircuit, Target, Wallet, ArrowUpRight } from 'lucide-react';

export default function Overview() {
    const [portfolio, setPortfolio] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [signal, setSignal] = useState<any>(null);
    const [chartAsset] = useState<string>('NASDAQ100');
    const [realPF, setRealPF] = useState<string>('0.00');

    useEffect(() => {
        fetchData();
        const cleanupRealtime = setupRealtime();
        // FIX #2: Reduced from 1s to 8s to avoid TiDB query storm (86k req/day → 10k req/day)
        const liveHFT = setInterval(fetchLiveChart, 8000);
        return () => {
            clearInterval(liveHFT);
            cleanupRealtime(); // FIX #3: Now properly cleans up Supabase WebSocket channel
        };
    }, []);

    const fetchData = async () => {
        // Fetch current portfolio
        const { data: pData } = await supabase.from('ghost_portfolio').select('*').limit(1);
        if (pData && pData.length > 0) setPortfolio(pData[0]);

        // FIX #1: Calculate REAL Profit Factor from actual trade PnL sums, not win/loss count ratio
        const { data: tradeData } = await supabase
            .from('ghost_trades')
            .select('pnl')
            .eq('status', 'CLOSED');
        if (tradeData && tradeData.length > 0) {
            let grossProfit = 0;
            let grossLoss = 0;
            tradeData.forEach((t: any) => {
                const pnl = parseFloat(t.pnl) || 0;
                if (pnl >= 0) grossProfit += pnl;
                else grossLoss += Math.abs(pnl);
            });
            const pf = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '0.00');
            setRealPF(pf);
        }

        // Fetch logs
        const { data: lData } = await supabase.from('ghost_reflections').select('*').order('created_at', { ascending: false }).limit(6);
        if (lData) setLogs(lData);
    };

    const fetchLiveChart = async () => {
        try {
            const rows = await getChartPrices(chartAsset, 30);
            if (rows && rows.length > 0) {
                const chartData = rows.reverse().map((r: any) => ({
                    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    balance: Number(parseFloat(r.price).toFixed(2))
                }));
                setHistory(chartData);
            }

            // Sync ML Signal
            const sData = await getLatestSignal();
            if (sData) {
                setSignal({ predict: sData.ml_prediction, target: sData.symbol, conf: sData.hybrid_confidence });
            }
        } catch (e) { console.error(e); }
    };

    const setupRealtime = (): (() => void) => {
        const ch = supabase.channel('react-overview-dashboard');
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_portfolio' }, fetchData);
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_trades' }, fetchData);
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ghost_reflections' }, fetchData);
        ch.subscribe();
        // FIX #3: Return cleanup function so useEffect can actually call it
        return () => { supabase.removeChannel(ch); };
    };

    if (!portfolio) return <div className="text-slate-500 animate-pulse p-10">Initializing Quantum Relays...</div>;

    const startBalance = Number(portfolio.start_balance);
    const balance = Number(portfolio.balance);
    const pnl = balance - startBalance;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-accent-green' : 'text-accent-red';
    const wins = Number(portfolio.wins);
    const losses = Number(portfolio.losses);
    const wr = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';
    // FIX #1: Use realPF (calculated from actual gross profit / gross loss) instead of win count ratio
    const profitFactor = realPF;

    // Circular Progress Math
    const signalScore = signal?.conf ? Number(signal.conf) / 100 : 0;
    const signalPredict = signal?.predict || 'WAITING';
    const signalTarget = signal?.target || '---';

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">
            {/* Top Stat row */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-b border-primary/30">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Wallet size={14} className="text-primary" /> Total Equity
                    </span>
                    <h3 className="text-3xl font-mono text-white tracking-tight">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                </div>

                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden border-b border-accent-green/30">
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl ${isProfit ? 'bg-accent-green/20' : 'bg-accent-red/20'}`}></div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Activity size={14} className={pnlColor} /> Session PNL
                    </span>
                    <div className="flex items-baseline gap-2">
                        <h3 className={`text-3xl font-mono tracking-tight ${pnlColor} drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]`}>
                            {isProfit ? '+' : '-'}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </h3>
                        <span className={`text-[10px] font-mono ${pnlColor} opacity-80`}>
                            {startBalance > 0 ? ((pnl / startBalance) * 100).toFixed(2) : '0'}%
                        </span>
                    </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-b border-accent-amber/30">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Target size={14} className="text-accent-amber" /> Global Win Rate
                    </span>
                    <h3 className="text-3xl font-mono text-accent-amber drop-shadow-[0_0_8px_rgba(255,184,0,0.4)] tracking-tight">{wr}%</h3>
                </div>

                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-b border-accent-green/30">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                        <ArrowUpRight size={14} className="text-accent-green" /> Profit Factor
                    </span>
                    <h3 className="text-3xl font-mono text-accent-green drop-shadow-[0_0_8px_rgba(0,255,102,0.4)] tracking-tight">{realPF}</h3>
                </div>
            </div>

            {/* Middle Section: Chart and Sentiment */}
            <div className="md:col-span-8 glass-panel rounded-2xl p-6 flex flex-col min-h-[350px]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><TrendingUp className="text-primary" /> L2 Live Market Stream</h3>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">Real-time InfluxDB HFT Telemetry ({chartAsset})</p>
                    </div>
                </div>
                <div className="flex-1 w-full h-[300px] min-h-[250px] relative">
                    <ResponsiveContainer width="100%" height={300} minHeight={250}>
                        <AreaChart data={history} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#257bf4" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#257bf4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" stroke="#27272a" fontSize={10} tickMargin={10} minTickGap={30} />
                            <YAxis domain={['dataMin', 'dataMax']} stroke="#27272a" fontSize={10} tickFormatter={(val) => `$${val}`} orientation="right" width={60} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', border: '1px solid #27272a', borderRadius: '8px', backdropFilter: 'blur(8px)' }}
                                itemStyle={{ color: '#257bf4', fontFamily: 'monospace' }}
                            />
                            <Area isAnimationActive={false} type="monotone" dataKey="balance" stroke="#257bf4" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="md:col-span-4 flex flex-col gap-6">
                {/* AI Sentiment Radial */}
                <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center relative flex-1">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 w-full">
                        <BrainCircuit size={16} /> Protocol Sentiment ({signalTarget})
                    </h3>

                    <div className="relative w-40 h-40 mb-4">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                            <circle
                                cx="80" cy="80" r="70" fill="none" stroke="#257bf4" strokeWidth="10" strokeLinecap="round"
                                strokeDasharray={439.8} strokeDashoffset={439.8 - (439.8 * signalScore)}
                                className="drop-shadow-[0_0_12px_rgba(37,123,244,0.6)] transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white font-mono">{(signalScore * 100).toFixed(0)}%</span>
                            <span className="text-[10px] text-primary mt-1 tracking-widest uppercase">Confidence</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-surface-dark rounded-xl border border-white/5">
                        <span className={`w-2 h-2 rounded-full animate-pulse ${signalPredict.includes('LONG') || signalPredict.includes('BULL') ? 'bg-accent-green' :
                            (signalPredict.includes('SHORT') || signalPredict.includes('BEAR') ? 'bg-accent-red' : 'bg-primary')
                            }`}></span>
                        <p className={`text-sm font-bold tracking-widest uppercase ${signalPredict.includes('LONG') || signalPredict.includes('BULL') ? 'text-accent-green' :
                            (signalPredict.includes('SHORT') || signalPredict.includes('BEAR') ? 'text-accent-red' : 'text-primary')
                            }`}>{signalPredict}</p>
                    </div>
                </div>

                {/* AI Log */}
                <div className="glass-panel rounded-2xl p-0 flex flex-col border border-primary/20 bg-[#05080a] flex-1 overflow-hidden h-[250px]">
                    <div className="bg-surface-dark px-4 py-3 border-b border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Terminal size={14} className="text-primary" />
                            <span className="text-xs font-mono text-slate-300 uppercase tracking-wider">AI Execution Log</span>
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                        </div>
                    </div>
                    <div className="p-4 font-mono text-[11px] flex-1 overflow-y-auto space-y-2 text-slate-400">
                        {logs.map(d => (
                            <div key={d.id} className="flex gap-2">
                                <span className="text-slate-600 shrink-0">[{new Date(d.created_at).toLocaleTimeString()}]</span>
                                <span className={d.analysis.includes('WIN') || d.analysis.includes('COMPLETED') ? 'text-accent-green' : 'text-slate-300'}>
                                    {d.analysis}
                                </span>
                            </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                            <span className="text-slate-600">Sentinel &gt;</span>
                            <span className="text-primary cursor-blink">_</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
