import { useEffect, useMemo, useState } from 'react';
import { Activity, Crosshair, Search, ShieldAlert } from 'lucide-react';
import { getRadarTelemetry, getSignalHistory, type RadarTelemetry, type SignalSnapshot } from '../lib/influxdb';

function formatPrice(value: number) {
  if (Math.abs(value) < 10) return value.toFixed(4);
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function momentumGauge(momentum: number) {
  return Math.max(0, Math.min(100, 50 + momentum * 10));
}

function signalColor(direction?: string) {
  if (direction === 'LONG') return 'text-accent-green';
  if (direction === 'SHORT') return 'text-accent-red';
  return 'text-slate-300';
}

export default function Radar() {
  const [prices, setPrices] = useState<RadarTelemetry[]>([]);
  const [signals, setSignals] = useState<SignalSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTelemetry = async () => {
    try {
      const [telemetry, signalRows] = await Promise.all([getRadarTelemetry(), getSignalHistory(30)]);
      setPrices(telemetry);
      setSignals(signalRows);
    } catch (error) {
      console.error('InfluxDB fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTelemetry();
    const interval = window.setInterval(fetchTelemetry, 3000);
    return () => window.clearInterval(interval);
  }, []);

  const latestSignalBySymbol = useMemo(() => {
    const bySymbol = new Map<string, SignalSnapshot>();
    signals.forEach((signal) => {
      if (!bySymbol.has(signal.symbol)) bySymbol.set(signal.symbol, signal);
    });
    return bySymbol;
  }, [signals]);

  const assetsData = prices.map((price) => ({
    ...price,
    signal: latestSignalBySymbol.get(price.symbol),
    momentumLevel: momentumGauge(price.momentum),
  }));

  if (loading && prices.length === 0) {
    return <div className="mt-20 text-center font-mono text-sm tracking-[0.2em] text-primary animate-pulse">SCANNING LIVE TELEMETRY...</div>;
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <div className="panel flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Crosshair className="text-primary" size={20} />
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Radar L2 Telemetry</h3>
            <p className="mt-1 text-xs text-slate-500">Live market_data + signal_data from InfluxDB</p>
          </div>
        </div>
        <div className="status-pill status-ok">
          <span className="h-2 w-2 rounded-full bg-current" />
          {prices.length} assets / 3s refresh
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {assetsData.map((asset) => {
          const signal = asset.signal;
          const fresh = asset.time ? Date.now() - new Date(asset.time).getTime() < 5 * 60 * 1000 : false;
          const momentumColor = asset.momentumLevel < 35 ? 'bg-accent-red' : asset.momentumLevel > 65 ? 'bg-accent-green' : 'bg-primary';
          const volatilityWidth = Math.min(100, Math.abs(asset.volatility) * 100);

          return (
            <section key={asset.symbol} className="panel p-4 transition-colors hover:border-white/20">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-mono text-xl font-semibold tracking-tight text-white">{asset.symbol}</h4>
                    <span className={`h-2 w-2 rounded-full ${fresh ? 'bg-accent-green' : 'bg-accent-amber'}`} />
                  </div>
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-slate-600">
                    {asset.time ? new Date(asset.time).toLocaleTimeString() : 'no timestamp'}
                  </p>
                </div>
                <Search size={15} className="text-slate-600" />
              </div>

              <div className="mb-5">
                <p className="text-3xl font-semibold tracking-tight text-white">${formatPrice(asset.price)}</p>
                <p className="mt-1 text-xs text-slate-500">Trend {asset.trend.toFixed(3)} / Momentum {asset.momentum.toFixed(3)}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">
                    <span>Momentum</span>
                    <span>{asset.momentumLevel.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full ${momentumColor}`} style={{ width: `${asset.momentumLevel}%` }} />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">
                    <span>Volatility</span>
                    <span>{asset.volatility.toFixed(4)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-accent-amber" style={{ width: `${volatilityWidth}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">
                    <ShieldAlert size={12} /> Signal
                  </span>
                  <span className={`text-right font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${signalColor(signal?.direction)}`}>
                    {signal ? `${signal.ml_label} / ${signal.hybrid_confidence.toFixed(1)}%` : 'WAITING'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-slate-600">
                  <span>{signal?.divergence || 'no divergence'}</span>
                  <span>{signal?.liquidity_pool || 'no liquidity'}</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {prices.length === 0 && (
        <div className="panel flex items-center gap-3 p-5 text-slate-400">
          <Activity size={18} className="text-accent-amber" />
          Waiting for market_data telemetry.
        </div>
      )}
    </div>
  );
}
