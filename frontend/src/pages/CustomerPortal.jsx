import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Phone, Key, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

const CustomerPortal = () => {
  const navigate = useNavigate();
  const { sendOTP, verifyOTP } = useAuth();
  
  const [step, setStep] = useState(1); // 1 = Phone, 2 = OTP
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [demoOtpCode, setDemoOtpCode] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone) {
      setError('Please enter your registered phone number.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      const response = await sendOTP(phone);
      if (response && response.otp) {
        setDemoOtpCode(response.otp); // Show in UI for demo purposes only!
        setSuccessMsg(`Welcome back, ${response.customerName}.`);
        setStep(2);
      }
    } catch (err) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      const user = await verifyOTP(phone, otp);
      if (user) {
        navigate('/dashboard'); // Customer Dashboard
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC] font-sans selection:bg-emerald-500/20 selection:text-emerald-900 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 z-10 w-full lg:w-1/2">
        <div className="mx-auto w-full max-w-sm lg:w-96 animate-fade-in">
          
          <div className="mb-10 flex flex-col items-center lg:items-start">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-xl shadow-emerald-500/30 mb-6 border border-emerald-300/50">
              <Shield className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 display-font text-center lg:text-left">
              Customer Portal
            </h2>
            <p className="mt-2 text-sm text-slate-500 font-medium text-center lg:text-left">
              Securely access your device telemetry and control panel using your registered mobile number.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
            
            {error && (
              <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-100 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5" />
                </div>
                <h3 className="text-sm font-semibold text-red-800">{error}</h3>
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleSendOTP} className="space-y-6">
                <div>
                  <label htmlFor="phone" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                    Registered Phone Number
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full pl-11 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm font-semibold text-slate-900 transition-colors"
                      placeholder="e.g. 1234567890"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !phone}
                  className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-md shadow-emerald-500/20 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Send Security Code
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-6 animate-slide-in-right">
                
                {successMsg && (
                   <div className="mb-6 rounded-xl bg-emerald-50 p-4 border border-emerald-100 flex items-start gap-3">
                     <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                     <p className="text-sm font-semibold text-emerald-800">{successMsg}</p>
                   </div>
                )}

                <div>
                  <label htmlFor="otp" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                    6-Digit Security PIN (OTP)
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      name="otp"
                      id="otp"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      maxLength={6}
                      className="block w-full pl-11 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-center text-2xl tracking-[0.5em] font-bold text-slate-900 transition-colors"
                      placeholder="••••••"
                      required
                    />
                  </div>
                  
                  {/* DEMO PURPOSES ONLY */}
                  {demoOtpCode && (
                    <p className="mt-4 text-xs font-semibold text-slate-500 text-center animate-pulse">
                      [DEMO MODE] Use PIN: <span className="font-bold text-emerald-600">{demoOtpCode}</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-md shadow-emerald-500/20 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Verify & Access Dashboard
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); setError(''); setDemoOtpCode(''); }}
                  className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Change Phone Number
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      
      {/* Right Side Image Banner for Large Screens */}
      <div className="hidden lg:block relative w-0 flex-1 bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/50 z-10" />
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          src="https://images.unsplash.com/photo-1558002038-1055907df827?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
          alt="Security Technology"
        />
        <div className="absolute bottom-12 left-12 right-12 z-20">
          <h3 className="text-3xl font-bold text-white mb-4">Enterprise Grade Security</h3>
          <p className="text-slate-300 font-medium max-w-lg">
            Monitor and control your devices seamlessly from our next-generation customer portal. Real-time telemetry, remote protection toggling, and instant alerts.
          </p>
        </div>
      </div>

    </div>
  );
};

export default CustomerPortal;
