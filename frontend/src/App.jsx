import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { DbProvider } from './context/DbContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import DeviceRegistration from './pages/DeviceRegistration';
import DeviceAddPage from './pages/DeviceAddPage';
import DeviceVerification from './pages/DeviceVerification';
import CustomerRegistration from './pages/CustomerRegistration';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerPortal from './pages/CustomerPortal';
import UsersPage from './pages/UsersPage';
import CommandCenter from './pages/CommandCenter';
import OtaManager from './pages/OtaManager';
import Analytics from './pages/Analytics';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// Root redirect component
const RootRedirect = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return user.role === 'admin' 
    ? <Navigate to="/admin" replace /> 
    : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <ThemeProvider>
      <DbProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/portal" element={<CustomerPortal />} />
              <Route path="/register/:deviceId" element={<CustomerRegistration />} />

              {/* Protected Admin Routes */}
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/register-device" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DeviceRegistration />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/device-add" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DeviceAddPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/command-center" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <CommandCenter />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/verify-device" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DeviceVerification />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ota"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <OtaManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard/:deviceId"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <CustomerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics/:deviceId?"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Analytics />
                  </ProtectedRoute>
                }
              />

              {/* Protected Customer Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <CustomerDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <Analytics />
                  </ProtectedRoute>
                } 
              />

              {/* Fallbacks */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </DbProvider>
    </ThemeProvider>
  );
}

export default App;
