import React, { createContext, useContext, useState, useEffect } from 'react';

const DbContext = createContext();

const API_BASE = '/api';

function authHeader() {
  try {
    const user = JSON.parse(localStorage.getItem('auth_user'));
    if (user?.token) return { 'Authorization': `Bearer ${user.token}` };
  } catch {}
  return {};
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error(`Failed to parse JSON from ${res.url}. Status: ${res.status}. Body:`, text);
    return null;
  }
}

export const DbProvider = ({ children }) => {
  const [devices, setDevices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshData = () => setRefreshTick(prev => prev + 1);

  // Fetch data on load, then keep polling every 10s so "online" status stays fresh.
  useEffect(() => {
    let cancelled = false;

    const fetchData = async ({ includeCustomers = false } = {}) => {
      try {
        const headers = authHeader();
        // Do not attempt to fetch data if the user is not authenticated
        if (!headers.Authorization) {
          if (!cancelled) setLoading(false);
          return;
        }

        const requests = [
          fetch(`${API_BASE}/devices`, { headers }),
          fetch(`${API_BASE}/telemetry/all`, { headers }),
        ];
        if (includeCustomers) requests.push(fetch(`${API_BASE}/customers`, { headers }));

        const [devicesRes, logsRes, customersRes] = await Promise.all(requests);

        if (cancelled) return;

        // If server returns 401 Unauthorized (e.g. expired session token), purge stale auth
        if (devicesRes?.status === 401 || logsRes?.status === 401) {
          localStorage.removeItem('auth_user');
          setDevices([]);
          setLogs([]);
          setCustomers([]);
          if (!cancelled) setLoading(false);
          return;
        }

        if (devicesRes.ok) {
          const dData = await safeJson(devicesRes);
          if (dData) setDevices(dData);
        }
        if (logsRes.ok) {
          const lData = await safeJson(logsRes);
          if (lData) setLogs(lData);
        }
        if (customersRes?.ok) {
          const raw = await safeJson(customersRes);
          if (raw) setCustomers(raw.map(c => ({ ...c, device_id: c.deviceId })));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData({ includeCustomers: true });
    const interval = setInterval(() => {
      if (!document.hidden) fetchData();
    }, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [refreshTick]);

  const registerDevice = async (deviceData) => {
    const res = await fetch(`${API_BASE}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(deviceData)
    });
    const data = await res.json();
    if (data.success) {
      setDevices(prev => [...prev, data.device]);
      return data.device;
    }
    throw new Error(data.error);
  };

  const verifyDevice = async (device_id, verificationData = {}) => {
    const res = await fetch(`${API_BASE}/devices/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ device_id, ...verificationData })
    });
    const data = await res.json();
    if (data.success) {
      setDevices(prev => prev.map(d => d.device_id === device_id ? { ...d, status: 'Verified' } : d));
      return data.device;
    }
    throw new Error(data.error);
  };

  const registerCustomer = async (customerData) => {
    const res = await fetch(`${API_BASE}/customers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(customerData)
    });
    const data = await res.json();
    if (data.success) {
      setCustomers(prev => [...prev, data.customer]);
      setDevices(prev => prev.map(d =>
        d.device_id === customerData.device_id ? { ...d, status: 'Registered' } : d
      ));
      return data.customer;
    }
    throw new Error(data.error);
  };

  const getDeviceStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/telemetry/summary/all`, { headers: authHeader() });
      const data = await safeJson(res);
      return data || { total: 0, online: 0, offline: 0, protectionMode: 0, registeredCustomers: 0, motionAlerts: 0, avgBattery: 0, avgSignal: 0 };
    } catch {
      return { total: 0, online: 0, offline: 0, protectionMode: 0, registeredCustomers: 0, motionAlerts: 0, avgBattery: 0, avgSignal: 0 };
    }
  };

  const getHistoricalLogs = async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE}/telemetry/${deviceId}`, { headers: authHeader() });
      const data = await safeJson(res);
      return data || [];
    } catch {
      return [];
    }
  };

  const deleteDevice = async (deviceId) => {
    const res = await fetch(`${API_BASE}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: authHeader()
    });
    const data = await res.json();
    if (data.success) {
      setDevices(prev => prev.filter(d => d.device_id !== deviceId));
      return data;
    }
    throw new Error(data.error);
  };
  const deleteCustomer = async (customerId, deviceId) => {
    const res = await fetch(`${API_BASE}/customers/${customerId}`, {
      method: 'DELETE',
      headers: authHeader()
    });
    const data = await res.json();
    if (data.success) {
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      if (deviceId) {
        setDevices(prev => prev.map(d =>
          d.device_id === deviceId && d.status === 'Registered' ? { ...d, status: 'Verified' } : d
        ));
      }
      return data;
    }
    throw new Error(data.error);
  };

  return (
    <DbContext.Provider value={{
      devices, customers, logs, loading,
      registerDevice, verifyDevice, registerCustomer,
      getDeviceStats, getHistoricalLogs, refreshData, deleteDevice, deleteCustomer
    }}>
      {children}
    </DbContext.Provider>
  );
};

export const useDb = () => {
  const context = useContext(DbContext);
  if (!context) throw new Error('useDb must be used within DbProvider');
  return context;
};
