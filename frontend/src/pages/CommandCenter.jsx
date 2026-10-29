import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDb } from '../context/DbContext';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import MotionChart from '../components/MotionChart';
import {
  Terminal, Radio, Send, AlertCircle, CheckCircle2, Loader2,
  Clock, HardDrive, Cpu, Wifi, Server, Activity, Zap,
  ChevronDown, X, RefreshCw, FileText, List, Layers,
  Search, ArrowLeft, Monitor, CpuIcon, CreditCard, Download,
  Plus, Pencil, Trash2, Save, BookMarked
} from 'lucide-react';

const COMMANDS = [
  { cmd: 'PRO01',    label: 'Protection ON',       param: false, desc: 'Enable protection mode' },
  { cmd: 'PRO00',    label: 'Protection OFF',      param: false, desc: 'Disable protection mode' },
  { cmd: 'TES01',    label: 'Test Mode ON',        param: false, desc: 'Enable test sequence' },
  { cmd: 'TES00',    label: 'Test Mode OFF',       param: false, desc: 'Disable test mode' },
  { cmd: 'NAME',     label: 'Set Device Name',     param: true,  desc: 'Set device name (letters/spaces)' },
  { cmd: 'CLRNAME',  label: 'Clear Device Name',   param: false, desc: 'Remove device name' },
  { cmd: 'ADMIN',    label: 'Set Admin Number',    param: true,  desc: 'Register admin phone +91XXXXXXXXXX' },
  { cmd: 'CLRADMIN', label: 'Clear Admin',         param: false, desc: 'Remove admin number' },
  { cmd: 'ADD1',     label: 'Add User Slot 1',     param: true,  desc: 'Add user 1 phone +91XXXXXXXXXX' },
  { cmd: 'ADD2',     label: 'Add User Slot 2',     param: true,  desc: 'Add user 2 phone +91XXXXXXXXXX' },
  { cmd: 'ADD3',     label: 'Add User Slot 3',     param: true,  desc: 'Add user 3 phone +91XXXXXXXXXX' },
  { cmd: 'ADD4',     label: 'Add User Slot 4',     param: true,  desc: 'Add user 4 phone +91XXXXXXXXXX' },
  { cmd: 'ADD5',     label: 'Add User Slot 5',     param: true,  desc: 'Add user 5 phone +91XXXXXXXXXX' },
  { cmd: 'DEL1',     label: 'Delete User 1',       param: false, desc: 'Remove user slot 1' },
  { cmd: 'DEL2',     label: 'Delete User 2',       param: false, desc: 'Remove user slot 2' },
  { cmd: 'DEL3',     label: 'Delete User 3',       param: false, desc: 'Remove user slot 3' },
  { cmd: 'DEL4',     label: 'Delete User 4',       param: false, desc: 'Remove user slot 4' },
  { cmd: 'DEL5',     label: 'Delete User 5',       param: false, desc: 'Remove user slot 5' },
  { cmd: 'RESETALL', label: 'Reset All',           param: false, desc: 'Clear all NVS data' },
  { cmd: 'LIST',     label: 'List Settings',       param: false, desc: 'Show device configuration' },
];

const PARAM_PLACEHOLDERS = {
  NAME:    'Enter device name (e.g. MyHome)',
  ADMIN:   'Enter phone (e.g. +919876543210)',
  ADD1:    'Enter phone (e.g. +919876543210)',
  ADD2:    'Enter phone (e.g. +919876543210)',
  ADD3:    'Enter phone (e.g. +919876543210)',
  ADD4:    'Enter phone (e.g. +919876543210)',
  ADD5:    'Enter phone (e.g. +919876543210)',
};

