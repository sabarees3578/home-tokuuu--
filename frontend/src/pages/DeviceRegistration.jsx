import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDb } from '../context/DbContext';
import Layout from '../components/Layout';
import {
  HardDrive,
  PlusCircle,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Cpu,
  Wifi,
  Hash,
  Tag,
  Layers,
  Search,
  CheckCircle2,
  PackageOpen,
  Activity,
  X,
  Info,
  MapPin,
  Phone,
  ChevronRight,
  Trash2,
  BookOpen,
  ChevronDown,
  Terminal,
  Zap,
  UserCheck,
  MonitorSmartphone
} from 'lucide-react';

/* ─── Status config ────────────────────────────────────────────────── */
const STATUS_META = {
  Available:  { badge: 'badge-amber',  dot: 'bg-amber-500',   icon: PackageOpen, iconBg: 'bg-amber-50 border-amber-200',   iconColor: 'text-amber-500'   },
  Verified:   { badge: 'badge-blue',   dot: 'bg-blue-500',    icon: ShieldCheck, iconBg: 'bg-blue-50 border-blue-200',     iconColor: 'text-blue-500'    },
  Registered: { badge: 'badge-green',  dot: 'bg-emerald-500', icon: Activity,    iconBg: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-500' },
};

/* ─── Register Device Modal ────────────────────────────────────────── */
const RegisterModal = ({ onClose, onSuccess }) => {
  const { registerDevice } = useDb();
  const [formData, setFormData] = useState({
    device_id: '', imei: '', mac_address: '',
    model: 'AT Shield v2', firmware_version: 'v2.1.4', serial_number: ''
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const validate = () => {
    if (!/^\d{15}$/.test(formData.imei))                                          return 'IMEI must be exactly 15 digits.';
    if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(formData.mac_address)) return 'MAC address must be XX:XX:XX:XX:XX:XX format.';
    return null;
  };

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const devData = {
        ...formData,
        device_id:     formData.device_id.trim().toUpperCase(),
        serial_number: formData.serial_number.trim() ||
          `SN-${formData.device_id.trim().toUpperCase()}-${Date.now().toString().slice(-6)}`
      };
      const newDev = registerDevice(devData);
      onSuccess(newDev);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const Field = ({ label, name, required, placeholder, icon: Icon, children }) => (
    <div className="space-y-1.5">
      <label className="field-label flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-blue-400" />}
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children ?? (
        <input
          type="text" name={name} value={formData[name]}
          onChange={handleChange} placeholder={placeholder}
          className="form-input" required={required}
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Register New Device</h2>
              <p className="text-[11px] text-slate-400">Enter hardware identifiers to create a record</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="h-4.5 w-4.5" /></button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-xs font-medium">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Device ID"    name="device_id"     required placeholder="e.g. SEC-004"           icon={Tag}    />
            <Field label="Serial Number" name="serial_number" placeholder="Auto-generated if blank"          icon={Hash}   />
            <Field label="IMEI (15 digits)" name="imei"      required placeholder="e.g. 862415049382715"    icon={Cpu}    />
            <Field label="MAC Address"   name="mac_address"  required placeholder="e.g. BC:A9:20:11:FE:5A" icon={Wifi}   />
            <Field label="Device Model"  name="model"        icon={Layers}>
              <select name="model" value={formData.model} onChange={handleChange} className="form-input">
                <option value="AT Shield v2">AT Shield v2</option>
                <option value="Sentinel Pro">Sentinel Pro</option>
                <option value="GuardPod Mini">GuardPod Mini</option>
              </select>
            </Field>
            <Field label="Firmware Version" name="firmware_version" required placeholder="e.g. v2.1.4" icon={Layers} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">* Required fields</span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost border border-slate-200 text-sm">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary text-sm">
                <PlusCircle className="h-4 w-4" />
                {loading ? 'Registering…' : 'Register Device'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Device Detail Drawer ─────────────────────────────────────────── */
const DeviceDrawer = ({ device, customers, onClose, onVerify }) => {
  const sm = STATUS_META[device.status] || STATUS_META.Available;
  const StatusIcon = sm.icon;
  const customer = customers.find(c => c.device_id === device.device_id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center border ${sm.iconBg}`}>
              <StatusIcon className={`h-4.5 w-4.5 ${sm.iconColor}`} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{device.device_id}</h3>
              <p className="text-[11px] text-slate-400">{device.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="h-4.5 w-4.5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Status */}
          <div>
            <p className="section-label mb-2">Current Status</p>
            <span className={`badge ${sm.badge} px-3 py-1 text-xs`}>
              <span className={`h-2 w-2 rounded-full ${sm.dot}`} />{sm.label}
            </span>
          </div>

          <hr className="divider" />

          {/* Hardware specs */}
          <div>
            <p className="section-label mb-3">Hardware Details</p>
            <div className="space-y-3">
              {[
                { label: 'Device ID',     value: device.device_id,        mono: false },
                { label: 'Serial No.',    value: device.serial_number,    mono: true  },
                { label: 'IMEI',          value: device.imei,             mono: true  },
                { label: 'MAC Address',   value: device.mac_address,      mono: true  },
                { label: 'Model',         value: device.model,            mono: false },
                { label: 'Firmware',      value: device.firmware_version, mono: false },
              ].map(r => (
                <div key={r.label} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-slate-400 text-xs font-medium w-24 flex-shrink-0">{r.label}</span>
                  <span className={`text-xs text-right text-slate-800 break-all ${r.mono ? 'font-mono' : 'font-semibold'}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Customer info */}
          {customer && (
            <>
              <hr className="divider" />
              <div>
                <p className="section-label mb-3">Linked Customer</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg overflow-hidden bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
                      {customer.photo
                        ? <img src={customer.photo} alt={customer.customer_name} className="h-full w-full object-cover" />
                        : <span className="text-blue-700 font-bold text-sm">{customer.customer_name[0]}</span>
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{customer.customer_name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{customer.customer_number}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-3 border-t border-slate-200">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1"><MapPin className="h-3 w-3" />Region</span>
                      <span className="font-semibold text-slate-700">{customer.location}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Since</span>
                      <span className="font-semibold text-slate-700">
                        {new Date(customer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        {(device.status === 'Available' || device.status === 'Verified') && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => onVerify(device.device_id)}
              className={`w-full flex items-center justify-center gap-2 ${device.status === 'Available' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <ShieldCheck className="h-4 w-4" />
              {device.status === 'Available' ? 'Proceed to Verification' : 'View QR Code'}
              <ArrowRight className="h-4 w-4 ml-auto" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════ */
const DevicesPage = () => {
  const { devices, customers, deleteDevice } = useDb();
  const navigate = useNavigate();

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('All');
  const [drawerDevice, setDrawer]     = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [justAdded, setJustAdded]     = useState(null);

  const [showDocs, setShowDocs]       = useState(false);

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    const matchSearch =
      (d.device_id || '').toLowerCase().includes(q) ||
      (d.imei || '').toLowerCase().includes(q) ||
      (d.mac_address || '').toLowerCase().includes(q) ||
      (d.model || '').toLowerCase().includes(q) ||
      (d.serial_number || '').toLowerCase().includes(q);
    return matchSearch && (statusFilter === 'All' || d.status === statusFilter);
  });

  const countOf = s => devices.filter(d => d.status === s).length;

  const handleRegisterSuccess = newDev => {
    setShowModal(false);
    setJustAdded(newDev.device_id);
    setTimeout(() => setJustAdded(null), 4000);
  };

  return (
    <Layout>
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Devices</h1>
            <p className="page-subtitle">Complete hardware inventory — all registered, verified and active units</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/public/device-docs"
              download="HS01_Device_Documentation.pdf"
              className="btn-ghost text-sm flex items-center gap-2"
              title="Download full device documentation PDF (A-to-Z guide)"
            >
              <BookOpen className="h-4 w-4" />
              Download PDF Guide
            </a>
            <button
              onClick={() => navigate('/admin/device-add')}
              className="btn-primary text-sm"
            >
              <PlusCircle className="h-4 w-4" />
              Add Device
            </button>
          </div>
        </div>

        {/* ── Success toast ── */}
        {justAdded && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3.5 text-sm animate-fade-in">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 flex-shrink-0" />
            <p className="text-emerald-800">
              Device <strong>{justAdded}</strong> registered successfully —{' '}
              <button
                onClick={() => navigate(`/admin/verify-device?deviceId=${justAdded}`)}
                className="underline font-semibold hover:text-emerald-900"
              >
                verify now
              </button>
            </p>
            <button onClick={() => setJustAdded(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Main card ── */}
        <div className="card rounded-xl overflow-hidden">

          {/* ── Toolbar ── */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">

              {/* Status filter chips */}
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Available', 'Verified', 'Registered'].map(s => {
                  const meta = STATUS_META[s];
                  const count = s === 'All' ? devices.length : countOf(s);
                  const active = statusFilter === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {meta && (
                        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white/70' : meta.dot}`} />
                      )}
                      {s}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ID, model, IMEI, MAC…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="form-input pl-9 text-xs"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-14 w-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                  <HardDrive className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-500">No devices found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filter</p>
                <button onClick={() => navigate('/admin/device-add')} className="btn-primary text-sm mt-4">
                  <PlusCircle className="h-4 w-4" /> Add First Device
                </button>
              </div>
            ) : (
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Model</th>
                    <th>IMEI</th>
                    <th>MAC Address</th>
                    <th>Firmware</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(device => {
                    const sm = STATUS_META[device.status] || STATUS_META.Available;
                    const StatusIcon = sm.icon;
                    const linkedCustomer = customers.find(c => c.device_id === device.device_id);
                    const isNew = device.device_id === justAdded;

                    return (
                      <tr
                        key={device.id}
                        className={`cursor-pointer ${isNew ? 'bg-emerald-50' : ''}`}
                        onClick={() => setDrawer(device)}
                      >
                        {/* Device ID */}
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${sm.iconBg}`}>
                              <StatusIcon className={`h-4 w-4 ${sm.iconColor}`} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{device.device_id}</p>
                              <p className="text-[10px] font-mono text-slate-400">{device.serial_number}</p>
                            </div>
                          </div>
                        </td>

                        {/* Model */}
                        <td>
                          <p className="font-semibold text-slate-800 text-sm">{device.model}</p>
                        </td>

                        {/* IMEI */}
                        <td>
                          <p className="text-xs font-mono text-slate-600">{device.imei}</p>
                        </td>

                        {/* MAC */}
                        <td>
                          <p className="text-xs font-mono text-slate-600">{device.mac_address}</p>
                        </td>

                        {/* Firmware */}
                        <td>
                          <span className="badge badge-slate">{device.firmware_version}</span>
                        </td>

                        {/* Status */}
                        <td>
                          <div className="space-y-1">
                            <span className={`badge ${sm.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                              {sm.label}
                            </span>
                            {linkedCustomer && (
                              <p className="text-[10px] text-slate-400">{linkedCustomer.customer_name}</p>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            {device.status === 'Available' && (
                              <button
                                onClick={e => { e.stopPropagation(); navigate(`/admin/verify-device?deviceId=${device.device_id}`); }}
                                className="btn-primary text-xs px-2.5 py-1.5"
                              >
                                Verify
                              </button>
                            )}
                            {device.status === 'Verified' && (
                              <button
                                onClick={e => { e.stopPropagation(); navigate(`/admin/verify-device?deviceId=${device.device_id}`); }}
                                className="btn-secondary text-xs px-2.5 py-1.5"
                              >
                                View QR
                              </button>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setDrawer(device); }}
                              className="btn-ghost p-1.5 border border-slate-200"
                              title="View details"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={async e => {
                                e.stopPropagation();
                                if (window.confirm(`Are you sure you want to completely delete device ${device.device_id}?`)) {
                                  try {
                                    await deleteDevice(device.device_id);
                                    window.location.reload();
                                  } catch (err) {
                                    alert('Failed to delete device: ' + err.message);
                                  }
                                }
                              }}
                              className="btn-ghost p-1.5 border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700"
                              title="Delete device"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Table footer ── */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing <strong className="text-slate-600">{filtered.length}</strong> of{' '}
                <strong className="text-slate-600">{devices.length}</strong> devices
              </p>
              <p className="text-xs text-slate-400 hidden sm:block">Click any row to view full details</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Register Modal ── */}
      {showModal && (
        <RegisterModal
          onClose={() => setShowModal(false)}
          onSuccess={handleRegisterSuccess}
        />
      )}

      {/* ── Detail Drawer ── */}
      {drawerDevice && (
        <DeviceDrawer
          device={drawerDevice}
          customers={customers}
          onClose={() => setDrawer(null)}
          onVerify={id => { setDrawer(null); navigate(`/admin/verify-device?deviceId=${id}`); }}
        />
      )}
    </Layout>
  );
};

export default DevicesPage;
