import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDb } from './DbContext';

const AuthContext = createContext();
const API_BASE = '/api';

async function safeJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { success: false, error: 'Network error or empty response from server.' };
  } catch (e) {
    return { success: false, error: 'Network error or invalid response from server.' };
  }
}

export const AuthProvider = ({ children }) => {
  const { registerCustomer, refreshData } = useDb();

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) localStorage.setItem('auth_user', JSON.stringify(user));
    else localStorage.removeItem('auth_user');
  }, [user]);

  /* ── Admin login ── */
  const login = async (username, password) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await safeJson(res);
      if (data.success) {
        setUser(data.user);
        // Wait for React to persist auth_user to localStorage, then trigger fetch
        setTimeout(() => { refreshData(); }, 100);
        return data.user;
      }
      const err = new Error(data.error || 'Invalid credentials.');
      setError(err.message);
      throw err;
    } catch (err) {
      setError(err.message || 'Network error.');
      throw err;
    }
  };

  /* ── Customer OTP — Send ── */
  const sendOTP = async (phone) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await safeJson(res);
      if (data.success) {
        // OTP is returned from backend for demo simulation purposes
        return { customerName: data.customerName, otp: data.otp };
      }
      const err = new Error(data.error || 'Failed to send OTP.');
      setError(err.message);
      throw err;
    } catch (err) {
      setError(err.message || 'Network error.');
      throw err;
    }
  };

  /* ── Customer OTP — Verify ── */
  const verifyOTP = async (phone, enteredOtp) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only send what the user typed — server validates against stored OTP
        body: JSON.stringify({ phone, enteredOtp })
      });
      const data = await safeJson(res);
      if (data.success) {
        setUser(data.user);
        setTimeout(() => { refreshData(); }, 100);
        return data.user;
      }
      const err = new Error(data.error || 'OTP verification failed.');
      setError(err.message);
      throw err;
    } catch (err) {
      setError(err.message || 'Network error.');
      throw err;
    }
  };

  const logout = () => { setUser(null); setError(null); };

  /* ── Customer self-onboarding ── */
  const signupCustomer = async (onboardingData) => {
    setError(null);
    try {
      return await registerCustomer(onboardingData);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      user, error,
      login, logout,
      sendOTP, verifyOTP,
      signupCustomer,
      isAuthenticated: !!user,
      isAdmin:    user?.role === 'admin',
      isCustomer: user?.role === 'customer'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