const CommandCenter = () => {
  const { devices } = useDb();
  const { user } = useAuth();
  const [selectedDevice, setSelectedDevice] = useState('');
  const [view, setView] = useState('list');
  const [selectedCmd, setSelectedCmd] = useState('');
  const [paramValue, setParamValue] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [rawCommand, setRawCommand] = useState('');

  const [customCommands, setCustomCommands] = useState([]);
  const [showCmdModal, setShowCmdModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [cmdError, setCmdError] = useState('');

  const [deviceLog, setDeviceLog] = useState([]);
  const deviceLogRef = useRef([]);
  const logEndRef = useRef(null);

  const [deviceLogs, setDeviceLogs] = useState([]);

  const [mqttConnected, setMqttConnected] = useState(false);
  const mqttClientRef = useRef(null);
  const selectedDeviceRef = useRef('');
  useEffect(() => { selectedDeviceRef.current = selectedDevice; }, [selectedDevice]);

  const fetchCommandTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/command-templates', {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) setCustomCommands(data.templates || []);
    } catch { /* offline — fall back to built-in list */ }
  }, [user]);

  useEffect(() => { fetchCommandTemplates(); }, [fetchCommandTemplates]);

  const allCommands = [
    ...COMMANDS,
    ...customCommands.map(t => ({
      cmd: t.code, label: t.label, param: t.param, desc: t.desc,
      placeholder: t.placeholder, custom: true, id: t.id,
    })),
  ];

  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`Delete command ${template.cmd}?`)) return;
    try {
      const res = await fetch(`/api/command-templates/${template.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        if (selectedCmd === template.cmd) { setSelectedCmd(''); setParamValue(''); }
        await fetchCommandTemplates();
      } else {
        setCmdError(data.error || 'Failed to delete command');
      }
    } catch (err) {
      setCmdError(err.message);
    }
  };

  useEffect(() => {
    if (!selectedDevice) { setDeviceLogs([]); return; }
    let cancelled = false;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/telemetry/${selectedDevice}`, {
          headers: { 'Authorization': `Bearer ${user?.token}` }
        });
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) setDeviceLogs(data);
      } catch {}
    };
    fetchLogs();
    return () => { cancelled = true; };
  }, [selectedDevice, user?.token]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [deviceLog]);

  const addLog = useCallback((text, type = 'info', source = '') => {
    const entry = { text, type, ts: new Date().toLocaleTimeString(), source };
    deviceLogRef.current = [...deviceLogRef.current, entry];
    if (deviceLogRef.current.length > 10000) deviceLogRef.current = deviceLogRef.current.slice(-10000);
    setDeviceLog([...deviceLogRef.current]);
  }, []);

  useEffect(() => {
    deviceLogRef.current = [];
    addLog('Device log started', 'info');
    let cancelled = false;
    const fetchTelemetry = async () => {
      try {
        const url = selectedDevice
          ? `/api/telemetry/${selectedDevice}`
          : '/api/telemetry/recent';
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${user?.token}` }
        });
        const data = await res.json().catch(() => ([]));
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          const entries = data.map(d => ({
            text: JSON.stringify({
              device: d.device?.device_id || d.deviceId || '?',
              battery: d.battery,
              signal: d.signal,
              motion: d.motion_count,
              alert: d.alert_active,
              timestamp: d.timestamp
            }, null, 2),
            type: 'telemetry',
            ts: new Date(d.timestamp).toLocaleTimeString(),
          })).reverse();
          deviceLogRef.current = [...deviceLogRef.current, ...entries].slice(-10000);
          setDeviceLog([...deviceLogRef.current]);
        }
      } catch {}
    };
    fetchTelemetry();
    return () => { cancelled = true; };
  }, [selectedDevice, addLog]);

  useEffect(() => {
    let client = null;
    let cancelled = false;

    const connect = async () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let wsUrl = `${proto}//${window.location.host}/mqtt`;
        try { const cfg = await (await fetch('/api/config')).json(); if (cfg.mqttWsUrl) wsUrl = cfg.mqttWsUrl; } catch {}

        const mqtt = await import('mqtt');
        client = mqtt.default.connect(wsUrl, { clean: true, connectTimeout: 10000 });
        mqttClientRef.current = client;

        client.on('connect', () => {
          if (cancelled) return;
          setMqttConnected(true);
          addLog('Connected to MQTT broker', 'success', 'system');
          client.subscribe('enthutech/#', { qos: 1 });
          addLog('Subscribed to enthutech/#', 'info', 'system');
        });

        client.on('message', (topic, msg) => {
          if (cancelled) return;
          const payload = msg.toString();
          try {
            const parsed = JSON.parse(payload);
            const device = selectedDeviceRef.current;
            // Store concise summary as text, full JSON stringified
            const summary = Object.entries(parsed)
              .filter(([k]) => !['topic'].includes(k))
              .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
              .join('  ·  ');
            addLog(summary || payload, 'mqtt', topic);
            if (device && topic.toLowerCase().includes(device.toLowerCase())) {
              setResponse(parsed);
            }
          } catch {
            addLog(payload, 'mqtt', topic);
          }
        });

        client.on('error', (err) => addLog(err.message, 'error', 'broker'));
        client.on('close', () => { if (!cancelled) { setMqttConnected(false); addLog('MQTT disconnected', 'warning', 'system'); } });
      } catch (err) {
        addLog(JSON.stringify({ error: err.message }), 'error');
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (client) { try { client.end(true); } catch {} }
    };
  }, [addLog]);

  const sendCommand = async (code, params) => {
    const command = String(code || '').trim().toUpperCase();
    const paramStr = String(params || '').trim();

    if (!selectedDevice || !command) {
      setCmdError('Select a device and a command');
      return;
    }

    const cmdObj = allCommands.find(c => c.cmd === command);
    if (cmdObj?.param && !paramStr) {
      setCmdError(`Parameter required for ${command}`);
      return;
    }

    setSending(true);
    setCmdError('');
    setResponse(null);

    try {
      const body = {
        device_id: selectedDevice,
        command,
        params: paramStr,
      };

      addLog(`${body.command}${body.params ? ' ' + body.params : ''} → ${body.device_id}`, 'sent', `CMD/${body.command}`);

      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({ success: false, error: 'Network error or empty response' }));

      if (data.success) {
        addLog(`Delivered via ${data.topic || 'MQTT'}`, 'success', data.topic || 'server');
        return true;
      } else {
        addLog(data.error || 'Command failed', 'error', 'server');
        setCmdError(data.error);
      }
    } catch (err) {
      addLog(err.message, 'error', 'network');
      setCmdError(err.message);
    } finally {
      setSending(false);
    }
    return false;
  };

  const handleSendCommand = () => sendCommand(selectedCmd, paramValue);

  const handleSendRaw = async () => {
    const parts = rawCommand.trim().split(/\s+/);
    const code = parts[0];
    const params = parts.slice(1).join(' ');
    const ok = await sendCommand(code, params);
    if (ok) setRawCommand('');
  };

  const selectedCmdObj = allCommands.find(c => c.cmd === selectedCmd);
  const commandableDevices = devices;
  const filteredDevices = devices.filter(d => {
    if (!deviceSearch) return true;
    const q = deviceSearch.trim().toLowerCase();
    return (
      (d.device_id || '').toLowerCase().includes(q) ||
      (d.model || '').toLowerCase().includes(q) ||
      (d.status || '').toLowerCase().includes(q) ||
      (d.customer?.customer_name || '').toLowerCase().includes(q)
    );
  }); const isOnline = d =>
    d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 1800000;

  const selectedDeviceObj = devices.find(d => d.device_id === selectedDevice);

  const handleOpenDevice = (deviceId) => {
    setSelectedDevice(deviceId);
    setResponse(null);
    setCmdError('');
    setSelectedCmd('');
    setParamValue('');
    setView('detail');
  };

  const handleBackToList = () => {
    setSelectedDevice('');
    setResponse(null);
    setCmdError('');
    setView('list');
  };

  const handleDownloadLog = () => {
    const textContent = deviceLog.map(l => `[${l.ts}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `device_log_${selectedDevice || 'recent'}_${new Date().toISOString().replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (view === 'detail' && selectedDevice) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBackToList}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 bg-white shadow-sm">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div>
                <h1 className="page-title">Command Center</h1>
                <p className="page-subtitle">Send MQTT commands to devices and monitor responses</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border ${
              mqttConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <span className={`h-2 w-2 rounded-full ${mqttConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {mqttConnected ? 'MQTT Connected' : 'MQTT Offline'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Section: Device info + Command + Response */}
            <div className="space-y-6">
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                  <Server className="h-5 w-5 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Device Target</span>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className={`h-3 w-3 rounded-full flex-shrink-0 ${selectedDeviceObj && isOnline(selectedDeviceObj) ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold text-slate-900 font-mono">{selectedDevice}</p>
                      {selectedDeviceObj && (
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                          {selectedDeviceObj.model} · {selectedDeviceObj.status}
                          {selectedDeviceObj.customer?.customer_name ? ` — ${selectedDeviceObj.customer.customer_name}` : ''}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-widest flex-shrink-0 ${selectedDeviceObj && isOnline(selectedDeviceObj) ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {selectedDeviceObj && isOnline(selectedDeviceObj) ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="field-label">Command Protocol</label>
                        <button type="button"
                          onClick={() => { setEditingTemplate(null); setShowCmdModal(true); }}
                          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors border border-blue-200">
                          <Plus className="h-3.5 w-3.5" /> Add Command
                        </button>
                      </div>
                      <select value={selectedCmd} onChange={e => { setSelectedCmd(e.target.value); setParamValue(''); setResponse(null); }}
                        className="form-input">
                        <option value="">-- Select command --</option>
                        <optgroup label="Built-in">
                          {COMMANDS.map(c => (
                            <option key={c.cmd} value={c.cmd}>{c.cmd} — {c.label}</option>
                          ))}
                        </optgroup>
                        {customCommands.length > 0 && (
                          <optgroup label="Custom">
                            {customCommands.map(t => (
                              <option key={t.code} value={t.code}>{t.code} — {t.label}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {selectedCmdObj && (
                        <div className="flex items-start justify-between gap-2 mt-1">
                          <p className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5 flex-shrink-0" />{selectedCmdObj.desc || 'Custom command'}
                          </p>
                          {selectedCmdObj.custom && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button type="button" title="Edit command"
                                onClick={() => { setEditingTemplate(customCommands.find(t => t.id === selectedCmdObj.id)); setShowCmdModal(true); }}
                                className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" title="Delete command"
                                onClick={() => handleDeleteTemplate(selectedCmdObj)}
                                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="field-label">
                        Parameter {selectedCmdObj && !selectedCmdObj.param && <span className="text-slate-400 font-normal">(optional for {selectedCmd})</span>}
                      </label>
                      <input type="text" value={paramValue} onChange={e => setParamValue(e.target.value)}
                        placeholder={PARAM_PLACEHOLDERS[selectedCmd] || selectedCmdObj?.placeholder || 'Enter value (optional)'}
                        className="form-input" />
                    </div>

                    <button onClick={handleSendCommand}
                      disabled={sending || !selectedDevice || !selectedCmd}
                      className="btn-primary w-full py-3.5">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sending ? 'Transmitting...' : 'Execute Command'}
                    </button>

                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <label className="field-label flex items-center gap-1.5">
                        <BookMarked className="h-3.5 w-3.5 text-slate-400" /> Direct Command
                      </label>
                      <div className="flex gap-2">
                        <input type="text" value={rawCommand}
                          onChange={e => setRawCommand(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !sending && rawCommand.trim()) handleSendRaw(); }}
                          placeholder="Type command + optional params (e.g. PRO01)"
                          className="form-input flex-1 font-mono" />
                        <button onClick={handleSendRaw}
                          disabled={sending || !selectedDevice || !rawCommand.trim()}
                          className="btn-primary px-4 flex-shrink-0" title="Send command">
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Send any protocol code directly — the first word is the command, the rest is the parameter. Press Enter to send.
                      </p>
                    </div>

                    {cmdError && (
                      <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 text-xs font-semibold">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />{cmdError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">ACK / Response</span>
                  </div>
                  {response && (
                    <button onClick={() => setResponse(null)} className="text-xs text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="p-6">
                  {!response && (
                    <p className="text-xs font-semibold text-slate-400 text-center py-8 flex flex-col items-center gap-3 uppercase tracking-wider">
                      <Radio className="h-8 w-8 text-slate-300" />
                      Awaiting command execution response...
                    </p>
                  )}
                  {response && (
                    <pre className="text-xs font-mono bg-slate-900 text-emerald-400 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap shadow-inner border border-slate-800">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  )}
                </div>
              </div>

              {/* SIM Plan Management */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">SIM Plan Provisioning</span>
                </div>
                <div className="p-6 space-y-4">
                  <SimPlanForm deviceId={selectedDevice} addLog={addLog} user={user} />
                </div>
              </div>

              {/* PIR & Protection Mode Graphs */}
              {deviceLogs.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">PIR &amp; Protection Mode Analytics</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-200">{deviceLogs.length} readings</span>
                  </div>
                  <div className="p-6">
                    <MotionChart deviceLogs={deviceLogs} />
                  </div>
                </div>
              )}
            </div>

            {/* Right Section: Telemetry Log Table */}
            <div className="card overflow-hidden flex flex-col h-[640px] lg:h-[calc(100vh-48px)] lg:sticky lg:top-6">
              {/* Table Header */}
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <Monitor className="h-4.5 w-4.5 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Telemetry Log</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">{deviceLog.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  {mqttConnected && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
                    </span>
                  )}
                  <button onClick={handleDownloadLog}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors border border-blue-200">
                    <Download className="h-3 w-3" /> Export
                  </button>
                  <button onClick={() => { deviceLogRef.current = []; setDeviceLog([]); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">
                    <X className="h-3 w-3" /> Clear
                  </button>
                </div>
              </div>

              {/* Column Headers */}
              <div className="grid grid-cols-[44px_72px_56px_1fr] gap-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-shrink-0">
                <div>#</div>
                <div>Time</div>
                <div>Type</div>
                <div>Message / Source</div>
              </div>

              {/* Rows */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {deviceLog.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Radio className="h-10 w-10 text-slate-200 mb-3" />
                    <p className="text-sm font-semibold text-slate-400">No log entries yet</p>
                    <p className="text-xs text-slate-300 mt-1">Waiting for MQTT or telemetry data...</p>
                  </div>
                )}
                {[...deviceLog].reverse().map((e, i) => {
                  const idx = deviceLog.length - i;
                  const typeConf = {
                    success:   { label: 'OK',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
                    error:     { label: 'ERR',   bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500' },
                    warning:   { label: 'WARN',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400' },
                    sent:      { label: 'CMD',   bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500' },
                    mqtt:      { label: 'MQTT',  bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500' },
                    telemetry: { label: 'DATA',  bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500' },
                    info:      { label: 'LOG',   bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400' },
                  };
                  const conf = typeConf[e.type] || typeConf.info;
                  const isEven = i % 2 === 0;
                  return (
                    <div
                      key={i}
                      className={`grid grid-cols-[44px_72px_56px_1fr] gap-0 px-3 py-2 text-xs items-start hover:bg-blue-50/40 transition-colors ${
                        isEven ? 'bg-white' : 'bg-slate-50/60'
                      }`}
                    >
                      {/* # */}
                      <div className="text-[10px] font-mono text-slate-400 pt-0.5">{idx}</div>

                      {/* Time */}
                      <div className="text-[10px] font-mono text-slate-500 pt-0.5 truncate">{e.ts}</div>

                      {/* Type badge */}
                      <div className="pt-0.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${conf.bg} ${conf.text} ${conf.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${conf.dot}`} />
                          {conf.label}
                        </span>
                      </div>

                      {/* Message + source */}
                      <div className="min-w-0 space-y-0.5">
                        {e.source && (
                          <div className="text-[9px] font-mono text-slate-400 truncate">{e.source}</div>
                        )}
                        <div className="text-[11px] text-slate-700 font-medium break-words leading-relaxed">{e.text}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
        {showCmdModal && (
          <CommandTemplateModal
            template={editingTemplate}
            user={user}
            onClose={() => { setShowCmdModal(false); setEditingTemplate(null); }}
            onSaved={async () => {
              setShowCmdModal(false);
              setEditingTemplate(null);
              await fetchCommandTemplates();
            }}
          />
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-6">

        {/* ── Top Header Banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 backdrop-blur-md">
                  <Terminal className="h-3 w-3" />
                  Telemetry Dispatcher
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline">
                  {commandableDevices.length} Target Nodes
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl display-font font-extrabold tracking-tight text-white drop-shadow-sm">
                MQTT Command Center
              </h1>
              <p className="text-xs font-medium text-slate-300 max-w-xl leading-relaxed">
                Dispatch real-time MQTT protocol payloads, configure hardware parameters, and monitor live telemetry.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border backdrop-blur-md ${
                mqttConnected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm' : 'bg-white/10 text-slate-300 border-white/10'
              }`}>
                <span className={`h-2 w-2 rounded-full ${mqttConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                {mqttConnected ? 'MQTT Connected' : 'MQTT Standby'}
              </div>
            </div>
          </div>
        </div>

        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={deviceSearch}
            onChange={e => setDeviceSearch(e.target.value)}
            placeholder="Search nodes by ID, model, status or customer..."
            className="form-input text-base py-4 pl-12 pr-12 rounded-2xl w-full shadow-sm"
          />
          {deviceSearch && (
            <button onClick={() => setDeviceSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {commandableDevices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <HardDrive className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-base font-bold text-slate-500 uppercase tracking-widest">No nodes discovered</p>
          </div>
        )}

        {commandableDevices.length > 0 && filteredDevices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-base font-bold text-slate-500 uppercase tracking-widest">No nodes match "{deviceSearch}"</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDevices.map(d => {
            const online = isOnline(d);
            return (
              <div key={d.device_id}
                className="card p-6 group flex flex-col gap-5 justify-between bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-3 w-3 rounded-full flex-shrink-0 ${online ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-300'}`}
                      title={online ? 'Online' : 'Offline'} />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold font-mono text-slate-900 truncate">{d.device_id}</p>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest truncate mt-0.5">
                        {d.model} · {d.status}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 truncate border-t border-slate-100 pt-4">
                    Client: <span className="text-slate-800 font-bold">{d.customer?.customer_name || 'Unassigned'}</span>
                  </p>
                </div>
                <button onClick={() => handleOpenDevice(d.device_id)}
                  className="btn-primary w-full py-3">
                  <Terminal className="h-4 w-4" />
                  Access Node
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

const SimPlanForm = ({ deviceId, addLog, user }) => {
  const [simPlan, setSimPlan] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!deviceId) return;
    const fetchPlan = async () => {
      try {
        const res = await fetch(`/api/ownership/${deviceId}`, {
          headers: { 'Authorization': `Bearer ${user?.token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (data.success && data.ownership) {
          setSimPlan(data.ownership.simPlan || '');
          setStartDate(data.ownership.simPlanStartDate ? data.ownership.simPlanStartDate.slice(0, 10) : '');
          setEndDate(data.ownership.simPlanEndDate ? data.ownership.simPlanEndDate.slice(0, 10) : '');
        }
      } catch { /* no ownership record yet */ }
      setLoaded(true);
    };
    fetchPlan();
  }, [deviceId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ownership/sim-plan', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          device_id: deviceId,
          simPlan: simPlan || null,
          simPlanStartDate: startDate || null,
          simPlanEndDate: endDate || null,
        }),
      });
      const data = await res.json().catch(() => ({ success: false, error: 'Network error' }));
      if (data.success) {
        addLog(`SIM plan provisioned for ${deviceId}`, 'success');
      } else {
        addLog(`Failed to provision SIM plan: ${data.error}`, 'error');
      }
    } catch (err) {
      addLog(`Failed to provision SIM plan: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="text-xs text-slate-500 text-center py-4 uppercase tracking-widest font-semibold">Retrieving Plan Data...</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="field-label">Plan Name</label>
        <input type="text" value={simPlan} onChange={e => setSimPlan(e.target.value)}
          placeholder="e.g. Premium IoT Connect"
          className="form-input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="field-label">Activation Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="form-input" />
        </div>
        <div className="space-y-2">
          <label className="field-label">Expiration Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="form-input" />
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-sm font-semibold hover:bg-amber-500/20 transition-all shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-50 mt-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {saving ? 'Provisioning...' : 'Update Plan'}
      </button>
    </div>
  );
};

const CommandTemplateModal = ({ template, user, onClose, onSaved }) => {
  const isEdit = !!template?.id;
  const [form, setForm] = useState({
    code: template?.code || '',
    label: template?.label || '',
    desc: template?.desc || '',
    param: !!template?.param,
    placeholder: template?.placeholder || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (!code) { setError('Command code is required'); return; }
    if (!/^[A-Z0-9]{1,24}$/.test(code)) {
      setError('Command code must be 1–24 letters/numbers (no spaces).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = isEdit ? `/api/command-templates/${template.id}` : '/api/command-templates';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ code, label: form.label, desc: form.desc, param: form.param, placeholder: form.placeholder }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        await onSaved();
      } else {
        setError(data.error || 'Failed to save command');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Terminal className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{isEdit ? 'Edit Command' : 'Add Command'}</h2>
              <p className="text-[11px] text-slate-400">Define a reusable protocol command</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-xs font-medium">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="field-label">Command Code *</label>
              <input type="text" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. ARM01" className="form-input font-mono" required />
            </div>
            <div className="space-y-2">
              <label className="field-label">Label *</label>
              <input type="text" value={form.label} onChange={e => set('label', e.target.value)}
                placeholder="e.g. Arm System" className="form-input" required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="field-label">Description</label>
            <input type="text" value={form.desc} onChange={e => set('desc', e.target.value)}
              placeholder="What does this command do?" className="form-input" />
          </div>

          <div className="space-y-2">
            <label className="field-label">Parameter Placeholder</label>
            <input type="text" value={form.placeholder} onChange={e => set('placeholder', e.target.value)}
              placeholder="Shown in the parameter input, e.g. +91XXXXXXXXXX" className="form-input" />
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={form.param} onChange={e => set('param', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <div>
              <p className="text-xs font-bold text-slate-800">Requires a parameter</p>
              <p className="text-[11px] text-slate-400">Block sending until a parameter value is provided</p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Command')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommandCenter;