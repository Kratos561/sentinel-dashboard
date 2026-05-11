// Sentinel dashboard InfluxDB connector.
// Reads the active market_data, signal_data and dl_predict measurements.

const INFLUX_URL = 'https://us-east-1-1.aws.cloud2.influxdata.com';
const INFLUX_ORG = '8e0d844a8941d92b';
const INFLUX_BUCKET = 'sentinel_telemetry';
const INFLUX_TOKEN = '8zKWfZkxl56BONLzRDJiibDk-IpCuZ5CEpXvtk4GlHgic4yexfOrsZXEy5v1byxf5LMvb50LCMqLT10dHtI2HA==';

const QUERY_URL = `${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`;

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

function parseCSV(csv: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return results;

  const headerIdx = lines.findIndex((line) => line.includes('_time') || line.includes('_value') || line.includes('_field'));
  if (headerIdx === -1) return results;

  const headers = lines[headerIdx].split(',');
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    if (lines[i]?.startsWith('#')) continue;
    const vals = lines[i].split(',');
    if (vals.length < headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      const key = header.trim();
      if (key && key !== 'result' && key !== 'table') row[key] = vals[index]?.trim() || '';
    });
    if (Object.keys(row).length > 0) results.push(row);
  }
  return results;
}

async function queryInflux(fluxQuery: string) {
  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Token ${INFLUX_TOKEN}`,
      'Content-Type': 'application/vnd.flux',
      Accept: 'application/csv',
    },
    body: fluxQuery,
  });
  if (!res.ok) return [];
  return parseCSV(await res.text());
}

function labelFromScore(score: number, explicitLabel?: string) {
  const label = (explicitLabel || '').toUpperCase();
  if (label.includes('LONG')) return { label: explicitLabel || 'LONG', direction: 'LONG' as const };
  if (label.includes('SHORT')) return { label: explicitLabel || 'SHORT', direction: 'SHORT' as const };
  if (score >= 0.65) return { label: `LONG ${(score * 100).toFixed(1)}%`, direction: 'LONG' as const };
  if (score <= 0.35) return { label: `SHORT ${(score * 100).toFixed(1)}%`, direction: 'SHORT' as const };
  return { label: explicitLabel || `HOLD ${(score * 100).toFixed(1)}%`, direction: 'HOLD' as const };
}

function scoreFromRaw(rawScore?: string, rawLabel?: string) {
  const numeric = Number.parseFloat(rawScore || '');
  if (Number.isFinite(numeric) && numeric > 0) return numeric > 1 ? numeric / 100 : numeric;
  const pct = String(rawLabel || rawScore || '').match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return Math.max(0, Math.min(1, Number(pct[1]) / 100));
  const label = String(rawLabel || rawScore || '').toUpperCase();
  if (label.includes('LONG')) return 0.75;
  if (label.includes('SHORT')) return 0.25;
  return 0.5;
}

function mapSignalRow(r: Record<string, string>): SignalSnapshot {
  const score = scoreFromRaw(r.ml_score, r.ml_label || r.ml_prediction);
  const { label, direction } = labelFromScore(score, r.ml_label);
  return {
    symbol: r.symbol || 'N/A',
    hybrid_confidence: Number.parseFloat(r.hybrid_confidence) || 0,
    ml_prediction: score,
    ml_label: label,
    direction,
    divergence: r.divergence || 'none',
    liquidity_pool: r.liquidity_pool || 'none',
    created_at: r._time || '',
  };
}

export async function getChartPrices(symbol: string, limit = 60): Promise<ChartPoint[]> {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -8h)
  |> filter(fn: (r) => r._measurement == "market_data" and r.symbol == "${symbol}" and r._field == "price")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})`;
  const rows = await queryInflux(query);
  return rows.map((r) => ({ price: Number.parseFloat(r._value) || 0, recorded_at: r._time || '' }));
}

export async function getRadarTelemetry(): Promise<RadarTelemetry[]> {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -30m)
  |> filter(fn: (r) => r._measurement == "market_data")
  |> last()
  |> pivot(rowKey: ["_time", "symbol"], columnKey: ["_field"], valueColumn: "_value")`;
  const rows = await queryInflux(query);
  return rows.map((r) => ({
    symbol: r.symbol || '',
    price: Number.parseFloat(r.price) || 0,
    momentum: Number.parseFloat(r.momentum) || 0,
    volatility: Number.parseFloat(r.volatility) || 0,
    trend: Number.parseFloat(r.trend) || 0,
    time: r._time || '',
  }));
}

export async function getLatestSignal(): Promise<SignalSnapshot | null> {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "signal_data")
  |> pivot(rowKey: ["_time", "symbol"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)`;
  const rows = await queryInflux(query);
  return rows.length > 0 ? mapSignalRow(rows[0]) : null;
}

export async function getSignalHistory(limit = 12): Promise<SignalSnapshot[]> {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -6h)
  |> filter(fn: (r) => r._measurement == "signal_data")
  |> pivot(rowKey: ["_time", "symbol"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})`;
  const rows = await queryInflux(query);
  return rows.map(mapSignalRow);
}

export async function getLatestDLPredictions(limit = 8): Promise<DLPrediction[]> {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -2h)
  |> filter(fn: (r) => r._measurement == "dl_predict")
  |> pivot(rowKey: ["_time", "symbol"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})`;
  const rows = await queryInflux(query);
  return rows.map((r) => ({
    symbol: r.symbol || 'N/A',
    score: Number.parseFloat(r.hybrid_score) || Number.parseFloat(r.score) || Number.parseFloat(r.prediction) || 0,
    latency_ms: Number.parseFloat(r.latency_ms) || Number.parseFloat(r.latency) || 0,
    created_at: r._time || '',
  }));
}

export async function influxPing(): Promise<number | null> {
  try {
    const t0 = Date.now();
    const res = await fetch(`${INFLUX_URL}/api/v2/orgs?org=Sentinel`, {
      headers: { Authorization: `Token ${INFLUX_TOKEN}` },
    });
    return res.ok ? Date.now() - t0 : null;
  } catch {
    return null;
  }
}
