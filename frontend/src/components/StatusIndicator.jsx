import React from 'react';
import { CheckCircle2, ShieldAlert, Clock, AlertTriangle, AlertCircle } from 'lucide-react';

const StatusIndicator = ({ status, pulse = false }) => {
  const configs = {
    Available: {
      bg: 'bg-[#1E293B] text-slate-300 border-[#475569]',
      label: 'Available',
      icon: Clock,
      dotColor: 'bg-slate-400',
      glow: ''
    },
    Verified: {
      bg: 'bg-blue-900/20 text-blue-400 border-blue-900/50',
      label: 'Verified',
      icon: CheckCircle2,
      dotColor: 'bg-blue-400',
      glow: 'shadow-[0_0_10px_rgba(96,165,250,0.2)]'
    },
    Registered: {
      bg: 'bg-green-900/20 text-green-400 border-green-900/50',
      label: 'Registered',
      icon: CheckCircle2,
      dotColor: 'bg-green-400',
      glow: 'shadow-[0_0_10px_rgba(74,222,128,0.2)] drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]'
    },
    Offline: {
      bg: 'bg-red-900/20 text-red-400 border-red-900/50',
      label: 'Offline',
      icon: ShieldAlert,
      dotColor: 'bg-red-500',
      glow: 'shadow-[0_0_10px_rgba(239,68,68,0.2)] drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]'
    }
  };

  const current = configs[status] || configs.Available;
  const Icon = current.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm transition-all duration-300 ${current.bg} ${current.glow}`}>
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dotColor}`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dotColor}`}></span>
      </span>
      <Icon className="h-3 w-3" />
      {current.label}
    </span>
  );
};

export default StatusIndicator;
