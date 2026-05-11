import { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  Brain,
  Crosshair,
  History as HistoryIcon,
  LayoutDashboard,
  LineChart,
  Rocket,
  Settings,
} from 'lucide-react';
import { influxPing } from './lib/influxdb';
import Overview from './views/Overview';
import Radar from './views/Radar';
import ActiveTrades from './views/ActiveTrades';
import AIIntel from './views/AIIntel';
import History from './views/History';

type TabId = 'overview' | 'radar' | 'trades' | 'intel' | 'history' | 'settings';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'radar', label: 'Radar', icon: Crosshair },
  { id: 'trades', label: 'Trades', icon: LineChart },
  { id: 'intel', label: 'AI Intel', icon: Brain },
  { id: 'history', label: 'History', icon: HistoryIcon },
] satisfies Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }>;

const titles: Record<TabId, { title: string; subtitle: string }> = {
  overview: { title: 'Sentinel Overview', subtitle: 'Live equity, edge quality, DL signal and market stream' },
  radar: { title: 'HFT Radar', subtitle: 'InfluxDB telemetry across active assets' },
  trades: { title: 'Active Trades', subtitle: 'Open operations and live mark-price drift' },
  intel: { title: 'AI Intel', subtitle: 'Core modules, DL health and reflection log' },
  history: { title: 'History', subtitle: 'Closed operations and realized performance' },
  settings: { title: 'Settings', subtitle: 'Runtime configuration surface' },
};

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [influxLatency, setInfluxLatency] = useState<number | null>(null);

  useEffect(() => {
    const checkInflux = async () => setInfluxLatency(await influxPing());
    void checkInflux();
    const interval = window.setInterval(checkInflux, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const dbOnline = influxLatency !== null;
  const activeTitle = titles[activeTab];

  return (
    <div className="flex h-screen overflow-hidden bg-background-dark text-slate-100 font-display">
      <nav className="hidden md:flex h-full w-20 shrink-0 flex-col border-r border-white/10 bg-[#080a0d] lg:w-64">
        <div className="flex items-center gap-3 px-4 py-5 lg:px-5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Rocket size={20} />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#080a0d] bg-accent-green" />
          </div>
          <div className="hidden min-w-0 lg:block">
            <h1 className="truncate text-base font-semibold tracking-tight text-white">Sentinel V12.2</h1>
            <p className="mt-1 truncate text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">Velocity Core</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary/30 bg-primary/10 text-white'
                    : 'border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.03] hover:text-slate-200'
                }`}
              >
                <Icon size={19} className={isActive ? 'text-primary' : ''} />
                <span className="hidden text-sm font-medium lg:block">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
              activeTab === 'settings' ? 'border-primary/30 bg-primary/10 text-white' : 'border-transparent text-slate-500 hover:bg-white/[0.03]'
            }`}
          >
            <Settings size={19} />
            <span className="hidden text-sm font-medium lg:block">Settings</span>
          </button>
          <div className="mt-3 hidden rounded-lg border border-white/10 bg-white/[0.02] p-3 lg:block">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.16em]">
              <span className="text-slate-500">InfluxDB</span>
              <span className={dbOnline ? 'text-accent-green' : 'text-accent-red'}>{dbOnline ? `${influxLatency}ms` : 'Offline'}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[1600px] flex-col gap-5 px-4 pb-24 pt-4 md:px-8 md:py-7">
          <header className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                <Activity size={13} className="text-primary" />
                Live Command Surface
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">{activeTitle.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{activeTitle.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`status-pill ${dbOnline ? 'status-ok' : 'status-bad'}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                InfluxDB {dbOnline ? `${influxLatency}ms` : 'offline'}
              </div>
              <div className="status-pill status-ok">
                <span className="h-2 w-2 rounded-full bg-current" />
                DL v12.2
              </div>
              <button
                aria-label="Notifications"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Bell size={16} />
              </button>
            </div>
          </header>

          {activeTab === 'overview' && <Overview />}
          {activeTab === 'radar' && <Radar />}
          {activeTab === 'trades' && <ActiveTrades />}
          {activeTab === 'intel' && <AIIntel />}
          {activeTab === 'history' && <History />}
          {activeTab === 'settings' && (
            <div className="panel p-8 text-sm text-slate-400">Settings</div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-white/10 bg-[#080a0d]/95 px-2 backdrop-blur md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex min-w-12 flex-col items-center justify-center rounded-lg px-2 py-2 text-[10px] transition-colors ${
                  isActive ? 'text-primary' : 'text-slate-500'
                }`}
              >
                <Icon size={19} />
                <span className="mt-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default App;
