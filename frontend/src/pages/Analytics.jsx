import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDb } from '../context/DbContext';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Label, Cell, Scatter
} from 'recharts';
import {
  Activity, ShieldCheck, BatteryCharging, Wifi,
  Database, Clock, Search, ChevronDown, AlertTriangle, Server,
  TrendingUp, MapPin, Download
} from 'lucide-react';
import { buildTelemetrySeries, fmtDateLabel, computeTimeTicks } from '../utils/telemetry';
import { downloadElementPng } from '../utils/downloadPng';
import TimeRangeFilter from '../components/TimeRangeFilter';
import DataTables from '../components/DataTables';

const AXIS_TICK = { fill: '#64748b', fontSize: 10, fontWeight: 600 };

/* ── Shared tooltip shell ─────────────────────────────────────────────────── */
const ChartTip = ({ active, payload, label, title, unit, color, extra }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[payload.length - 1];
  return (
    <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200 text-xs min-w-[190px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-bold text-slate-700">{p.payload?.dateLabel || label}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">{title}</span>
          <span className="font-black text-sm" style={{ color }}>{p.value}{unit}</span>
        </div>
        {extra && extra(p)}
      </div>
    </div>
  );
};

/* ── GRAPH 1 tooltip: trigger status (module scope) ───────────────────────── */
const PIRTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const first = payload[0];
  if (first.name === 'Individual trigger') {
    const t = first.payload;
    return (
      <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200 text-xs min-w-[190px]">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-bold text-slate-700">Trigger</span>
        </div>
        <div className="flex justify-between"><span className="text-slate-400">Exact time</span><span className="font-bold text-slate-700">{new Date(t.t).toLocaleString()}</span></div>
        <div className="flex justify-between mt-1"><span className="text-slate-400">Status</span><span className="font-black text-red-600 text-sm uppercase">Triggered</span></div>
      </div>
    );
  }
  const d = first.payload;
  return (
    <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200 text-xs min-w-[190px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-bold text-slate-700">{d?.dateLabel || fmtDateLabel(d?.rawT)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-slate-500"><Activity className={`h-3.5 w-3.5 ${d.pirActive === 1 ? 'text-red-500' : 'text-emerald-500'}`} /> Status</span>
        <span className={`font-black text-sm uppercase tracking-wider ${d.pirActive === 1 ? 'text-red-600' : 'text-emerald-600'}`}>
          {d.pirActive === 1 ? 'TRIGGERED' : 'CLEAR'}
        </span>
      </div>
      {d.count > 0 && (
        <div className="flex justify-between mt-1"><span className="text-slate-400">In this slot</span><span className="font-mono font-bold text-slate-600">{d.count}</span></div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   GRAPH 1 — PIR DETECTION  (Area / every trigger marked exactly / date axis)
   ═══════════════════════════════════════════════════════════════════════ */
const PirAreaChart = ({ data, width, triggers = [], minT, maxT, showIndividual }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  const activeSlots = data.filter(d => d.pirActive === 1).length;
  const pct = data.length ? Math.round((activeSlots / data.length) * 100) : 0;
  const fmtTick = (v) => {
    const d = new Date(v);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return (maxT - minT) > 24 * 3600e3
      ? `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${time}`
      : time;
  };
  return (
    <ChartCard
      icon={<Activity className="h-4 w-4" />}
      iconWrap="bg-blue-50 text-blue-600 border-blue-100"
      title="PIR Trigger Status × Time"
      subtitle="0 / 1 per time slot — did motion trigger or not · total shown in corner"
      badge={{ label: `${total} total triggers · ${activeSlots} slots (${pct}%)`, cls: 'bg-blue-50 text-blue-700 border-blue-200' }}
    >
      <div className="overflow-x-auto custom-scrollbar px-1 pb-2">
        <div style={{ width }} className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 25, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="gPir" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                type="number"
                dataKey="rawT"
                domain={[minT, maxT]}
                tickFormatter={fmtTick}
                ticks={computeTimeTicks(minT, maxT)}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                tickMargin={6}
                angle={-28}
                textAnchor="end"
                height={54}
              />
              <YAxis domain={[0, 1]} ticks={[0, 1]} tick={AXIS_TICK} tickLine={false} axisLine={false}
                tickFormatter={(v) => v === 1 ? 'TRIG' : 'CLR'}
                label={{ value: 'Status × Time', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
              <Tooltip content={<PIRTooltip />} cursor={{ stroke: '#fca5a5', strokeDasharray: '4 4' }} />
              <ReferenceLine y={0.5} stroke="#e2e8f0" strokeDasharray="6 4" />
              <ReferenceLine y={1} stroke="#fecaca" strokeDasharray="3 3" />
              <ReferenceLine y={0} stroke="#e2e8f0" />
              <Area type="stepAfter" dataKey="pirActive" stroke="#ef4444" strokeWidth={2}
                fill="url(#gPir)" name="Status" connectNulls
                dot={(props) => showIndividual ? null : (props.payload.pirActive === 1 ? (
                  <g>
                    <circle cx={props.cx} cy={props.cy} r={6.5} fill="#ef4444" fillOpacity={0.16} stroke="none" />
                    <circle cx={props.cx} cy={props.cy} r={3.5} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                  </g>
                ) : null)}
                activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 3 }} />
              {showIndividual && (
                <Scatter
                  name="Individual trigger"
                  data={triggers.map(t => ({ rawT: t.t, pirActive: 1, count: t.count }))}
                  fill="#ef4444"
                  dataKey="pirActive"
                  shape={(props) => (
                    <g>
                      <circle cx={props.cx} cy={props.cy} r={8} fill="#ef4444" fillOpacity={0.14} stroke="none" />
                      <circle cx={props.cx} cy={props.cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={2.5} />
                    </g>
                  )}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      {showIndividual && (
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-500 px-2">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-red-100" /> Each red dot = one trigger at its exact timestamp</span>
          <span className="flex items-center gap-1.5 text-red-500"><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />1 = TRIGGERED <span className="inline-block w-2 h-2 rounded-full bg-slate-300 ml-2 mr-1 ml-1" />0 = CLEAR</span>
        </div>
      )}
    </ChartCard>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   GRAPH 2 — PROTECTION MODE  (Step line / binary / status dots)
   ═══════════════════════════════════════════════════════════════════════ */
const ProtectionChart = ({ data, width }) => {
  const armed = data.filter(d => d.status === 1).length;
  const armedPct = Math.round((armed / Math.max(data.length, 1)) * 100);
  return (
    <ChartCard
      icon={<ShieldCheck className="h-4 w-4" />}
      iconWrap="bg-indigo-50 text-indigo-600 border-indigo-100"
      title="Protection Mode State"
      subtitle="Time × ARM / STANDBY — exact state at every slot"
      badge={{ label: `${armedPct}% armed`, cls: armedPct >= 50 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200' }}
    >
      <div className="overflow-x-auto custom-scrollbar px-1 pb-2">
        <div style={{ width }} className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 25, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="shortLabel" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
                angle={-28} textAnchor="end" height={50} interval="preserveStartEnd" minTickGap={40} />
              <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={v => v === 1 ? 'ARMED' : 'OFF'}
                tick={AXIS_TICK} tickLine={false} axisLine={false}
                label={{ value: 'Protection Status', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
              <Tooltip content={<ChartTip title="Protection" color="#6366f1" extra={p => (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] uppercase">State</span>
                  <span className={`font-black text-[10px] uppercase ${p.value === 1 ? 'text-indigo-600' : 'text-slate-400'}`}>{p.value === 1 ? 'ARMED' : 'STANDBY'}</span>
                </div>
              )} />} cursor={{ stroke: '#c7d2fe', strokeDasharray: '4 4' }} />
              <ReferenceLine y={1} stroke="#6366f1" strokeDasharray="6 3" strokeOpacity={0.4}>
                <Label value="ARMED" position="right" fill="#6366f1" fontSize={10} fontWeight={700} />
              </ReferenceLine>
              <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" strokeOpacity={0.4}>
                <Label value="STANDBY" position="right" fill="#94a3b8" fontSize={10} fontWeight={700} />
              </ReferenceLine>
              <Line type="stepAfter" dataKey="status" stroke="#6366f1" strokeWidth={3.5} name="Protection"
                dot={(props) => (
                  <g>
                    {props.payload.status === 1 && <circle cx={props.cx} cy={props.cy} r={6} fill="#6366f1" fillOpacity={0.2} />}
                    <circle cx={props.cx} cy={props.cy} r={3.5} fill={props.payload.status === 1 ? '#6366f1' : '#94a3b8'} stroke="#fff" strokeWidth={2} />
                    {data.length <= 40 && (
                      <text x={props.cx} y={props.cy - 12} textAnchor="middle" fill={props.payload.status === 1 ? '#4338ca' : '#64748b'} fontSize={9} fontWeight={800} fontFamily="monospace">
                        {props.payload.status === 1 ? 'A' : 'OFF'}
                      </text>
                    )}
                  </g>
                )}
                activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   GRAPH 3 — BATTERY LEVEL  (Line / dots with % / warning line)
   ═══════════════════════════════════════════════════════════════════════ */
const BatteryLineChart = ({ data, width }) => {
  const series = data.filter(d => d.battery !== null);
  const last = series[series.length - 1]?.battery;
  const lowCount = series.filter(d => d.battery <= 20).length;
  return (
    <ChartCard
      icon={<BatteryCharging className="h-4 w-4" />}
      iconWrap={`bg-emerald-50 text-emerald-600 border-emerald-100`}
      title="Battery Level"
      subtitle="Time × battery % — AC power vs backup"
      badge={{ label: last !== undefined ? `${last}% current` : 'No data', cls: lowCount > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200' }}
    >
      <div className="overflow-x-auto custom-scrollbar px-1 pb-2">
        <div style={{ width }} className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 25, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="shortLabel" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
                angle={-28} textAnchor="end" height={50} interval="preserveStartEnd" minTickGap={40} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false}
                label={{ value: 'Battery %', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
              <Tooltip content={<ChartTip title="Battery" unit="%" color="#059669" />} cursor={{ stroke: '#a7f3d0', strokeDasharray: '4 4' }} />
              <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.7}>
                <Label value="LOW BATTERY" position="right" fill="#ef4444" fontSize={9} fontWeight={800} />
              </ReferenceLine>
              <ReferenceArea y1={0} y2={20} fill="#ef4444" fillOpacity={0.06} />
              <Line type="monotone" dataKey="battery" name="Battery %" stroke="#059669" strokeWidth={3} connectNulls
                dot={(props) => props.payload.battery !== null ? (
                  <g>
                    <circle cx={props.cx} cy={props.cy} r={4} fill={props.payload.battery <= 20 ? '#ef4444' : '#059669'} stroke="#fff" strokeWidth={2} />
                    {data.length <= 40 && (
                      <text x={props.cx} y={props.cy - 10} textAnchor="middle" fill="#065f46" fontSize={10} fontWeight={800} fontFamily="monospace">{props.payload.battery}</text>
                    )}
                  </g>
                ) : null}
                activeDot={{ r: 6, fill: '#059669', stroke: '#fff', strokeWidth: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   GRAPH 4 — SIGNAL STRENGTH  (Bar / colored bands / dBm values)
   ═══════════════════════════════════════════════════════════════════════ */
const SIGNAL_BANDS = [
  { upTo: -70, color: '#059669', label: 'Excellent' },
  { upTo: -90, color: '#3b82f6', label: 'Good' },
  { upTo: -102, color: '#f59e0b', label: 'Fair' },
  { upTo: -200, color: '#ef4444', label: 'Weak' },
];
function bandFor(dbm) { return SIGNAL_BANDS.find(b => dbm >= b.upTo) || SIGNAL_BANDS[SIGNAL_BANDS.length - 1]; }

const SignalBarChart = ({ data, width }) => {
  const series = data.filter(d => d.signal !== null);
  const last = series[series.length - 1]?.signal;
  const band = last !== undefined ? bandFor(last) : null;
  return (
    <ChartCard
      icon={<Wifi className="h-4 w-4" />}
      iconWrap="bg-purple-50 text-purple-600 border-purple-100"
      title="Network Signal Strength"
      subtitle="Time × RSSI (dBm) — colour-coded quality bands"
      badge={{ label: band ? `${band.label} (${last} dBm)` : 'No data', cls: band ? (band.label === 'Weak' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-purple-50 text-purple-700 border-purple-200') : 'bg-slate-50 text-slate-500 border-slate-200' }}
    >
      <div className="overflow-x-auto custom-scrollbar px-1 pb-2">
        <div style={{ width }} className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 25, right: 10, left: -10, bottom: 5 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="shortLabel" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
                angle={-28} textAnchor="end" height={50} interval="preserveStartEnd" minTickGap={40} />
              <YAxis domain={[-120, -40]} tick={AXIS_TICK} tickLine={false} axisLine={false}
                label={{ value: 'Signal dBm', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
              <Tooltip content={<ChartTip title="Signal" unit=" dBm" color="#7c3aed" />} cursor={{ fill: '#f3f4f6' }} />
              <ReferenceLine y={-102} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.6}>
                <Label value="WEAK" position="right" fill="#ef4444" fontSize={9} fontWeight={800} />
              </ReferenceLine>
              <ReferenceLine y={-70} stroke="#059669" strokeDasharray="6 4" strokeOpacity={0.5}>
                <Label value="STRONG" position="right" fill="#059669" fontSize={9} fontWeight={800} />
              </ReferenceLine>
              <Bar dataKey="signal" name="Signal"
                radius={[5, 5, 0, 0]}
                label={(props) => data.length <= 40 && props.payload.signal !== null ? (
                  <text x={props.x + props.width / 2} y={props.y - 4} textAnchor="middle" fill="#6b21a8" fontSize={10} fontWeight={800} fontFamily="monospace">{props.payload.signal}</text>
                ) : null}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.signal !== null ? bandFor(d.signal).color : '#e2e8f0'} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   GRAPH 5 — UNIFIED DEVICE HEALTH OVERVIEW  (everything on one timeline)
   Verdict chips + PIR + Protection + Battery + Signal + Power cuts
   ═══════════════════════════════════════════════════════════════════════ */
const lastOf = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
};

const MiniStat = ({ label, value, cls }) => (
  <div className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2 min-w-[104px]">
    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    <span className={`text-sm font-black ${cls}`}>{value}</span>
  </div>
);

const OverviewComposedChart = ({ data, width, minT, maxT, bucketMs }) => {
  const lastBattery = lastOf(data.map(d => d.battery));
  const lastSignal = lastOf(data.map(d => d.signal));
  const powerCuts = data.reduce((s, d) => s + (d.powerCutCount || 0), 0);
  const armedPct = Math.round((data.filter(d => d.status === 1).length / Math.max(data.length, 1)) * 100);
  const totalPir = data.reduce((s, d) => s + (d.count || 0), 0);

  const issues = [];
  if (data.length === 0) issues.push('no telemetry');
  if (lastBattery === null) issues.push('no battery data');
  else if (lastBattery <= 20) issues.push(`low battery ${lastBattery}%`);
  if (lastSignal === null) issues.push('no signal data');
  else if (lastSignal <= -102) issues.push(`weak signal ${lastSignal}dBm`);
  if (powerCuts > 0) issues.push(`${powerCuts} power cut${powerCuts > 1 ? 's' : ''}`);

  const healthy = issues.length === 0;
  const verdict = healthy
    ? { label: 'DEVICE OK', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : { label: `CHECK DEVICE · ${issues.length}`, cls: 'bg-red-50 text-red-600 border-red-200', reason: issues.join(', ') };

  const spanMs = (maxT - minT) || 0;
  const fmtTick = (v) => {
    const d = new Date(v);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return spanMs > 12 * 3600e3
      ? `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`
      : time;
  };

  const dayBoundaries = (() => {
    if (!spanMs || spanMs > 7 * 86400e3) return [];
    const start = new Date(minT);
    const firstMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0).getTime();
    const out = [];
    for (let t = firstMidnight; t < maxT; t += 86400e3) out.push(t);
    return out;
  })();

  const armedBands = data.filter(d => d.status === 1).map((d, i) => (
    <ReferenceArea key={`arm-${i}`} yAxisId="arm" x1={d.rawT} x2={d.rawT + (bucketMs || 0)} y1={0} y2={1}
      fill="#6366f1" fillOpacity={0.09} stroke="none" />
  ));
  const powerCutMarks = data.filter(d => (d.powerCutCount || 0) > 0).map((d, i) => (
    <ReferenceLine key={`cut-${i}`} x={d.rawT} stroke="#ef4444" strokeWidth={2.5} strokeDasharray="3 3" ifOverflow="extendDomain" />
  ));

  return (
    <ChartCard
      icon={<Server className="h-4 w-4" />}
      iconWrap="bg-slate-900 text-white border-slate-800"
      title="Unified Device Health Overview"
      subtitle="All metrics on one timeline — PIR · protection · battery · signal · power cuts"
      badge={{ label: verdict.label, cls: verdict.cls }}
    >
      {!healthy && verdict.reason && (
        <p className="mb-3 -mt-2 text-[11px] font-bold text-red-500">{verdict.reason}</p>
      )}
      <div className="relative z-10 flex flex-wrap gap-2 mb-4">
        <MiniStat label="Battery" value={lastBattery !== null ? `${lastBattery}%` : '—'}
          cls={lastBattery !== null && lastBattery <= 20 ? 'text-red-600' : 'text-emerald-600'} />
        <MiniStat label="Signal" value={lastSignal !== null ? `${lastSignal} dBm` : '—'}
          cls={lastSignal !== null && lastSignal <= -102 ? 'text-red-600' : 'text-purple-600'} />
        <MiniStat label="Power Cuts" value={powerCuts}
          cls={powerCuts > 0 ? 'text-red-600' : 'text-slate-700'} />
        <MiniStat label="Armed" value={`${armedPct}%`}
          cls={armedPct >= 50 ? 'text-indigo-600' : 'text-slate-600'} />
        <MiniStat label="Triggers" value={totalPir}
          cls={totalPir > 0 ? 'text-amber-600' : 'text-slate-600'} />
      </div>

      <div className="overflow-x-auto custom-scrollbar px-1 pb-2">
        <div style={{ width }} className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="gOv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={spanMs > 0 && spanMs <= 24 * 3600e3} />
              <XAxis type="number" dataKey="rawT" domain={[minT, maxT]} tickFormatter={fmtTick}
                ticks={computeTimeTicks(minT, maxT)}
                tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tickMargin={6}
                angle={-28} textAnchor="end" height={54} />
              <YAxis yAxisId="pir" allowDecimals={false} orientation="left" tick={AXIS_TICK} tickLine={false} axisLine={false} width={42}
                label={{ value: 'PIR', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 10, fontWeight: 700 }} />
              <YAxis yAxisId="arm" domain={[0, 1]} orientation="left" hide />
              <YAxis yAxisId="sig" domain={[-120, -40]} orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false}
                label={{ value: 'Signal dBm', angle: 90, position: 'insideRight', fill: '#7c3aed', fontSize: 10, fontWeight: 700 }} />
              <YAxis yAxisId="batt" domain={[0, 100]} orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={56}
                label={{ value: 'Battery', angle: 90, position: 'insideRight', offset: 22, fill: '#059669', fontSize: 10, fontWeight: 700 }} />
              {dayBoundaries.map((t) => (
                <ReferenceLine key={`frame-${t}`} x={t} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.5} ifOverflow="extendDomain" />
              ))}
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload;
                  return (
                    <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200 text-xs min-w-[210px]">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-bold text-slate-700">{row?.dateLabel || label}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between"><span className="text-slate-400">PIR Triggers</span><span className="font-black text-amber-600">{row?.count ?? 0}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Protection</span><span className={`font-black text-[10px] uppercase ${row?.status === 1 ? 'text-indigo-600' : 'text-slate-400'}`}>{row?.status === 1 ? 'ARMED' : 'STANDBY'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Battery</span><span className="font-black text-emerald-600">{row?.battery ?? '—'}%</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Signal</span><span className="font-black text-purple-600">{row?.signal ?? '—'} dBm</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Power Cut</span>
                          <span className={`font-black ${(row?.powerCutCount || 0) > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                            {(row?.powerCutCount || 0) > 0 ? `YES ×${row.powerCutCount}` : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
                cursor={{ fill: '#f8fafc' }}
              />
              {armedBands}
              {powerCutMarks}
              <ReferenceLine yAxisId="sig" y={-102} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.55}>
                <Label value="WEAK" position="right" fill="#ef4444" fontSize={9} fontWeight={800} />
              </ReferenceLine>
              <ReferenceLine yAxisId="batt" y={20} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.55}>
                <Label value="LOW" position="right" fill="#ef4444" fontSize={9} fontWeight={800} />
              </ReferenceLine>
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              <Area yAxisId="pir" type="monotone" dataKey="count" name="PIR Triggers" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gOv)"
                dot={false} />
              <Bar yAxisId="sig" dataKey="signal" name="Signal (dBm)" fill="#7c3aed" fillOpacity={0.6} radius={[3, 3, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={d.signal !== null ? bandFor(d.signal).color : '#e2e8f0'} fillOpacity={0.8} />)}
              </Bar>
              <Line yAxisId="batt" type="monotone" dataKey="battery" name="Battery %" stroke="#059669" strokeWidth={2.5} connectNulls dot={false} />
              <Line yAxisId="arm" type="stepAfter" dataKey="status" name="Protection (Arm)" stroke="#6366f1" strokeWidth={2.5}
                dot={(props) => <circle cx={props.cx} cy={props.cy} r={3} fill={props.payload.status === 1 ? '#6366f1' : '#94a3b8'} stroke="#fff" strokeWidth={2} />} />
              {data.length > 0 && (
                <ReferenceLine x={maxT} stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="6 3" ifOverflow="extendDomain">
                  <Label value="END" position="insideTopRight" fill="#0284c7" fontSize={9} fontWeight={800} />
                </ReferenceLine>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-2 px-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-200" />Indigo bands = armed</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Red dashed ticks = power cut</span>
      </div>
    </ChartCard>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   CHART CARD WRAPPER
   ═══════════════════════════════════════════════════════════════════════ */
const ChartCard = ({ icon, iconWrap, title, subtitle, badge, children, downloadable = true }) => {
  const wrapRef = useRef(null);
  return (
    <div ref={wrapRef} className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50/50 to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shadow-sm border ${iconWrap}`}>{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 display-font tracking-wide">{title}</h3>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-widest border w-max ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          {downloadable && (
            <button
              onClick={() => downloadElementPng(wrapRef.current, `${title} ${new Date().toISOString().slice(0, 10)}`)}
              title="Download chart as PNG"
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-white transition-colors shadow-sm"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN ANALYTICS PAGE
   ═══════════════════════════════════════════════════════════════════════ */
const Analytics = () => {
  const { user } = useAuth();
  const { devices, customers, logs } = useDb();
  const { deviceId: adminDeviceId } = useParams();
  const isAdmin = user?.role === 'admin';

  const defaultDevice = () => (isAdmin ? (adminDeviceId || '') : (user?.device_id || ''));
  const [selectedDevice, setSelectedDevice] = useState(defaultDevice);
  const [rawLogs, setRawLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState({ from: null, to: null, label: 'All time' });

  const deviceOptions = isAdmin
    ? Array.from(new Set([...logs.map(l => l.deviceId), ...devices.map(d => d.device_id)])).filter(Boolean)
    : [];

  useEffect(() => {
    if (!selectedDevice) { setRawLogs([]); return; }
    let cancelled = false;
    setLoading(true);
    setRawLogs([]);
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/telemetry/${selectedDevice}`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) setRawLogs(data);
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLogs();
    return () => { cancelled = true; setLoading(false); };
  }, [selectedDevice, user?.token]);

  const series = useMemo(() => buildTelemetrySeries(rawLogs, range), [rawLogs, range]);

  const spanMs = series ? (series.maxT - series.minT) : 0;
  const showIndividual = !!series && spanMs > 0 && spanMs <= 48 * 3600e3;
  const bucketPx = series ? Math.max(700, series.series.length * 74) : 700;
  const chartWidth = bucketPx;

  // Fallback to any device if admin has none selected
  useEffect(() => {
    if (isAdmin && !selectedDevice && deviceOptions.length > 0) {
      setSelectedDevice(deviceOptions[0]);
    }
  }, [isAdmin, selectedDevice, deviceOptions]);

  const selectedDeviceObj = devices.find(d => d.device_id === selectedDevice);

  return (
    <Layout>
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md">
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-[90px] pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1.5 backdrop-blur-md">
                  <TrendingUp className="h-3 w-3" />
                  Full-History Analytics
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl display-font font-extrabold tracking-tight text-white drop-shadow-sm">
                Data Visualisation Studio
              </h1>
              <p className="text-xs font-medium text-slate-300 max-w-2xl leading-relaxed">
                Every stored reading, bucketed by time, marked with its exact value. Dates included on every axis.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-72">
              {isAdmin ? (
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    value={selectedDevice}
                    onChange={e => setSelectedDevice(e.target.value)}
                    className="w-full pl-10 pr-9 py-3 rounded-xl text-sm font-bold text-slate-800 bg-white shadow-sm appearance-none border border-white/20"
                  >
                    <option value="">-- Select a device --</option>
                    {deviceOptions.map(id => (
                      <option key={id} value={id}>{id}{devices.find(d => d.device_id === id)?.model ? ` · ${devices.find(d => d.device_id === id).model}` : ''}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">Analyzing Node</p>
                  <p className="text-lg font-bold font-mono">{selectedDevice || '—'}</p>
                </div>
              )}
              {series && (
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-[11px] font-bold text-slate-200">
                    {series.scanCount} readings
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-[11px] font-bold text-slate-200">
                    {series.series.length} slots
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Range filter */}
        <TimeRangeFilter value={range} onChange={setRange} />

        {/* Range + device context strip */}
        {series && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs shadow-sm">
            <span className="flex items-center gap-2 font-bold text-slate-700">
              <Clock className="h-4 w-4 text-blue-500" />{fmtDateLabel(series.start.getTime())} → {fmtDateLabel(series.end.getTime())}
            </span>
            <span className="flex items-center gap-2 font-semibold text-slate-500">
              <Database className="h-4 w-4 text-slate-400" />{series.scanCount} stored readings · every slot value-accurate
            </span>
            {selectedDeviceObj && (
              <span className="flex items-center gap-1.5 font-semibold text-slate-500 ml-auto">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />{selectedDeviceObj.location || 'Facility'} · {selectedDeviceObj.model}
              </span>
            )}
          </div>
        )}

        {!series && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
            <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">
              {loading ? 'Loading telemetry history...' : selectedDevice ? 'No telemetry stored for this node yet' : 'Select a device to begin'}
            </p>
          </div>
        )}

        {series && (
          <div className="space-y-6">
            <PirAreaChart data={series.series} width={chartWidth} triggers={series.triggers}
              minT={series.minT} maxT={series.maxT} showIndividual={showIndividual} />
            <ProtectionChart data={series.series} width={chartWidth} />
            <BatteryLineChart data={series.series} width={chartWidth} />
            <SignalBarChart data={series.series} width={chartWidth} />
            <OverviewComposedChart data={series.series} width={chartWidth} minT={series.minT} maxT={series.maxT} bucketMs={series.bucketMs} />
            {chartWidth > 700 && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">
                Charts are horizontally scrollable to view all {series.series.length} time slots →
              </p>
            )}
          </div>
        )}

        {/* DB tables — telemetry, events, registries */}
        {selectedDevice && (
          <div id="data-tables" className="space-y-4">
            <div className="flex items-center gap-2 pt-2">
              <Database className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                Live Data Tables · <span className="text-slate-800">{selectedDevice}</span>
              </h2>
            </div>
            <DataTables
              logs={rawLogs}
              range={range}
              devices={devices}
              customers={customers}
              deviceLabel={selectedDevice}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Analytics;