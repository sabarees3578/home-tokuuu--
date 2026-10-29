import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDb } from '../context/DbContext';
import Layout from '../components/Layout';
import {
  Users,
  Search,
  User,
  Phone,
  MapPin,
  Shield,
  Calendar,
  X,
  ChevronRight,
  Laptop,
  Trash2
} from 'lucide-react';

/* ── Small info row ─────────────────────────────────────────────────── */
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <Icon className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
    <div className="min-w-0">
      <p className="section-label leading-none mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-words">{value || '—'}</p>
    </div>
  </div>
);

/* ── Main ──────────────────────────────────────────────────────────── */
const UsersPage = () => {
  const { customers, devices, deleteCustomer } = useDb();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = customers.filter(c => {
    const q = (search || '').toLowerCase();
    return (
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_number || '').includes(q) ||
      (c.location || '').toLowerCase().includes(q) ||
      (c.device_id || '').toLowerCase().includes(q)
    );
  });

  const getDevice = (deviceId) => devices.find(d => d.device_id === deviceId);

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
                  Customer Directory
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline">
                  {customers.length} Verified Users
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl display-font font-extrabold tracking-tight text-white drop-shadow-sm">
                User &amp; Client Management
              </h1>
              <p className="text-xs font-medium text-slate-300 max-w-xl leading-relaxed">
                Manage registered customer profiles, installation addresses, and linked security devices.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-3 text-white">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">Total Clients</p>
                  <p className="text-lg font-bold font-mono">{customers.length} <span className="text-xs text-slate-400 font-sans">Accounts</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Search & Filter Strip ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, mobile number, address or device ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input text-xs pl-10 py-2.5 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs font-bold text-slate-500 flex-shrink-0">
            Showing {filtered.length} of {customers.length} Users
          </p>
        </div>

        {/* ── Content: list + detail ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── Left: Customer list ── */}
          <div className={`${selected ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-3`}>

            {/* Customer cards */}
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 text-sm font-bold">No customers found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search filter keywords.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
                {filtered.map(c => {
                  const dev = getDevice(c.device_id);
                  const isSelected = selected?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected(isSelected ? null : c)}
                      className={`w-full text-left bg-white rounded-2xl p-4 transition-all duration-200 border shadow-sm ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30'
                          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className={`h-11 w-11 rounded-2xl overflow-hidden border flex items-center justify-center flex-shrink-0 shadow-sm ${
                          isSelected ? 'border-blue-400 bg-blue-100/60' : 'border-slate-200 bg-slate-100/80'
                        }`}>
                          {c.photo
                            ? <img src={c.photo} alt={c.customer_name} className="h-full w-full object-cover" />
                            : <User className={`h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                            {c.customer_name}
                          </p>
                          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {c.customer_number}
                          </p>
                        </div>

                        {/* Right meta */}
                        <div className="text-right flex-shrink-0 space-y-1">
                          {c.device_id && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                              {c.device_id}
                            </span>
                          )}
                          {c.location && (
                            <p className="text-[10px] font-semibold text-slate-400 flex items-center justify-end gap-0.5">
                              <MapPin className="h-2.5 w-2.5" /> {c.location}
                            </p>
                          )}
                        </div>

                        <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform ${
                          isSelected ? 'rotate-90 text-blue-600' : 'text-slate-300'
                        }`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right: Customer detail panel ── */}
          {selected && (
            <div className="lg:col-span-7 animate-slide-up">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">

                {/* Detail header */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-6 text-white flex items-start justify-between gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="h-14 w-14 rounded-2xl overflow-hidden border-2 border-white/20 bg-white/10 flex items-center justify-center flex-shrink-0 shadow-inner">
                      {selected.photo
                        ? <img src={selected.photo} alt={selected.customer_name} className="h-full w-full object-cover" />
                        : <User className="h-7 w-7 text-white" />
                      }
                    </div>
                    <div>
                      <h2 className="text-xl font-bold leading-tight display-font">{selected.customer_name}</h2>
                      <p className="text-slate-300 text-xs font-semibold mt-1 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-blue-400" /> {selected.customer_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                    <button
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to remove customer ${selected.customer_name}?`)) {
                          try {
                            await deleteCustomer(selected.id, selected.device_id);
                            setSelected(null);
                          } catch (err) {
                            alert('Failed to delete customer: ' + err.message);
                          }
                        }
                      }}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-full transition-colors flex-shrink-0"
                      title="Delete Customer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelected(null)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex-shrink-0 text-slate-300 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Detail body */}
                <div className="p-6 space-y-6 max-h-[55vh] overflow-y-auto custom-scrollbar">

                  {/* Contact & Identity */}
                  <div>
                    <h3 className="section-label mb-3">Contact Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoRow icon={Phone}    label="Mobile Number"  value={selected.customer_number} />
                      <InfoRow icon={Calendar} label="Registered On"  value={new Date(selected.created_at || selected.registeredAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                      <InfoRow icon={MapPin}   label="Region"         value={selected.location || 'Primary Zone'} />
                    </div>
                  </div>

                  <hr className="divider" />

                  {/* Address */}
                  <div>
                    <h3 className="section-label mb-2">Installation Address</h3>
                    <p className="text-xs font-medium text-slate-700 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                      {selected.address || selected.customerAddress || 'No installation address recorded.'}
                    </p>
                  </div>

                  <hr className="divider" />

                  {/* Linked device */}
                  <div>
                    <h3 className="section-label mb-3">Linked Security Hardware</h3>
                    {(() => {
                      const dev = getDevice(selected.device_id);
                      if (!dev) return (
                        <p className="text-xs text-slate-400 italic">No security device linked.</p>
                      );
                      return (
                        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                                <Laptop className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm font-mono">{dev.device_id}</p>
                                <p className="text-xs font-semibold text-slate-400">{dev.model}</p>
                              </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Registered
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                            <div>
                              <p className="section-label mb-0.5">Firmware</p>
                              <p className="text-xs font-mono font-semibold text-slate-700">{dev.firmware_version || 'v2.1'}</p>
                            </div>
                            <div>
                              <p className="section-label mb-0.5">MAC Address</p>
                              <p className="text-xs font-mono font-semibold text-slate-700">{dev.mac_address || '04:83:08:BC:DC:CC'}</p>
                            </div>
                            <div>
                              <p className="section-label mb-0.5">IMEI</p>
                              <p className="text-xs font-mono font-semibold text-slate-700">{dev.imei || '865203088710862'}</p>
                            </div>
                            <div>
                              <p className="section-label mb-0.5">Serial No.</p>
                              <p className="text-xs font-mono font-semibold text-slate-700">{dev.serial_number || 'N/A'}</p>
                            </div>
                            <div className="col-span-2 pt-3 mt-1 border-t border-slate-200">
                              <button
                                onClick={() => navigate(`/admin/dashboard/${dev.device_id}`)}
                                className="w-full btn-primary py-2.5 text-xs shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                Enter User Dashboard <ChevronRight className="h-4 w-4 ml-1" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default UsersPage;
