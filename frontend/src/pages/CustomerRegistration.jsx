import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDb } from '../context/DbContext';
import { useAuth } from '../context/AuthContext';
import {
  Shield, User, Phone, MapPin, Image, Camera,
  AlertCircle, CheckCircle2, ArrowRight, ArrowLeft,
  Smartphone, Users, Hash, ChevronRight, RefreshCw, Lock,
  Wifi, Power
} from 'lucide-react';

const SimIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2"/>
    <path d="M15 2v4H9V2"/>
    <rect x="9" y="11" width="6" height="6" rx="1"/>
  </svg>
);

const Field = ({ label, hint, required, icon: Icon, children }) => (
  <div className="space-y-1.5">
    <label className="field-label flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5 text-blue-500" />}
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 leading-relaxed">{hint}</p>}
  </div>
);

const StepBar = ({ current, total }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: total }).map((_, i) => (
      <React.Fragment key={i}>
        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
          i < current
            ? 'bg-blue-600 border-blue-600 text-white'
            : i === current
              ? 'border-blue-600 text-blue-600 bg-blue-50'
              : 'border-slate-200 text-slate-400 bg-white'
        }`}>
          {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
        </div>
        {i < total - 1 && (
          <div className={`flex-1 h-0.5 rounded-full transition-all ${i < current ? 'bg-blue-600' : 'bg-slate-200'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const ReturningCustomerOTP = ({ customer, device }) => {
  const { sendOTP, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone]         = useState(customer.customer_number);
  const [otpSent, setOtpSent]     = useState(false);
  const [simOtp, setSimOtp]       = useState('');
  const [enteredOtp, setEntered]  = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendOTP = async () => {
    setError('');
    setLoading(true);
    try {
      const { otp } = await sendOTP(phone);
      setSimOtp(otp);
      setOtpSent(true);
      setCountdown(180);
      setEntered('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleVerify = () => {
    setError('');
    setLoading(true);
    try {
      verifyOTP(phone, enteredOtp);
      navigate('/dashboard');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="h-12 w-12 rounded-xl overflow-hidden border-2 border-blue-200 bg-blue-100 flex items-center justify-center flex-shrink-0">
          <User className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">{customer.customer_name}</p>
          <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
            <Smartphone className="h-3 w-3" /> {customer.device_name || device.device_id}
          </p>
        </div>
        <div className="ml-auto text-right">
          <span className="badge badge-green">Registered</span>
          <p className="text-[10px] text-slate-400 mt-1">{device.model}</p>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-xs font-medium animate-fade-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /><p>{error}</p>
        </div>
      )}
      {otpSent && simOtp && (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-4 text-center space-y-1 animate-fade-in">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">📱 Simulated OTP</p>
          <p className="text-3xl font-black tracking-[0.4em] text-amber-800 font-mono">{simOtp}</p>
          <p className="text-[11px] text-amber-600">Sent to {phone} · Expires in {fmtTime(countdown)}</p>
        </div>
      )}
      {!otpSent && (
        <Field label="Registered Mobile Number" required icon={Phone}>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter your mobile number" className="form-input" />
        </Field>
      )}
      {otpSent && (
        <Field label="Enter OTP" required icon={Lock} hint="Enter the 6-digit code shown above">
          <input type="text" value={enteredOtp} onChange={e => setEntered(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="· · · · · ·" maxLength={6} inputMode="numeric" className="form-input font-mono tracking-[0.5em] text-center text-2xl" autoFocus />
        </Field>
      )}
      {!otpSent ? (
        <button onClick={handleSendOTP} disabled={loading || phone.length < 8} className="btn-primary w-full py-3">
          {loading ? 'Sending…' : 'Send OTP'} <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <div className="space-y-3">
          <button onClick={handleVerify} disabled={loading || enteredOtp.length !== 6} className="btn-primary w-full py-3">
            {loading ? 'Verifying…' : 'Verify & Enter Portal'} <ArrowRight className="h-4 w-4" />
          </button>
          {countdown === 0 ? (
            <button onClick={handleSendOTP} className="btn-ghost w-full text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Resend OTP
            </button>
          ) : (
            <p className="text-center text-xs text-slate-400">Resend available in <strong className="text-slate-600">{fmtTime(countdown)}</strong></p>
          )}
        </div>
      )}
    </div>
  );
};

const OnboardingWizard = ({ device, deviceId, isOnline }) => {
  const { loginCustomer } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [simOtp, setSimOtp] = useState('');
  const [enteredOtp, setEntered] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ackReceived, setAckReceived] = useState(false);

  const [data, setData] = useState({
    customerName: '', customerAddress: '', customerNumber: '',
    deviceSimNumber: '', deviceName: '',
    user1: '', user2: '', user3: '', user4: '', user5: ''
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const set = (name, value) => setData(prev => ({ ...prev, [name]: value }));

  const handleStep0Next = () => {
    if (!isOnline) { setError('Device must be online to continue.'); return; }
    setError(''); setStep(1);
  };

  const handleStep1Next = () => {
    setError('');
    if (!data.customerName.trim()) { setError('User name is required.'); return; }
    if (!data.customerAddress.trim()) { setError('Address is required.'); return; }
    if (data.customerNumber.length < 8) { setError('Valid contact number is required.'); return; }
    setStep(2);
  };

  const handleSendAdmin = async () => {
    setError('');
    if (!data.deviceName.trim()) { setError('Device Name is required.'); return; }
    if (!data.deviceSimNumber.trim()) { setError('Admin Mobile Number is required.'); return; }
    
    setLoading(true);
    try {
      const res = await fetch('/api/public/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, command: 'ADMIN', params: data.deviceSimNumber })
      });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);
      
      // Poll for ACK
      const checkAck = async (retries) => {
        if (retries === 0) {
          setError('Did not receive ACK from device in time. Ensure device is online.');
          setLoading(false);
          return;
        }
        try {
          const lRes = await fetch(`/api/public/logs/${deviceId}`);
          const lData = await lRes.json();
          if (lData.success && lData.logs) {
             const ack = lData.logs.find(l => l.log.includes('ACK') || l.log.includes('ADMIN_OK') || l.topic.includes('ack') || l.log.includes('Admin number') || l.log.includes(data.deviceSimNumber));
             if (ack) {
               setAckReceived(true);
               setLoading(false);
               setStep(3);
               return;
             }
          }
        } catch(e) {}
        setTimeout(() => checkAck(retries - 1), 2000);
      };
      
      checkAck(10); // wait up to 20 seconds
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleStep3Next = async () => {
    setError('');
    setLoading(true);

    try {
      // Send optional users sequentially to avoid overwhelming the device
      const users = [
        { cmd: 'ADD1', val: data.user1 },
        { cmd: 'ADD2', val: data.user2 },
        { cmd: 'ADD3', val: data.user3 },
        { cmd: 'ADD4', val: data.user4 },
        { cmd: 'ADD5', val: data.user5 },
      ].filter(u => u.val && u.val.trim().length >= 8);

      for (let u of users) {
        await fetch('/api/public/command', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ device_id: deviceId, command: u.cmd, params: u.val })
        });
        // We will pause 1s between commands to give the device time to process.
        await new Promise(r => setTimeout(r, 1000));
      }
      
      setStep(4);
      // Send OTP
      const res = await fetch('/api/public/registration/send-otp', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ phone: data.customerNumber })
      });
      const d = await res.json();
      if(d.success) {
        setSimOtp(d.otp);
        setCountdown(180);
      } else {
        setError(d.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/registration/verify', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ deviceId, formData: data, otp: enteredOtp })
      });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);
      
      // Successfully registered! Force a login flow
      loginCustomer({ 
        success: true, 
        user: { role: 'customer', username: data.customerNumber, device_id: deviceId, name: data.customerName, token: 'temp' } 
      });
      navigate('/dashboard');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <StepBar current={step} total={5} />
        <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
          <span className={step === 0 ? 'text-blue-600 font-semibold' : ''}>Connect</span>
          <span className={step === 1 ? 'text-blue-600 font-semibold' : ''}>User</span>
          <span className={step === 2 ? 'text-blue-600 font-semibold' : ''}>Admin</span>
          <span className={step === 3 ? 'text-blue-600 font-semibold' : ''}>Users</span>
          <span className={step === 4 ? 'text-blue-600 font-semibold' : ''}>Finish</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-xs font-medium animate-fade-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /><p>{error}</p>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4 animate-fade-in text-center">
          <div className="h-16 w-16 mx-auto bg-blue-50 rounded-2xl flex items-center justify-center border-2 border-blue-100">
            <Power className={`h-8 w-8 ${isOnline ? 'text-emerald-500' : 'text-slate-400'}`} />
          </div>
          <h3 className="font-bold text-lg text-slate-800">Prepare Your Device</h3>
          <p className="text-sm text-slate-500">
            Please turn on the device and securely place the SIM card into the slot. Wait until it establishes a connection.
          </p>
          <div className={`p-4 rounded-xl border ${isOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
             <div className="flex items-center justify-center gap-2 font-bold">
               {isOnline ? <><Wifi className="h-5 w-5" /> Device is Online!</> : <><RefreshCw className="h-5 w-5 animate-spin" /> Waiting for Connection...</>}
             </div>
          </div>
          <button onClick={handleStep0Next} disabled={!isOnline} className="btn-primary w-full py-3 mt-4">
            Proceed <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="section-label border-b border-slate-100 pb-2">User Information</h3>
          <Field label="User Name" required icon={User}>
            <input type="text" value={data.customerName} onChange={e => set('customerName', e.target.value)} className="form-input" />
          </Field>
          <Field label="Address" required icon={MapPin}>
            <input type="text" value={data.customerAddress} onChange={e => set('customerAddress', e.target.value)} className="form-input" />
          </Field>
          <Field label="Contact Number" required icon={Phone}>
            <input type="tel" value={data.customerNumber} onChange={e => set('customerNumber', e.target.value.replace(/\D/g, ''))} className="form-input" />
          </Field>
          <button onClick={handleStep1Next} className="btn-primary w-full py-3">
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="section-label border-b border-slate-100 pb-2">Device Configuration</h3>
          <Field label="Device Name" required icon={Smartphone}>
            <input type="text" value={data.deviceName} onChange={e => set('deviceName', e.target.value)} className="form-input" />
          </Field>
          <Field label="Admin Number (Main)" required icon={Shield}>
            <input type="tel" value={data.deviceSimNumber} onChange={e => set('deviceSimNumber', e.target.value.replace(/\D/g, ''))} className="form-input" />
          </Field>
          <button onClick={handleSendAdmin} disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Sending via MQTT...' : 'Send & Wait for ACK'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="section-label border-b border-slate-100 pb-2">Additional Users (Optional)</h3>
          <p className="text-xs text-slate-500 mb-2">You can add up to 5 optional users. The Admin number is the main authority.</p>
          {[1,2,3,4,5].map(num => (
            <Field key={num} label={`User ${num} Number`} icon={Users}>
              <input type="tel" value={data[`user${num}`]} onChange={e => set(`user${num}`, e.target.value.replace(/\D/g, ''))} className="form-input" />
            </Field>
          ))}
          <button onClick={handleStep3Next} className="btn-primary w-full py-3">
            Finish Setup <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5 animate-fade-in">
          <div className="text-center space-y-2">
            <h3 className="font-bold text-slate-900">Final Verification</h3>
            <p className="text-xs text-slate-500">Verify your contact number to register the device.</p>
          </div>
          <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-4 text-center space-y-1">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">📱 Simulated OTP</p>
            <p className="text-3xl font-black tracking-[0.4em] text-amber-800 font-mono">{simOtp}</p>
            <p className="text-[11px] text-amber-600">Sent to {data.customerNumber} · Expires in {fmtTime(countdown)}</p>
          </div>
          <Field label="Enter OTP" required icon={Lock}>
            <input type="text" value={enteredOtp} onChange={e => setEntered(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} className="form-input text-center tracking-[0.5em] text-2xl font-mono" placeholder="------" autoFocus />
          </Field>
          <button onClick={handleVerifyOTP} disabled={loading || enteredOtp.length !== 6} className="btn-primary w-full py-3">
            {loading ? 'Verifying…' : 'Register Device'} <CheckCircle2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const CustomerRegistration = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();

  const [device, setDevice] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let pollInterval;
    
    const fetchPublicDevice = async () => {
      try {
        const res = await fetch(`/api/public/device/${deviceId}`);
        const data = await res.json();
        if (!isMounted) return;
        if (data.success) {
          if (data.status === 'Available' || data.status === 'Verified' || data.status === 'Registered') {
            setPageError('');
            setDevice(data);
            if (data.status === 'Registered') {
              setCustomer(data.customer || null);
            } else {
               // Check if online via logs or status
               const logsRes = await fetch(`/api/public/logs/${deviceId}`);
               const lData = await logsRes.json();
               if (lData.success && lData.logs.length > 0) {
                 const latest = new Date(lData.logs[0].timestamp).getTime();
                 setIsOnline(Date.now() - latest < 5 * 60 * 1000); // 5 mins
               }
            }
          } else {
            setPageError(`Device ${deviceId} has not been verified yet. Please contact admin.`);
          }
        } else {
          setPageError(`Invalid link — Device '${deviceId}' not found.`);
        }
      } catch (err) {
        if (isMounted) setPageError(`Failed to authenticate link.`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchPublicDevice();
    pollInterval = setInterval(fetchPublicDevice, 3000);
    
    return () => { isMounted = false; clearInterval(pollInterval); };
  }, [deviceId]);

  const isReturning = device?.status === 'Registered';
  const isFirstTime = device?.status === 'Verified' || device?.status === 'Available';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Authenticating Device Link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-start justify-center py-12 px-4 font-sans text-slate-900 selection:bg-blue-500/20 selection:text-blue-900">
      <div className="w-full max-w-lg">
        <div className="card-elevated rounded-3xl overflow-hidden animate-slide-up bg-white border border-slate-200/80 shadow-2xl">
          <div className="bg-slate-900 px-6 py-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight display-font">AT Induser Security</h1>
                <p className="text-slate-300 text-xs font-semibold mt-0.5 uppercase tracking-wider">
                  {isReturning ? 'Welcome back — verify to enter your portal' : isFirstTime ? 'One-time device setup' : 'Customer Portal'}
                </p>
              </div>
            </div>
            {device && (
              <div className="mt-5 flex items-center justify-between bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm relative z-10">
                <div>
                  <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Device</p>
                  <p className="font-bold leading-tight font-mono text-white">{deviceId}</p>
                </div>
              </div>
            )}
          </div>
          <div className="p-6">
            {pageError && (
              <div className="flex flex-col items-center text-center py-8 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Access Restricted</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-xs">{pageError}</p>
                </div>
                <button onClick={() => navigate('/login')} className="btn-secondary text-sm">Go to Login</button>
              </div>
            )}
            {isReturning && customer && <ReturningCustomerOTP customer={customer} device={device} />}
            {isFirstTime && <OnboardingWizard device={device} deviceId={deviceId} isOnline={isOnline} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRegistration;
