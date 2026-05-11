import { useEffect, useState } from 'react';
import { BrainCircuit, ShieldCheck, TerminalSquare, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLatestDLPredictions, type DLPrediction } from '../lib/influxdb';

interface ReflectionRow {
  id: number | string;
  analysis: string;
  created_at: string;
}

interface BotStatus {
  cycle?: number;
  uptime?: number;
  portfolio?: {
    balance?: number;
    pnl?: number | string;
    winRate?: string;
    trades?: number;
  };
  valentini?: {
    killSwitch?: string;
    hotAssets?: string[];
  };
}

const MODULES = [
  { label: 'Edge Quality Gate', value: 'ACTIVE', tone: 'text-accent-green', desc: 'Filters trades before AI confirmation using regime, VWAP, RSI, ATR and memory.' },
  { label: 'DL Ensemble Prior', value: 'NEURAL+TECH', tone: 'text-primary', desc: 'Blends model output with recent technical prior when disagreement is large.' },
  { label: 'Hybrid Min Score', value: '66%', tone: 'text-primary', desc: 'Final hybrid filter remains active after AI confirmation.' },
  { label: 'Regime Filter', value: 'ADX/CI', tone: 'text-accent-green', desc: 'Blocks dead chop unless Bollinger mean reversion is valid.' },
  { label: 'ATR Exits', value: '2x SL', tone: 'text-accent-green', desc: 'Stop/target/trailing exits are regime adaptive.' },
  { label: 'Kelly Sizing', value: 'TENTH', tone: 'text-accent-amber', desc: 'Risk is capped and sized by edge, not fixed impulse.' },
  { label: 'DCA', value: 'REMOVED', tone: 'text-accent-red', desc: 'No averaging down; one clean thesis per trade.' },
  { label: 'Snowball', value: 'REMOVED', tone: 'text-accent-red', desc: 'No unchecked compounding after wins.' },
  { label: 'Daily Kill Switch', value: '4 LOSSES', tone: 'text-accent-red', desc: 'Stops the day after repeated realized losses.' },
  { label: 'Asset Blacklist', value: 'EURO/SUI', tone: 'text-accent-amber', desc: 'Blocks locally toxic assets until performance improves.' },
];

export default function AIIntel() {
  const [logs, setLogs] = useState<ReflectionRow[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [dlRows, setDlRows] = useState<DLPrediction[]>([]);

  const fetchLogs = async () => {
    try {
      const { data } = await supabase.from('ghost_reflections').select('*').order('created_at', { ascending: false }).limit(20);
      if (data) setLogs(data as ReflectionRow[]);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('https://p01--sentinel-advance--blnvcmgxk6zh.code.run/');
      if (res.ok) setBotStatus((await res.json()) as BotStatus);
    } catch {
      setBotStatus(null);
    }
  };

  const fetchDlRows = async () => {
    setDlRows(await getLatestDLPredictions(10));
  };

  useEffect(() => {
    void fetchLogs();
    void fetchBotStatus();
    void fetchDlRows();
    const interval = window.setInterval(() => {
      void fetchBotStatus();
      void fetchDlRows();
    }, 30000);
    const ch = supabase.channel('react-intel-tab');
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ghost_reflections' }, fetchLogs);
    ch.subscribe();
    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <section className="panel flex min-h-[500px] flex-col overflow-hidden lg:col-span-8">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <TerminalSquare size={17} className="text-primary" />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Sentinel Neural Terminal</h3>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-slate-600">Velocity Core V12.2 / DL Watchdog</p>
            </div>
          </div>
          {botStatus && (
            <div className="status-pill status-ok">
              <span className="h-2 w-2 rounded-full bg-current" />
              Cycle #{botStatus.cycle ?? '-'}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5 font-mono text-xs">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-primary">
            SENTINEL V12.2 ONLINE<br />
            EDGE GATE: ACTIVE<br />
            DL ENSEMBLE: NEURAL OUTPUT + TECHNICAL PRIOR<br />
            HYBRID FILTER: ORDER FLOW / ML / DIVERGENCE / LIQUIDITY / MEAN REVERSION<br />
            RISK: ATR EXITS + TENTH KELLY + DAILY KILL SWITCH
          </div>
          {logs.map((log) => {
            const isWin = log.analysis.includes('WIN') || log.analysis.includes('COMPLETED') || log.analysis.includes('OPEN');
            const isLoss = log.analysis.includes('LOSS') || log.analysis.includes('WARNING') || log.analysis.includes('RISK');
            const color = isWin ? 'text-accent-green' : isLoss ? 'text-accent-red' : 'text-slate-300';
            return (
              <div key={log.id} className="border-b border-white/[0.04] pb-2">
                <span className={`block opacity-80 ${color}`}>[{new Date(log.created_at).toLocaleTimeString()} / AI NODE]</span>
                <span className={`mt-1 block border-l border-current pl-3 ${color}`}>{log.analysis}</span>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="flex flex-col gap-5 lg:col-span-4">
        <section className="panel p-5">
          <div className="mb-4 flex items-center gap-3">
            <BrainCircuit size={20} className="text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Deep Learning V12.2</h4>
          </div>
          <div className="space-y-2">
            {dlRows.length === 0 && <p className="text-sm text-slate-500">Waiting for dl_predict telemetry.</p>}
            {dlRows.slice(0, 6).map((row) => (
              <div key={`${row.symbol}-${row.created_at}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                <span className="font-mono text-xs text-slate-400">{row.symbol}</span>
                <span className="font-mono text-xs font-semibold text-primary">{(row.score * 100).toFixed(1)}%</span>
                <span className="font-mono text-[10px] text-slate-600">{row.latency_ms.toFixed(0)}ms</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck size={18} className="text-accent-green" />
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Control Matrix</h4>
          </div>
          <div className="space-y-2">
            {MODULES.map((module) => (
              <div key={module.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2" title={module.desc}>
                <span className="text-[11px] text-slate-500">{module.label}</span>
                <span className={`font-mono text-[11px] font-semibold ${module.tone}`}>{module.value}</span>
              </div>
            ))}
          </div>
        </section>

        {botStatus && (
          <section className="panel p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-accent-amber">
              <Zap size={14} /> Live Bot Telemetry
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Balance', value: `$${Number(botStatus.portfolio?.balance || 0).toFixed(2)}` },
                { label: 'PnL', value: `$${botStatus.portfolio?.pnl ?? '0.00'}` },
                { label: 'Win Rate', value: botStatus.portfolio?.winRate || 'N/A' },
                { label: 'Trades', value: botStatus.portfolio?.trades ?? 0 },
                { label: 'Kill Switch', value: botStatus.valentini?.killSwitch || 'N/A' },
                { label: 'Uptime', value: `${Math.floor(Number(botStatus.uptime || 0) / 60)}m` },
              ].map((stat) => (
                <div key={stat.label} className="mini-stat">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
