import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AutomationPage } from './pages/AutomationPage';
import { BrandSetupPage } from './pages/BrandSetupPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { FollowUpsPage } from './pages/FollowUpsPage';
import { LeadsPage } from './pages/LeadsPage';
import { LoginPage } from './pages/LoginPage';
import { ProductsPage } from './pages/ProductsPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { StorefrontPage } from './pages/StorefrontPage';
import { TeamPage } from './pages/TeamPage';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/store/:businessSlug" element={<StorefrontPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER', 'SALES_EMPLOYEE']}>
                    <LeadsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER', 'SALES_EMPLOYEE']}>
                    <CustomersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/follow-ups"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER', 'SALES_EMPLOYEE']}>
                    <FollowUpsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/products"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                    <ProductsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                    <AutomationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/brand-setup"
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <BrandSetupPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-assistant"
                element={
                  <ProtectedRoute roles={['ADMIN', 'SALES_EMPLOYEE']}>
                    <AiAssistantPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team"
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <TeamPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
