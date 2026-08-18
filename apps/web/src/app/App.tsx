import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthContext.js';
import { DashboardLayout } from '../layouts/DashboardLayout.js';
import { LoginPage } from '../features/auth/LoginPage.js';
import { DashboardPage } from '../features/dashboard/DashboardPage.js';
import { CustomersListPage } from '../features/customers/CustomersListPage.js';
import { CustomerDetailPage } from '../features/customers/CustomerDetailPage.js';
import { LoansListPage } from '../features/loans/LoansListPage.js';
import { LoanDetailPage } from '../features/loans/LoanDetailPage.js';
import { PaymentsListPage } from '../features/payments/PaymentsListPage.js';
import { CollectionsPage } from '../features/collections/CollectionsPage.js';
import { OverduePage } from '../features/overdue/OverduePage.js';
import { ReportsPage } from '../features/reports/ReportsPage.js';
import { AuditLogsPage } from '../features/audit/AuditLogsPage.js';
import { SettingsPage } from '../features/settings/SettingsPage.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="customers" element={<CustomersListPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="loans" element={<LoansListPage />} />
            <Route path="loans/:id" element={<LoanDetailPage />} />
            <Route path="payments" element={<PaymentsListPage />} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="overdue" element={<OverduePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
