// Sentinel dashboard telemetry client.
// The browser never receives InfluxDB credentials; all reads go through the
// Sentinel core read-only proxy endpoints.

const SENTINEL_CORE_URL = (import.meta.env.VITE_SENTINEL_CORE_URL ?? 'https://p01--sentinel-advance--blnvcmgxk6zh.code.run').replace(/\/+$/, '');

export interface ChartPoint {
  price: number;
  recorded_at: string;
}

export interface RadarTelemetry {
  symbol: string;
  price: number;
  momentum: number;
  volatility: number;
  trend: number;
  time: string;
}

export interface SignalSnapshot {
  symbol: string;
  hybrid_confidence: number;
  ml_prediction: number;
  ml_label: string;
  direction: 'LONG' | 'SHORT' | 'HOLD';
  divergence: string;
  liquidity_pool: string;
  created_at: string;
}

export interface DLPrediction {
  symbol: string;
  score: number;
  latency_ms: number;
  created_at: string;
}

export interface DecisionEvent {
  ts: string;
  asset: string;
  stage: string;
  action: string;
  session?: string;
  details?: Record<string, unknown>;
}

export interface DecisionState {
  generatedAt: string;
  session: string;
  cycle: number;
  cadence: {
    lastOpenedTradeAt?: string | null;
    lastClosedTradeAt?: string | null;
    hoursSinceTrade?: number | null;
    dormant?: boolean;
    dormantThresholdHours?: number;
  };
  discipline: {
    consecutiveLosses: number;
    dailyLosses: number;
    dailyPnL: number;
    cooldownCyclesLeft: number;
    dailyRisk?: {
      blocked: boolean;
      cautionMode: boolean;
      strictMode: boolean;
      lossLimit: number;
      maxDailyLossUsd: number;
      recoveryPnlMin: number;
      dailyLossCount: number;
      dailyPnL: number;
      consecutiveLosses: number;
      minQualityBump: number;
      hybridBump: number;
      qualityPenalty: number;
      sizeMultiplier: number;
      reasons: string[];
    };
  };
  counters: Record<string, number>;
  latestByAsset: Record<string, DecisionEvent>;
  recentEvents: DecisionEvent[];
  risk: {
    maxRiskPerTradePct: number;
    maxDailyLossPct?: number;
    maxDailyLossUsd?: number;
    dailyLossTradesLimit?: number;
    maxTradesPerHour?: number;
    sameAssetCooldownMin?: number;
    postLossCooldownMin?: number;
    hybridMinScore: number;
    lossStreakGuardStart: number;
    lossStreakStrictStart: number;
  };
}

export interface SecurityPosture {
  headers: boolean;
  rateLimitPerMinute: number;
  corsMode: string;
  dashboardProxy: boolean;
  optionalReadToken: boolean;
  secretFallbacksActive?: Record<string, boolean>;
  secretEnvMissing?: Record<string, boolean>;
  influx?: {
    configured: boolean;
    envReady: boolean;
    source: string;
    bucket: string;
    host: string;
  };
}

