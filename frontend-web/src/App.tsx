import React, { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import LoginPage from './pages/Login'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { PlanProvider } from './contexts/PlanContext'
import AppShell from './components/layout/AppShell'
import RequireAuth from './components/auth/RequireAuth'
import OverviewPage from './pages/Overview'
import FarmsPage from './pages/Farms'
import TasksPage from './pages/Tasks'
import FarmPlansPage from './pages/FarmPlans'
import WorkersPage from './pages/Workers'
import SensorsPage from './pages/Sensors'
import AssetsPage from './pages/Assets'
import FinancePage from './pages/Finance'
import ReportsPage from './pages/Reports'
import DemoPage from './pages/Demo'
import SettingsPage from './pages/Settings'
import PaymentsVerify from './pages/PaymentsVerify'
const FarmMapPage = lazy(() => import('./pages/FarmMap'))

function App(){
  return (
    <ToastProvider>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <PlanProvider>
              <Routes>
              <Route path="/login" element={<LoginPage/>} />
              <Route path="/register" element={<LoginPage initialMode="register" />} />
              <Route path="/:tenantSlug/login" element={<LoginPage/>} />
              <Route path="/:tenantSlug/register" element={<LoginPage initialMode="register" />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<OverviewPage/>} />
                  <Route path="/farms" element={<FarmsPage/>} />
                  <Route path="/map" element={<Suspense fallback={<div className="panel">Loading map...</div>}><FarmMapPage/></Suspense>} />
                  <Route path="/tasks" element={<TasksPage/>} />
                  <Route path="/farm-plans" element={<FarmPlansPage/>} />
                  <Route path="/workers" element={<WorkersPage/>} />
                  <Route path="/team" element={<Navigate to="/workers" replace />} />
                  <Route path="/assets" element={<AssetsPage/>} />
                  <Route path="/sensors" element={<SensorsPage/>} />
                  <Route path="/finance" element={<FinancePage/>} />
                  <Route path="/reports" element={<ReportsPage/>} />
                  <Route path="/demo" element={<DemoPage/>} />
                  <Route path="/settings" element={<SettingsPage/>} />
                  <Route path="/payments/verify" element={<PaymentsVerify/>} />
                </Route>
              </Route>
              <Route element={<RequireAuth />}>
                <Route path="/:tenantSlug" element={<AppShell />}>
                  <Route index element={<OverviewPage/>} />
                  <Route path="farms" element={<FarmsPage/>} />
                  <Route path="map" element={<Suspense fallback={<div className="panel">Loading map...</div>}><FarmMapPage/></Suspense>} />
                  <Route path="tasks" element={<TasksPage/>} />
                  <Route path="farm-plans" element={<FarmPlansPage/>} />
                  <Route path="workers" element={<WorkersPage/>} />
                  <Route path="team" element={<Navigate to="../workers" replace />} />
                  <Route path="assets" element={<AssetsPage/>} />
                  <Route path="sensors" element={<SensorsPage/>} />
                  <Route path="finance" element={<FinancePage/>} />
                  <Route path="reports" element={<ReportsPage/>} />
                  <Route path="demo" element={<DemoPage/>} />
                  <Route path="settings" element={<SettingsPage/>} />
                  <Route path="payments/verify" element={<PaymentsVerify/>} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </PlanProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
