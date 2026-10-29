/* ── Shared telemetry bucketing for analytics charts ──────────────────────────
   Buckets the FULL stored log history into adaptive time slots.
   Each slot keeps accurate values (PIR count, protection status, battery, signal)
   plus a rich date+time label so charts read cleanly. */

export const BUCKET_SIZE_MS = [
  { max: 6 * 3600e3,   ms: 5 * 60e3 },   // ≤ 6h   → 5 min buckets
  { max: 24 * 3600e3,  ms: 15 * 60e3 },  // ≤ 24h  → 15 min buckets
  { max: 7 * 24 * 3600e3, ms: 60 * 60e3 }, // ≤ 7d → 1h buckets
  { max: 30 * 24 * 3600e3, ms: 6 * 3600e3 }, // ≤ 30d → 6h buckets
  { max: Infinity,                 ms: 24 * 3600e3 },  // > 30d → daily buckets
];

export function fmtShortDate(ts, forChart = true) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const monthDay = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (forChart && sameDay) return time;
  return `${monthDay} · ${time}`;
}

export function fmtDateLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleString([], {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export function fmtRange(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/* Even time-frame ticks for the X axis — 1 minute minimum step, so every
   minute is marked when the window is short; steps scale up to cap the count. */
export function computeTimeTicks(minT, maxT, preferStepMs = 60e3, cap = 720) {
  if (!Number.isFinite(minT) || !Number.isFinite(maxT) || maxT <= minT) return null;
  const step = Math.max(preferStepMs, Math.ceil((maxT - minT) / cap / preferStepMs) * preferStepMs);
  const start = Math.ceil(minT / step) * step;
  const ticks = [];
  for (let t = start; t <= maxT && ticks.length <= cap + 1; t += step) ticks.push(t);
  return ticks;
}

/* Build full-history buckets. Returns null when no usable logs.
   Pass { from, to } (epoch ms) to restrict to a time window. */
export function buildTelemetrySeries(deviceLogs, { from = null, to = null } = {}) {
  const inRange = (l) => {
    const t = new Date(l.timestamp).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    return true;
  };

  const valid = (deviceLogs || [])
    .filter(l => l && l.timestamp && inRange(l))
    .map(l => ({
      t: new Date(l.timestamp).getTime(),
      motion: l.motion_count || 0,
      protect: l.alert_active ? 1 : 0,
      battery: typeof l.battery === 'number' ? l.battery : null,
      signal: typeof l.signal === 'number' ? l.signal : null,
      power: l.power ?? null,
      powerCut: typeof l.power === 'number' ? l.power < 4.0 : (l.power_cut ?? null),
    }))
    .sort((a, b) => a.t - b.t);

  if (valid.length === 0) return null;

  const min = valid[0].t;
  const max = valid[valid.length - 1].t;
  const span = Math.max(max - min, 1);

  const bucketMs = BUCKET_SIZE_MS.find(b => span <= b.max).ms;
  const startAligned = Math.floor(min / bucketMs) * bucketMs;
  const numBuckets = Math.ceil((max - startAligned) / bucketMs) + 1;

  const buckets = [];
  for (let i = 0; i < numBuckets; i++) {
    const bStart = startAligned + i * bucketMs;
    buckets.push({
      key: bStart,
      rawT: bStart + bucketMs / 2,
      dateLabel: fmtDateLabel(bStart),
      shortLabel: fmtShortDate(bStart),
      rangeLabel: fmtRange(bStart),
      count: 0,
      status: 0,
      hasBattery: false,
      batterySum: 0,
      batteryCount: 0,
      signalSum: 0,
      signalCount: 0,
      powerCutCount: 0,
    });
  }

  for (const r of valid) {
    const idx = Math.floor((r.t - startAligned) / bucketMs);
    const b = buckets[idx];
    if (!b) continue;
    b.count += r.motion;
    b.status = r.protect;
    if (r.battery !== null) { b.hasBattery = true; b.batterySum += r.battery; b.batteryCount++; }
    if (r.signal !== null) { b.signalSum += r.signal; b.signalCount++; }
    if (r.powerCut) b.powerCutCount++;
  }

  // Filter out trailing buckets that have no data at all
  let lastDataIdx = buckets.length - 1;
  while (lastDataIdx > 0 && buckets[lastDataIdx].count === 0 && buckets[lastDataIdx].batteryCount === 0 && buckets[lastDataIdx].signalCount === 0) {
    lastDataIdx--;
  }
  const finalBuckets = buckets.slice(0, lastDataIdx + 1);

  // Attach averaged battery / signal to each bucket, filling nulls for gaps
  const series = finalBuckets.map(b => ({
    ...b,
    pirActive: b.count > 0 ? 1 : 0,
    battery: b.hasBattery ? Math.round(b.batterySum / b.batteryCount) : null,
    signal: b.hasBattery ? Math.round(b.signalSum / b.signalCount) : null,
  }));

  // Protection-mode transitions count across raw stream
  let changes = 0;
  let prev = null;
  for (const r of valid) {
    if (prev !== null && r.protect !== prev) changes++;
    prev = r.protect;
  }

  return {
    series,
    triggers: valid.filter(r => r.motion > 0).map(r => ({ t: r.t, count: r.motion })),
    totalPir: series.reduce((s, b) => s + b.count, 0),
    armCount: series.filter(b => b.status === 1).length,
    changes,
    scanCount: valid.length,
    start: new Date(min),
    end: new Date(max),
    bucketMs,
    minT: min,
    maxT: max,
    batteryMin: valid.reduce((m, r) => r.battery !== null && (m === null || r.battery < m) ? r.battery : m, null),
    batteryMax: valid.reduce((m, r) => r.battery !== null && (m === null || r.battery > m) ? r.battery : m, null),
    signalMin: valid.reduce((m, r) => r.signal !== null && (m === null || r.signal < m) ? r.signal : m, null),
    signalMax: valid.reduce((m, r) => r.signal !== null && (m === null || r.signal > m) ? r.signal : m, null),
  };
}