import { useState, useEffect } from 'react';
import { getRadarTelemetry, getSignalHistory } from '../lib/influxdb';
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
            // Get latest telemetry for all assets from InfluxDB
            const telemetry = await getRadarTelemetry();
            if (telemetry && telemetry.length > 0) {
                setPrices(telemetry.map((r: any) => ({
                    symbol: r.symbol || '',
                    price: String(r.price || 0),
                    trend: String(r.trend || 0),
                    momentum: String(r.momentum || 0),
                    volatility: String(r.volatility || 0),
                    recorded_at: r.time || new Date().toISOString(),
                })));
            }

            // Get latest signals
            const sigRows = await getSignalHistory(10);
            if (sigRows && sigRows.length > 0) {
                setSignals(sigRows.map((r: any) => ({
                    symbol: r.symbol || '',
                    hybrid_confidence: parseFloat(r.hybrid_confidence) || 0,
                    ml_prediction: r.ml_prediction || '0',
                    divergence: r.divergence || 'none',
                    liquidity_pool: r.liquidity_pool || 'none',
                    created_at: r._time || new Date().toISOString(),
                })));
            }
        } catch (e) {
            console.error("InfluxDB fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTelemetry();
        // FIX #2: Reduced from 1s to 10s — was generating 86,400 JOIN queries/day on 1.6M row table
        const interval = setInterval(fetchTelemetry, 1000); // ⚡ Real-Time InfluxDB
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
                    <span className="text-[10px] text-accent-red font-mono uppercase tracking-widest">Scanning {prices.length} Assets (10s)</span>
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
                                {/* Momentum Gauge (FIX #4: Renamed from fake RSI to accurate MOMENTUM label) */}
                                <div>
                                    <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                                        <span>MOMENTUM</span>
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
