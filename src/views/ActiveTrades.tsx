import { useEffect, useState } from 'react';
import { AlertCircle, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TradeRow {
  id: number | string;
  asset: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number | string;
  size?: number | string;
  opened_at?: string;
  status?: string;
}

interface PythParsedPrice {
  id: string;
  price: {
    price: string;
    expo: string;
  };
}

interface PythResponse {
  parsed?: PythParsedPrice[];
}

const PYTH_FEEDS: Record<string, string> = {
  XAU: '765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
  ORO: '765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
  EUR: 'a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
  EURO: 'a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
  JPY: 'ef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52',
  YEN: 'ef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52',
  BTC: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  BITCOIN: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  SOL: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  SOLANA: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  SUI: '23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  SP500: '19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
  SPY: '19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
  NASDAQ100: '9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d',
  QQQ: '9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d',
};

function baseAsset(asset: string) {
  return asset.replace('/USD', '').replace('USDT', '').toUpperCase();
}

function priceFormat(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: value < 10 ? 4 : 2, maximumFractionDigits: value < 10 ? 4 : 2 });
}

export default function ActiveTrades() {
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  const fetchTrades = async () => {
    try {
      const { data } = await supabase.from('ghost_trades').select('*').eq('status', 'OPEN').order('opened_at', { ascending: false });
      if (data) setTrades(data as TradeRow[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLivePrices = async () => {
    if (trades.length === 0) return;
    const ids = new Set<string>();
    trades.forEach((trade) => {
      const id = PYTH_FEEDS[baseAsset(trade.asset)];
      if (id) ids.add(id);
    });
    if (ids.size === 0) return;

    try {
      const queryParams = Array.from(ids).map((id) => `ids[]=${id}`).join('&');
      const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?${queryParams}`);
      const data = (await res.json()) as PythResponse;
      const updatedPrices: Record<string, number> = {};
      data.parsed?.forEach((priceItem) => {
        updatedPrices[priceItem.id] = Number.parseInt(priceItem.price.price, 10) * Math.pow(10, Number.parseInt(priceItem.price.expo, 10));
      });

      setLivePrices((prev) => {
        const next = { ...prev };
        trades.forEach((trade) => {
          const base = baseAsset(trade.asset);
          const id = PYTH_FEEDS[base];
          if (id && updatedPrices[id]) next[base] = updatedPrices[id];
        });
        return next;
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    void fetchTrades();
    const ch = supabase.channel('react-trades-tab');
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ghost_trades' }, fetchTrades);
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (trades.length === 0) return undefined;
    void fetchLivePrices();
    const interval = window.setInterval(fetchLivePrices, 1000);
    return () => window.clearInterval(interval);
  }, [trades]);

  if (loading) return <div className="text-slate-500 animate-pulse">Scanning open operations...</div>;

  return (
    <div className="flex flex-col gap-5">
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="section-title"><Target size={18} /> Ongoing Operations</h3>
          <div className="status-pill status-ok">
            <span className="h-2 w-2 rounded-full bg-current" />
            {trades.length} open
          </div>
        </div>

        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-primary/30 text-primary">
              <AlertCircle size={24} />
            </div>
            <p className="font-mono text-sm uppercase tracking-[0.18em] text-primary">No active trades</p>
            <p className="text-xs text-slate-500">Awaiting next confirmed edge.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-5 py-3">Asset</th>
                  <th className="px-5 py-3">Direction</th>
                  <th className="px-5 py-3">Entry</th>
                  <th className="px-5 py-3">Mark</th>
                  <th className="px-5 py-3">Move</th>
                  <th className="px-5 py-3">Live PnL</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {trades.map((trade) => {
                  const isLong = trade.direction === 'LONG';
                  const Icon = isLong ? TrendingUp : TrendingDown;
                  const base = baseAsset(trade.asset);
                  const currentPrice = livePrices[base];
                  const entryPrice = Number(trade.entry_price);
                  const size = Number(trade.size || 0);
                  const pnlPercent = currentPrice && entryPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 * (isLong ? 1 : -1) : null;
                  const pnlUsd = currentPrice && entryPrice && size ? (isLong ? currentPrice - entryPrice : entryPrice - currentPrice) * size : null;
                  const isProfit = (pnlPercent ?? 0) >= 0;

                  return (
                    <tr key={trade.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{trade.asset}</p>
                        <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-slate-600">{base}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          isLong ? 'border-accent-green/25 bg-accent-green/10 text-accent-green' : 'border-accent-red/25 bg-accent-red/10 text-accent-red'
                        }`}>
                          <Icon size={12} /> {trade.direction}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-300">${priceFormat(entryPrice)}</td>
                      <td className="px-5 py-4 font-mono text-white">
                        {currentPrice ? `$${priceFormat(currentPrice)}` : <span className="text-slate-600">syncing</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-lg border px-2 py-1 font-mono text-xs font-semibold ${
                          pnlPercent === null ? 'border-transparent text-slate-600' : isProfit ? 'border-accent-green/20 bg-accent-green/10 text-accent-green' : 'border-accent-red/20 bg-accent-red/10 text-accent-red'
                        }`}>
                          {pnlPercent === null ? '--' : `${isProfit ? '+' : ''}${pnlPercent.toFixed(3)}%`}
                        </span>
                      </td>
                      <td className={`px-5 py-4 font-mono font-semibold ${pnlUsd === null ? 'text-slate-600' : pnlUsd >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {pnlUsd === null ? '--' : `${pnlUsd >= 0 ? '+' : '-'}$${Math.abs(pnlUsd).toFixed(4)}`}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-accent-green">Active</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
