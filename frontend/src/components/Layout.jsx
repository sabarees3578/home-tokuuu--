import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  LayoutDashboard,
  HardDrive,
  CheckSquare,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
  Users,
  Activity,
  Terminal,
  PlusCircle,
  CloudUpload,
  BarChart3
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = isAdmin
    ? [
        { name: 'Overview',  path: '/admin',                 icon: LayoutDashboard },
        { name: 'Users',     path: '/admin/users',            icon: Users           },
        { name: 'Devices',   path: '/admin/register-device',  icon: HardDrive       },
        { name: 'Register Device', path: '/admin/device-add', icon: PlusCircle      },
        { name: 'Verify Device', path: '/admin/verify-device', icon: CheckSquare    },
      ]
    : [
        { name: 'My Security Panel', path: '/dashboard', icon: LayoutDashboard },
      ];

  const activeItem = navItems.find(item => location.pathname === item.path);

  // Sidebar content shared between desktop & mobile
  const renderSidebarContent = (onNavClick) => (
    <div className="flex flex-col h-full bg-[#FCFCFC] relative z-10">
      {/* Brand */}
      <div className="flex items-center gap-4 px-6 py-8 border-b border-slate-200/60 relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white flex-shrink-0 shadow-md">
          <Shield className="h-6 w-6" />
        </div>
        <div className="relative z-10">
          <span className="text-xl font-extrabold text-slate-900 tracking-tight leading-none block">
            AT INDUSER
          </span>
          <span className="text-[10px] text-blue-600 font-bold tracking-[0.2em] uppercase mt-1 block">
            Security Core
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-8 space-y-8 overflow-y-auto custom-scrollbar">
        {isAdmin ? (
          <>
            {/* Group 1 — Dashboard */}
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase px-4 pb-3">Dashboard</p>
              <div className="space-y-1">
              {[
                { name: 'Overview', path: '/admin',        icon: LayoutDashboard },
                { name: 'Analytics',  path: '/admin/analytics', icon: BarChart3       },
                { name: 'Users',    path: '/admin/users',  icon: Users            },
              ].map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); if (onNavClick) onNavClick(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`} />
                    {item.name}
                    {isActive && <ChevronRight className="h-4 w-4 ml-auto text-blue-500 opacity-70" />}
                  </button>
                );
              })}
              </div>
            </div>

            {/* Group 2 — Device Management */}
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase px-4 pb-3">Device Management</p>
              <div className="space-y-1">
              {[
                { name: 'Devices', path: '/admin/register-device', icon: HardDrive   },
                { name: 'Register Device', path: '/admin/device-add', icon: PlusCircle },
                { name: 'Verify Device',  path: '/admin/verify-device',  icon: CheckSquare },
                { name: 'Command Center', path: '/admin/command-center', icon: Terminal    },
                { name: 'OTA Manager', path: '/admin/ota', icon: CloudUpload },
              ].map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); if (onNavClick) onNavClick(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`} />
                    {item.name}
                    {isActive && <ChevronRight className="h-4 w-4 ml-auto text-blue-500 opacity-70" />}
                  </button>
                );
              })}
              </div>
            </div>
          </>
        ) : (
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase px-4 pb-3">Secure Gateway</p>
            <button
              onClick={() => { navigate('/dashboard'); if (onNavClick) onNavClick(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                location.pathname === '/dashboard'
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className={`h-5 w-5 ${location.pathname === '/dashboard' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`} />
              My Security Panel
              {location.pathname === '/dashboard' && <ChevronRight className="h-4 w-4 ml-auto text-blue-500 opacity-70" />}
            </button>
            <button
              onClick={() => { navigate('/analytics'); if (onNavClick) onNavClick(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group mt-1 ${
                location.pathname === '/analytics'
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className={`h-5 w-5 ${location.pathname === '/analytics' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`} />
              Analytics Studio
              {location.pathname === '/analytics' && <ChevronRight className="h-4 w-4 ml-auto text-blue-500 opacity-70" />}
            </button>
          </div>
        )}
      </nav>

      {/* User + logout */}
      <div className="p-4 border-t border-slate-200 bg-[#FCFCFC] space-y-2">
        {user && (
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
              {user.photo
                ? <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
                : <User className="h-4 w-4 text-slate-400" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-blue-600 uppercase tracking-widest font-bold mt-0.5">Level: {user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors group"
        >
          <LogOut className="h-4 w-4 group-hover:text-red-600 transition-colors" />
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen max-h-screen w-full bg-[#F3F4F6] flex text-slate-900 font-sans selection:bg-blue-500/20 selection:text-blue-900 relative overflow-hidden">
      
      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside className="hidden md:flex flex-col w-[280px] flex-shrink-0 border-r border-slate-200 fixed inset-y-0 left-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] h-full">
        {renderSidebarContent()}
      </aside>

      {/* ─── MOBILE DRAWER ─── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] shadow-2xl bg-[#FCFCFC] border-r border-slate-200 animate-slide-in-right">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-6 right-6 p-2 z-50 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors border border-slate-200"
            >
              <X className="h-5 w-5 text-slate-600" />
            </button>
            {renderSidebarContent(() => setSidebarOpen(false))}
          </aside>
        </div>
      )}

      {/* ─── MAIN AREA ─── */}
      <div className="flex-1 flex flex-col md:ml-[280px] relative z-10 h-screen max-h-screen overflow-hidden">

        {/* Top Header */}
        <header className="flex-shrink-0 h-16 bg-[#F3F4F6]/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-6 md:px-8 transition-all">
          {/* Left */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 md:hidden bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Menu className="h-5 w-5 text-slate-700" />
            </button>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-[0.1em]">
                {activeItem ? activeItem.name : 'Dashboard Overview'}
              </span>
            </div>
            {/* Mobile brand */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">AT INDUSER</span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-slate-200/50 transition-colors group" title="System Alerts">
              <Activity className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-blue-500 rounded-full border-2 border-[#F3F4F6]" />
            </button>
            {user && (
              <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-slate-300">
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 leading-none">{user.name}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
                  {user.photo
                    ? <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
                    : <User className="h-4 w-4 text-slate-500" />
                  }
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-[1600px] mx-auto animate-fade-in overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
