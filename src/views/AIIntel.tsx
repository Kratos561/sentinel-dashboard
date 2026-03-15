import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TerminalSquare, ShieldCheck, BrainCircuit, Zap } from 'lucide-react';

const MODULES = [
    { label: 'DL Engine (REAL)', value: 'WIRED', color: 'text-primary', desc: 'V11.3: Keras3 Patch + CryptoCompare' },
    { label: 'DL Weight in Hybrid', value: '60%', color: 'text-primary', desc: 'Domina el ML Score (60% del voto)' },
    { label: 'Hybrid Min Score', value: '68%', color: 'text-primary', desc: 'V11.3: Bajado de 72% para permitir trades' },
    { label: 'Regime Filter (ADX≥15)', value: 'ACTIVE', color: 'text-accent-green', desc: 'V11.3: Threshold bajado de 20→15' },
    { label: 'DCA Safety Orders', value: '2 MAX', color: 'text-accent-green', desc: 'Inyección de rescate x1.5 cada vez' },
    { label: 'Bollinger + Mean Rev', value: '10% WT', color: 'text-accent-green', desc: 'Reversión a la media activa' },
    { label: 'Breakeven Auto', value: '@ 65%', color: 'text-accent-green', desc: 'Protege entry al 65% del TP' },
    { label: 'Snowball Lot Adj', value: '+35%/WIN', color: 'text-accent-amber', desc: 'Max 3.5x en racha ganadora' },
    { label: 'Regime Choppiness Max', value: '61.8', color: 'text-accent-amber', desc: 'CI > 61.8 = mercado trampa = NO TRADE' },
    { label: 'Asset Blacklist', value: 'SUI, SP500, BNB', color: 'text-accent-red', desc: 'Activos tóxicos bloqueados permanently' },
    { label: 'Kill Switch', value: '4 LOSSES/DAY', color: 'text-accent-red', desc: 'Corta fuego si pierde 4 veces en el día' },
    { label: 'Balance Floor', value: '$10.00', color: 'text-accent-red', desc: 'Apagado automático si bóveda < $10' },
];

