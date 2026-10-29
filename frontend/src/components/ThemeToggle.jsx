import React from 'react';
import { Shield } from 'lucide-react';

const ThemeToggle = () => {
  return (
    <button
      className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700/80 transition-all duration-300 border border-slate-700 active:scale-90"
      aria-label="Premium Mode Locked"
      title="OLED Premium Mode"
    >
      <div className="relative h-5 w-5 transition-transform duration-500 ease-out transform hover:rotate-180">
        <Shield className="h-5 w-5 text-green-400 rotate-0 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
      </div>
    </button>
  );
};

export default ThemeToggle;
