import { useState, useEffect } from 'react';
import { tidb } from '../lib/tidb';
import { Crosshair, Search } from 'lucide-react';

interface AssetData {
    symbol: string;
    price: string;
    trend: string;
    momentum: string;
    volatility: string;
    recorded_at: string;
}

interface SignalData {
    symbol: string;
    hybrid_confidence: number;
    ml_prediction: string;
    divergence: string;
    liquidity_pool: string;
    created_at: string;
}

export default function Radar() {
    const [prices, setPrices] = useState<AssetData[]>([]);
    const [signals, setSignals] = useState<SignalData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTelemetry = async () => {
        try {
            // Get latest prices for top 8 assets
            // Using a subquery trick to get the most recent row per symbol
            const priceQuery = `
                SELECT t1.* FROM ghost_prices t1
                INNER JOIN (
                    SELECT symbol, MAX(recorded_at) as max_time
                    FROM ghost_prices
                    GROUP BY symbol
                ) t2 ON t1.symbol = t2.symbol AND t1.recorded_at = t2.max_time
                ORDER BY t1.symbol
            `;
            const pData: any = await tidb.execute(priceQuery);
            if (pData && pData.rows) {
                setPrices(pData.rows);
            } else if (Array.isArray(pData)) {
                setPrices(pData);
            }

            // Get latest signals
            const sigQuery = `
                SELECT t1.* FROM ghost_signals t1
                INNER JOIN (
                    SELECT symbol, MAX(created_at) as max_time
                    FROM ghost_signals
                    GROUP BY symbol
                ) t2 ON t1.symbol = t2.symbol AND t1.created_at = t2.max_time
            `;
            const sData: any = await tidb.execute(sigQuery);
            if (sData && sData.rows) {
                setSignals(sData.rows);
            } else if (Array.isArray(sData)) {
                setSignals(sData);
            }
        } catch (e) {
            console.error("TiDB fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTelemetry();
        const interval = setInterval(fetchTelemetry, 1000); // Polling TiDB every 1s
        return () => clearInterval(interval);
    }, []);

    // Combine data
    const assetsData = prices.map(p => {
        const sig = signals.find(s => s.symbol === p.symbol) || null;
        return {
            ...p,
            signal: sig,
            // Calculate a fake RSI based on momentum just for visual flair if not provided
            rsi: 50 + (Number(p.momentum) * 10),
        };
    });

    if (loading && prices.length === 0) {
        return <div className="text-primary animate-pulse font-mono tracking-widest text-center mt-20">SCANNING SATELLITE LINKS...</div>;
    }

    return (
        <div className="flex flex-col gap-6 h-full pb-20">
            {/* Radar Header */}
            <div className="glass-panel p-4 rounded-2xl flex justify-between items-center border border-accent-red/20 shadow-glow-red/10">
                <div className="flex items-center gap-3">
                    <Crosshair className="text-accent-red animate-pulse" size={20} />
                    <h3 className="text-accent-red font-bold font-mono tracking-widest uppercase">Radar L2 Telemetry</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-red animate-ping"></div>
                    <span className="text-[10px] text-accent-red font-mono uppercase tracking-widest">Scanning {prices.length} Assets (1s)</span>
                </div>
            </div>

            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {assetsData.map(asset => {
                    const priceNum = Number(asset.price);
                    const rsi = Math.max(0, Math.min(100, asset.rsi));
                    const isOversold = rsi < 30;
                    const isOverbought = rsi > 70;
                    const rsiColor = isOversold ? 'text-accent-green' : (isOverbought ? 'text-accent-red' : 'text-primary');
                    const sig = asset.signal;

                    return (
                        <div key={asset.symbol} className="glass-panel p-5 rounded-2xl border-t border-white/5 hover:bg-white/5 transition-colors group relative overflow-hidden flex flex-col gap-4">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Search size={14} className="text-slate-500 hover:text-white cursor-pointer" />
                            </div>

                            <div className="flex justify-between items-start">
                                <h4 className="text-xl font-bold font-mono text-white tracking-tight">{asset.symbol}</h4>
                                {sig && sig.divergence && sig.divergence !== 'NONE' && (
                                    <span className="text-[9px] bg-accent-amber/20 text-accent-amber px-2 py-0.5 rounded font-mono border border-accent-amber/30">
                                        Divergence
                                    </span>
                                )}
                            </div>

                            <div className="flex items-baseline gap-2">
                                <h2 className="text-3xl font-mono text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                                    {priceNum < 10 ? priceNum.toFixed(4) : priceNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </h2>
                            </div>

                            <div className="space-y-3 mt-2">
                                {/* RSI Gauge */}
                                <div>
                                    <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                                        <span>RSI</span>
                                        <span className={rsiColor}>{rsi.toFixed(1)}</span>
                                    </div>
                                    <div className="w-full h-1 bg-surface-dark rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${isOversold ? 'bg-accent-green shadow-glow-green' : (isOverbought ? 'bg-accent-red shadow-glow-red' : 'bg-primary shadow-glow')}`}
                                            style={{ width: `${rsi}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Volatility Gauge */}
                                <div>
                                    <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                                        <span>VOLATILITY</span>
                                        <span className="text-white">{Number(asset.volatility).toFixed(4)}</span>
                                    </div>
                                    <div className="w-full h-1 bg-surface-dark rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-500" style={{ width: `${Math.min(100, Number(asset.volatility) * 100)}%` }}></div>
                                    </div>
                                </div>

                                {/* ML Prediction / Confidence */}
                                {sig && (
                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[10px] font-mono text-slate-500">AI PREDICT</span>
                                        <span className={`text-[11px] font-bold tracking-widest uppercase font-mono ${sig.ml_prediction.includes('LONG') ? 'text-accent-green' :
                                            (sig.ml_prediction.includes('SHORT') ? 'text-accent-red' : 'text-slate-300')
                                            }`}>
                                            {sig.ml_prediction} ({sig.hybrid_confidence}%)
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