export default function AIIntel() {
    const [logs, setLogs] = useState<any[]>([]);
    const [botStatus, setBotStatus] = useState<any>(null);

    useEffect(() => {
        fetchLogs();
        fetchBotStatus();
        const interval = setInterval(fetchBotStatus, 30000);
        const ch = supabase.channel('react-intel-tab');
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ghost_reflections' }, fetchLogs);
        ch.subscribe();
        return () => {
            clearInterval(interval);
            supabase.removeChannel(ch);
        };
    }, []);

    const fetchLogs = async () => {
        try {
            const { data } = await supabase.from('ghost_reflections').select('*').order('created_at', { ascending: false }).limit(20);
            if (data) setLogs(data);
        } catch (e) { console.error(e) }
    };

    const fetchBotStatus = async () => {
        try {
            const res = await fetch('https://p01--sentinel-advance--blnvcmgxk6zh.code.run/');
            if (res.ok) {
                const data = await res.json();
                setBotStatus(data);
            }
        } catch (e) { /* silently fail */ }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Neural Terminal */}
            <div className="lg:col-span-8 glass-panel rounded-2xl flex flex-col min-h-[500px] border border-primary/20 bg-[#05080a] relative">
                <div className="bg-surface-dark px-6 py-4 border-b border-white/5 flex justify-between items-center rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <TerminalSquare size={16} className="text-primary" />
                        <span className="text-[12px] font-mono text-white uppercase tracking-widest font-bold flex flex-col">
                            SENTINEL NEURAL TERMINAL
                            <span className="text-[9px] text-slate-500 tracking-[0.2em] font-normal">FABIO VALENTINI × DL ENGINE V11.3</span>
                        </span>
                    </div>
                    {botStatus && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-glow" />
                            <span className="text-[10px] font-mono text-primary uppercase tracking-widest">
                                Cycle #{botStatus.cycle} · {Math.floor(botStatus.uptime / 60)}m uptime
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex-1 p-6 font-mono text-xs overflow-y-auto space-y-3">
                    <div className="text-primary mb-6 animate-pulse drop-shadow-[0_0_8px_rgba(37,123,244,0.6)]">
                        ============================================<br />
                        SENTINEL ÁGUILA IMPERIAL V11.3 INIT<br />
                        DL ENGINE: KERAS3 PATCH LOADER ONLINE<br />
                        HYBRID SCORE: DL(60%) + OF(35%) + MR(10%)<br />
                        REGIME FILTER: ADX≥15 | CI≤61.8<br />
                        CONNECTION SECURED OVER ENCRYPTED LINK<br />
                        ============================================
                    </div>
                    {logs.map((log) => {
                        const date = new Date(log.created_at);
                        const isWin = log.analysis.includes('WIN') || log.analysis.includes('COMPLETED') || log.analysis.includes('OPEN');
                        const isLoss = log.analysis.includes('LOSS') || log.analysis.includes('WARNING');
                        const colorCls = isWin ? 'text-accent-green' : (isLoss ? 'text-accent-red' : 'text-slate-300');

                        return (
                            <div key={log.id} className="flex flex-col gap-1 border-b border-white/5 pb-2 mb-2">
                                <span className={`shrink-0 opacity-70 ${colorCls}`}>
                                    [{date.toLocaleTimeString()} - AI NODE: ALPHA]
                                </span>
                                <span className={`${colorCls} pl-2 border-l-2 border-current ml-2`}>
                                    {log.analysis}
                                </span>
                            </div>
                        )
                    })}
                    <div className="flex gap-2 pt-4 pl-4 items-center">
                        <span className="text-primary">root@sentinel-v11.3:~# </span>
                        <span className="w-2 h-4 bg-primary animate-pulse"></span>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">
                {/* DL Engine status card */}
                <div className="glass-panel p-5 rounded-2xl border border-primary/30 relative overflow-hidden bg-[#050a14]">
                    <div className="absolute top-0 left-0 w-1 bg-primary h-full shadow-glow" />
                    <div className="flex items-center gap-3 mb-4">
                        <BrainCircuit size={20} className="text-primary drop-shadow-[0_0_8px_rgba(37,123,244,0.6)] ml-2" />
                        <h4 className="font-bold text-white tracking-widest font-mono text-xs uppercase">Deep Learning V11.3</h4>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-primary/10">
                            <span className="text-xs text-slate-500 font-mono">Modelo</span>
                            <span className="text-xs text-primary font-bold font-mono">Keras 3 / tfjs</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-primary/10">
                            <span className="text-xs text-slate-500 font-mono">Data Source</span>
                            <span className="text-xs text-primary font-bold font-mono">CryptoCompare ✓</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-primary/10">
                            <span className="text-xs text-slate-500 font-mono">Geo-Block</span>
                            <span className="text-xs text-accent-green font-bold font-mono">INMUNE</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-primary/10">
                            <span className="text-xs text-slate-500 font-mono">Hybrid Weight</span>
                            <span className="text-xs text-primary font-bold font-mono drop-shadow-[0_0_6px_rgba(37,123,244,0.6)]">60% ML VOTE</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-primary/10">
                            <span className="text-xs text-slate-500 font-mono">Keras3 Patcher</span>
                            <span className="text-xs text-accent-green font-bold font-mono">ACTIVE</span>
                        </div>
                    </div>
                </div>

                {/* Defense matrix */}
                <div className="glass-panel p-5 rounded-2xl border border-accent-green/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 bg-accent-green h-full shadow-glow-green" />
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck size={18} className="text-accent-green ml-2 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]" />
                        <h4 className="font-bold text-white tracking-widest font-mono text-xs uppercase">Defense Matrix V11.3</h4>
                    </div>
                    <div className="flex flex-col gap-2">
                        {MODULES.map(m => (
                            <div key={m.label} className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-white/5 group" title={m.desc}>
                                <span className="text-[10px] text-slate-500 font-mono">{m.label}</span>
                                <span className={`text-[10px] font-bold font-mono ${m.color}`}>{m.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Live Bot Pulse */}
                {botStatus && (
                    <div className="glass-panel p-4 rounded-2xl border border-accent-amber/20 relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={14} className="text-accent-amber" />
                            <span className="text-[10px] font-mono text-accent-amber uppercase tracking-widest font-bold">Live Bot Telemetry</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: 'Balance', value: `$${Number(botStatus.portfolio?.balance).toFixed(2)}` },
                                { label: 'PnL', value: `$${botStatus.portfolio?.pnl}` },
                                { label: 'Win Rate', value: botStatus.portfolio?.winRate || 'N/A' },
                                { label: 'Trades', value: botStatus.portfolio?.trades },
                                { label: 'Kill Switch', value: botStatus.valentini?.killSwitch },
                                { label: 'Cycle', value: `#${botStatus.cycle}` },
                            ].map(stat => (
                                <div key={stat.label} className="bg-surface-dark px-3 py-2 rounded-lg border border-white/5">
                                    <p className="text-[9px] font-mono text-slate-500 mb-0.5">{stat.label}</p>
                                    <p className="text-xs font-bold font-mono text-white">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
