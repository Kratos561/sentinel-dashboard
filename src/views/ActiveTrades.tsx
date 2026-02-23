import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Target, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

const PYTH_FEEDS: Record<string, string> = {
    'XAU': '765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
    'EUR': 'a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
    'JPY': 'ef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52',
    'BTC': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    'SOL': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    'SUI': '23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
    'SP500': '19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    'SPY': '19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    'QQQ': '9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d'
};

export default function ActiveTrades() {
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchTrades();
        const ch = supabase.channel('react-trades-tab');
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_trades' }, fetchTrades);
        ch.subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []);

    useEffect(() => {
        let interval: any;
        if (trades.length > 0) {
            fetchLivePrices();
            interval = setInterval(fetchLivePrices, 1000);
        }
        return () => clearInterval(interval);
    }, [trades]);

    const fetchTrades = async () => {
        try {
            const { data } = await supabase.from('ghost_trades').select('*').eq('status', 'OPEN').order('opened_at', { ascending: false });
            if (data) setTrades(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchLivePrices = async () => {
        if (trades.length === 0) return;
        const ids = new Set<string>();
        trades.forEach(t => {
            const base = t.asset.replace('/USD', '').replace('USDT', '').toUpperCase();
            if (PYTH_FEEDS[base]) ids.add(PYTH_FEEDS[base]);
        });
        if (ids.size === 0) return;

        try {
            const queryParams = Array.from(ids).map(id => `ids[]=${id}`).join('&');
            const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?${queryParams}`);
            const data = await res.json();

            if (data && data.parsed) {
                const updatedPrices: Record<string, number> = {};
                data.parsed.forEach((p: any) => {
                    const price = parseInt(p.price.price);
                    const expo = parseInt(p.price.expo);
                    updatedPrices[p.id] = price * Math.pow(10, expo);
                });

                setLivePrices(prev => {
                    const newDict = { ...prev };
                    trades.forEach(t => {
                        const base = t.asset.replace('/USD', '').replace('USDT', '').toUpperCase();
                        const id = PYTH_FEEDS[base];
                        if (id && updatedPrices[id]) {
                            newDict[base] = updatedPrices[id];
                        }
                    });
                    return newDict;
                });
            }
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="text-slate-500 animate-pulse">Scanning Order Books...</div>;

    return (
        <div className="flex flex-col gap-6">
            <div className="glass-panel overflow-hidden border border-white/5 rounded-2xl shadow-glow/5">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface-dark relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent opacity-50"></div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-widest font-mono text-[14px]">
                        <Target className="text-primary drop-shadow-[0_0_8px_rgba(37,123,244,0.6)]" size={18} /> Ongoing Operations
                    </h3>
                </div>

                {trades.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center border-t border-white/5 bg-[#05080a]">
                        <div className="h-16 w-16 rounded-full border border-dashed border-primary/30 flex items-center justify-center animate-spin-slow mb-4 text-primary shadow-glow">
                            <AlertCircle size={24} />
                        </div>
                        <p className="text-primary font-mono text-sm uppercase tracking-widest drop-shadow-[0_0_8px_rgba(37,123,244,0.4)]">🔭 SCANNING SATELLITE LINKS...</p>
                        <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-mono">Awaiting Alpha Signal Confirmation</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-white/5 text-xs text-slate-400 uppercase tracking-wider font-medium">
                                    <th className="px-6 py-4 border-b border-white/5">Asset Pair</th>
                                    <th className="px-6 py-4 border-b border-white/5">Direction</th>
                                    <th className="px-6 py-4 border-b border-white/5">Entry Price</th>
                                    <th className="px-6 py-4 border-b border-white/5">Mark Price</th>
                                    <th className="px-6 py-4 border-b border-white/5">Unrealized PNL</th>
                                    <th className="px-6 py-4 border-b border-white/5 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm bg-[#05080a]">
                                {trades.map((t) => {
                                    const isLong = t.direction === 'LONG';
                                    const Icon = isLong ? TrendingUp : TrendingDown;
                                    const colorCls = isLong ? 'text-accent-green bg-accent-green/10 border-accent-green/20' : 'text-accent-red bg-accent-red/10 border-accent-red/20';

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
                                                ${Number(t.entry_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            {(() => {
                                                const base = t.asset.replace('/USD', '').replace('USDT', '').toUpperCase();
                                                const currentPrice = livePrices[base];
                                                const entryPrice = Number(t.entry_price);

                                                let pnlPercent = 0;
                                                let isProfit = false;
                                                let unrealizedStr = '--';
                                                let pnlColor = 'text-slate-500 border border-transparent';

                                                if (currentPrice && entryPrice) {
                                                    const diff = currentPrice - entryPrice;
                                                    // Standardizing visualization to 50x cross margin to show aggressive movement in active trades. 
                                                    pnlPercent = (diff / entryPrice) * 100 * (isLong ? 1 : -1) * 50;
                                                    isProfit = pnlPercent >= 0;
                                                    pnlColor = isProfit ? 'text-accent-green bg-accent-green/10 border-accent-green/20' : 'text-accent-red bg-accent-red/10 border-accent-red/20';
                                                    unrealizedStr = `${isProfit ? '+' : ''}${pnlPercent.toFixed(2)}% ROE`;
                                                }

                                                return (
                                                    <>
                                                        <td className="px-6 py-4 font-mono text-white">
                                                            {currentPrice ? `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-slate-500 text-[10px] uppercase animate-pulse">Syncing Pyth...</span>}
                                                        </td>
                                                        <td className="px-6 py-4 font-mono font-bold">
                                                            <span className={`px-2.5 py-1 rounded-sm text-xs font-bold tracking-wider border ${pnlColor}`}>{unrealizedStr}</span>
                                                        </td>
                                                    </>
                                                );
                                            })()}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
                                                    <span className="text-xs font-mono text-accent-green uppercase">ACTIVE</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
