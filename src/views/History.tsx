import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { History as HistoryIcon, Target, TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';

interface ClosedTrade {
    id: number;
    asset: string;
    direction: string;
    entry_price: number;
    exit_price: number;
    pnl: number;
    opened_at: string;
    closed_at: string;
}

export default function History() {
    const [trades, setTrades] = useState<ClosedTrade[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('ghost_trades')
                .select('*')
                .eq('status', 'CLOSED')
                .order('closed_at', { ascending: false })
                .limit(50); // Fetch the last 50 closed trades

            if (data && !error) {
                setTrades(data as ClosedTrade[]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        // FIX #6: Added Realtime subscription so closed trades appear instantly
        const ch = supabase.channel('react-history-tab');
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_trades' }, fetchHistory);
        ch.subscribe();
        const interval = setInterval(fetchHistory, 10000);
        return () => {
            clearInterval(interval);
            supabase.removeChannel(ch);
        };
    }, []);

    if (loading) return <div className="text-slate-500 animate-pulse">Scanning Historical Records...</div>;

    return (
        <div className="flex flex-col gap-6 pb-20">
            <div className="glass-panel p-4 rounded-2xl flex justify-between items-center border border-primary/20 shadow-glow/10">
                <div className="flex items-center gap-3">
                    <HistoryIcon className="text-primary animate-pulse" size={20} />
                    <h3 className="text-primary font-bold font-mono tracking-widest uppercase">Execution History</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
                    <span className="text-[10px] text-primary font-mono uppercase tracking-widest">Tracking {trades.length} Operations</span>
                </div>
            </div>

            <div className="glass-panel overflow-hidden border border-white/5 rounded-2xl shadow-glow/5">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface-dark relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent opacity-50"></div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-widest font-mono text-[14px]">
                        <Target className="text-primary drop-shadow-[0_0_8px_rgba(37,123,244,0.6)]" size={18} /> Closed Operations
                    </h3>
                </div>

                {trades.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center border-t border-white/5 bg-[#05080a]">
                        <div className="h-16 w-16 rounded-full border border-dashed border-primary/30 flex items-center justify-center animate-spin-slow mb-4 text-primary shadow-glow">
                            <AlertCircle size={24} />
                        </div>
                        <p className="text-primary font-mono text-sm uppercase tracking-widest drop-shadow-[0_0_8px_rgba(37,123,244,0.4)]">🔭 NO DATA FOUND...</p>
                        <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-mono">Awaiting First Trade Closure</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-white/5 text-xs text-slate-400 uppercase tracking-wider font-medium">
                                    <th className="px-6 py-4 border-b border-white/5">Asset Pair</th>
                                    <th className="px-6 py-4 border-b border-white/5">Direction</th>
                                    <th className="px-6 py-4 border-b border-white/5">Entry Price</th>
                                    <th className="px-6 py-4 border-b border-white/5">Exit Price</th>
                                    <th className="px-6 py-4 border-b border-white/5 text-right">Realized PNL</th>
                                    <th className="px-6 py-4 border-b border-white/5 text-right">Closed At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm bg-[#05080a]">
                                {trades.map((t) => {
                                    const isLong = t.direction === 'LONG';
                                    const isWin = t.pnl >= 0;
                                    const Icon = isLong ? TrendingUp : TrendingDown;
                                    const colorCls = isLong ? 'text-accent-green bg-accent-green/10 border-accent-green/20' : 'text-accent-red bg-accent-red/10 border-accent-red/20';

                                    const pnlColorCls = isWin ? 'text-accent-green drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'text-accent-red drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]';

                                    const closedDate = new Date(t.closed_at);

                                    return (
                                        <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-surface-dark flex items-center justify-center border border-white/5 drop-shadow-[0_0_4px_rgba(255,255,255,0.1)]">
                                                        <span className="text-[10px] font-bold text-white">{t.asset.substring(0, 3)}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white tracking-wide">{t.asset}</p>
                                                        <p className="text-[10px] text-primary">Cross Margin</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-wider ${colorCls} border`}>
                                                    <Icon size={12} /> {t.direction}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-300">
                                                ${parseFloat(t.entry_price as any) < 10 ? parseFloat(t.entry_price as any).toFixed(4) : parseFloat(t.entry_price as any).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-300">
                                                ${parseFloat(t.exit_price as any) < 10 ? parseFloat(t.exit_price as any).toFixed(4) : parseFloat(t.exit_price as any).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className={`px-6 py-4 font-mono font-bold text-right text-lg tracking-tight ${pnlColorCls}`}>
                                                {isWin ? '+' : ''}${parseFloat(t.pnl as any) < 10 ? parseFloat(t.pnl as any).toFixed(4) : parseFloat(t.pnl as any).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {/* FIX #11: Show full date + time, not just the hour */}
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-dark rounded border border-white/5 font-mono text-xs text-slate-400">
                                                    <Clock size={12} className="text-primary/70" />
                                                    {closedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {closedDate.toLocaleTimeString('en-US', { hour12: false })}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
