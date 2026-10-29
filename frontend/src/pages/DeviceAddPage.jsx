import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDb } from '../context/DbContext';
import Layout from '../components/Layout';
import {
  Plug, PlugZap, CheckCircle2, AlertCircle, Loader2,
  Smartphone, Cpu, Hash, Tag, Layers, Terminal, Radio,
  Link2, HardDrive, Monitor, X, Usb,
  Settings2, Signal, CheckCheck, Clock,
  UserCheck, RefreshCw, Key, Send, ShieldCheck
} from 'lucide-react';

const HS01_BANNER_START = '========== HS01 CONFIGURATION ==========';
const HS01_BANNER_END   = '========================================';

// Stages: 0=Connect  1=Serial-Number  2=MQTT  3=Monitor  4=Register  5=Done
const STAGES = [
  { key: 'connect',  label: 'Connect',       icon: Usb,          desc: 'Read device info via serial'  },
  { key: 'serial',   label: 'Serial No.',    icon: Hash,         desc: 'Assign serial number to device' },
  { key: 'mqtt',     label: 'Configure',     icon: Settings2,    desc: 'Send MQTT credentials'         },
  { key: 'wait',     label: 'Monitor',       icon: Signal,       desc: 'Wait for telemetry data'       },
  { key: 'register', label: 'Register',      icon: UserCheck,    desc: 'Save device to system'         },
  { key: 'done',     label: 'Done',          icon: CheckCircle2, desc: 'Setup complete'                },
];

