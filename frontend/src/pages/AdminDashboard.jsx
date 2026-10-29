import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useDb } from '../context/DbContext';
import Layout from '../components/Layout';
import {
  Laptop, Users, ShieldCheck, Wifi, WifiOff,
  Activity, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, Server, ChevronDown, ChevronUp, MapPin, Phone, X, Zap, User, Search, ExternalLink, Download, Copy
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip,
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis
} from 'recharts';

/* ══════════════════════════════════════════════════
   KPI WIDGET
══════════════════════════════════════════════════ */
const COLORS = {
  blue:    { bar: 'bg-blue-500',    icon: 'bg-blue-50 text-blue-600 border border-blue-100',      val: 'text-slate-800'    },
  green:   { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600 border border-emerald-100', val: 'text-slate-800'   },
  red:     { bar: 'bg-red-500',     icon: 'bg-red-50 text-red-600 border border-red-100',        val: 'text-slate-800'     },
  amber:   { bar: 'bg-amber-500',   icon: 'bg-amber-50 text-amber-600 border border-amber-100',    val: 'text-slate-800'   },
  indigo:  { bar: 'bg-indigo-500',  icon: 'bg-indigo-50 text-indigo-600 border border-indigo-100',  val: 'text-slate-800'  },
  slate:   { bar: 'bg-slate-400',   icon: 'bg-slate-50 text-slate-500 border border-slate-200',       val: 'text-slate-700'   },
  purple:  { bar: 'bg-purple-500',  icon: 'bg-purple-50 text-purple-600 border border-purple-100',  val: 'text-slate-800'  },
  teal:    { bar: 'bg-teal-500',    icon: 'bg-teal-50 text-teal-600 border border-teal-100',      val: 'text-slate-800'    },
};

const KpiCard = ({ label, value, sub, icon: Icon, color, pulse, onClick, isActive }) => {
  const c = COLORS[color] || COLORS.blue;
  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 group cursor-pointer border ${isActive ? 'bg-white border-blue-200 shadow-[0_8px_30px_rgba(59,130,246,0.15)] ring-2 ring-blue-500/20' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-slate-300'}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 ${c.bar} ${isActive ? 'opacity-100' : 'opacity-80'}`} />
      <div className="flex items-start justify-between gap-3 mt-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 truncate">{label}</p>
          <p className={`text-3xl display-font tracking-tight leading-none ${c.val}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 ${c.icon} ${pulse ? 'animate-pulse' : ''} shadow-sm transition-transform group-hover:scale-110`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {sub && (
        <p className={`text-[11px] font-semibold mt-4 pt-4 border-t leading-relaxed transition-colors ${isActive ? 'text-blue-600 border-blue-100' : 'text-slate-500 border-slate-100'}`}>
          {sub}
        </p>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   DONUT CHART
══════════════════════════════════════════════════ */
const DONUT_COLORS = { Registered: '#10b981', Verified: '#3b82f6', Available: '#f59e0b' };

const StatusDonut = ({ devices }) => {
  const data = ['Registered', 'Verified', 'Available'].map(s => ({
    name: s, value: devices.filter(d => d.status === s).length
  })).filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.07) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
        className="text-xs font-bold drop-shadow-md">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl pointer-events-none" />
      <div className="mb-4 relative z-10">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Device Status Distribution</h3>
        <p className="text-xs font-medium text-slate-500 mt-1">{total} total units across all states</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={55} outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={renderLabel}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={DONUT_COLORS[entry.name]} />
              ))}
            </Pie>
            <RTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0];
                return (
                  <div className="bg-white rounded-xl p-3 shadow-xl border border-slate-200 text-xs">
                    <p className="font-bold mb-1" style={{ color: d.payload.fill }}>{d.name}</p>
                    <p className="text-slate-600 font-medium">{d.value} device{d.value !== 1 ? 's' : ''}</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="w-full space-y-2 mt-4 pt-4 border-t border-slate-100">
          {data.map(d => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: DONUT_COLORS[d.name] }} />
                <span className="text-slate-600 font-bold">{d.name}</span>
              </span>
              <span className="font-bold text-slate-800">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


/* ══════════════════════════════════════════════════
   MOTION BAR
══════════════════════════════════════════════════ */
const DEVICE_PALETTE = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ef4444','#14b8a6'];

const MotionBarChart = ({ devices, logs }) => {
  const data = devices
    .filter(d => (d.status === 'Registered' || d.status === 'Verified'))
    .map((dev, i) => ({
      device: dev.device_id,
      motions: logs.filter(l => l.deviceId === dev.device_id).reduce((s, l) => s + l.motion_count, 0),
      fill: DEVICE_PALETTE[i % DEVICE_PALETTE.length]
    }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={32}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="device" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
        <RTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-white rounded-xl p-3 shadow-xl border border-slate-200 text-xs">
                <p className="font-bold text-slate-800 mb-1">{label}</p>
                <p className="text-slate-500 font-medium">Motion events: <strong className="text-slate-900">{payload[0].value}</strong></p>
              </div>
            );
          }}
        />
        {data.map((d) => (
          <Bar key={d.device} dataKey="motions" fill={d.fill} radius={[4, 4, 0, 0]} name={d.device} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

/* ══════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════ */
const AdminDashboard = () => {
  const { devices, customers, logs } = useDb();
  const [activeListMode, setActiveListMode] = useState(null);

  const hasActiveSubscription = (deviceId) => {
    const customer = customers.find(c => c.deviceId === deviceId || c.device_id === deviceId);
    if (!customer) return false;
    if (!customer.simPlanStartDate || !customer.simPlanEndDate) return false;
    
    const now = new Date();
    const startDate = new Date(customer.simPlanStartDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(customer.simPlanEndDate);
    endDate.setHours(23, 59, 59, 999);
    
    return startDate <= now && now <= endDate;
  };

  const getCustomerInfo = (deviceId) => {
    const dev = devices.find(d => d.device_id === deviceId);
    const customer = customers.find(c => c.deviceId === deviceId || c.device_id === deviceId);
    
    const name = dev?.customer?.customer_name || customer?.customerName || customer?.customer_name || customer?.name || 'N/A';
    const phone = dev?.customer?.customer_number || customer?.customerNumber || customer?.customer_number || customer?.phone || 'N/A';

    return { name, phone };
  };

  const getLatestLog = (deviceId) => {
    const devLogs = logs.filter(l => l.deviceId === deviceId);
    return devLogs.length ? devLogs[devLogs.length - 1] : null;
  };

  const stats = useMemo(() => {
    const total      = devices.length;
    const registered = devices.filter(d => (d.status === 'Registered' || d.status === 'Verified'));

    const onlineList = registered.filter(d =>
      d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 1800000
    );
    const offlineList = registered.filter(d => 
      !d.last_seen || (Date.now() - new Date(d.last_seen).getTime()) >= 1800000
    );

    const protectionOnList = onlineList.filter(dev => {
      const devLogs = logs.filter(l => l.deviceId === dev.device_id);
      if (!devLogs.length) return false;
      return devLogs[devLogs.length - 1].alert_active;
    });

    const totalMotion = logs.reduce((s, l) => s + l.motion_count, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const motionToday = logs
      .filter(l => new Date(l.timestamp) >= today)
      .reduce((s, l) => s + l.motion_count, 0);

    const motionDevicesList = registered.filter(dev => {
      const devLogs = logs.filter(l => l.deviceId === dev.device_id && new Date(l.timestamp) >= today && l.motion_count > 0);
      return devLogs.length > 0;
    });

    const verified  = devices.filter(d => d.status === 'Verified').length;
    const available = devices.filter(d => d.status === 'Available').length;

    const onlineSub = onlineList.filter(d => hasActiveSubscription(d.device_id));
    const protectionSub = protectionOnList.filter(d => hasActiveSubscription(d.device_id));
    const offlineSub = offlineList.filter(d => hasActiveSubscription(d.device_id));

    return {
      total, 
      registered,
      onlineCount: onlineList.length, 
      offline: offlineList.length, 
      protectionOn: protectionOnList.length,
      totalMotion, motionToday, motionDevicesList,
      customersList: customers,
      verified, available,
      onlineSub, protectionSub, offlineSub
    };
  }, [devices, customers, logs]);

  const kpis = [
    {
      id: 'total',
      label: 'Total Devices',
      value: stats.total,
      sub:   `${stats.available} available · ${stats.verified} verified (Click to view)`,
      icon:  Laptop,      color: 'blue'
    },
    {
      id: 'online',
      label: 'Devices Online',
      value: stats.onlineCount,
      sub:   `Live telemetry · ${stats.onlineSub.length} w/ active sub (Click to view)`,
      icon:  Wifi,        color: 'green',
      pulse: stats.onlineCount > 0
    },
    {
      id: 'protection',
      label: 'Protection Mode',
      value: stats.protectionOn,
      sub:   `Armed systems · ${stats.protectionSub.length} w/ active sub (Click to view)`,
      icon:  ShieldCheck, color: 'indigo'
    },
    {
      id: 'motion',
      label: 'Motion Events',
      value: stats.motionToday,
      sub:   `${stats.motionDevicesList.length} devices detected motion today (Click to view)`,
      icon:  Activity,    color: 'amber'
    },
    {
      id: 'offline',
      label: 'Devices Offline',
      value: stats.offline,
      sub:   `${stats.offlineSub.length} offline devices w/ active sub (Click to view)`,
      icon:  WifiOff,     color: stats.offline > 0 ? 'red' : 'slate',
      pulse: stats.offline > 0
    }
  ];

  const [modalSearch, setModalSearch] = useState('');

  const downloadQR = (deviceId) => {
    const svg = document.getElementById(`qr-${deviceId}`);
    if (!svg) return;
    const svgStr = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 300;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 20, 20, 260, 260);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `QR_${deviceId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const renderActiveListModal = () => {
    if (!activeListMode) return null;
    
    let listTitle = '';
    let listSubtitle = '';
    let listData = [];
    let themeColor = { bg: 'bg-blue-600', lightBg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: Laptop };

    if (activeListMode === 'total') {
      listTitle = 'All Registered Devices';
      listSubtitle = 'Complete hardware inventory list & current status';
      listData = stats.registered;
      themeColor = { bg: 'bg-blue-600', lightBg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: Laptop };
    } else if (activeListMode === 'online') {
      listTitle = 'Online Devices';
      listSubtitle = 'Active live telemetry nodes with valid subscriptions';
      listData = stats.onlineSub;
      themeColor = { bg: 'bg-emerald-600', lightBg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: Wifi };
    } else if (activeListMode === 'protection') {
      listTitle = 'Protected Devices';
      listSubtitle = 'Active armed security systems under monitoring';
      listData = stats.protectionSub;
      themeColor = { bg: 'bg-indigo-600', lightBg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', icon: ShieldCheck };
    } else if (activeListMode === 'offline') {
      listTitle = 'Offline Devices';
      listSubtitle = 'Devices currently unlinked or out of signal range';
      listData = stats.offlineSub;
      themeColor = { bg: 'bg-red-600', lightBg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: WifiOff };
    } else if (activeListMode === 'motion') {
      listTitle = 'Motion Events Today';
      listSubtitle = 'Devices that registered perimeter motion triggers today';
      listData = stats.motionDevicesList;
      themeColor = { bg: 'bg-amber-600', lightBg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: Activity };
    }

    const CategoryIcon = themeColor.icon;

    // Filter by modal search query
    const filteredData = listData.filter(item => {
      const q = (modalSearch || '').toLowerCase();
      const cInfo = getCustomerInfo(item.device_id);
      return (
        (item.device_id || '').toLowerCase().includes(q) ||
        (cInfo.name || '').toLowerCase().includes(q) ||
        (cInfo.phone || '').includes(q)
      );
    });

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 lg:p-6 animate-fade-in">
        <div 
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity" 
          onClick={() => { setActiveListMode(null); setModalSearch(''); }} 
        />
        <div className="relative bg-white rounded-3xl shadow-[0_25px_70px_-15px_rgba(15,23,42,0.3)] border border-slate-200/80 w-full max-w-4xl max-h-[82vh] flex flex-col overflow-hidden animate-slide-up">
          
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-80 h-80 bg-slate-100 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex items-center gap-3">
               <div className={`p-3 rounded-2xl ${themeColor.lightBg} ${themeColor.text} border ${themeColor.border} shadow-sm flex-shrink-0`}>
                 <CategoryIcon className="h-5 w-5" />
               </div>
               <div>
                 <div className="flex items-center gap-2">
                   <h3 className="text-lg font-bold text-slate-900 display-font tracking-tight">{listTitle}</h3>
                   <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${themeColor.lightBg} ${themeColor.text} border ${themeColor.border}`}>
                     {listData.length} records
                   </span>
                 </div>
                 <p className="text-xs font-medium text-slate-500 mt-0.5">{listSubtitle}</p>
               </div>
            </div>

            <div className="flex items-center gap-3 relative z-10">
              {/* Search input inside modal */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter list..."
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  className="form-input text-xs pl-8 py-1.5 rounded-xl bg-white shadow-sm"
                />
                {modalSearch && (
                  <button onClick={() => setModalSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button 
                onClick={() => { setActiveListMode(null); setModalSearch(''); }} 
                className="p-2 rounded-full bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm text-slate-500 hover:text-red-500 flex-shrink-0"
              >
                 <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto max-h-[55vh] custom-scrollbar p-4 sm:p-5">
            {filteredData.length === 0 ? (
               <div className="py-12 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                 <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                   <AlertTriangle className="h-6 w-6 text-slate-300" />
                 </div>
                 <p className="font-bold text-slate-700">No records found</p>
                 <p className="text-xs text-slate-400 max-w-xs">No entries match your current category or search criteria.</p>
               </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-widest whitespace-nowrap">
                      {activeListMode === 'total' && (
                        <>
                          <th className="py-3 px-4 pl-5">Device ID</th>
                          <th className="py-3 px-4">User Name</th>
                          <th className="py-3 px-4">Phone Number</th>
                          <th className="py-3 px-4">Device Status</th>
                          <th className="py-3 px-4 pr-5 text-right">Actions</th>
                        </>
                      )}
                      {activeListMode === 'online' && (
                        <>
                          <th className="py-3 px-4 pl-5">Device ID</th>
                          <th className="py-3 px-4">User Name</th>
                          <th className="py-3 px-4">Power Cut Status</th>
                          <th className="py-3 px-4">Phone Number</th>
                          <th className="py-3 px-4 pr-5 text-right">Actions</th>
                        </>
                      )}
                      {activeListMode === 'protection' && (
                        <>
                          <th className="py-3 px-4 pl-5">Device ID</th>
                          <th className="py-3 px-4">User Name</th>
                          <th className="py-3 px-4">Phone Number</th>
                          <th className="py-3 px-4">Protection Status</th>
                          <th className="py-3 px-4 pr-5 text-right">Actions</th>
                        </>
                      )}
                      {activeListMode === 'motion' && (
                        <>
                          <th className="py-3 px-4 pl-5">Device ID</th>
                          <th className="py-3 px-4">User Name</th>
                          <th className="py-3 px-4">Phone Number</th>
                          <th className="py-3 px-4 pr-5 text-right">Actions</th>
                        </>
                      )}
                      {activeListMode === 'offline' && (
                        <>
                          <th className="py-3 px-4 pl-5">Device ID</th>
                          <th className="py-3 px-4">User Name</th>
                          <th className="py-3 px-4">Phone Number</th>
                          <th className="py-3 px-4">Last Seen</th>
                          <th className="py-3 px-4 pr-5 text-right">Actions</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((item, idx) => {
                      const cInfo = getCustomerInfo(item.device_id);
                      const latestLog = getLatestLog(item.device_id);
                      const powerStatus = latestLog ? (latestLog.battery < 20 ? 'Backup Battery' : 'AC Power') : 'Unknown';
                      const protectionStatus = latestLog?.alert_active ? 'Armed' : 'Disarmed';

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors whitespace-nowrap group">
                          {/* Common Device ID Cell */}
                          <td className="py-3 px-4 pl-5 text-xs font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                             <div className="flex items-center gap-2.5">
                               <div className="h-7 w-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-600 font-sans text-xs">
                                 <Server className="h-3.5 w-3.5 text-slate-500" />
                               </div>
                               {item.device_id}
                             </div>
                          </td>

                          {/* Common User Name Cell */}
                          <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                             <div className="flex items-center gap-2">
                               <div className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                 <User className="w-3 h-3 text-slate-500" />
                               </div>
                               <span>{cInfo.name}</span>
                             </div>
                          </td>

                          {/* Specific Cells based on Mode */}
                          {activeListMode === 'total' && (
                            <>
                              <td className="py-3 px-4 text-xs font-medium text-slate-600">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {cInfo.phone}
                                </span>
                              </td>
                              <td className="py-3 px-4 pr-5 text-xs">
                                 <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                   item.status === 'Verified' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                 }`}>
                                   {item.status}
                                 </span>
                              </td>
                            </>
                          )}

                          {activeListMode === 'online' && (
                            <>
                              <td className="py-3 px-4 text-xs font-medium">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-max ${
                                  powerStatus === 'AC Power' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                                }`}>
                                  <Zap className="w-3 h-3" />
                                  {powerStatus}
                                </span>
                              </td>
                              <td className="py-3 px-4 pr-5 text-xs font-medium text-slate-600">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {cInfo.phone}
                                </span>
                              </td>
                            </>
                          )}

                          {activeListMode === 'protection' && (
                            <>
                              <td className="py-3 px-4 text-xs font-medium text-slate-600">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {cInfo.phone}
                                </span>
                              </td>
                              <td className="py-3 px-4 pr-5 text-xs font-medium">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 w-max ${
                                  protectionStatus === 'Armed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  <ShieldCheck className="w-3 h-3" />
                                  {protectionStatus}
                                </span>
                              </td>
                            </>
                          )}

                          {activeListMode === 'motion' && (
                            <>
                              <td className="py-3 px-4 pr-5 text-xs font-medium text-slate-600">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {cInfo.phone}
                                </span>
                              </td>
                            </>
                          )}

                          {activeListMode === 'offline' && (
                            <>
                              <td className="py-3 px-4 text-xs font-medium text-slate-600">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {cInfo.phone}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-slate-500">
                                 {item.last_seen ? new Date(item.last_seen).toLocaleString() : 'Never'}
                              </td>
                            </>
                          )}
                          
                          {/* Common Actions Cell */}
                          <td className="py-3 px-4 pr-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden">
                                <QRCodeSVG id={`qr-${item.device_id}`} value={item.status === 'Verified' ? `${window.location.origin}/register/${item.device_id}` : `${window.location.origin}/portal`} size={200} level="H" includeMargin />
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); downloadQR(item.device_id); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100"
                                title={`Download QR for ${item.status === 'Verified' ? 'Registration' : 'Login'}`}
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.status === 'Verified' ? `${window.location.origin}/register/${item.device_id}` : `${window.location.origin}/portal`); alert('Customer link copied to clipboard!'); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
                                title="Copy Link to give to Customer"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <Link 
                                to={`/admin/dashboard/${item.device_id}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100"
                                title="Admin Only: Preview Dashboard"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 flex-shrink-0">
            <span>Showing {filteredData.length} of {listData.length} records</span>
            <button 
              onClick={() => { setActiveListMode(null); setModalSearch(''); }} 
              className="btn-secondary text-xs px-3.5 py-1.5"
            >
              Close Window
            </button>
          </div>

        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6 pb-4">
        {/* Top Welcome & Status Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  All Systems Operational
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline">
                  AT Induser Core v3.4
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl display-font font-extrabold tracking-tight text-white drop-shadow-sm">
                Admin Control Matrix
              </h1>
              <p className="text-xs font-medium text-slate-300 max-w-xl leading-relaxed">
                Real-time security telemetry, active node monitoring, and customer deployment overview.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-3 text-white">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">Live Grid</p>
                  <p className="text-lg font-bold font-mono">{stats.onlineCount} / {stats.registered.length} <span className="text-xs text-slate-400 font-sans">Active</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {kpis.map(k => (
            <KpiCard 
              key={k.id} 
              {...k} 
              isActive={activeListMode === k.id}
              onClick={() => setActiveListMode(activeListMode === k.id ? null : k.id)} 
            />
          ))}
        </div>

        {/* Modal Overlay for Active List */}
        {renderActiveListModal()}

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50/50 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 relative z-10">
              <div>
                <h3 className="text-sm font-bold text-slate-900 display-font tracking-wide">Motion Telemetry Array</h3>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5 uppercase tracking-widest">
                  Total motion triggers — {stats.totalMotion} events recorded
                </p>
              </div>
              <span className={`px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm ${stats.motionToday > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                <Activity className="h-3.5 w-3.5" />
                {stats.motionToday} Triggers Today
              </span>
            </div>

            {devices.filter(d => (d.status === 'Registered' || d.status === 'Verified')).length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-400 font-semibold text-xs relative z-10 uppercase tracking-widest">
                No registered devices with motion data
              </div>
            ) : (
              <div className="h-60 pt-2 relative z-10">
                <MotionBarChart devices={devices} logs={logs} />
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <StatusDonut devices={devices} />
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default AdminDashboard;
