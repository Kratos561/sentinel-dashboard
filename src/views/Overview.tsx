import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity, Terminal, BrainCircuit, Target, Wallet, ArrowUpRight } from 'lucide-react';

export default function Overview() {
    const [portfolio, setPortfolio] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [signal, setSignal] = useState<any>(null);

    useEffect(() => {
        fetchData();
        setupRealtime();
    }, []);

    const fetchData = async () => {
        // Fetch current portfolio
        const { data: pData } = await supabase.from('ghost_portfolio').select('*').limit(1);
        if (pData && pData.length > 0) {
            setPortfolio(pData[0]);

            // Build equity curve using the last 20 closed trades
            const { data: tData } = await supabase.from('ghost_trades')
                .select('closed_at, pnl')
                .not('closed_at', 'is', null)
                .order('closed_at', { ascending: false })
                .limit(20);

            if (tData) {
                let currentBal = Number(pData[0].balance);
                const historyData = [];
                for (let i = 0; i < tData.length; i++) {
                    // Safe parsing for Safari/webkit (strip microsecond fractions)
                    const cleanDateStr = tData[i].closed_at.split('.')[0] + 'Z';
                    historyData.unshift({
                        time: new Date(cleanDateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        balance: Number(currentBal.toFixed(4)),
                    });
                    currentBal -= Number(tData[i].pnl) || 0;
                }
                historyData.unshift({
                    time: 'T0',
                    balance: Number(currentBal.toFixed(4)),
                });
                setHistory(historyData);
            }
        }

        // Fetch logs
        const { data: lData } = await supabase.from('ghost_reflections').select('*').order('created_at', { ascending: false }).limit(6);
        if (lData) setLogs(lData);

        // Fetch signals
        const { data: sData } = await supabase.from('ghost_signals').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (sData && sData.ml_prediction) {
            try {
                const mlObj = typeof sData.ml_prediction === 'string'
                    ? (sData.ml_prediction.startsWith('{') ? JSON.parse(sData.ml_prediction) : { predict: sData.ml_prediction })
                    : sData.ml_prediction;
                setSignal(mlObj);
            } catch (e) {
                setSignal({ predict: String(sData.ml_prediction) });
            }
        }
    };

    const setupRealtime = () => {
        const ch = supabase.channel('react-overview-dashboard');
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_portfolio' }, fetchData);
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_trades' }, fetchData);
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ghost_reflections' }, fetchData);
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ghost_signals' }, fetchData);
        ch.subscribe();
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
    const profitFactor = losses > 0 ? (wins / losses).toFixed(2) : (wins > 0 ? '∞' : '0.00');

    // Circular Progress Math
    const signalScore = signal?.score ? Number(signal.score) : 0;
    const signalPredict = signal?.predict || 'WAITING';

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">
            {/* Top Stat row */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Wallet size={14} className="text-primary" /> Total Equity
                    </span>
                    <h3 className="text-3xl font-mono text-white tracking-tight">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                </div>

                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl ${isProfit ? 'bg-accent-green/20' : 'bg-accent-red/20'}`}></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Activity size={14} className={pnlColor} /> Session PNL
                    </span>
                    <div className="flex items-baseline gap-2">
                        <h3 className={`text-3xl font-mono tracking-tight ${pnlColor}`}>
                            {isProfit ? '+' : '-'}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </h3>
                        <span className={`text-sm font-mono ${pnlColor} opacity-80`}>
                            {startBalance > 0 ? ((pnl / startBalance) * 100).toFixed(2) : '0'}%
                        </span>
                    </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Target size={14} className="text-primary" /> Win Rate
                    </span>
                    <h3 className="text-3xl font-mono text-white tracking-tight">{wr}%</h3>
                </div>

                <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <ArrowUpRight size={14} className="text-primary" /> Profit Factor
                    </span>
                    <h3 className="text-3xl font-mono text-white tracking-tight">{profitFactor}</h3>
                </div>
            </div>

            {/* Middle Section: Chart and Sentiment */}
            <div className="md:col-span-8 glass-panel rounded-2xl p-6 flex flex-col min-h-[350px]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><TrendingUp className="text-primary" /> Live Equity Curve</h3>
                        <p className="text-xs text-slate-500 mt-1">Real-time portfolio growth tracking</p>
                    </div>
                </div>
                <div className="flex-1 w-full h-[300px] min-h-[250px] relative">
                    <ResponsiveContainer width="100%" height={300} minHeight={250}>
                        <AreaChart data={history} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#13c8ec" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#13c8ec" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" stroke="#334155" fontSize={10} tickMargin={10} minTickGap={30} />
                            <YAxis domain={['auto', 'auto']} stroke="#334155" fontSize={10} tickFormatter={(val) => `$${val}`} orientation="right" width={60} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f141a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                itemStyle={{ color: '#13c8ec', fontFamily: 'monospace' }}
                            />
                            <Area type="monotone" dataKey="balance" stroke="#13c8ec" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="md:col-span-4 flex flex-col gap-6">
                {/* AI Sentiment Radial */}
                <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center relative flex-1">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 w-full">
                        <BrainCircuit size={16} /> Protocol Sentiment
                    </h3>

                    <div className="relative w-40 h-40 mb-4">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                            <circle
                                cx="80" cy="80" r="70" fill="none" stroke="#13c8ec" strokeWidth="10" strokeLinecap="round"
                                strokeDasharray={439.8} strokeDashoffset={439.8 - (439.8 * signalScore)}
                                className="drop-shadow-[0_0_8px_rgba(19,200,236,0.6)] transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white font-mono">{(signalScore * 100).toFixed(0)}%</span>
                            <span className="text-[10px] text-primary mt-1">CONFIDENCE</span>
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
