import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BrainCircuit, Cpu, Target, Terminal, TrendingUp, Wallet, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getChartPrices, getLatestDLPredictions, getLatestSignal, type DLPrediction, type SignalSnapshot } from '../lib/influxdb';

interface PortfolioRow {
  balance: number | string;
  start_balance: number | string;
  wins: number | string;
  losses: number | string;
  total_trades?: number | string;
}

interface ReflectionRow {
  id: number | string;
  analysis: string;
  created_at: string;
}

interface BotStatus {
  cycle?: number;
  uptime?: number;
  portfolio?: {
    openPositions?: number;
    balance?: number;
    pnl?: number | string;
    winRate?: string;
    trades?: number;
  };
  valentini?: {
    hotAssets?: string[];
    killSwitch?: string;
  };
}

interface ChartRow {
  time: string;
  price: number;
  ma: number;
}

const ASSET_OPTIONS = ['NASDAQ100', 'BITCOIN', 'ORO', 'SOLANA'];

function currency(value: number, digits = 2) {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function signalTone(direction?: string) {
  if (direction === 'LONG') return 'text-accent-green';
  if (direction === 'SHORT') return 'text-accent-red';
  return 'text-slate-300';
}

function movingAverage(rows: Array<{ price: number; recorded_at: string }>): ChartRow[] {
  return rows
    .slice()
    .reverse()
    .map((row, index, arr) => {
      const start = Math.max(0, index - 8);
      const windowRows = arr.slice(start, index + 1);
      const ma = windowRows.reduce((sum, item) => sum + item.price, 0) / Math.max(windowRows.length, 1);
      return {
        time: new Date(row.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: Number(row.price.toFixed(row.price < 10 ? 4 : 2)),
        ma: Number(ma.toFixed(row.price < 10 ? 4 : 2)),
      };
    });
}

export default function Overview() {
  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [history, setHistory] = useState<ChartRow[]>([]);
  const [logs, setLogs] = useState<ReflectionRow[]>([]);
  const [signal, setSignal] = useState<SignalSnapshot | null>(null);
  const [dlRows, setDlRows] = useState<DLPrediction[]>([]);
  const [chartAsset, setChartAsset] = useState(ASSET_OPTIONS[0]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('https://p01--sentinel-advance--blnvcmgxk6zh.code.run/');
      if (res.ok) setBotStatus((await res.json()) as BotStatus);
    } catch {
      setBotStatus(null);
    }
  };

  const fetchData = async () => {
    const { data: pData } = await supabase.from('ghost_portfolio').select('*').limit(1);
    if (pData?.[0]) setPortfolio(pData[0] as PortfolioRow);

    const { data: lData } = await supabase.from('ghost_reflections').select('*').order('created_at', { ascending: false }).limit(6);
    if (lData) setLogs(lData as ReflectionRow[]);
  };

  const fetchLiveChart = async () => {
    try {
      const [rows, latestSignal, latestDl] = await Promise.all([
        getChartPrices(chartAsset, 80),
        getLatestSignal(),
        getLatestDLPredictions(8),
      ]);
      if (rows.length > 0) setHistory(movingAverage(rows));
      setSignal(latestSignal);
      setDlRows(latestDl);
    } catch (error) {
      console.error(error);
    }
  };

  const setupRealtime = () => {
    const ch = supabase.channel('react-overview-dashboard');
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_portfolio' }, fetchData);
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_trades' }, fetchData);
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ghost_reflections' }, fetchData);
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  };

  useEffect(() => {
    void fetchData();
    void fetchBotStatus();
    const cleanupRealtime = setupRealtime();
    const liveHFT = window.setInterval(fetchLiveChart, 3000);
    const botPoll = window.setInterval(fetchBotStatus, 30000);
    void fetchLiveChart();
    return () => {
      window.clearInterval(liveHFT);
      window.clearInterval(botPoll);
      cleanupRealtime();
    };
  }, [chartAsset]);

  const metrics = useMemo(() => {
    const startBalance = Number(portfolio?.start_balance || 0);
    const balance = Number(portfolio?.balance || 0);
    const pnl = balance - startBalance;
    const wins = Number(portfolio?.wins || 0);
    const losses = Number(portfolio?.losses || 0);
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
    return { startBalance, balance, pnl, wins, losses, winRate };
  }, [portfolio]);

  if (!portfolio) return <div className="p-10 text-sm text-slate-500 animate-pulse">Initializing Sentinel telemetry...</div>;

  const isProfit = metrics.pnl >= 0;
  const signalScore = Number(signal?.hybrid_confidence || 0);
  const latestDl = dlRows[0];

  return (
    <div className="grid grid-cols-1 gap-5 pb-20 md:grid-cols-12">
      <div className="col-span-12 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <section className="metric-card">
          <span><Wallet size={14} /> Equity</span>
          <strong>${currency(metrics.balance)}</strong>
          <small>Start ${currency(metrics.startBalance)}</small>
        </section>
        <section className="metric-card">
          <span><Activity size={14} /> Session PnL</span>
          <strong className={isProfit ? 'text-accent-green' : 'text-accent-red'}>
            {isProfit ? '+' : '-'}${currency(Math.abs(metrics.pnl))}
          </strong>
          <small>{metrics.startBalance > 0 ? ((metrics.pnl / metrics.startBalance) * 100).toFixed(2) : '0.00'}%</small>
        </section>
        <section className="metric-card">
          <span><Target size={14} /> Win Rate</span>
          <strong className="text-accent-amber">{metrics.winRate.toFixed(1)}%</strong>
          <small>{metrics.wins}W / {metrics.losses}L</small>
        </section>
        <section className="metric-card">
          <span><BrainCircuit size={14} /> Edge Signal</span>
          <strong className={signalTone(signal?.direction)}>{signal?.direction || 'HOLD'}</strong>
          <small>{signal?.symbol || 'No signal'} / {signalScore.toFixed(1)}%</small>
        </section>
        <section className="metric-card col-span-2 xl:col-span-1">
          <span><Cpu size={14} /> DL Watchdog</span>
          <strong>{latestDl ? `${(latestDl.score * 100).toFixed(1)}%` : 'SYNC'}</strong>
          <small>{latestDl ? `${latestDl.symbol} / ${latestDl.latency_ms.toFixed(0)}ms` : 'awaiting dl_predict'}</small>
        </section>
      </div>

      <section className="panel col-span-12 min-h-[410px] p-5 md:col-span-8">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="section-title"><TrendingUp size={17} /> Live Market Stream</h3>
            <p className="mt-1 text-xs font-mono uppercase tracking-[0.16em] text-slate-500">{chartAsset} / InfluxDB HFT telemetry</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ASSET_OPTIONS.map((asset) => (
              <button
                key={asset}
                onClick={() => setChartAsset(asset)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.12em] transition-colors ${
                  chartAsset === asset ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 text-slate-500 hover:text-slate-200'
                }`}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#4f8cff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="time" stroke="#475569" fontSize={10} tickMargin={10} minTickGap={28} />
              <YAxis domain={['dataMin', 'dataMax']} stroke="#475569" fontSize={10} tickFormatter={(val: number) => `$${val}`} orientation="right" width={72} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0b0f14', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area isAnimationActive={false} type="monotone" dataKey="price" name="Price" stroke="#4f8cff" strokeWidth={2} fill="url(#priceFill)" />
              <Line isAnimationActive={false} type="monotone" dataKey="ma" name="MA9" stroke="#f2b84b" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <aside className="col-span-12 flex flex-col gap-5 md:col-span-4">
        <section className="panel p-5">
          <h3 className="section-title"><BrainCircuit size={17} /> Current Read</h3>
          <div className="mt-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{signal?.symbol || 'No signal'}</p>
              <p className={`mt-2 text-3xl font-semibold ${signalTone(signal?.direction)}`}>{signal?.ml_label || 'HOLD'}</p>
              <p className="mt-2 text-xs text-slate-500">{signal?.divergence || 'no divergence'} / {signal?.liquidity_pool || 'no liquidity read'}</p>
            </div>
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
              <div className="text-center">
                <p className="text-2xl font-semibold text-white">{signalScore.toFixed(0)}%</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">Hybrid</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel min-h-[245px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="section-title"><Terminal size={16} /> Execution Log</h3>
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-600">Supabase</span>
          </div>
          <div className="max-h-[230px] space-y-2 overflow-y-auto p-4 font-mono text-[11px]">
            {logs.map((log) => {
              const isWin = log.analysis.includes('WIN') || log.analysis.includes('COMPLETED');
              return (
                <div key={log.id} className="grid grid-cols-[70px_1fr] gap-2 border-b border-white/[0.04] pb-2">
                  <span className="text-slate-600">{new Date(log.created_at).toLocaleTimeString()}</span>
                  <span className={isWin ? 'text-accent-green' : 'text-slate-300'}>{log.analysis}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-accent-amber">
            <Zap size={13} />
            Runtime Pulse
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="mini-stat"><span>Cycle</span><strong>#{botStatus?.cycle ?? '-'}</strong></div>
            <div className="mini-stat"><span>Open</span><strong>{botStatus?.portfolio?.openPositions ?? 0}</strong></div>
            <div className="mini-stat"><span>Hot</span><strong>{botStatus?.valentini?.hotAssets?.length ?? 0}</strong></div>
          </div>
        </section>
      </aside>
    </div>
  );
}
