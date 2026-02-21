import { useState } from 'react';
import { Rocket, LayoutDashboard, LineChart, Brain, History, Settings, Bell } from 'lucide-react';
import Overview from './views/Overview';
import ActiveTrades from './views/ActiveTrades';
import AIIntel from './views/AIIntel';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'trades', label: 'Active Trades', icon: LineChart },
    { id: 'intel', label: 'AI Intel', icon: Brain },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="flex h-screen overflow-hidden text-slate-100 font-display">
      {/* Sidebar */}
      <nav className="hidden md:flex flex-col w-20 lg:w-64 h-full border-r border-white/5 bg-background-dark shrink-0 z-50">
        <div className="p-6 flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shadow-glow relative shrink-0">
            <Rocket size={20} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-green rounded-full border-2 border-background-dark"></div>
          </div>
          <div className="hidden lg:flex flex-col">
            <h1 className="text-white font-bold text-lg tracking-tight leading-none">Sentinel</h1>
            <p className="text-primary/70 text-xs font-mono mt-1">v2.5 ONLINE</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-2 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${isActive
                  ? 'bg-primary/10 border border-primary/20 text-white shadow-glow'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
              >
                <Icon size={20} className={isActive ? 'text-primary' : 'group-hover:text-primary transition-colors'} />
                <span className="hidden lg:block text-sm font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="p-3 mt-auto">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center w-full gap-3 px-3 py-3 rounded-xl transition-all group ${activeTab === 'settings' ? 'bg-primary/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Settings size={20} className="group-hover:text-primary transition-colors" />
            <span className="hidden lg:block text-sm font-medium">Settings</span>
          </button>
          <div className="mt-4 pt-4 border-t border-white/5 px-3 flex items-center gap-3 hidden lg:flex">
            <div className="h-8 w-8 rounded-full bg-slate-700 bg-cover bg-center flex items-center justify-center text-xs">
              AT
            </div>
            <div className="flex flex-col text-left">
              <p className="text-xs text-white font-medium">Alex Trader</p>
              <p className="text-[10px] text-slate-500">Pro Account</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-background-dark">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/5 via-background-dark/50 to-background-dark pointer-events-none z-0"></div>
        <div className="relative z-10 p-4 pb-24 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 min-h-full">

          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight capitalize">{activeTab.replace('-', ' ')}</h2>
              <p className="text-slate-400 text-sm mt-1">Real-time AI analysis and portfolio tracking</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/20">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
                <span className="text-xs font-medium text-accent-green font-mono">SYSTEM ONLINE</span>
              </div>
              <button className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                <Bell size={18} />
              </button>
            </div>
          </header>

          {activeTab === 'overview' && <Overview />}
          {activeTab === 'trades' && <ActiveTrades />}
          {activeTab === 'intel' && <AIIntel />}
          {activeTab === 'history' && <div className="glass-panel p-10 text-center text-slate-400 rounded-2xl">History Module - In Development</div>}
          {activeTab === 'settings' && <div className="glass-panel p-10 text-center text-slate-400 rounded-2xl">Settings Panel - In Development</div>}

        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#05080a] border-t border-white/5 z-50 flex items-center justify-around px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${isActive ? 'text-primary' : 'text-slate-500'
                  }`}
              >
                <Icon size={20} className={isActive ? 'text-primary drop-shadow-[0_0_8px_rgba(19,200,236,0.6)]' : ''} />
                <span className="text-[10px] mt-1 font-medium">{item.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  );
}

export default App;
