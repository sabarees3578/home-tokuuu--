import { useState, useEffect } from 'react';
import { CalendarClock, Clock, SlidersHorizontal } from 'lucide-react';

const PRESETS = [
  { id: '12h', label: 'Last 12 hours', ms: 12 * 3600e3 },
  { id: '24h', label: 'Last 24 hours', ms: 24 * 3600e3 },
  { id: '48h', label: 'Last 48 hours', ms: 48 * 3600e3 },
  { id: '7d', label: 'Last 7 days', ms: 7 * 24 * 3600e3 },
  { id: 'all', label: 'All time', ms: null },
];

/* Controlled time-range filter.
   Props: value = { from, to } (epoch ms, null = open ended), onChange({from,to,label}) */
const TimeRangeFilter = ({ value, onChange }) => {
  const resolveMode = ({ from, to }) => {
    const now = Date.now();
    if (from === null && to === null) return 'all';
    for (const p of PRESETS) {
      if (p.ms !== null && from !== null && Math.abs((now - p.ms) - from) < 60e3 && to === null) return p.id;
    }
    return 'custom';
  };

  const [mode, setMode] = useState(resolveMode(value || {}));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    setMode(resolveMode(value || {}));
  }, [value?.from, value?.to]);

  const applyPreset = (p) => {
    setMode(p.id);
    if (p.ms === null) {
      onChange({ from: null, to: null, label: p.label });
    } else {
      const from = Date.now() - p.ms;
      onChange({ from, to: null, label: p.label });
    }
  };

  const applyCustom = () => {
    const now = Date.now();
    let from = customFrom ? new Date(customFrom).getTime() : now - 24 * 3600e3;
    let to   = customTo   ? new Date(customTo).getTime()   : now;
    if (from > now) from = now;
    if (to > now)   to   = now;
    if (from > to) return;
    onChange({ from, to, label: 'Custom range' });
  };

  const nowLocalISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        <Clock className="h-3.5 w-3.5" />
        Time Range
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all ${
              mode === p.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => {
            setMode('custom');
            const nowIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
            const fromIso = new Date(Date.now() - 24 * 3600e3 - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
            setCustomFrom(fromIso);
            setCustomTo(nowIso);
          }}
          className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
            mode === 'custom'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Custom
        </button>
      </div>

      {mode === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">From</label>
            <input
              type="datetime-local"
              value={customFrom}
              max={nowLocalISO}
              onChange={e => setCustomFrom(e.target.value)}
              className="form-input text-xs py-2 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">To</label>
            <input
              type="datetime-local"
              value={customTo}
              max={nowLocalISO}
              onChange={e => setCustomTo(e.target.value)}
              className="form-input text-xs py-2 rounded-xl"
            />
          </div>
          <button
            onClick={applyCustom}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Apply Range
          </button>
          <span className="text-[10px] font-semibold text-slate-400 pb-2">Blank To = end at now · cannot go beyond now</span>
        </div>
      )}
    </div>
  );
};

export default TimeRangeFilter;