function getWeekNumber(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

/** Build YYYYWWNNNN serial from parts */
function buildSerial(year, week, counter) {
  return `${year}${String(week).padStart(2, '0')}${String(counter).padStart(4, '0')}`;
}

const DeviceAddPage = () => {
  const { registerDevice } = useDb();
  const navigate = useNavigate();

  const [stage, setStage] = useState(0);
  const [error, setError] = useState('');

  // ── Serial port refs ──────────────────────────────────────────────────────
  const [port, setPort] = useState(null);
  const [reader, setReader] = useState(null);
  const [writer, setWriter] = useState(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialBusy, setSerialBusy] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const serialNumberRef = useRef('');
  const readLoopPromiseRef = useRef(null);

  // ── Serial-number step state ───────────────────────────────────────────────
  const [snLoading, setSnLoading]         = useState(false);
  const [snGenerated, setSnGenerated]     = useState('');   // computed SN
  const [snSent, setSnSent]               = useState(false);
  const [snWaiting, setSnWaiting]         = useState(false); // device asked for SN
  const [snConfirmed, setSnConfirmed]     = useState(false); // device ACK'd SN
  const snWaitingRef = useRef(false);  // ref mirror so readLoop can see it

  // ── Log state ─────────────────────────────────────────────────────────────
  const [serialLog, setSerialLog] = useState([]);
  const serialLogRef = useRef([]);
  const serialScrollRef = useRef(null);
  const [mqttLog, setMqttLog] = useState([]);
  const mqttLogRef = useRef([]);
  const mqttScrollRef = useRef(null);

  // ── MQTT config state ─────────────────────────────────────────────────────
  const [mqttUrl, setMqttUrl]                 = useState('');
  const [mqttId, setMqttId]                   = useState('');
  const [mqttKey, setMqttKey]                 = useState('');
  const [mqttUrlSent, setMqttUrlSent]         = useState(false);
  const [mqttUrlConfirmed, setMqttUrlConfirmed] = useState(false);
  const [mqttIdSent, setMqttIdSent]           = useState(false);
  const [mqttIdConfirmed, setMqttIdConfirmed] = useState(false);
  const [mqttKeySent, setMqttKeySent]         = useState(false);
  const [mqttKeyConfirmed, setMqttKeyConfirmed] = useState(false);
  const [mqttConfigComplete, setMqttConfigComplete] = useState(false);

  // ── MQTT monitor state ────────────────────────────────────────────────────
  const [mqttClient, setMqttClient]         = useState(null);
  const [mqttConnected, setMqttConnected]   = useState(false);
  const [mqttDataReceived, setMqttDataReceived] = useState(false);
  const [autoScroll, setAutoScroll]         = useState(true);
  const [registering, setRegistering]       = useState(false);
  const [registered, setRegistered]         = useState(false);
  const mqttClientRef = useRef(null);
  const provisioningDeviceIdRef = useRef('');
  const mqttDataReceivedRef = useRef(false);
  const autoMqttRef = useRef(false);

  const handleDownloadLog = useCallback(() => {
    const text = serialLogRef.current.map(e => `[${e.ts}] ${e.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const addSerialLog = useCallback((text, type = 'info') => {
    const entry = { text, type, ts: new Date().toLocaleTimeString() };
    serialLogRef.current = [...serialLogRef.current, entry].slice(-500);
    setSerialLog([...serialLogRef.current]);
  }, []);

  const addMqttLog = useCallback((text, type = 'info') => {
    const entry = { text, type, ts: new Date().toLocaleTimeString() };
    mqttLogRef.current = [...mqttLogRef.current, entry].slice(-200);
    setMqttLog([...mqttLogRef.current]);
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = serialScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [serialLog, autoScroll]);

  useEffect(() => {
    const el = mqttScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mqttLog]);

  const parseHs01Banner = useCallback((text) => {
    const info = {};
    for (const line of text.split('\n')) {
      const t = line.trim();
      if      (t.startsWith('Device ID:')) info.device_id = t.substring(10).trim();
      else if (t.startsWith('Name:'))       info.name      = t.substring(5).trim();
      else if (t.startsWith('MAC:'))        info.mac       = t.substring(4).trim();
      else if (t.startsWith('model:'))      info.model     = t.substring(6).trim();
      else if (t.startsWith('Firmware:'))   info.firmware  = t.substring(9).trim();
      else if (t.startsWith('IMEI')) {
        const v = t.includes(':') ? t.substring(t.indexOf(':') + 1).trim() : '';
        if (v) info.imei = v;
      }
    }
    return Object.keys(info).length > 0 ? info : null;
  }, []);

  // ── Fetch next serial number from backend ──────────────────────────────────
  const fetchNextSerial = useCallback(async () => {
    setSnLoading(true);
    try {
      const res = await fetch('/api/config/next-serial');
      const data = await res.json();
      if (data.success) {
        setSnGenerated(data.serial);
        serialNumberRef.current = data.serial;
        addSerialLog(`Generated serial number: ${data.serial} (Year ${data.year}, Week ${data.week}, #${data.counter})`, 'success');
        return data.serial;
      }
      throw new Error(data.error || 'Failed to generate serial');
    } catch (err) {
      // Fallback: generate locally
      const now = new Date();
      const fallback = buildSerial(now.getFullYear(), getWeekNumber(now), Math.floor(Math.random() * 9999) + 1);
      setSnGenerated(fallback);
      serialNumberRef.current = fallback;
      addSerialLog(`Serial generated locally (offline): ${fallback}`, 'warning');
      return fallback;
    } finally {
      setSnLoading(false);
    }
  }, [addSerialLog]);

  // ── Send SN to device when it asks ────────────────────────────────────────
  const sendSnToDevice = useCallback(async (sn, writerRef) => {
    try {
      const encoded = new TextEncoder().encode(sn + '\r\n');
      await writerRef.current.write(encoded);
      addSerialLog(`> ${sn}  (serial number sent)`, 'sent');
      setSnSent(true);
    } catch (err) {
      addSerialLog(`Failed to send SN: ${err.message}`, 'error');
    }
  }, [addSerialLog]);

  // ── Connect serial port ───────────────────────────────────────────────────
  const handleConnectSerial = useCallback(async () => {
    try {
      setError('');
      setSerialBusy(true);
      if (!navigator.serial) { setError('Web Serial API not supported. Use Chrome/Edge.'); setSerialBusy(false); return; }

      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });

      const rdr = selectedPort.readable.getReader();
      const wtr = selectedPort.writable.getWriter();
      const portRef   = { current: selectedPort };
      const readerRef = { current: rdr };
      const writerRef = { current: wtr };

      setPort(portRef);
      setReader(readerRef);
      setWriter(writerRef);
      setSerialConnected(true);

      let pinfo;
      try { pinfo = selectedPort.getInfo(); } catch {}
      addSerialLog(`Serial port opened at 115200 baud${pinfo ? ` (VID:0x${pinfo.usbVendorId?.toString(16).padStart(4,'0')} PID:0x${pinfo.usbProductId?.toString(16).padStart(4,'0')})` : ''}`, 'success');

      const decoder = new TextDecoder();
      let lineBuf = '';
      let inBanner = false, bannerFound = false;
      let bannerLines = [];

      const readLoop = async () => {
        try {
          while (selectedPort.readable) {
            let chunk;
            try { chunk = await rdr.read(); } catch { break; }
            const { value, done } = chunk;
            if (done) { addSerialLog('Serial port disconnected', 'warning'); setSerialConnected(false); break; }

            lineBuf += decoder.decode(value, { stream: true });

            let nl;
            while ((nl = lineBuf.indexOf('\n')) >= 0) {
              const rawLine = lineBuf.substring(0, nl).replace(/\r/g, '');
              lineBuf = lineBuf.substring(nl + 1);
              const line = rawLine.trim();

              if (rawLine) addSerialLog(rawLine, 'serial');
              if (!line) continue;

              // ── Banner detection ──────────────────────────────────────────
              if (!bannerFound && !inBanner && line.includes(HS01_BANNER_START)) {
                inBanner = true; bannerLines = [];
                addSerialLog('HS01 Configuration Banner Detected', 'success');
                continue;
              }
              if (inBanner) {
                if (line.includes(HS01_BANNER_END)) {
                  inBanner = false; bannerFound = true;
                  const content = bannerLines.join('\n');
                  const parsed = parseHs01Banner(content);
                  if (parsed) {
                    provisioningDeviceIdRef.current = parsed.device_id || '';
                    setDeviceInfo(parsed);
                    addSerialLog('Device info extracted — proceeding to serial number step', 'success');
                    setTimeout(() => setStage(1), 600);
                  } else {
                    addSerialLog(`Failed to parse banner:\n${content}`, 'error');
                  }
                } else {
                  bannerLines.push(rawLine);
                }
                continue;
              }

              // ── Serial Number step: device asks for SN ────────────────────
              if (line.toLowerCase().includes('waiting for sn') ||
                  line.includes('10-digit') || line.includes('SN:')) {
                addSerialLog('Device is waiting for serial number!', 'success');
                setSnWaiting(true);
                snWaitingRef.current = true;
                // Auto-send if we already have the SN ready
                if (serialNumberRef.current && writerRef.current) {
                  await sendSnToDevice(serialNumberRef.current, writerRef);
                }
                continue;
              }

              // ── SN acknowledged by device ─────────────────────────────────
              if (line.toLowerCase().includes('sn received') ||
                  line.toLowerCase().includes('serial stored') ||
                  line.toLowerCase().includes('sn saved') ||
                  line.toLowerCase().includes('serial number saved') ||
                  line.toLowerCase().includes('[hs01] sn:')) {
                addSerialLog('Serial number confirmed by device ✓', 'success');
                setSnConfirmed(true);
                setTimeout(() => { setStage(2); addSerialLog('Proceeding to MQTT configuration', 'info'); }, 800);
                continue;
              }

              // ── MQTT config protocol ──────────────────────────────────────
              if (line.includes('[HS01] MQTT URL received:'))          { setMqttUrlConfirmed(true); addSerialLog('URL confirmed', 'success'); continue; }
              if (line.includes('[HS01] MQTT ID received:'))           { setMqttIdConfirmed(true); addSerialLog('MQTT ID confirmed', 'success'); continue; }
              if (line.includes('[HS01] MQTT KEY received'))           { setMqttKeyConfirmed(true); addSerialLog('MQTT KEY confirmed', 'success'); continue; }
              if (line.includes('[HS01] MQTT URL / ID / KEY stored')) {
                setMqttConfigComplete(true);
                addSerialLog('MQTT configuration saved to device', 'success');
                setTimeout(() => { setStage(3); addSerialLog('Waiting for device telemetry...', 'info'); }, 1000);
                continue;
              }
              if (line.includes('[HS01] Invalid MQTT configuration')) {
                addSerialLog('Invalid config — re-enter credentials', 'error');
                setMqttUrlSent(false); setMqttUrlConfirmed(false);
                setMqttIdSent(false);  setMqttIdConfirmed(false);
                setMqttKeySent(false); setMqttKeyConfirmed(false);
                setMqttConfigComplete(false);
                continue;
              }
              if (line.includes('[HS01] Soft reset now')) { addSerialLog('Device restarting...', 'warning'); continue; }
            }
          }
        } catch { addSerialLog('Serial read error', 'error'); }
        finally { try { rdr.releaseLock(); } catch {} }
      };

      readLoopPromiseRef.current = readLoop();
      setSerialBusy(false);
    } catch (err) {
      setError(err.message || 'Serial connection failed');
      setSerialBusy(false);
    }
  }, [addSerialLog, parseHs01Banner, sendSnToDevice]);

  // ── When entering stage 1, fetch the serial number ────────────────────────
  useEffect(() => {
    if (stage !== 1 || snGenerated) return;
    fetchNextSerial();
  }, [stage, snGenerated, fetchNextSerial]);

  // ── Manual "Send SN" button ───────────────────────────────────────────────
  const handleSendSN = useCallback(async () => {
    if (!writer?.current || !snGenerated) return;
    await sendSnToDevice(snGenerated, writer);
  }, [writer, snGenerated, sendSnToDevice]);

  // ── Skip SN step (if device doesn't ask / already has SN) ────────────────
  const handleSkipSN = useCallback(() => {
    if (!snGenerated) {
      addSerialLog('Serial number not yet generated — wait a moment', 'warning');
      return;
    }
    // Store the SN so it gets saved at registration time even if device skipped
    serialNumberRef.current = snGenerated;
    setSnConfirmed(true);
    addSerialLog(`Serial number ${snGenerated} will be saved at registration (device skipped SN step)`, 'info');
    setTimeout(() => { setStage(2); }, 500);
  }, [snGenerated, addSerialLog]);

  const sendViaWriter = useCallback(async (text) => {
    if (!writer?.current) return false;
    try {
      await writer.current.write(new TextEncoder().encode(text + '\r\n'));
      addSerialLog(`> ${text}`, 'sent');
      return true;
    } catch { return false; }
  }, [writer, addSerialLog]);

  // ── Auto-send MQTT credentials once in stage 2 ───────────────────────────
  useEffect(() => {
    if (stage !== 2 || !deviceInfo || mqttUrlSent) return;
    if (autoMqttRef.current) return;
    autoMqttRef.current = true;
    (async () => {
      let url = window.location.hostname;
      try { const cfg = await (await fetch('/api/config')).json(); if (cfg.mqttHost) url = cfg.mqttHost; } catch {}
      setMqttUrl(url);
      setMqttId(deviceInfo.device_id);
      setMqttKey(Array.from({ length: 16 }, () => Math.random().toString(36)[2]).join(''));
      addMqttLog('Auto-generated MQTT credentials', 'info');
      if (writer?.current && await sendViaWriter(url)) setMqttUrlSent(true);
      else setTimeout(() => { autoMqttRef.current = false; }, 500);
    })();
  }, [stage, deviceInfo, writer, sendViaWriter, addMqttLog, mqttUrlSent]);

  useEffect(() => {
    if (mqttUrlSent && mqttId && !mqttIdSent && writer?.current) {
      const timer = setTimeout(() => {
        sendViaWriter(mqttId).then(ok => ok && setMqttIdSent(true));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mqttUrlSent, mqttId, mqttIdSent, writer, sendViaWriter]);

  useEffect(() => {
    if (mqttIdSent && mqttKey && !mqttKeySent && writer?.current) {
      const timer = setTimeout(() => {
        sendViaWriter(mqttKey).then(ok => ok && setMqttKeySent(true));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mqttIdSent, mqttKey, mqttKeySent, writer, sendViaWriter]);

  const handleSerialReset = useCallback(async () => {
    if (await sendViaWriter('clrnvs')) addSerialLog('Reset command sent (clrnvs)', 'sent');
  }, [sendViaWriter, addSerialLog]);

  const handleDisconnect = useCallback(async () => {
    if (reader?.current)              { try { await reader.current.cancel(); } catch {} reader.current = null; }
    if (readLoopPromiseRef.current)   { try { await readLoopPromiseRef.current; } catch {} readLoopPromiseRef.current = null; }
    if (writer?.current)              { try { await writer.current.close(); } catch {} writer.current = null; }
    if (port?.current)                { try { await port.current.close(); } catch {} port.current = null; }
    setSerialConnected(false);
    addSerialLog('Serial disconnected', 'warning');
  }, [port, reader, writer, addSerialLog]);

  // ── MQTT Monitor ──────────────────────────────────────────────────────────
  const startMqttMonitor = useCallback(async () => {
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${proto}//${window.location.host}/mqtt`;
      try { const cfg = await (await fetch('/api/config')).json(); if (cfg.mqttWsUrl) wsUrl = cfg.mqttWsUrl; } catch {}
      const mqtt = await import('mqtt');
      const client = mqtt.default.connect(wsUrl, { clean: true, connectTimeout: 10000 });
      mqttClientRef.current = client;

      client.on('connect', () => {
        addMqttLog('Connected to MQTT broker', 'success');
        setMqttConnected(true);
        client.subscribe('devices/#');
        client.subscribe('enthutech/#');
        addMqttLog('Subscribed to device topics', 'info');
      });

      client.on('message', (topic, msg) => {
        const payload = msg.toString();
        let parsed = null;
        try { parsed = JSON.parse(payload); addMqttLog(`[${topic}] ${JSON.stringify(parsed, null, 2)}`, 'mqtt'); }
        catch { addMqttLog(`[${topic}] ${payload}`, 'mqtt'); }

        const currentExpectedId = provisioningDeviceIdRef.current;
        const incomingId = parsed ? String(parsed['Device-ID'] || '') : '';
        
        let fromThisDevice = false;
        if (currentExpectedId && (
          topic.toLowerCase().includes(currentExpectedId.toLowerCase()) ||
          (incomingId && incomingId === currentExpectedId)
        )) {
          fromThisDevice = true;
        } else if (incomingId && (topic.includes('devices/') || topic.includes('enthutech/'))) {
          // If we receive telemetry from ANY device during provisioning and it doesn't match the auto-generated ID,
          // assume this is the device we are provisioning and update the expected ID to match the real hardware ID.
          fromThisDevice = true;
          provisioningDeviceIdRef.current = incomingId;
          setDeviceInfo(prev => prev ? { ...prev, device_id: incomingId } : null);
          addMqttLog(`Updated device ID to match hardware: ${incomingId}`, 'info');
        }

        if (fromThisDevice && !mqttDataReceivedRef.current) {
          mqttDataReceivedRef.current = true;
          setMqttDataReceived(true);
          addMqttLog('Device telemetry received — ready to register!', 'success');
          setStage(s => (s < 4 ? 4 : s));
        }
      });

      client.on('error', err => addMqttLog(`MQTT error: ${err.message}`, 'error'));
      client.on('close', () => { addMqttLog('MQTT disconnected', 'warning'); setMqttConnected(false); });
      setMqttClient(client);
    } catch (err) { addMqttLog(`Failed: ${err.message}`, 'error'); }
  }, [addMqttLog]);

  useEffect(() => { if (stage === 3 && !mqttClient) startMqttMonitor(); }, [stage, mqttClient, startMqttMonitor]);

  // ── Register device ───────────────────────────────────────────────────────
  const handleRegisterDevice = useCallback(async () => {
    if (!deviceInfo) return;
    setRegistering(true); setError('');
    try {
      await registerDevice({
        device_id:        deviceInfo.device_id,
        model:            deviceInfo.model || 'HS01',
        imei:             deviceInfo.imei || '',
        mac_address:      deviceInfo.mac || '',
        firmware_version: deviceInfo.firmware || '',
        serial_number:    serialNumberRef.current || snGenerated,
        mqtt_id:          mqttId,
        mqtt_key:         mqttKey,
        mqtt_url:         mqttUrl,
      });
      addSerialLog('Device registered successfully!', 'success');
      addMqttLog('Device registered in system', 'success');
      setRegistered(true);
      setStage(5);
    } catch (err) {
      setError(err.message);
      addSerialLog(`Registration failed: ${err.message}`, 'error');
    } finally { setRegistering(false); }
  }, [deviceInfo, registerDevice, addSerialLog, addMqttLog, snGenerated, mqttId, mqttKey, mqttUrl]);

  useEffect(() => {
    return () => {
      try { mqttClientRef.current?.end(true); } catch {}
      (async () => {
        if (reader?.current) { try { await reader.current.cancel(); } catch {} }
        if (readLoopPromiseRef.current) { try { await readLoopPromiseRef.current; } catch {} }
        if (writer?.current) { try { await writer.current.close(); } catch {} }
        if (port?.current)   { try { await port.current.close(); }   catch {} }
      })();
    };
  }, [port, reader, writer]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER HELPERS
  ═══════════════════════════════════════════════════════════════ */

  const renderStageBar = () => (
    <div className="flex items-center gap-3">
      {STAGES.map((s, i) => {
        const Ic = s.icon;
        const active = i === stage;
        const done   = i < stage;
        return (
          <div key={s.key} className="flex items-center gap-3 flex-1">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              active ? 'bg-blue-600 text-white shadow-md shadow-blue-200' :
              done   ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                       'bg-slate-50 text-slate-400 border border-slate-200'
            }`}>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center ${
                active ? 'bg-white/20' : done ? 'bg-emerald-500' : 'bg-slate-200'
              }`}>
                {done ? <CheckCircle2 className="h-3 w-3 text-white" /> : <Ic className="h-3 w-3" />}
              </div>
              <span className="hidden sm:inline whitespace-nowrap">{s.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const FORM_FIELDS = [
    { key: 'device_id', label: 'Device ID',    icon: Tag,       mono: true  },
    { key: 'name',      label: 'Name',         icon: Smartphone, mono: false },
    { key: 'mac',       label: 'MAC Address',  icon: Link2,     mono: true  },
    { key: 'imei',      label: 'IMEI',         icon: Cpu,       mono: true  },
    { key: 'model',     label: 'Model',        icon: Layers,    mono: false },
    { key: 'firmware',  label: 'Firmware',     icon: Monitor,   mono: false },
  ];

  const renderDeviceForm = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center"><Usb className="h-3.5 w-3.5 text-blue-600" /></div>
          <div><p className="text-xs font-bold text-slate-800">Device Information</p><p className="text-[10px] text-slate-400">Auto-detected from serial connection</p></div>
        </div>
        {!serialConnected ? (
          <button onClick={handleConnectSerial} disabled={serialBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
            {serialBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Usb className="h-3.5 w-3.5" />}
            {serialBusy ? 'Connecting...' : 'Connect Device'}
          </button>
        ) : (
          <button onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-all">
            <PlugZap className="h-3.5 w-3.5" /> Disconnect
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {serialConnected && deviceInfo && (
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold mb-1">
            <CheckCircle2 className="h-3 w-3" /> Device detected — fields populated
          </div>
        )}
        {FORM_FIELDS.map(f => {
          const Ic = f.icon;
          const val = deviceInfo?.[f.key] || '';
          return (
            <div key={f.key} className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1"><Ic className="h-3 w-3 text-blue-400" /> {f.label}</label>
              <input type="text" value={val} readOnly disabled
                className={`w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 ${f.mono ? 'font-mono' : ''}`}
                placeholder={serialConnected ? 'Waiting for device data...' : 'Connect a device to auto-fill'} />
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Serial Number Panel (stage 1) ─────────────────────────────────────────
  const renderSerialNumberPanel = () => {
    if (stage < 1 || stage > 2) return null;
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center"><Hash className="h-3.5 w-3.5 text-indigo-600" /></div>
            <div><p className="text-xs font-bold text-slate-800">Serial Number Assignment</p><p className="text-[10px] text-slate-400">Format: YYYY + Week + Counter (10 digits)</p></div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${snConfirmed ? 'bg-emerald-50 text-emerald-700' : snSent ? 'bg-blue-50 text-blue-700' : snWaiting ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${snConfirmed ? 'bg-emerald-500' : snSent ? 'bg-blue-500 animate-pulse' : snWaiting ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'}`} />
            {snConfirmed ? 'Confirmed' : snSent ? 'Sent' : snWaiting ? 'Device Ready' : 'Generating'}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Generated SN display */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
              <Hash className="h-3 w-3 text-indigo-400" /> Generated Serial Number
            </label>
            <div className="flex items-center gap-2">
              {snLoading ? (
                <div className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                  <span className="text-xs text-slate-400">Generating...</span>
                </div>
              ) : (
                <div className={`w-full px-3 py-2.5 rounded-lg border font-mono text-sm font-bold tracking-wider text-center ${
                  snConfirmed ? 'border-emerald-300 bg-emerald-50 text-emerald-800' :
                  snSent      ? 'border-blue-300 bg-blue-50 text-blue-800' :
                                'border-indigo-200 bg-indigo-50 text-indigo-800'
                }`}>
                  {snGenerated || '—'}
                </div>
              )}
              <button onClick={fetchNextSerial} disabled={snLoading || snSent}
                className="btn-ghost border border-slate-200 px-2 flex-shrink-0 disabled:opacity-40" title="Re-generate">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {snGenerated && (
              <p className="text-[10px] text-slate-400 mt-1">
                Year: <strong>{snGenerated.slice(0, 4)}</strong> · Week: <strong>{snGenerated.slice(4, 6)}</strong> · Counter: <strong>{snGenerated.slice(6)}</strong>
              </p>
            )}
          </div>

          {/* Status messages */}
          {!snWaiting && !snSent && !snConfirmed && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <p className="text-[11px] text-amber-700 font-medium">
                Waiting for device to request serial number via serial port…<br/>
                <span className="text-amber-500">The device will print: <code className="font-mono bg-amber-100 px-1 rounded">Waiting for SN 10-digit number ...</code></span>
              </p>
            </div>
          )}

          {snWaiting && !snSent && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
              <Signal className="h-3.5 w-3.5 text-blue-500 animate-pulse flex-shrink-0" />
              <p className="text-[11px] text-blue-700 font-semibold">Device is ready — sending serial number…</p>
            </div>
          )}

          {snSent && !snConfirmed && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
              <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin flex-shrink-0" />
              <p className="text-[11px] text-blue-700 font-semibold">Sent — waiting for device ACK…</p>
            </div>
          )}

          {snConfirmed && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
              <CheckCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <p className="text-[11px] text-emerald-700 font-semibold">Serial number saved to device ✓</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSendSN}
              disabled={!snGenerated || snSent || snLoading || !serialConnected}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5" />
              {snSent ? 'SN Sent' : 'Send SN to Device'}
            </button>
            <button
              onClick={handleSkipSN}
              disabled={!snGenerated || snConfirmed}
              className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Skip if device doesn't support SN prompt"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMqttConfig = () => {
    if (stage < 2 || stage > 4) return null;
    const rows = [
      { label: 'MQTT Broker Host', value: mqttUrl, sent: mqttUrlSent, confirmed: mqttUrlConfirmed, icon: Link2 },
      { label: 'MQTT Device ID',  value: mqttId,  sent: mqttIdSent,  confirmed: mqttIdConfirmed,  icon: Hash },
      { label: 'MQTT API Key',    value: mqttKey, sent: mqttKeySent, confirmed: mqttKeyConfirmed,  icon: Key  },
    ];
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center"><Settings2 className="h-3.5 w-3.5 text-blue-600" /></div>
            <div><p className="text-xs font-bold text-slate-800">MQTT Configuration</p><p className="text-[10px] text-slate-400">Auto-sending credentials to device</p></div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${mqttConfigComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${mqttConfigComplete ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
            {mqttConfigComplete ? 'Complete' : 'In Progress'}
          </div>
        </div>
        <div className="p-4 space-y-3">
          {rows.map(r => {
            const Ic = r.icon;
            return (
              <div key={r.label} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Ic className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-slate-400">{r.label}</p>
                    <p className={`text-xs text-slate-700 truncate ${r.confirmed ? 'font-semibold' : ''}`}>{r.value || '—'}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-2">
                  {!r.sent ? <span className="text-[10px] text-slate-400">Queued</span>
                    : r.confirmed ? <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold"><CheckCircle2 className="h-3 w-3" />ACK</span>
                    : <span className="flex items-center gap-1 text-[10px] text-amber-500"><Loader2 className="h-3 w-3 animate-spin" />Waiting</span>
                  }
                </div>
              </div>
            );
          })}
          {mqttConfigComplete && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 mt-1">
              <CheckCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">All credentials saved to device NVS</span>
            </div>
          )}
          
          {/* Skip Button for devices that do not send ACKs over serial */}
          {!mqttConfigComplete && (
            <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setMqttConfigComplete(true);
                  setTimeout(() => { setStage(s => s < 3 ? 3 : s); }, 500);
                  addSerialLog('Skipped waiting for device MQTT configuration ACK.', 'warning');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 transition-all"
                title="Skip if device doesn't acknowledge via serial or is already configured"
              >
                Skip / Proceed to Monitor
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMqttMonitor = () => {
    if (stage < 3) return null;
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center"><Signal className="h-3.5 w-3.5 text-purple-600" /></div>
            <div><p className="text-xs font-bold text-slate-800">MQTT Monitor</p><p className="text-[10px] text-slate-400">Waiting for device telemetry</p></div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${mqttConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${mqttConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            {mqttConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="p-4 space-y-3">
          {!mqttConnected && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting to broker...</div>}
          {mqttConnected && !mqttDataReceived && <div className="flex items-center gap-2 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" />Listening for device telemetry on MQTT topics...</div>}
          {mqttDataReceived && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-200 font-semibold">
              <CheckCircle2 className="h-4 w-4" />Device data received via MQTT — ready to register
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRegisterButton = () => {
    if (stage < 4) return null;
    return (
      <div className="pt-1 space-y-2">
        {/* Summary before registering */}
        {!registered && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Device Summary</p>
            {[
              { label: 'Device ID',     value: deviceInfo?.device_id },
              { label: 'Model',         value: deviceInfo?.model     },
              { label: 'Serial No.',    value: snGenerated, mono: true, highlight: true },
              { label: 'IMEI',          value: deviceInfo?.imei,     mono: true },
              { label: 'MAC',           value: deviceInfo?.mac,      mono: true },
              { label: 'MQTT ID',       value: mqttId,               mono: true },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="flex justify-between text-xs">
                <span className="text-slate-400">{r.label}</span>
                <span className={`${r.mono ? 'font-mono' : 'font-semibold'} ${r.highlight ? 'text-indigo-700 bg-indigo-50 px-1.5 rounded' : 'text-slate-700'}`}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={handleRegisterDevice} disabled={registering || registered}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg ${registered ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl'} disabled:opacity-60`}>
          {registering ? <Loader2 className="h-5 w-5 animate-spin" /> : registered ? <CheckCircle2 className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
          {registering ? 'Registering...' : registered ? 'Registered Successfully' : 'Register Device'}
        </button>
        {registered && (
          <div className="flex gap-2 mt-1">
            <button onClick={() => navigate('/admin/register-device')} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all">View All Devices</button>
            <button onClick={() => navigate('/admin/verify-device')}   className="flex-1 py-2.5 rounded-xl border border-blue-200 text-blue-600 text-xs font-bold hover:bg-blue-50 transition-all">Verify Device</button>
            <button onClick={() => {
              try { mqttClientRef.current?.end(true); } catch {}
              mqttClientRef.current = null; autoMqttRef.current = false;
              provisioningDeviceIdRef.current = ''; mqttDataReceivedRef.current = false;
              snWaitingRef.current = false;
              setStage(0); setDeviceInfo(null); setMqttClient(null); setMqttConnected(false);
              setRegistered(false); setMqttDataReceived(false); setMqttConfigComplete(false);
              setMqttUrl(''); setMqttUrlSent(false); setMqttUrlConfirmed(false);
              setMqttId(''); setMqttIdSent(false); setMqttIdConfirmed(false);
              setMqttKey(''); setMqttKeySent(false); setMqttKeyConfirmed(false);
              setSnGenerated(''); setSnSent(false); setSnWaiting(false); setSnConfirmed(false);
            }} className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition-all">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const LogViewer = ({ title, icon: Icon, iconColor, entries, emptyMsg, connected, height, onReset, showAutoScroll, autoScroll, onToggleScroll, onDownload, scrollRef, onClear }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2"><Icon className={`h-3.5 w-3.5 ${iconColor}`} /><span className="text-xs font-bold text-slate-700">{title}</span></div>
        <div className="flex items-center gap-2">
          {connected && onReset && (
            <button onClick={onReset} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
              <RefreshCw className="h-3 w-3" /> Reset
            </button>
          )}
          {showAutoScroll && (
            <button onClick={onToggleScroll} className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${autoScroll ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              Auto-scroll
            </button>
          )}
          {onDownload && (
            <button onClick={onDownload} className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              Download
            </button>
          )}
          {onClear && (
            <button onClick={onClear} className="text-slate-400 hover:text-slate-700 text-[10px] font-semibold">Clear</button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className={`${height || 'h-48'} overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-1 bg-slate-900 text-slate-200`}>
        {entries.length === 0 && <p className="text-slate-500 italic">{emptyMsg}</p>}
        {entries.map((e, i) => (
          <div key={i} className={`${
            e.type === 'success' ? 'text-emerald-400' :
            e.type === 'error'   ? 'text-red-400' :
            e.type === 'warning' ? 'text-amber-400' :
            e.type === 'sent'    ? 'text-blue-400 font-semibold' :
            e.type === 'mqtt'    ? 'text-purple-300' :
            e.type === 'serial'  ? 'text-slate-300' : 'text-slate-400'
          }`}>
            <span className="text-slate-500 mr-2 text-[10px]">[{e.ts}]</span>{e.text}
          </div>
        ))}
      </div>
    </div>
  );

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
                  Serial Provisioning Wizard
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline">
                  Hardware Serial Mode
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl display-font font-extrabold tracking-tight text-white drop-shadow-sm">
                Add &amp; Flash Security Unit
              </h1>
              <p className="text-xs font-medium text-slate-300 max-w-xl leading-relaxed">
                Provision a new HS01 security unit via serial connection — auto-assigns serial numbers &amp; MQTT configurations.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border backdrop-blur-md ${
                serialConnected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm' : 'bg-white/10 text-slate-300 border-white/10'
              }`}>
                <span className={`h-2 w-2 rounded-full ${serialConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                {serialConnected ? 'Serial Connected' : 'Serial Standby'}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3.5 text-xs font-medium">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><p>{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">{renderStageBar()}</div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {renderDeviceForm()}
            {renderSerialNumberPanel()}
            {renderMqttConfig()}
            {renderMqttMonitor()}
            {renderRegisterButton()}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <LogViewer title="Serial Monitor" icon={Terminal} iconColor="text-emerald-400"
              entries={serialLog} emptyMsg="Connect to a device to see serial output..."
              connected={serialConnected} height="h-80" scrollRef={serialScrollRef}
              onReset={handleSerialReset} showAutoScroll autoScroll={autoScroll}
              onToggleScroll={() => setAutoScroll(v => !v)}
              onDownload={handleDownloadLog}
              onClear={() => { serialLogRef.current = []; setSerialLog([]); }} />
            <LogViewer title="MQTT Data Log" icon={Radio} iconColor="text-purple-400"
              entries={mqttLog} emptyMsg="Waiting for MQTT data..."
              connected={mqttConnected} height="h-64" scrollRef={mqttScrollRef}
              onClear={() => { mqttLogRef.current = []; setMqttLog([]); }} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DeviceAddPage;
