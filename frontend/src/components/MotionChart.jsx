import { useState, useMemo, useRef } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Scatter
} from 'recharts';
import { Activity, ShieldCheck, Clock, AlertTriangle, Database, ScrollText, Download, ChevronsRight } from 'lucide-react';
import { buildTelemetrySeries, computeTimeTicks } from '../utils/telemetry';
import { downloadElementPng } from '../utils/downloadPng';
import TimeRangeFilter from './TimeRangeFilter';

const BUCKET_PX = 72;

/* ── PIR Detection Tooltip ────────────────────────────────────────────────── */
const PirTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const p = payload[0];
    const isTrigger = p.name === 'Individual trigger';
    const timeLabel = isTrigger
      ? new Date(p.payload.t).toLocaleString()
      : (p.payload?.dateLabel || new Date(label).toLocaleString());
    const active = (p.value || p.payload?.pirActive || 0) > 0;
    return (
      <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200 text-xs min-w-[180px]">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-bold text-slate-700">{timeLabel}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Activity className={`h-3.5 w-3.5 ${active ? 'text-red-500' : 'text-emerald-500'}`} />
              {isTrigger ? 'Trigger' : 'Status'}
            </span>
            <span className={`font-black text-sm uppercase tracking-wider ${active ? 'text-red-600' : 'text-emerald-600'}`}>
              {active ? 'TRIGGERED' : 'CLEAR'}
            </span>
          </div>
          {!isTrigger && p.payload?.count > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">In this slot</span>
              <span className="font-mono font-bold text-slate-600">{p.payload.count}</span>
            </div>
          )}
          {isTrigger && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Triggers</span>
              <span className="font-mono font-bold text-slate-600">{p.payload.count}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

/* ── Protection Mode Tooltip ──────────────────────────────────────────────── */
const ProtectionTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200 text-xs min-w-[180px]">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-bold text-slate-700">{payload[0].payload.dateLabel || label}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
              Protection
            </span>
            <span className={`font-black text-sm ${val === 1 ? 'text-indigo-600' : 'text-slate-400'}`}>
              {val === 1 ? 'ARMED' : 'STANDBY'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider">Value</span>
            <span className="font-mono font-bold text-slate-600">{val}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

/* ── Custom PIR dot : marks triggered slots only, never draws counts ─────── */
const PirDot = (props) => {
  const { cx, cy, payload, showLabels } = props;
  if (payload.pirActive === 1) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6.5} fill="#ef4444" fillOpacity={0.16} stroke="none" />
        <circle cx={cx} cy={cy} r={3.5} fill="#ef4444" stroke="#fff" strokeWidth={2} />
        {showLabels && (
          <text x={cx} y={cy - 10} textAnchor="middle" fill="#dc2626" fontSize={9} fontWeight={800} fontFamily="monospace">
            ●
          </text>
        )}
      </g>
    );
  }
  return null;
};

