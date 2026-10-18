import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AssessmentWizard from './pages/AssessmentWizard';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import RiskResult from './pages/RiskResult';
import SchemeFinder from './pages/SchemeFinder';
import SchemeDetail from './pages/SchemeDetail';
import SchemeQuickCheck from './pages/SchemeQuickCheck';
import MySchemes from './pages/MySchemes';
import Settings from './pages/Settings';
import SecurityLog from './pages/SecurityLog';
import HelpCenter from './pages/HelpCenter';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageSchemes from './pages/admin/ManageSchemes';
import SchemeUpdates from './pages/admin/SchemeUpdates';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';

// AdminRoute Wrapper
const AdminRoute = ({ children }) => {
  const { user, loading, loggingOut } = useAuth();

  if (loading || loggingOut) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-muted)' }}>Checking your session...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          {/* Declared outside the AdminRoute group below so it stays reachable when logged out. */}
          <Route path="/admin/login" element={<Auth mode="admin" />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/assessment" element={<AssessmentWizard />} />
            <Route path="/assessment/result/:id" element={<RiskResult />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/schemes" element={<SchemeFinder />} />
            <Route path="/schemes/quick-check" element={<SchemeQuickCheck />} />
            <Route path="/schemes/:slug" element={<SchemeDetail />} />
            <Route path="/my-schemes" element={<MySchemes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/security-log" element={<SecurityLog />} />
            <Route path="/help" element={<HelpCenter />} />
          </Route>

          <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route path="/admin" element={<Navigate to="/admin/analytics" replace />} />
            <Route path="/admin/analytics" element={<AdminDashboard />} />
            <Route path="/admin/schemes" element={<ManageSchemes />} />
            <Route path="/admin/schemes/updates" element={<SchemeUpdates />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
