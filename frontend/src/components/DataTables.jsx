import { useMemo } from 'react';
import { Database, FileSpreadsheet, FileText, Activity, Server, Users, AlarmClock } from 'lucide-react';
import { exportTableExcel, exportTablePdf } from '../utils/exportLogs';

const fmtDT = (ts) => (ts ? new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—');
const fmtT = (ts) => (ts ? new Date(ts).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—');

/* ── Shared DB-style table shell ─────────────────────────────────────────── */
const DbTable = ({ icon, title, subtitle, count, columns, rows, fileBase }) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    {/* DB-style heading bar */}
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-900 text-white">
      <span className="p-1.5 rounded-lg bg-white/10 text-emerald-300">{icon}</span>
      <div className="min-w-0">
        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-white font-mono">{title}</h4>
        <p className="text-[10px] font-semibold text-slate-400 truncate">{subtitle} · <span className="text-emerald-300">{count} rows</span></p>
      </div>
      <div className="flex-1" />
      <button
        onClick={() => exportTableExcel(columns, rows, fileBase)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 text-slate-900 text-[10px] font-black uppercase tracking-wider transition-colors"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </button>
      <button
        onClick={() => exportTablePdf(title, subtitle, columns, rows, fileBase)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider transition-colors"
      >
        <FileText className="h-3.5 w-3.5" /> PDF
      </button>
    </div>

    {/* DB grid */}
    <div className="overflow-x-auto custom-scrollbar">
      <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left font-mono text-[11px] border-collapse min-w-[720px]">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400 font-semibold">
                  No matching rows
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className={i % 2 ? 'bg-slate-50/60' : 'bg-white hover:bg-indigo-50/40 transition-colors'}>
                  {r.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

/* ── 4 table panels ───────────────────────────────────────────────────────── */
const DataTables = ({ logs = [], range = {}, devices = [], customers = [], deviceLabel = '' }) => {
  const { from = null, to = null } = range;
  const inRange = (l) => {
    const t = new Date(l.timestamp).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    return true;
  };

  const sorted = useMemo(
    () => [...logs].filter(inRange).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    [logs, from, to]
  );

  const telemetry = useMemo(() => sorted.map((l, i) => [
    i + 1,
    fmtDT(l.timestamp),
    l.battery ?? '—',
    l.signal ?? '—',
    l.motion_count || 0,
    l.alert_active ? 'ARMED' : 'STANDBY',
    l.power ?? '—',
    l.power_cut ?? false ? 'YES' : 'NO',
  ]), [sorted]);

  const events = useMemo(() => {
    const out = [];
    let prevArm = null;
    for (const l of sorted) {
      const armed = !!l.alert_active;
      if (prevArm !== null && armed !== prevArm) {
        out.push({ t: l.timestamp, type: armed ? 'ARMED' : 'STANDBY', device: l.deviceId, motion: 0, battery: l.battery, signal: l.signal });
      }
      prevArm = armed;
      if ((l.motion_count || 0) > 0) {
        out.push({ t: l.timestamp, type: 'MOTION', device: l.deviceId, motion: l.motion_count, battery: l.battery, signal: l.signal });
      }
    }
    return out.map((e, i) => [
      i + 1,
      fmtDT(e.t),
      e.type,
      e.device,
      e.motion,
      e.battery ?? '—',
      e.signal ?? '—',
    ]);
  }, [sorted]);

  const deviceRows = useMemo(() => devices.map((d, i) => [
    i + 1,
    d.device_id,
    d.model ?? '—',
    d.status ?? '—',
    d.imei ?? '—',
    d.mac_address ?? '—',
    d.serial_number ?? '—',
    d.firmware_version ?? '—',
    fmtT(d.last_seen),
  ]), [devices]);

  const customerRows = useMemo(() => customers.map((c, i) => [
    i + 1,
    c.device_id ?? '—',
    c.customer_name ?? '—',
    c.customer_number ?? '—',
    c.device_name ?? '—',
    c.device_sim_number ?? '—',
    c.simPlan ?? '—',
    [c.user2_phone, c.user3_phone, c.user4_phone].filter(Boolean).join(', ') || '—',
    c.address ?? '—',
  ]), [customers]);

  const base = `Telemetry ${deviceLabel} ${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-6">
      <DbTable
        icon={<Database className="h-4 w-4" />}
        title="TABLE 1 · TELEMETRY READINGS"
        subtitle={`Every stored reading ${deviceLabel}`}
        count={sorted.length}
        columns={['#', 'Timestamp', 'Battery %', 'Signal dBm', 'Motion', 'Protection', 'Power V', 'Power Cut']}
        rows={telemetry}
        fileBase={`${base} readings`}
      />
      <DbTable
        icon={<AlarmClock className="h-4 w-4" />}
        title="TABLE 2 · EVENT / ALERT LOG"
        subtitle="Motion triggers & protection-mode changes"
        count={events.length}
        columns={['#', 'Timestamp', 'Type', 'Device', 'Motion', 'Battery %', 'Signal dBm']}
        rows={events}
        fileBase={`${base} events`}
      />
      <DbTable
        icon={<Server className="h-4 w-4" />}
        title="TABLE 3 · DEVICE REGISTRY"
        subtitle="Registered hardware & status"
        count={devices.length}
        columns={['#', 'Device ID', 'Model', 'Status', 'IMEI', 'MAC Address', 'Serial No', 'Firmware', 'Last Seen']}
        rows={deviceRows}
        fileBase={`${base} devices`}
      />
      <DbTable
        icon={<Users className="h-4 w-4" />}
        title="TABLE 4 · CUSTOMER REGISTRY"
        subtitle="Owners & authorised users"
        count={customers.length}
        columns={['#', 'Device ID', 'Customer Name', 'Phone', 'Device Name', 'SIM Number', 'SIM Plan', 'Extra Users', 'Address']}
        rows={customerRows}
        fileBase={`${base} customers`}
      />
    </div>
  );
};

export default DataTables;