/* ── Custom Protection dot ────────────────────────────────────────────────── */
const ProtectionDot = (props) => {
  const { cx, cy, payload, showLabels } = props;
  const isActive = payload.status === 1;
  return (
    <g>
      {isActive && <circle cx={cx} cy={cy} r={6} fill="#6366f1" fillOpacity={0.2} stroke="none" />}
      <circle cx={cx} cy={cy} r={3.5} fill={isActive ? '#6366f1' : '#94a3b8'} stroke="#fff" strokeWidth={2} />
      {showLabels && (
        <text x={cx} y={cy - 12} textAnchor="middle" fill={isActive ? '#4338ca' : '#64748b'} fontSize={9} fontWeight={800} fontFamily="monospace">
          {isActive ? 'A' : 'OFF'}
        </text>
      )}
    </g>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT — uses shared buildTelemetrySeries (full history, dates, scroll)
   ═══════════════════════════════════════════════════════════════════════════ */
const MotionChart = ({ deviceLogs }) => {
  const [activeTab, setActiveTab] = useState('pir');
  const [range, setRange] = useState({ from: null, to: null, label: 'All time' });
  const wrapRef = useRef(null);

  const data = useMemo(() => buildTelemetrySeries(deviceLogs, range), [deviceLogs, range]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Database className="h-12 w-12 text-slate-300 mb-4" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No telemetry data stored</p>
        <p className="text-xs text-slate-400 mt-1">Waiting for device readings...</p>
      </div>
    );
  }

  const { series: buckets, totalPir, armCount: armed, changes, scanCount, bucketMs, triggers, minT, maxT } = data;
  const numBuckets = buckets.length;
  const showDotLabels = numBuckets <= 40;
  const chartWidth = Math.max(680, numBuckets * BUCKET_PX);
  const showIndividual = (maxT - minT) > 0 && (maxT - minT) <= 48 * 3600e3;

  const bucketSizeLabel = bucketMs < 60e3
    ? `${bucketMs / 1000}s`
    : bucketMs < 3600e3 && bucketMs % 60000 === 0
      ? `${bucketMs / 60000} min`
      : bucketMs < 86400e3
        ? `${bucketMs / 3600000} h`
        : `${bucketMs / 86400000} day`;

  const armedPct = Math.round((armed / numBuckets) * 100);

  const DAY_MS = 86400e3;
  const spanMs = (maxT - minT) || 0;
  const endLabel = range.to === null ? 'NOW' : 'END';
  const fmtTick = (v) => {
    const d = new Date(v);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return spanMs > 12 * 3600e3
      ? `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`
      : time;
  };
  const dayBoundaries = (() => {
    if (!spanMs || spanMs > 7 * DAY_MS) return [];
    const start = new Date(minT);
    const firstMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0).getTime();
    const out = [];
    for (let t = firstMidnight; t < maxT; t += DAY_MS) out.push(t);
    return out;
  })();

  const timeFrameLines = [minT, ...dayBoundaries];
  const showVerticalGrid = spanMs <= 24 * 3600e3 && spanMs > 0;

  const XAxisProps = {
    type: 'number',
    dataKey: 'rawT',
    domain: [minT, maxT],
    tickFormatter: fmtTick,
    ticks: computeTimeTicks(minT, maxT),
    stroke: '#94a3b8',
    fontSize: 10,
    fontWeight: 600,
    tickLine: false,
    axisLine: { stroke: '#cbd5e1', strokeWidth: 1 },
    tick: { fill: '#64748b' },
    tickMargin: 6,
    angle: -30,
    textAnchor: 'end',
    height: 54,
  };

  const dayFrameRefs = timeFrameLines.map((t) => (
    <ReferenceLine
      key={`frame-${t}`}
      x={t}
      stroke={t === minT ? '#cbd5e1' : '#fbbf24'}
      strokeDasharray={t === minT ? '0 0' : '4 4'}
      strokeOpacity={t === minT ? 0.4 : 0.5}
      ifOverflow="extendDomain"
    />
  ));

  const nowRef = (
    <ReferenceLine x={maxT} stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="6 3" ifOverflow="extendDomain">
      <Label value={endLabel} position="insideTopRight" fill="#0284c7" fontSize={9} fontWeight={800} />
    </ReferenceLine>
  );

  return (
    <div className="w-full" ref={wrapRef}>
      {/* Card header */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="min-w-[200px]">
          <h4 className="flex items-center gap-2.5 text-sm font-black tracking-wide text-slate-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Sensor Activity Timeline
          </h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
            {range.label} · {data.start.toLocaleDateString([], { day: 'numeric', month: 'short' })} →{' '}
            {range.to === null ? 'now' : data.end.toLocaleDateString([], { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <div className="flex-1" />
        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('pir')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'pir'
                ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="h-4 w-4" />
            Motion
          </button>
          <button
            onClick={() => setActiveTab('protection')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'protection'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Protection
          </button>
        </div>
        <button
          onClick={() => downloadElementPng(wrapRef.current, `MotionChart ${range.label} ${new Date().toISOString().slice(0, 10)}`)}
          title="Download graph as PNG"
          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-white transition-colors shadow-sm"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* Time range filter */}
      <div className="mb-4">
        <TimeRangeFilter value={range} onChange={setRange} />
      </div>

      {/* Timeframe toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-3 text-xs">
        <span className="flex items-center gap-2 font-bold text-slate-700">
          <Database className="h-4 w-4 text-blue-500" />
          {range.label}
        </span>
        <span className="flex items-center gap-2 font-semibold text-slate-500">
          <Clock className="h-4 w-4 text-slate-400" />
          {fmtTick(minT)} → {range.to === null ? 'now' : fmtTick(maxT)}
        </span>
        <span className="flex items-center gap-2 font-semibold text-slate-500">
          <ScrollText className="h-4 w-4 text-slate-400" />
          {scanCount} readings · {numBuckets} slots ({bucketSizeLabel})
        </span>
        <span className="flex-1" />
        <span className="flex items-center gap-2 font-bold text-slate-500 uppercase tracking-widest text-[10px]">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          {endLabel} anchor on axis
        </span>
      </div>

      {/* PIR Detection Chart */}
      {activeTab === 'pir' && (
        <div className="space-y-4">
          {/* Corner stats + legend */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center gap-3 border rounded-xl px-4 py-2.5 ${
              totalPir > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
            }`}>
              {totalPir > 0 ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Activity className="h-4 w-4 text-emerald-500" />}
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest block ${totalPir > 0 ? 'text-red-400' : 'text-emerald-400'}`}>Status</span>
                <span className={`text-sm font-black uppercase tracking-wider ${totalPir > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {totalPir > 0 ? 'DETECTED' : 'ALL CLEAR'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 block">Total Triggers</span>
                <span className="text-xl font-black text-blue-700">{totalPir}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Status × Time</span>
              <span className="text-[10px] font-bold text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />TRIGGERED &nbsp;
                <span className="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1" />CLEAR
              </span>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar px-1 pb-2">
            <div style={{ width: chartWidth }} className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={buckets} margin={{ top: 25, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="pirGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={showVerticalGrid} />
                  <XAxis {...XAxisProps} />
                  <YAxis
                    domain={[0, 1]}
                    ticks={[0, 1]}
                    allowDecimals={false}
                    stroke="#94a3b8"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontWeight: 700 }}
                    tickFormatter={(v) => v === 1 ? 'TRIG' : 'CLR'}
                    label={{ value: 'Status × Time', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip content={<PirTooltip />} />
                  {dayFrameRefs}
                  <ReferenceLine y={0.5} stroke="#e2e8f0" strokeDasharray="6 4" />
                  <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <ReferenceLine y={1} stroke="#fecaca" strokeDasharray="3 3" />
                  <Area
                    type="stepAfter"
                    dataKey="pirActive"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#pirGrad)"
                    dot={(props) => showIndividual ? null : <PirDot showLabels={showDotLabels} {...props} />}
                    activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 3 }}
                  />
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
                  {nowRef}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Protection Mode Chart */}
      {activeTab === 'protection' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 block">Armed Coverage</span>
                <span className="text-xl font-black text-indigo-700">{armedPct}%</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Mode Transitions</span>
                <span className="text-xl font-black text-slate-700">{changes}</span>
              </div>
            </div>
            <div className={`flex items-center gap-3 border rounded-xl px-4 py-2.5 ${
              armedPct >= 50 ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <ShieldCheck className={`h-4 w-4 ${armedPct >= 50 ? 'text-indigo-500' : 'text-amber-500'}`} />
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest block ${armedPct >= 50 ? 'text-indigo-400' : 'text-amber-400'}`}>Coverage</span>
                <span className={`text-sm font-black uppercase tracking-wider ${armedPct >= 50 ? 'text-indigo-600' : 'text-amber-600'}`}>
                  {armedPct >= 50 ? 'MOSTLY ARMED' : 'MOSTLY STANDBY'}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar px-1 pb-2">
            <div style={{ width: chartWidth }} className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={buckets} margin={{ top: 25, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={showVerticalGrid} />
                  <XAxis {...XAxisProps} />
                  <YAxis
                    domain={[0, 1]}
                    ticks={[0, 1]}
                    tickFormatter={(val) => val === 1 ? 'ARMED' : 'OFF'}
                    stroke="#94a3b8"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                    label={{ value: 'Protection Status', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip content={<ProtectionTooltip />} />
                  {dayFrameRefs}
                  <ReferenceLine y={1} stroke="#6366f1" strokeDasharray="6 3" strokeOpacity={0.4}>
                    <Label value="ARMED" position="right" fill="#6366f1" fontSize={10} fontWeight={700} />
                  </ReferenceLine>
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" strokeOpacity={0.4}>
                    <Label value="STANDBY" position="right" fill="#94a3b8" fontSize={10} fontWeight={700} />
                  </ReferenceLine>
                  <Line
                    type="stepAfter"
                    dataKey="status"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={<ProtectionDot showLabels={showDotLabels} />}
                    activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 3 }}
                  />
                  {nowRef}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Scroll hint */}
      {chartWidth > 680 && (
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <ChevronsRight className="h-3.5 w-3.5" />
          Scroll horizontally to view all {numBuckets} time slots
        </div>
      )}
    </div>
  );
};

export default MotionChart;