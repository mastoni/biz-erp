'use client';

import React, { useState } from 'react';
import { FileText, ShoppingBag, Receipt } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useReportsViewModel } from '@/features/reports/use-reports-viewmodel';
import { ReportsExecutiveKPICards } from '@/features/reports/components/ReportsExecutiveKPICards';
import { CashFlowChart, SalesCompositionChart } from '@/features/reports/components/ReportsCharts';
import { ReportsTabSelector } from '@/features/reports/components/ReportsTabSelector';
import { ReportsActivePanel } from '@/features/reports/components/ReportsActivePanel';

export default function ReportsPage() {
  const { business } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    range,
    setRange,
    activeTab,
    setActiveTab,
    state,
    isLoading,
    error,
    kpi,
    cashFlow,
    salesComposition,
    salesReport,
    inventoryReport,
    profitLoss,
    isP1Tab,
    p1TabUnavailableMessage,
    exportCsv,
  } = useReportsViewModel({
    businessId: business?.id,
  });

  const handleExportCsv = () => {
    const csvContent = exportCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan-${activeTab}-${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage('Laporan diunduh sebagai CSV.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-5 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          data-testid="reports-toast"
          className="fixed top-4 right-4 z-50 rounded-xl border border-pine/30 bg-pine text-white px-4 py-2.5 text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {toastMessage}
        </div>
      )}

      {/* Section Head with 7d / 30d Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Laporan & Analisis
          </h1>
          <p className="text-xs text-fog mt-0.5">
            Seluruh laporan dihitung langsung dari data transaksi, stok, dan pembukuan.
          </p>
        </div>

        <div className="flex rounded-lg border border-line bg-surface p-0.5 shadow-sm self-start sm:self-auto" data-testid="range-toggle">
          {(['7d', '30d'] as const).map((r) => {
            const isSelected = range === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                data-testid={`range-btn-${r}`}
                className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-pine text-[#f2efe2] shadow-sm'
                    : 'text-fog hover:text-ink'
                }`}
              >
                {r === '7d' ? '7 Hari' : '30 Hari'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-clay/30 bg-clay/10 p-4 text-xs font-medium text-clay">
          {error}
        </div>
      )}

      {/* Executive KPI Cards */}
      <ReportsExecutiveKPICards kpi={kpi} />

      {/* 2-Column Analytics Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CashFlowChart points={cashFlow} />
        <SalesCompositionChart items={salesComposition} />
      </div>

      {/* 6 Report Selector Cards */}
      <ReportsTabSelector activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Active Report Panel */}
      <ReportsActivePanel
        activeTab={activeTab}
        range={range}
        salesReport={salesReport}
        inventoryReport={inventoryReport}
        profitLoss={profitLoss}
        isP1Tab={isP1Tab}
        p1TabUnavailableMessage={p1TabUnavailableMessage}
        businessName={business?.name || 'SKM Mart'}
        onExportCsv={handleExportCsv}
      />

      {/* Footer Notice Banner */}
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-3 text-[12px] text-fog">
        <FileText className="h-4 w-4 shrink-0 text-pine" />
        <span>
          Laporan laba rugi & valuasi stok diperbarui otomatis saat ada transaksi kasir, penerimaan PO, atau penyesuaian stok.
        </span>
        <span className="ml-auto hidden items-center gap-1.5 sm:flex opacity-60">
          <ShoppingBag className="h-3.5 w-3.5" /> <Receipt className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