async function fetchCore<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${SENTINEL_CORE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

function labelFromScore(score: number, explicitLabel?: string) {
  const label = (explicitLabel || '').toUpperCase();
  if (label.includes('LONG')) return { label: explicitLabel || 'LONG', direction: 'LONG' as const };
  if (label.includes('SHORT')) return { label: explicitLabel || 'SHORT', direction: 'SHORT' as const };
  if (score >= 0.65) return { label: `LONG ${(score * 100).toFixed(1)}%`, direction: 'LONG' as const };
  if (score <= 0.35) return { label: `SHORT ${(score * 100).toFixed(1)}%`, direction: 'SHORT' as const };
  return { label: explicitLabel || `HOLD ${(score * 100).toFixed(1)}%`, direction: 'HOLD' as const };
}

function scoreFromRaw(rawScore?: unknown, rawLabel?: unknown) {
  const numeric = Number.parseFloat(String(rawScore ?? ''));
  if (Number.isFinite(numeric) && numeric > 0) return numeric > 1 ? numeric / 100 : numeric;
  const pct = String(rawLabel ?? rawScore ?? '').match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return Math.max(0, Math.min(1, Number(pct[1]) / 100));
  const label = String(rawLabel ?? rawScore ?? '').toUpperCase();
  if (label.includes('LONG')) return 0.75;
  if (label.includes('SHORT')) return 0.25;
  return 0.5;
}

function mapSignalRow(r: Record<string, unknown>): SignalSnapshot {
  const score = scoreFromRaw(r.ml_score ?? r.ml_prediction, r.ml_label);
  const { label, direction } = labelFromScore(score, String(r.ml_label || ''));
  return {
    symbol: String(r.symbol || 'N/A'),
    hybrid_confidence: Number.parseFloat(String(r.hybrid_confidence || 0)) || 0,
    ml_prediction: score,
    ml_label: label,
    direction,
    divergence: String(r.divergence || 'none'),
    liquidity_pool: String(r.liquidity_pool || 'none'),
    created_at: String(r.created_at || r._time || ''),
  };
}

export async function getChartPrices(symbol: string, limit = 60): Promise<ChartPoint[]> {
  const rows = await fetchCore<Record<string, unknown>[]>(
    `/api/chart?symbol=${encodeURIComponent(symbol)}&limit=${encodeURIComponent(String(limit))}`,
    [],
  );
  return rows.map((r) => ({
    price: Number.parseFloat(String(r.price ?? r._value ?? 0)) || 0,
    recorded_at: String(r.recorded_at || r._time || ''),
  }));
}

export async function getRadarTelemetry(): Promise<RadarTelemetry[]> {
  const rows = await fetchCore<Record<string, unknown>[]>('/api/radar', []);
  return rows.map((r) => ({
    symbol: String(r.symbol || ''),
    price: Number.parseFloat(String(r.price || 0)) || 0,
    momentum: Number.parseFloat(String(r.momentum || 0)) || 0,
    volatility: Number.parseFloat(String(r.volatility || 0)) || 0,
    trend: Number.parseFloat(String(r.trend || 0)) || 0,
    time: String(r.time || r._time || ''),
  }));
}

export async function getLatestSignal(): Promise<SignalSnapshot | null> {
  const row = await fetchCore<Record<string, unknown> | null>('/api/latest-signal', null);
  return row ? mapSignalRow(row) : null;
}

export async function getSignalHistory(limit = 12): Promise<SignalSnapshot[]> {
  const rows = await fetchCore<Record<string, unknown>[]>(`/api/signals?limit=${encodeURIComponent(String(limit))}`, []);
  return rows.map(mapSignalRow);
}

export async function getLatestDLPredictions(limit = 8): Promise<DLPrediction[]> {
  const rows = await fetchCore<Record<string, unknown>[]>(`/api/dl?limit=${encodeURIComponent(String(limit))}`, []);
  return rows.map((r) => ({
    symbol: String(r.symbol || 'N/A'),
    score: Number.parseFloat(String(r.score ?? r.hybrid_score ?? r.prediction ?? 0)) || 0,
    latency_ms: Number.parseFloat(String(r.latency_ms ?? r.latency ?? 0)) || 0,
    created_at: String(r.created_at || r._time || ''),
  }));
}

export async function influxPing(): Promise<number | null> {
  const result = await fetchCore<{ latencyMs: number | null }>('/api/influx-ping', { latencyMs: null });
  return result.latencyMs;
}

export async function getDecisionState(): Promise<DecisionState | null> {
  return fetchCore<DecisionState | null>('/api/decision-state', null);
}

export async function getSecurityPosture(): Promise<SecurityPosture | null> {
  return fetchCore<SecurityPosture | null>('/api/security', null);
}
