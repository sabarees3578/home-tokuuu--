import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import {
  CloudUpload, Package, Send, RefreshCw, Download,
  Trash2, X, CheckCircle2, AlertTriangle, Loader2, ChevronDown, Search,
  Cpu, HardDrive, Clock, Settings2, ListChecks, FileCode2, Code,
  Copy, Link2, Check, ArrowRight, FileUp, RotateCcw, TerminalSquare, Lock
} from 'lucide-react';

const API = '/api';

const STATUS_STYLES = {
  pending:     'bg-slate-100 text-slate-600',
  pushing:     'bg-blue-50 text-blue-700',
  downloading: 'bg-amber-50 text-amber-700',
  flashing:    'bg-violet-50 text-violet-700',
  success:     'bg-emerald-50 text-emerald-700',
  failed:      'bg-red-50 text-red-700',
};

const METHOD_LABELS = { auto: 'Auto Update', section: 'Section Update' };

const STEPS = [
  { n: 1, title: 'Upload File', desc: 'Store the .bin firmware build on the server' },
  { n: 2, title: 'Generate Link', desc: 'Create the HTTPS download link for this build' },
  { n: 3, title: 'Device Download', desc: 'Device pulls the link and flashes via espota' },
];

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
  >
    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
  </button>
);

const OtaManager = () => {
  const { user } = useAuth();
  const token = user?.token;

  const [tab, setTab] = useState('versions');
  const [devices, setDevices] = useState([]);
  const [versions, setVersions] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const [method, setMethod] = useState('section');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [showPush, setShowPush] = useState(false);
  const [busy, setBusy] = useState(false);

  const [upFile, setUpFile] = useState(null);
  const [upVersion, setUpVersion] = useState('');
  const [upDesc, setUpDesc] = useState('');
  const [upWindow, setUpWindow] = useState('Auto');

  const [uploaded, setUploaded] = useState(null);
  const [linkGenerated, setLinkGenerated] = useState(false);

  const [pushVersionId, setPushVersionId] = useState('');
  const [pushMethod, setPushMethod] = useState('section');
  const [pushResult, setPushResult] = useState(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const showNotice = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 5000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, v, j] = await Promise.all([
        fetch(`${API}/ota/devices`, { headers: authHeaders() }),
        fetch(`${API}/ota/versions`, { headers: authHeaders() }),
        fetch(`${API}/ota/updates`, { headers: authHeaders() }),
      ]);
      const devData = await d.json().catch(() => []);
      const verData = await v.json().catch(() => []);
      const jobData = await j.json().catch(() => []);
      setDevices(Array.isArray(devData) ? devData : []);
      setVersions(Array.isArray(verData) ? verData : []);
      setJobs(Array.isArray(jobData) ? jobData : []);
    } catch (e) {
      showNotice(e.message || 'Failed to load OTA data', 'error');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${API}/ota/updates`, { headers: authHeaders() });
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) setJobs(data);
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [authHeaders]);

  const filteredDevices = devices.filter(d =>
    !deviceSearch ||
    d.device_id.toLowerCase().includes(deviceSearch.toLowerCase()) ||
    String(d.firmware_version || '').toLowerCase().includes(deviceSearch.toLowerCase())
  );

  const toggleSelect = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAutoUpdate = async (device, enabled) => {
    try {
      const res = await fetch(`${API}/ota/devices/${device.device_id}/auto-update`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setDevices(prev => prev.map(d => d.device_id === device.device_id ? { ...d, auto_update: enabled } : d));
      }
    } catch {}
  };

  const handleUpload = async () => {
    if (!upFile) return showNotice('Select a firmware file (.bin)', 'error');
    if (!upVersion.trim()) return showNotice('Version is required (e.g. 1.2.3)', 'error');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', upFile);
      fd.append('version', upVersion.trim());
      fd.append('description', upDesc.trim());
      fd.append('window', upWindow);
      const res = await fetch(`${API}/ota/versions`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setUpFile(null); setUpVersion(''); setUpDesc(''); setUpWindow('Auto');
      setUploaded(data.version);
      setLinkGenerated(false);
      showNotice(`Firmware v${data.version.version} uploaded`);
      loadAll();
    } catch (e) {
      showNotice(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateLink = () => {
    if (!uploaded) return showNotice('Upload a firmware file first', 'error');
    setLinkGenerated(true);
    showNotice(`Download link generated for v${uploaded.version}`);
  };

  const startNewUpdate = () => {
    setUploaded(null);
    setLinkGenerated(false);
    setUpFile(null); setUpVersion(''); setUpDesc(''); setUpWindow('Auto');
  };

  const copyText = async (text, label = 'Link') => {
    try {
      await navigator.clipboard.writeText(text);
      showNotice(`${label} copied to clipboard`);
    } catch {
      showNotice('Copy failed', 'error');
    }
  };

  const handlePush = async (versionId, m, ids) => {
    if (!ids || ids.length === 0) return showNotice('Select at least one device', 'error');
    if (!versionId) return showNotice('Select a firmware version', 'error');
    setBusy(true);
    setPushResult(null);
    try {
      const res = await fetch(`${API}/ota/push`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIds: ids, versionId, method: m }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Push failed');
      setPushResult(data);
      const ok = data.results.filter(r => r.success).length;
      const fail = data.results.length - ok;
      showNotice(`Update pushed to ${ok} device(s)${fail ? `, ${fail} failed` : ''}`, fail ? 'error' : 'success');
      setShowPush(false);
      setSelectedIds([]);
      loadAll();
    } catch (e) {
      showNotice(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteVersion = async (v) => {
    if (!window.confirm(`Delete firmware v${v.version}? The stored file will be removed.`)) return;
    try {
      const res = await fetch(`${API}/ota/versions/${v.id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      showNotice(`Firmware v${v.version} deleted`);
      loadAll();
    } catch (e) {
      showNotice(e.message, 'error');
    }
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
  };

  const openPush = (v) => {
    setPushVersionId(v ? String(v.id) : pushVersionId || '');
    setPushMethod(method);
    setPushResult(null);
    setShowPush(true);
  };

  const openPushSelected = () => {
    if (selectedIds.length === 0) return showNotice('Select at least one device first', 'error');
    setPushVersionId(pushVersionId || '');
    setPushMethod(method);
    setPushResult(null);
    setShowPush(true);
  };

  const modalCls = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  const modalCard = 'w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in';

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition';
  const btnPrimary = 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed';
  const btnGhost = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-bold transition disabled:opacity-50';return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 pb-10">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">OTA Manager</h1>
            <p className="text-sm text-slate-500 mt-1">Push firmware updates to devices over the air (esp_ota_ops)</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/public/ota/device-code"
              download="main.c"
              className={btnGhost}
              title="Download ESP32 device source code (main.c)"
            >
              <Code className="h-4 w-4" /> Download Device Code
            </a>
            <button onClick={() => { loadAll(); setSelectedIds([]); }} className={btnGhost}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {notice && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold animate-fade-in ${
            notice.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {notice.type === 'error' ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : <CheckCircle2 className="h-4 w-4 flex-shrink-0" />}
            {notice.msg}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm w-fit">
          <button
            onClick={() => setTab('versions')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${tab === 'versions' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Settings2 className="h-4 w-4" /> Version Management
          </button>
          <button
            onClick={() => setTab('files')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${tab === 'files' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Package className="h-4 w-4" /> File System
          </button>
        </div>

        {/* ════════════════ TAB 1: VERSION MANAGEMENT ════════════════ */}
        {tab === 'versions' && (
          <>
            {/* Top control bar */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                {/* Method selector */}
                <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                  {['section', 'auto'].map(m => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${method === m ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>

                {/* Device multi-select */}
                <div className="relative flex-1 min-w-[220px]">
                  <button
                    onClick={() => setListOpen(o => !o)}
                    className={`${inputCls} flex items-center justify-between gap-2`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <HardDrive className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      {selectedIds.length > 0
                        ? `${selectedIds.length} device(s) selected`
                        : 'Select devices…'}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${listOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {listOpen && (
                    <div className="absolute z-30 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in">
                      <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            value={deviceSearch}
                            onChange={(e) => setDeviceSearch(e.target.value)}
                            placeholder="Search device ID…"
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto custom-scrollbar">
                        {devices.length === 0 && (
                          <p className="px-4 py-6 text-sm text-slate-400 text-center">No devices found</p>
                        )}
                        {devices.map(d => (
                          <label key={d.device_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={selectedIds.includes(d.device_id)}
                              onChange={() => toggleSelect(d.device_id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{d.device_id}</p>
                              <p className="text-xs text-slate-400 truncate">FW {d.firmware_version || '—'} · {d.model || 'HS01'}</p>
                            </div>
                            {d.auto_update && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">AUTO</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => setListOpen(false)} className={btnGhost}>List Device</button>
                <button onClick={openPushSelected} disabled={busy} className={btnPrimary}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Update
                </button>
              </div>
            </div>

            {/* Device table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-blue-600" /> Device List &amp; Firmware Versions
                </h2>
                <span className="text-xs font-bold text-slate-400">{filteredDevices.length} device(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-5 py-3 w-10">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          checked={filteredDevices.length > 0 && filteredDevices.every(d => selectedIds.includes(d.device_id))}
                          onChange={(e) => setSelectedIds(e.target.checked ? filteredDevices.map(d => d.device_id) : [])}
                        />
                      </th>
                      <th className="px-4 py-3">Device ID</th>
                      <th className="px-4 py-3">Model</th>
                      <th className="px-4 py-3">Firmware Version</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Seen</th>
                      <th className="px-4 py-3">Auto Update</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.length === 0 && (
                      <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-400">No devices — register one first</td></tr>
                    )}
                    {filteredDevices.map(d => (
                      <tr key={d.device_id} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            checked={selectedIds.includes(d.device_id)}
                            onChange={() => toggleSelect(d.device_id)}
                          />
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-800">{d.device_id}</td>
                        <td className="px-4 py-3.5 text-slate-500">{d.model || 'HS01'}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700">
                            <Cpu className="h-3.5 w-3.5 text-blue-500" /> {d.firmware_version || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            d.status === 'Verified' ? 'bg-emerald-50 text-emerald-700' :
                            d.status === 'Registered' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                          }`}>{d.status || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs">{new Date(d.last_seen).toLocaleString()}</td>
                        <td className="px-4 py-3.5">
                          <Toggle checked={!!d.auto_update} onChange={(v) => toggleAutoUpdate(d, v)} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => { setSelectedIds([d.device_id]); openPush(null); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition"
                          >
                            <Send className="h-3.5 w-3.5" /> Push
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ════════════════ TAB 2: FILE SYSTEM — step-by-step wizard ════════════════ */}
        {tab === 'files' && (
          <div className="space-y-6">
            {/* ── Wizard header + stepper ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-blue-600" /> Step-by-Step Firmware Update
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Upload the file → generate the download link → the device pulls it and flashes via espota.
                  </p>
                </div>
                {uploaded && (
                  <button onClick={startNewUpdate} className={btnGhost}>
                    <RotateCcw className="h-4 w-4" /> Start New Update
                  </button>
                )}
              </div>

              {/* Stepper */}
              <div className="mt-6 flex items-start gap-2">
                {STEPS.map((s, i) => {
                  const done = (s.n === 1 && uploaded) || (s.n === 2 && linkGenerated) || (s.n === 3 && linkGenerated);
                  const active = (s.n === 1 && !uploaded) || (s.n === 2 && uploaded && !linkGenerated) || (s.n === 3 && linkGenerated);
                  const locked = (s.n === 2 && !uploaded) || (s.n === 3 && !linkGenerated);
                  return (
                    <div key={s.n} className="flex-1 flex items-center gap-2">
                      <div className={`flex-1 rounded-xl border p-3 transition ${active ? 'border-blue-300 bg-blue-50/60 shadow-sm' : locked ? 'border-slate-100 bg-slate-50/50 opacity-60' : 'border-emerald-200 bg-emerald-50/50'}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${
                            done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-xs font-extrabold truncate ${active ? 'text-blue-800' : done ? 'text-emerald-700' : 'text-slate-400'}`}>{s.title}</p>
                            <p className="text-[10px] text-slate-400 leading-tight truncate">{s.desc}</p>
                          </div>
                        </div>
                      </div>
                      {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-slate-300 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── STEP 1: Upload file ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <span className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-extrabold">1</span>
                <span className="font-extrabold text-slate-900 flex items-center gap-2">
                  <FileUp className="h-4.5 w-4.5 text-blue-600" /> Upload Firmware File
                </span>
                {uploaded && (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> v{uploaded.version} uploaded
                  </span>
                )}
              </div>
              <div className="p-6">
                {!uploaded ? (
                  <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Firmware file (.bin)</span>
                        <div className={`mt-2 rounded-xl border-2 border-dashed ${upFile ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'} transition p-6 text-center cursor-pointer`}>
                          <input
                            type="file"
                            accept=".bin,.img,.hex"
                            className="hidden"
                            id="fw-file-input"
                            onChange={(e) => setUpFile(e.target.files?.[0] || null)}
                          />
                          <label htmlFor="fw-file-input" className="cursor-pointer block">
                            {upFile ? (
                              <>
                                <p className="text-sm font-bold text-emerald-700 truncate">{upFile.name}</p>
                                <p className="text-xs text-slate-400 mt-1">{fmtSize(upFile.size)}</p>
                              </>
                            ) : (
                              <>
                                <CloudUpload className="h-8 w-8 text-slate-300 mx-auto" />
                                <p className="text-sm text-slate-500 font-semibold mt-2">Click to choose a file</p>
                                <p className="text-[11px] text-slate-400 mt-1">App factory partition or section build</p>
                              </>
                            )}
                          </label>
                        </div>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Description</span>
                        <textarea value={upDesc} onChange={(e) => setUpDesc(e.target.value)} rows={2} placeholder="What changed in this build…" className={`${inputCls} mt-2 resize-none`} />
                      </label>
                    </div>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Version</span>
                        <input value={upVersion} onChange={(e) => setUpVersion(e.target.value)} placeholder="e.g. 1.2.3" className={`${inputCls} mt-2`} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Partition Window</span>
                        <select value={upWindow} onChange={(e) => setUpWindow(e.target.value)} className={`${inputCls} mt-2`}>
                          <option value="Auto">Auto</option>
                          <option value="OTA0">OTA0</option>
                          <option value="OTA1">OTA1</option>
                        </select>
                      </label>
                      <div className="pt-2">
                        <button onClick={handleUpload} disabled={busy} className={`${btnPrimary} w-full justify-center`}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                          {busy ? 'Uploading…' : 'Upload File'}
                        </button>
                        <p className="text-[11px] text-slate-400 mt-2 text-center">Only stores the file — no update is pushed yet</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl bg-emerald-50/60 border border-emerald-200 p-4">
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-800">Firmware v{uploaded.version} stored successfully</p>
                      <p className="text-xs text-emerald-700/80 mt-0.5 truncate">
                        {uploaded.file_name} · {fmtSize(uploaded.file_size)} · {uploaded.window} window · MD5 {uploaded.md5}
                      </p>
                    </div>
                    <button onClick={startNewUpdate} className={btnGhost}>Upload Another File</button>
                  </div>
                )}
              </div>
            </div>

            {/* ── STEP 2: Generate Link ── */}
            <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${!uploaded ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${uploaded ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {linkGenerated ? <Check className="h-3.5 w-3.5" /> : 2}
                </span>
                <span className="font-extrabold text-slate-900 flex items-center gap-2">
                  <Link2 className={`h-4.5 w-4.5 ${uploaded ? 'text-blue-600' : 'text-slate-300'}`} /> Generate Link
                </span>
                {!uploaded && <span className="text-[10px] font-bold text-slate-400 uppercase ml-auto">Locked — complete step 1</span>}
              </div>
              <div className="p-6">
                {!uploaded ? (
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <Lock className="h-4 w-4 text-slate-300" />
                    <p className="text-sm text-slate-400">Upload a firmware file in step 1 before the download link can be generated.</p>
                  </div>
                ) : !linkGenerated ? (
                  <div className="flex flex-col items-start gap-4">
                    <p className="text-sm text-slate-600">
                      Generate the HTTPS download link for <span className="font-bold text-slate-800">v{uploaded.version}</span>. The device's espota routine will fetch firmware from this link.
                    </p>
                    <button onClick={handleGenerateLink} disabled={busy} className={btnPrimary}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Generate Link
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-100 p-4">
                      <Link2 className="h-4.5 w-4.5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Download link — device pulls from here</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <code className="text-xs font-mono text-blue-700 break-all bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1">{uploaded.download_url}</code>
                          <button onClick={() => copyText(uploaded.download_url, 'Link')} className={btnGhost}>
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">File Size</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">{fmtSize(uploaded.file_size)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Window</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">{uploaded.window}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">MD5 Checksum</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs font-mono text-slate-600 truncate flex-1">{uploaded.md5}</p>
                          <button onClick={() => copyText(uploaded.md5, 'MD5')} className="text-slate-400 hover:text-blue-600 transition flex-shrink-0">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Link generated — strictly after upload, nothing pushed to devices
                      </p>
                      <button onClick={() => setLinkGenerated(false)} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition">Regenerate</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── STEP 3: Device Download via espota ── */}
            <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${!linkGenerated ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${linkGenerated ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {linkGenerated ? <Check className="h-3.5 w-3.5" /> : 3}
                </span>
                <span className="font-extrabold text-slate-900 flex items-center gap-2">
                  <TerminalSquare className={`h-4.5 w-4.5 ${linkGenerated ? 'text-emerald-600' : 'text-slate-300'}`} /> Device Download — espota
                </span>
                {!linkGenerated && <span className="text-[10px] font-bold text-slate-400 uppercase ml-auto">Locked — generate link first</span>}
              </div>
              <div className="p-6">
                {!linkGenerated ? (
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <Lock className="h-4 w-4 text-slate-300" />
                    <p className="text-sm text-slate-400">The device routine is revealed once the download link has been generated in step 2.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] p-4 space-y-3 overflow-x-auto">
                      <div>
                        <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">① HTTPS fetch (device side)</p>
                        <p className="mt-1.5">GET <span className="text-emerald-300 break-all">{uploaded.download_url}</span></p>
                        <p className="text-slate-500 mt-0.5">Expects: 200 OK · Content-Type application/octet-stream · MD5 header = {uploaded.md5}</p>
                      </div>
                      <div className="border-t border-slate-700/60 pt-3">
                        <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">② Flash with esp_ota_ops</p>
                        <p className="mt-1.5">
                          esp_ota_begin(ota, 0, 0) → esp_ota_write(ota, chunk, len) → esp_ota_end(ota)<br />
                          <span className="text-slate-500">then esp_ota_set_boot_partition(ota) + esp_restart()</span>
                        </p>
                      </div>
                      <div className="border-t border-slate-700/60 pt-3">
                        <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">③ MQTT OTA trigger (optional, for auto update)</p>
                        <p className="mt-1.5 text-slate-500">publish to topic:</p>
                        <p className="text-cyan-300">enthutech/&lt;deviceId&gt;/ota</p>
                        <pre className="text-[10px] text-violet-300 mt-1.5 whitespace-pre-wrap">{JSON.stringify({
                          version: uploaded.version,
                          url: uploaded.download_url,
                          method: 'section',
                          md5: uploaded.md5,
                          file_size: uploaded.file_size,
                        }, null, 2)}</pre>
                      </div>
                      <div className="border-t border-slate-700/60 pt-3">
                        <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">④ Verify on PC (optional)</p>
                        <p className="mt-1.5 text-slate-500 truncate">curl -L -o firmware.bin "<span className="text-emerald-300">{uploaded.download_url}</span>"</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-blue-50/60 border border-blue-100 p-3">
                      <Cpu className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <p className="text-xs text-slate-600">
                        The device downloads this link itself on boot or when triggered — no server-side push is required for this update.
                      </p>
                    </div>
                    <button onClick={startNewUpdate} className={btnGhost}>
                      <RotateCcw className="h-4 w-4" /> Start New Update
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Existing firmware builds (manage) ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" /> Stored Firmware Builds
                </h2>
                <span className="text-xs font-bold text-slate-400">{versions.length} build(s)</span>
              </div>
              {versions.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">No firmware files yet — complete step 1 above to upload the first build</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {versions.map(v => (
                    <div key={v.id} className="px-5 py-4 flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-extrabold px-2.5 py-1 rounded-full">
                            <FileCode2 className="h-3 w-3" /> v{v.version}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full">{v.window}</span>
                          <span className="text-xs text-slate-400 font-semibold">{fmtSize(v.file_size)}</span>
                          <span className="text-xs text-slate-400"><Clock className="h-3 w-3 inline" /> {new Date(v.created_at).toLocaleString()}</span>
                        </div>
                        {v.description && <p className="text-xs text-slate-500 mt-1 truncate">{v.description}</p>}
                        {v.md5 && <p className="text-[10px] text-slate-300 font-mono truncate" title={v.md5}>MD5: {v.md5}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => { setUploaded(v); setLinkGenerated(false); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition"
                          title="Load this build into the wizard"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Use
                        </button>
                        <a href={v.download_url} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-700 text-xs font-bold transition" download>
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                        <button onClick={() => deleteVersion(v)} className="inline-flex items-center p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Push modal ── */}
      {showPush && (
        <div className={modalCls}>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => !busy && setShowPush(false)} />
          <div className={`${modalCard} relative z-10`}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" /> Push Update
              </h3>
              <button onClick={() => !busy && setShowPush(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Firmware version</span>
                <select value={pushVersionId} onChange={(e) => setPushVersionId(e.target.value)} className={`${inputCls} mt-2`}>
                  <option value="">Select a version…</option>
                  {versions.map(v => <option key={v.id} value={v.id}>v{v.version} — {v.description || v.file_name}</option>)}
                </select>
              </label>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Update method</span>
                <div className="mt-2 flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                  {['section', 'auto'].map(m => (
                    <button
                      key={m}
                      onClick={() => setPushMethod(m)}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition ${pushMethod === m ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}
                    >
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Targeting {selectedIds.length || 'all listed'} device(s)</p>
                <div className="space-y-1.5">
                  {(selectedIds.length > 0 ? devices.filter(d => selectedIds.includes(d.device_id)) : devices.slice(0, 12)).map(d => (
                    <p key={d.device_id} className="text-sm text-slate-600 font-semibold truncate">• {d.device_id} <span className="text-slate-400 font-normal">(FW {d.firmware_version || '—'})</span></p>
                  ))}
                  {selectedIds.length === 0 && devices.length > 12 && <p className="text-xs text-slate-400">…and {devices.length - 12} more</p>}
                </div>
              </div>
              {pushResult && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Push results</p>
                  {pushResult.results.map((r, i) => (
                    <p key={i} className={`text-xs font-semibold flex items-center gap-1.5 ${r.success ? 'text-emerald-700' : 'text-red-600'}`}>
                      {r.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {r.device_id} — {r.success ? 'command sent' : r.error}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowPush(false)} disabled={busy} className={btnGhost}>Cancel</button>
                <button onClick={() => handlePush(pushVersionId, pushMethod, selectedIds.length > 0 ? selectedIds : devices.map(d => d.device_id))} disabled={busy} className={btnPrimary}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default OtaManager;