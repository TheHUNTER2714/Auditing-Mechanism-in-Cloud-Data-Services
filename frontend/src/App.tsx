import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
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
      <div className="min-h-screen flex flex-col bg-[#050816] text-[#F1F5F9]">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/files/:id" element={<FileDetailPage />} />
            <Route path="/files/:id/edit" element={<DynamicEditPage />} />
            <Route path="/tpa" element={<TPAConsolePage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/benchmarks" element={<BenchmarkPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/batch-audit" element={<BatchAuditPage />} />
            <Route path="/audits" element={<AuditsPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
