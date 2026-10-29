import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDb } from '../context/DbContext';
import Layout from '../components/Layout';
import MotionChart from '../components/MotionChart';
import {
  Shield, ShieldAlert, Battery, BatteryCharging,
  Wifi, Zap, Activity, User, MapPin, Phone,
  Server, Fingerprint, Crosshair, Radar, ChevronRight, BarChart3
} from 'lucide-react';

/* ── Ultra-Premium Metric Card ─────────────────────────────────────────────── */
const MetricCard = ({ label, value, sub, icon: Icon, iconClass, warning, animate }) => (
  <div className={`relative overflow-hidden rounded-3xl p-7 transition-all duration-500 hover:-translate-y-2 group
    ${warning 
      ? 'border border-red-200 bg-red-50 shadow-[0_8px_30px_rgba(239,68,68,0.15)] ring-2 ring-red-500/20' 
      : 'border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300'
    }`}
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-50 to-transparent rounded-bl-full pointer-events-none opacity-50" />
    
    <div className="relative flex items-start justify-between gap-4 z-10">
      <div className="space-y-3">
        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${warning ? 'text-red-500' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-4xl display-font tracking-tight ${warning ? 'text-red-600 drop-shadow-sm' : 'text-slate-800'} ${animate ? 'animate-pulse' : ''}`}>{value}</p>
      </div>
      <div className={`p-4 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm ${iconClass}`}>
        <Icon className="h-7 w-7" />
      </div>
    </div>
    {sub && (
      <div className={`relative z-10 mt-6 pt-5 border-t ${warning ? 'border-red-200' : 'border-slate-100'}`}>
        <p className={`text-xs font-semibold flex items-center gap-2 ${warning ? 'text-red-600' : 'text-slate-500'}`}>
          {sub}
        </p>
      </div>
    )}
  </div>
);

const CustomerDashboard = () => {
  const { user } = useAuth();
  const { devices, logs, customers } = useDb();
  const { deviceId: adminDeviceId } = useParams();

  const [deviceInfo, setDeviceInfo] = useState(null);
  const [displayUser, setDisplayUser] = useState(null);
  const [latestLog, setLatestLog] = useState(null);
  const [deviceLogs, setDeviceLogs] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState('');
  const [simPlanActive, setSimPlanActive] = useState(true);

  const toggleProtection = async (currentlyArmed) => {
    if (!deviceInfo) return;
    setToggling(true);
    setToggleError('');
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          device_id: deviceInfo.device_id,
          command: currentlyArmed ? 'PRO00' : 'PRO01'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || 'Command failed');
    } catch (err) {
      setToggleError(err.message);
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    const targetDeviceId = adminDeviceId || user?.device_id;
    if (!targetDeviceId) return;
    
    const dev = devices.find(d => d.device_id === targetDeviceId);
    setDeviceInfo(dev);
    
    if (adminDeviceId) {
      const c = customers.find(c => c.device_id === targetDeviceId);
      setDisplayUser(c ? { name: c.customer_name, username: c.customer_number, photo: c.photo } : null);
    } else {
      setDisplayUser(user);
    }

    const devLogs = logs.filter(l => l.deviceId === targetDeviceId);
    setDeviceLogs(devLogs);
    if (devLogs.length > 0) setLatestLog(devLogs[devLogs.length - 1]);

    const checkSimPlan = async () => {
      try {
        const res = await fetch(`/api/ownership/${targetDeviceId}`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (data.success && data.ownership) {
          const { simPlanStartDate, simPlanEndDate } = data.ownership;
          if (!simPlanStartDate || !simPlanEndDate) {
            setSimPlanActive(false);
          } else {
            const now = new Date();
            const start = new Date(simPlanStartDate);
            start.setHours(0,0,0,0);
            const end = new Date(simPlanEndDate);
            end.setHours(23,59,59,999);
            setSimPlanActive(start <= now && now <= end);
          }
        } else {
          setSimPlanActive(false);
        }
      } catch {
        setSimPlanActive(false);
      }
    };
    checkSimPlan();
  }, [user, devices, logs, customers, adminDeviceId]);

  if (!displayUser || !deviceInfo) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Radar className="h-12 w-12 text-emerald-500 animate-spin mb-6" />
          <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Initializing Secure Protocol...</p>
        </div>
      </Layout>
    );
  }

  const battery  = latestLog?.battery ?? 95;
  const signal   = latestLog?.signal ?? 82;
  const motion   = latestLog?.motion_count ?? false;
  const powerCut = latestLog?.power < 4.0;
  const armed    = latestLog?.alert_active ?? true;
  const online   = deviceInfo.last_seen
    ? (Date.now() - new Date(deviceInfo.last_seen).getTime()) < 1800000
    : false;

  const signalLabel = signal > 75 ? 'Excellent' : signal > 50 ? 'Good' : signal > 30 ? 'Fair' : 'Weak';

  return (
    <Layout>
      <div className="space-y-10 animate-fade-in">
        {motion && online && (
          <div className="relative overflow-hidden flex items-center justify-between gap-6 rounded-3xl bg-red-50 border border-red-200 text-slate-800 p-6 md:p-8 shadow-[0_8px_30px_rgba(239,68,68,0.15)] animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-red-100 to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="p-4 bg-white rounded-2xl text-red-600 shadow-sm border border-red-100">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div>
                <h3 className="display-font text-2xl tracking-widest text-red-600 drop-shadow-sm font-bold">CRITICAL INTRUSION DETECTED</h3>
                <p className="text-sm font-semibold text-red-500 mt-2 tracking-wide uppercase">
                  Motion sensor triggered at {new Date(latestLog.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="hidden md:block relative z-10">
              <Crosshair className="h-12 w-12 text-red-300 animate-spin-slow" />
            </div>
          </div>
        )}

        {!simPlanActive && (
          <div className="relative overflow-hidden rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 p-6 md:p-8 shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-100/50 to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              <div className="p-4 bg-white rounded-2xl text-amber-600 shadow-sm border border-amber-100 flex-shrink-0">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div>
                <h3 className="display-font text-2xl tracking-widest font-bold">SIM PLAN INACTIVE</h3>
                <p className="text-sm font-medium mt-2 max-w-xl">
                  Your device's SIM plan is currently expired or inactive. Telemetry monitoring and remote commands are restricted until the plan is renewed. Please contact support.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 backdrop-blur-md">
                  <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {online ? 'System Synchronized' : 'System Standby'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline">
                  Node ID: {deviceInfo.device_id}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl display-font font-extrabold tracking-tight text-white drop-shadow-sm">
                Security Control Panel
              </h1>
              <p className="text-xs font-medium text-slate-300 max-w-xl leading-relaxed">
                Real-time perimeter monitoring, power grid telemetry, and intrusion alert status.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-3 text-white">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">Armed Mode</p>
                  <p className="text-lg font-bold font-mono">{armed ? 'PROTECTED' : 'STANDBY'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="relative overflow-hidden rounded-3xl p-7 border border-slate-200 bg-white shadow-sm flex flex-col justify-between group transition-all duration-500 hover:-translate-y-2 hover:shadow-md hover:border-slate-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-50 to-transparent rounded-bl-full pointer-events-none" />
            <div className="relative flex items-start justify-between gap-3 z-10">
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Protection Status</p>
                <p className={`text-4xl display-font tracking-tight ${armed ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {armed ? 'ARMED' : 'STANDBY'}
                </p>
              </div>
              <div className={`p-4 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 shadow-sm ${armed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                <Shield className="h-7 w-7" />
              </div>
            </div>
            
            {toggleError && <p className="text-[10px] font-bold text-red-500 pt-3">{toggleError}</p>}
            
            <div className="pt-6 mt-6 flex items-center justify-between border-t border-slate-100 relative z-10">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-slate-400" /> {toggling ? 'Authenticating...' : 'Toggle System'}
              </span>
              <button
                onClick={() => toggleProtection(armed)}
                disabled={!online || toggling || !simPlanActive}
                className={`relative flex h-9 w-16 items-center rounded-full p-1 transition-all duration-500 outline-none shadow-inner ${
                  !simPlanActive ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200' :
                  armed 
                    ? 'bg-emerald-100 border border-emerald-200 cursor-pointer' 
                    : 'bg-slate-100 border border-slate-200 cursor-pointer'
                }`}
              >
                <span className={`h-7 w-7 rounded-full transform transition-transform duration-500 flex items-center justify-center shadow-sm ${
                  armed 
                    ? 'translate-x-7 bg-emerald-500' 
                    : 'translate-x-0 bg-white border border-slate-200'
                }`}></span>
              </button>
            </div>
          </div>

          <MetricCard
            label="Power Source"
            value={`${battery}%`}
            sub={powerCut ? <><Zap className="w-4 h-4 text-red-600"/> Backup Battery Active</> : <><Zap className="w-4 h-4 text-emerald-600"/> Main AC Connected</>}
            icon={powerCut ? Battery : BatteryCharging}
            iconClass={battery > 20 ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-red-50 text-red-600 border border-red-100 animate-pulse'}
            warning={battery <= 20}
          />

          <MetricCard
            label="Uplink Signal"
            value={`${signal}%`}
            sub={<><Wifi className="w-4 h-4"/> Cell Tower: {signalLabel}</>}
            icon={Wifi}
            iconClass="bg-purple-50 text-purple-600 border border-purple-100"
          />

          <MetricCard
            label="Motion Array"
            value={motion && online ? 'ALERT' : 'CLEAR'}
            sub={motion && online ? 'Perimeter breached' : 'No movement detected'}
            icon={Activity}
            iconClass={motion && online ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-400 border border-slate-200'}
            warning={motion && online}
            animate={motion && online}
          />
        </div>

        {/* Full-Width Charts Section */}
        <div className="rounded-3xl bg-white border border-slate-200 p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50/50 to-transparent pointer-events-none" />
          <div className="mb-6 flex items-center justify-between gap-4 relative z-10 flex-wrap">
            <div>
              <h3 className="text-xl display-font tracking-wide text-slate-800 font-bold">Sensor Activity Telemetry</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">PIR detection & protection mode — full history, scrollable</p>
            </div>
            <Link
              to="/analytics"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              Open Analytics Studio
            </Link>
          </div>
          <div className="relative z-10">
            <MotionChart deviceLogs={deviceLogs} />
          </div>
        </div>

        {/* User Profile Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="sm:col-span-2 rounded-3xl bg-white border border-slate-200 p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-[80px] pointer-events-none" />
            
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-4 relative z-10 mb-6">Authorized User Profile</h3>

            <div className="flex items-center gap-5 relative z-10">
              <div className="h-20 w-20 rounded-2xl bg-slate-50 border border-slate-200 p-1 shadow-sm overflow-hidden flex items-center justify-center flex-shrink-0">
                  {displayUser.photo
                    ? <img src={displayUser.photo} alt={displayUser.name} className="h-full w-full object-cover rounded-xl" />
                    : <User className="h-8 w-8 text-slate-400" />
                  }
              </div>
              <div>
                <h4 className="display-font text-2xl text-slate-800 font-bold tracking-wide">{displayUser.name}</h4>
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-2 mt-2 tracking-widest uppercase">
                  <Phone className="h-3.5 w-3.5 text-emerald-500" /> {displayUser.username}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-[60px] pointer-events-none" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-3 relative z-10 mb-4">Deployment Zone</h3>
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500 border border-emerald-100">
                <MapPin className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-800 tracking-wide">{deviceInfo.location || 'Secure Facility Alpha'}</span>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-[60px] pointer-events-none" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-3 relative z-10 mb-4">Hardware Matrix</h3>
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-500 border border-blue-100">
                <Shield className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-800 tracking-wide">{deviceInfo.model}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 relative z-10">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 block mb-1">IMEI</span>
                <span className="text-[11px] font-mono font-bold text-slate-700">{deviceInfo.imei || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 block mb-1">MAC</span>
                <span className="text-[11px] font-mono font-bold text-slate-700">{deviceInfo.mac_address || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CustomerDashboard;
