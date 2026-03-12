// ============================================================
//  INFLUXDB CLOUD CONNECTOR — SENTINEL DASHBOARD (React/Vite)
//  Replaces @tidbcloud/serverless for all HFT reads
// ============================================================

const INFLUX_URL = 'https://us-east-1-1.aws.cloud2.influxdata.com';
const INFLUX_ORG = '8e0d844a8941d92b';
const INFLUX_BUCKET = 'sentinel_telemetry';
const INFLUX_TOKEN = '8zKWfZkxl56BONLzRDJiibDk-IpCuZ5CEpXvtk4GlHgic4yexfOrsZXEy5v1byxf5LMvb50LCMqLT10dHtI2HA==';

const QUERY_URL = `${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`;

function parseCSV(csv: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return results;

  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].includes('_time') || lines[i].includes('_value') || lines[i].includes('_field')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return results;

  const headers = lines[headerIdx].split(',');
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    if (vals.length < headers.length) continue;
    if (vals[0]?.startsWith('#')) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j].trim();
      if (key && key !== '' && key !== 'result' && key !== 'table') {
        row[key] = vals[j]?.trim() || '';
      }
    }
    if (Object.keys(row).length > 0) results.push(row);
  }
  return results;
}

async function queryInflux(fluxQuery: string) {
  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${INFLUX_TOKEN}`,
      'Content-Type': 'application/vnd.flux',
      'Accept': 'application/csv',
    },
    body: fluxQuery,
  });
  if (!res.ok) return [];
  const csv = await res.text();
  return parseCSV(csv);
}

// ── Public API (matches what Radar.tsx, Overview.tsx, App.tsx need) ──

export async function getChartPrices(symbol: string, limit = 30) {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -6h)
  |> filter(fn: (r) => r._measurement == "market_data" and r.symbol == "${symbol}" and r._field == "price")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})`;
  const rows = await queryInflux(query);
  return rows.map(r => ({ price: parseFloat(r._value) || 0, recorded_at: r._time || '' }));
}

export async function getRadarPrices(limit = 50) {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -30m)
  |> filter(fn: (r) => r._measurement == "market_data" and r._field == "price")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})`;
  const rows = await queryInflux(query);
  return rows.map(r => ({
    symbol: r.symbol || '',
    price: parseFloat(r._value) || 0,
    recorded_at: r._time || '',
  }));
}

export async function getRadarTelemetry() {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -30m)
  |> filter(fn: (r) => r._measurement == "market_data")
  |> last()
  |> pivot(rowKey: ["_time", "symbol"], columnKey: ["_field"], valueColumn: "_value")`;
  const rows = await queryInflux(query);
  return rows.map(r => ({
    symbol: r.symbol || '',
    price: parseFloat(r.price) || 0,
    momentum: parseFloat(r.momentum) || 0,
    volatility: parseFloat(r.volatility) || 0,
    trend: parseFloat(r.trend) || 0,
    time: r._time || '',
  }));
}

export async function getLatestSignal() {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "signal_data")
  |> last()
  |> pivot(rowKey: ["_time", "symbol"], columnKey: ["_field"], valueColumn: "_value")`;
  const rows = await queryInflux(query);
  if (rows.length > 0) {
    const r = rows[0];
    return {
      symbol: r.symbol || 'N/A',
      hybrid_confidence: parseFloat(r.hybrid_confidence) || 0,
      ml_prediction: parseFloat(r.ml_prediction) || 0,
      divergence: r.divergence || 'none',
      liquidity_pool: r.liquidity_pool || 'none',
      created_at: r._time || '',
    };
  }
  return null;
}

export async function getSignalHistory(limit = 10) {
  const query = `from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -6h)
  |> filter(fn: (r) => r._measurement == "signal_data")
  |> pivot(rowKey: ["_time", "symbol"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})`;
  return await queryInflux(query);
}

export async function influxPing(): Promise<number | null> {
  try {
    const t0 = Date.now();
    const res = await fetch(`${INFLUX_URL}/api/v2/orgs?org=Sentinel`, {
      headers: { 'Authorization': `Token ${INFLUX_TOKEN}` },
    });
    if (res.ok) return Date.now() - t0;
    return null;
  } catch {
    return null;
  }
}
