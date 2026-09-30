import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { FilesPage } from './pages/FilesPage';
import { FileDetailPage } from './pages/FileDetailPage';
import { DynamicEditPage } from './pages/DynamicEditPage';
import { TPAConsolePage } from './pages/TPAConsolePage';
import { LedgerPage } from './pages/LedgerPage';
import { BenchmarkPage } from './pages/BenchmarkPage';
import { AlertsPage } from './pages/AlertsPage';
import { BatchAuditPage } from './pages/BatchAuditPage';
import { AuditsPage } from './pages/AuditsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Website Routes (Cinematic & Academic) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Dedicated Application Routes (Wrapped in AppLayout with Sidebar & Topbar) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/files/:id" element={<FileDetailPage />} />
          <Route path="/files/:id/edit" element={<DynamicEditPage />} />
          <Route path="/audits" element={<AuditsPage />} />
          <Route path="/tpa" element={<TPAConsolePage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/batch-audit" element={<BatchAuditPage />} />
          <Route path="/benchmarks" element={<BenchmarkPage />} />
        </Route>

        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
