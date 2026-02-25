import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Cpu, TerminalSquare, ShieldCheck } from 'lucide-react';

export default function AIIntel() {
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        fetchLogs();
        const ch = supabase.channel('react-intel-tab');
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ghost_reflections' }, fetchLogs);
        ch.subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []);

    const fetchLogs = async () => {
        try {
            const { data } = await supabase.from('ghost_reflections').select('*').order('created_at', { ascending: false }).limit(20);
            if (data) setLogs(data);
        } catch (e) { console.error(e) }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 glass-panel rounded-2xl flex flex-col min-h-[500px] border border-primary/20 bg-[#05080a] relative">
                <div className="bg-surface-dark px-6 py-4 border-b border-white/5 flex justify-between items-center rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <TerminalSquare size={16} className="text-primary" />
                        <span className="text-[12px] font-mono text-white uppercase tracking-widest font-bold flex flex-col">
                            SENTINEL NEURAL TERMINAL
                            <span className="text-[9px] text-slate-500 tracking-[0.2em] font-normal">FABIO VALENTINI LOGS</span>
                        </span>
                    </div>
                </div>
                <div className="flex-1 p-6 font-mono text-xs overflow-y-auto space-y-3">
                    <div className="text-primary mb-6 animate-pulse drop-shadow-[0_0_8px_rgba(37,123,244,0.6)]">
                        ======================================<br />
                        SENTINEL ÁGUILA IMPERIAL V11 INIT<br />
                        CONNECTION SECURED OVER ENCRYPTED LINK<br />
                        ======================================
                    </div>
                    {logs.map((log) => {
                        const date = new Date(log.created_at);
                        const isWin = log.analysis.includes('WIN') || log.analysis.includes('COMPLETED') || log.analysis.includes('OPEN');
                        const isLoss = log.analysis.includes('LOSS') || log.analysis.includes('WARNING');
                        const colorCls = isWin ? 'text-accent-green' : (isLoss ? 'text-accent-red' : 'text-slate-300');

                        return (
                            <div key={log.id} className="flex flex-col gap-1 border-b border-white/5 pb-2 mb-2">
                                <span className={`shrink-0 opacity-70 ${colorCls}`}>
                                    [{date.toLocaleTimeString()} - NODE: ALPHA]
                                </span>
                                <span className={`${colorCls} pl-2 border-l-2 border-current ml-2`}>
                                    {log.analysis}
                                </span>
                            </div>
                        )
                    })}
                    <div className="flex gap-2 pt-4 pl-4 items-center">
                        <span className="text-primary">root@sentinel:~# </span>
                        <span className="w-2 h-4 bg-primary animate-pulse"></span>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="glass-panel p-6 rounded-2xl border flex flex-col border-accent-green/20 relative overflow-hidden transition-all hover:bg-white/5 shadow-glow-green/10">
                    <div className="absolute top-0 left-0 w-1 bg-accent-green h-full shadow-glow-green"></div>
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldCheck size={20} className="text-accent-green drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]" />
                        <h4 className="font-bold text-white tracking-widest font-mono text-xs uppercase">Defense Matrix V11</h4>
                    </div>
                    <p className="text-sm text-slate-400">Kill Switch: 4 max losses/day. Breakeven Auto @ 30% TP. DCA Safety Orders active. Blacklist: SUI, SP500, BNB.</p>
                </div>

                <div className="glass-panel p-6 rounded-2xl border flex flex-col border-primary/20 relative overflow-hidden transition-all hover:bg-white/5 shadow-glow/10">
                    <div className="absolute top-0 left-0 w-1 bg-primary h-full shadow-glow"></div>
                    <div className="flex items-center gap-3 mb-2">
                        <Cpu size={20} className="text-primary drop-shadow-[0_0_8px_rgba(37,123,244,0.4)]" />
                        <h4 className="font-bold text-white tracking-widest font-mono text-xs uppercase">V11 Modules</h4>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-white/5">
                            <span className="text-xs text-slate-500 font-mono">Regime Filter (ADX+CI)</span>
                            <span className="text-xs text-accent-green font-bold font-mono">ACTIVE</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-white/5">
                            <span className="text-xs text-slate-500 font-mono">DCA Safety Orders</span>
                            <span className="text-xs text-accent-green font-bold font-mono">2 MAX</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-white/5">
                            <span className="text-xs text-slate-500 font-mono">Bollinger + Mean Rev</span>
                            <span className="text-xs text-accent-green font-bold font-mono">10% WT</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-white/5">
                            <span className="text-xs text-slate-500 font-mono">Breakeven Auto</span>
                            <span className="text-xs text-accent-green font-bold font-mono">@ 30%</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-white/5">
                            <span className="text-xs text-slate-500 font-mono">Hybrid Min Score</span>
                            <span className="text-xs text-primary font-bold font-mono">78.0%</span>
                        </div>
                        <div className="flex justify-between items-center bg-surface-dark px-3 py-2 rounded-lg border border-white/5">
                            <span className="text-xs text-slate-500 font-mono">Asset Blacklist</span>
                            <span className="text-xs text-accent-red font-bold font-mono">SUI, SP500, BNB</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
