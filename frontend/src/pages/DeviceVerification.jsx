import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDb } from '../context/DbContext';
import Layout from '../components/Layout';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckSquare,
  AlertCircle,
  QrCode,
  Download,
  Printer,
  ExternalLink,
  Layers,
  Calendar,
  UserCheck,
  ClipboardList,
  Loader2,
  ShieldCheck
} from 'lucide-react';

const emptyFormData = () => ({
  made_date:         new Date().toISOString().split('T')[0],
  deployed_by:       '',
  verified_by:       '',
  verification_date: new Date().toISOString().split('T')[0],
  notes:             ''
});

const DeviceVerification = () => {
  const { devices, verifyDevice } = useDb();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryDeviceId = searchParams.get('deviceId');
  const eligibleDevices = devices.filter(d => d.status === 'Available' || d.status === 'Verified');

  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [formData, setFormData] = useState(emptyFormData());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const qrCardRef = useRef();

  const selectedDevice = devices.find(d => d.device_id === selectedDeviceId);
  // A device that isn't 'Available' has already been verified (or even
  // registered to a customer) — show its QR right away instead of forcing
  // the admin through the QA form a second time.
  const alreadyVerified = !!selectedDevice && selectedDevice.status !== 'Available';

  useEffect(() => {
    if (!queryDeviceId) return;
    const dev = devices.find(d => d.device_id === queryDeviceId);
    if (!dev) return;
    setSelectedDeviceId(queryDeviceId);
    if (dev.status !== 'Available') {
      const fd = { ...emptyFormData(), deployed_by: dev.deployed_by || '', verified_by: dev.verified_by || '' };
      setFormData(fd);
      setVerificationResult({ ...fd, device_id: queryDeviceId });
    }
  }, [queryDeviceId, devices]);

  const handleDeviceChange = e => {
    const devId = e.target.value;
    setSelectedDeviceId(devId);
    const dev = devices.find(d => d.device_id === devId);
    const fd = dev ? { ...emptyFormData(), deployed_by: dev.deployed_by || '', verified_by: dev.verified_by || '' } : emptyFormData();
    setFormData(fd);
    
    if (dev && dev.status !== 'Available') {
      setVerificationResult({ ...fd, device_id: devId });
    } else {
      setVerificationResult(null);
    }
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!selectedDeviceId) { setError('Please select a device to verify.'); return; }
    setSubmitting(true);
    try {
      await verifyDevice(selectedDeviceId, {
        deployed_by: formData.deployed_by,
        verified_by: formData.verified_by,
        notes: formData.notes
      });
      setVerificationResult({ ...formData, device_id: selectedDeviceId });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const registrationLink = `${window.location.origin}/register/${selectedDeviceId}`;

  const downloadQR = () => {
    const svg = document.getElementById('device-qr-code');
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
      a.download = `QR_${selectedDeviceId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const printQR = () => {
    const content = qrCardRef.current.innerHTML;
    document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">${content}</div>`;
    window.print();
    window.location.reload();
  };

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
                  QA Inspection &amp; Certification
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline">
                  {eligibleDevices.length} Eligible Units
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl display-font font-extrabold tracking-tight text-white drop-shadow-sm">
                Device Verification &amp; QR Seal
              </h1>
              <p className="text-xs font-medium text-slate-300 max-w-xl leading-relaxed">
                Authorize hardware quality testing, sign inspector credentials, and generate customer QR codes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center gap-3 text-white">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">Ready for QA</p>
                  <p className="text-lg font-bold font-mono">{eligibleDevices.length} <span className="text-xs text-slate-400 font-sans">Units</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── Left: Form ── */}
          <div className="lg:col-span-7 space-y-6">

            {error && (
              <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 p-4 text-xs font-semibold shadow-sm">
                <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {alreadyVerified && (
              <div className="flex items-center gap-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 p-4 text-xs font-semibold shadow-sm">
                <ShieldCheck className="h-4.5 w-4.5 flex-shrink-0 text-blue-600" />
                <p>
                  Device <strong>{selectedDeviceId}</strong> is already verified — its QR code is rendered on the right.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-sm">

            {/* Device selector */}
            <div className="space-y-1.5">
              <label className="field-label">Select Provisioned Device <span className="text-red-500">*</span></label>
              <select value={selectedDeviceId} onChange={handleDeviceChange} className="form-input" required>
                <option value="">— Choose a Device ID —</option>
                {eligibleDevices.map(d => (
                  <option key={d.id} value={d.device_id}>
                    {d.device_id} ({d.model}) · {d.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Date row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="field-label flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-500" /> Manufactured Date
                </label>
                <input type="date" name="made_date" value={formData.made_date} onChange={handleChange} className="form-input" required />
              </div>
              <div className="space-y-1.5">
                <label className="field-label flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-500" /> Verification Date
                </label>
                <input type="date" name="verification_date" value={formData.verification_date} onChange={handleChange} className="form-input" required />
              </div>
            </div>

            {/* Personnel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="field-label flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-500" /> Deployment Engineer
                </label>
                <input type="text" name="deployed_by" value={formData.deployed_by} onChange={handleChange} placeholder="e.g. Alex Mercer" className="form-input" required />
              </div>
              <div className="space-y-1.5">
                <label className="field-label flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-blue-500" /> Quality Inspector
                </label>
                <input type="text" name="verified_by" value={formData.verified_by} onChange={handleChange} placeholder="e.g. Sarah Connor" className="form-input" required />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="field-label flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-blue-500" /> QA Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Physical inspection notes, signal tests, firmware checks…"
                rows={4}
                className="form-input resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={!selectedDeviceId || submitting}
                className="btn-primary"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                {submitting ? 'Verifying...' : (alreadyVerified || verificationResult) ? 'Update Verification' : 'Verify Device'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: QR Panel ── */}
        <div className="lg:col-span-5">
          {verificationResult ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-slate-800">
                <QrCode className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold">Generated Security QR Code</h3>
              </div>

              {/* QR card */}
              <div ref={qrCardRef} className="card rounded-xl p-8 flex flex-col items-center text-center bg-white">
                <div className="bg-white p-3 rounded-xl border-2 border-slate-200 mb-5 shadow-inner">
                  <QRCodeSVG id="device-qr-code" value={registrationLink} size={200} level="H" includeMargin />
                </div>
                <h4 className="text-lg font-extrabold text-slate-900 mb-0.5">Device: {selectedDeviceId}</h4>
                <span className="badge badge-blue mb-4">
                  {devices.find(d => d.device_id === selectedDeviceId)?.model}
                </span>
                <div className="text-[10px] font-mono bg-slate-100 px-3 py-2 rounded-lg text-slate-500 max-w-xs break-all border border-slate-200">
                  {registrationLink}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={downloadQR} className="btn-secondary">
                  <Download className="h-4 w-4" /> Download PNG
                </button>
                <button onClick={printQR} className="btn-secondary">
                  <Printer className="h-4 w-4" /> Print Label
                </button>
              </div>

              {/* Dev utility */}
              <div className="card rounded-xl p-4 flex items-center justify-between gap-3 bg-slate-50">
                <div>
                  <span className="section-label block">Developer Utility</span>
                  <span className="text-sm text-slate-600 font-medium">Simulate camera QR scan</span>
                </div>
                <button
                  onClick={() => navigate(`/register/${selectedDeviceId}`)}
                  className="btn-primary text-xs"
                >
                  Open Link <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="card rounded-xl p-10 flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-200 bg-white min-h-[320px]">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <QrCode className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-600">Awaiting Verification</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-xs leading-relaxed">
                Select a device and complete verification to generate its customer onboarding QR code.
              </p>
            </div>
          )}
        </div>

        </div>

      </div>
    </Layout>
  );
};

export default DeviceVerification;
