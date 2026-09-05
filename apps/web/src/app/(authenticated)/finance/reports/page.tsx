'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  FinanceReportHeader,
  ReportTab,
  PeriodPreset,
} from '@/features/finance/components/FinanceReportHeader';
import { ProfitLossView } from '@/features/finance/components/ProfitLossView';
import { BalanceSheetView } from '@/features/finance/components/BalanceSheetView';
import { CashflowReportView } from '@/features/finance/components/CashflowReportView';
import { GeneralLedgerView } from '@/features/finance/components/GeneralLedgerView';
import { TrialBalanceView } from '@/features/finance/components/TrialBalanceView';
import {
  getProfitLossReport,
  getBalanceSheetReport,
  getCashflowStatementReport,
  getGeneralLedgerReport,
  getTrialBalanceReport,
  getAccounts,
  getFinanceApiErrorMessage,
} from '@/features/finance/api';
import type {
  ProfitLossReportDto,
  BalanceSheetReportDto,
  CashflowStatementReportDto,
  GeneralLedgerReportDto,
  TrialBalanceReportDto,
  AccountDto,
} from '@/features/finance/types';
import { getBranches } from '@/features/inventory/api';
import type { Branch } from '@/features/inventory/types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function getInitialDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const from = `${year}-${month}-01`;
  const to = `${year}-${month}-${day}`;
  return { from, to, asOf: to };
}

export default function FinanceReportsPage() {
  const { business, role } = useAuth();

  const [activeTab, setActiveTab] = useState<ReportTab>('labarugi');
  const [preset, setPreset] = useState<PeriodPreset>('bulan-ini');

  const initialDates = useMemo(() => getInitialDates(), []);
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);
  const [asOfDate, setAsOfDate] = useState<string>(initialDates.asOf);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [profitLossData, setProfitLossData] = useState<ProfitLossReportDto | null>(null);
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetReportDto | null>(null);
  const [cashflowData, setCashflowData] = useState<CashflowStatementReportDto | null>(null);
  const [generalLedgerData, setGeneralLedgerData] = useState<GeneralLedgerReportDto | null>(null);
  const [trialBalanceData, setTrialBalanceData] = useState<TrialBalanceReportDto | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  // RBAC Guard: CASHIER is strictly blocked from /finance/reports
  const isAuthorized = role === 'OWNER' || role === 'STAFF';

  // Load branches and COA accounts
  useEffect(() => {
    if (!business?.id || !isAuthorized) return;

    let isMounted = true;
    async function loadMeta() {
      try {
        const [branchList, accountListRes] = await Promise.all([
          getBranches(business!.id).catch(() => []),
          getAccounts({ limit: 100 }).catch(() => ({ items: [], total: 0 })),
        ]);
        if (isMounted) {
          setBranches(branchList);
          setAccounts(accountListRes.items || []);
        }
      } catch {
        // Non-fatal
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [business?.id, isAuthorized]);

  // Handle Preset Change
  const handlePresetChange = useCallback((newPreset: PeriodPreset) => {
    setPreset(newPreset);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const todayDay = String(now.getDate()).padStart(2, '0');
    const curMonthStr = String(month + 1).padStart(2, '0');

    if (newPreset === 'bulan-ini') {
      const f = `${year}-${curMonthStr}-01`;
      const t = `${year}-${curMonthStr}-${todayDay}`;
      setFromDate(f);
      setToDate(t);
      setAsOfDate(t);
      setDateError(null);
    } else if (newPreset === 'bulan-lalu') {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const prevMonthStr = String(prevMonth + 1).padStart(2, '0');
      const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      const f = `${prevYear}-${prevMonthStr}-01`;
      const t = `${prevYear}-${prevMonthStr}-${String(lastDay).padStart(2, '0')}`;
      setFromDate(f);
      setToDate(t);
      setAsOfDate(t);
      setDateError(null);
    } else if (newPreset === 'ytd') {
      const f = `${year}-01-01`;
      const t = `${year}-${curMonthStr}-${todayDay}`;
      setFromDate(f);
      setToDate(t);
      setAsOfDate(t);
      setDateError(null);
    }
  }, []);

  // Handle Manual Date Changes
  const handleFromDateChange = useCallback(
    (date: string) => {
      setPreset('kustom');
      setFromDate(date);
      if (toDate && date > toDate) {
        setDateError('Tanggal awal tidak boleh lebih besar dari tanggal akhir.');
      } else {
        setDateError(null);
      }
    },
    [toDate]
  );

  const handleToDateChange = useCallback(
    (date: string) => {
      setPreset('kustom');
      setToDate(date);
      setAsOfDate(date);
      if (fromDate && fromDate > date) {
        setDateError('Tanggal akhir tidak boleh lebih kecil dari tanggal awal.');
      } else {
        setDateError(null);
      }
    },
    [fromDate]
  );

  const handleAsOfDateChange = useCallback((date: string) => {
    setPreset('kustom');
    setAsOfDate(date);
    setToDate(date);
    setDateError(null);
  }, []);

  // Fetch Report Data based on activeTab
  const fetchReportData = useCallback(async () => {
    if (!business?.id || !isAuthorized) return;
    if (activeTab !== 'neraca' && fromDate > toDate) {
      setDateError('Tanggal awal tidak boleh lebih besar dari tanggal akhir.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const branchParam = selectedBranchId || undefined;

    try {
      if (activeTab === 'labarugi') {
        const res = await getProfitLossReport({
          from: fromDate,
          to: toDate,
          branch_id: branchParam,
        });
        setProfitLossData(res);
      } else if (activeTab === 'neraca') {
        const res = await getBalanceSheetReport({
          as_of: asOfDate || toDate,
          branch_id: branchParam,
        });
        setBalanceSheetData(res);
      } else if (activeTab === 'aruskas') {
        const res = await getCashflowStatementReport({
          from: fromDate,
          to: toDate,
          branch_id: branchParam,
        });
        setCashflowData(res);
      } else if (activeTab === 'bukubesar') {
        const res = await getGeneralLedgerReport({
          from: fromDate,
          to: toDate,
          branch_id: branchParam,
          account_id: selectedAccountId || undefined,
        });
        setGeneralLedgerData(res);
      } else if (activeTab === 'neracasaldo') {
        const res = await getTrialBalanceReport({
          from: fromDate,
          to: toDate,
          branch_id: branchParam,
        });
        setTrialBalanceData(res);
      }
    } catch (err) {
      setError(getFinanceApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    business?.id,
    isAuthorized,
    activeTab,
    fromDate,
    toDate,
    asOfDate,
    selectedBranchId,
    selectedAccountId,
  ]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Client-Side CSV Export Generator
  const handleExportCsv = useCallback(() => {
    let csvRows: string[][] = [];
    let filename = `laporan_${activeTab}_${fromDate}_${toDate}.csv`;

    if (activeTab === 'labarugi' && profitLossData) {
      filename = `laba_rugi_${fromDate}_sd_${toDate}.csv`;
      const grossProfit =
        (profitLossData.revenue_minor || 0) - (profitLossData.cogs_minor || 0);
      csvRows = [
        ['LAPORAN LABA RUGI'],
        [`Periode: ${fromDate} s/d ${toDate}`],
        [''],
        ['Komponen', 'Jumlah (IDR)'],
        ['Total Pendapatan (Revenue)', String(profitLossData.revenue_minor || 0)],
        ['Harga Pokok Penjualan (COGS)', String(profitLossData.cogs_minor || 0)],
        ['Laba Kotor (Gross Profit)', String(grossProfit)],
        ['Beban Operasional', String(profitLossData.operating_expense_minor || 0)],
        ['Total Beban Usaha', String(profitLossData.expense_minor || 0)],
        ['Laba (Rugi) Bersih', String(profitLossData.net_income_minor || 0)],
      ];
    } else if (activeTab === 'neraca' && balanceSheetData) {
      filename = `neraca_per_${asOfDate || toDate}.csv`;
      const totalLiabEq =
        (balanceSheetData.total_liabilities_minor || 0) +
        (balanceSheetData.total_equity_minor || 0);
      const isBalanced =
        balanceSheetData.total_assets_minor === totalLiabEq ? 'SEIMBANG' : 'TIDAK SEIMBANG';
      csvRows = [
        ['LAPORAN NERACA KEUANGAN'],
        [`Per Tanggal: ${asOfDate || toDate}`],
        [''],
        ['Komponen', 'Jumlah (IDR)'],
        ['Total Aset (Aktiva)', String(balanceSheetData.total_assets_minor || 0)],
        ['Total Kewajiban (Liabilitas)', String(balanceSheetData.total_liabilities_minor || 0)],
        ['Total Ekuitas (Modal)', String(balanceSheetData.total_equity_minor || 0)],
        ['Total Pasiva (Kewajiban + Modal)', String(totalLiabEq)],
        ['Status Keseimbangan', isBalanced],
      ];
    } else if (activeTab === 'aruskas' && cashflowData) {
      filename = `arus_kas_${fromDate}_sd_${toDate}.csv`;
      csvRows = [
        ['LAPORAN ARUS KAS'],
        [`Periode: ${fromDate} s/d ${toDate}`],
        [''],
        ['Total Kas Masuk (Inflow)', String(cashflowData.total_inflow || 0)],
        ['Total Kas Keluar (Outflow)', String(cashflowData.total_outflow || 0)],
        ['Arus Kas Bersih (Net Flow)', String(cashflowData.net_cash_flow || 0)],
        [''],
        ['Tanggal', 'Kode Akun', 'Nama Akun', 'Tipe', 'Keterangan', 'Kas Masuk', 'Kas Keluar', 'Arus Bersih'],
      ];
      (cashflowData.entries || []).forEach((e) => {
        csvRows.push([
          e.date,
          e.account_code,
          e.account_name,
          e.account_type,
          `"${(e.description || '').replace(/"/g, '""')}"`,
          String(e.debit_minor),
          String(e.credit_minor),
          String(e.net_flow),
        ]);
      });
    } else if (activeTab === 'bukubesar' && generalLedgerData) {
      filename = `buku_besar_${fromDate}_sd_${toDate}.csv`;
      csvRows = [
        ['LAPORAN BUKU BESAR (GENERAL LEDGER)'],
        [`Periode: ${fromDate} s/d ${toDate}`],
        [''],
        ['Saldo Awal', String(generalLedgerData.opening_balance || 0)],
        ['Mutasi Periode', String(generalLedgerData.period_movements || 0)],
        ['Saldo Akhir', String(generalLedgerData.closing_balance || 0)],
        [''],
        ['Tanggal', 'Kode Akun', 'Nama Akun', 'Sumber', 'Keterangan', 'Debit', 'Kredit', 'Saldo Berjalan'],
      ];
      (generalLedgerData.entries || []).forEach((e) => {
        csvRows.push([
          e.date,
          e.account_code,
          e.account_name,
          e.source_type,
          `"${(e.description || '').replace(/"/g, '""')}"`,
          String(e.debit_minor),
          String(e.credit_minor),
          String(e.running_balance),
        ]);
      });
    } else if (activeTab === 'neracasaldo' && trialBalanceData) {
      filename = `neraca_saldo_${fromDate}_sd_${toDate}.csv`;
      csvRows = [
        ['LAPORAN NERACA SALDO (TRIAL BALANCE)'],
        [`Periode: ${fromDate} s/d ${toDate}`],
        [''],
        ['Kode Akun', 'Nama Akun', 'Tipe', 'Debit Total', 'Kredit Total', 'Saldo Bersih'],
      ];
      trialBalanceData.forEach((t) => {
        csvRows.push([
          t.account_code,
          t.account_name,
          t.account_type,
          String(t.debit_total),
          String(t.credit_total),
          String(t.balance),
        ]);
      });
    }

    if (csvRows.length === 0) return;

    const csvContent = '\uFEFF' + csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    activeTab,
    fromDate,
    toDate,
    asOfDate,
    profitLossData,
    balanceSheetData,
    cashflowData,
    generalLedgerData,
    trialBalanceData,
  ]);

  // Print Handler
  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  // 1. RBAC Guard: If CASHIER, render blocked view
  if (!isAuthorized) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="font-display text-xl font-bold text-ink">
          Akses Laporan Keuangan Dibatasi
        </h1>
        <p className="text-xs text-fog max-w-md mt-1.5 leading-relaxed">
          Halaman Laporan Keuangan (Laba Rugi, Neraca, Arus Kas, Buku Besar, Neraca Saldo) hanya dapat diakses oleh Pemilik Usaha (OWNER) dan Staf Keuangan (STAFF).
        </p>
        <Link
          href="/finance"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-paper"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Ringkasan Keuangan</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <FinanceReportHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        preset={preset}
        onPresetChange={handlePresetChange}
        fromDate={fromDate}
        toDate={toDate}
        asOfDate={asOfDate}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        onAsOfDateChange={handleAsOfDateChange}
        branches={branches}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        onExportCsv={handleExportCsv}
        onPrint={handlePrint}
        onRefresh={fetchReportData}
        isLoading={isLoading}
        dateError={dateError}
      />

      {/* Print Document Header (Visible only when printing) */}
      <div className="hidden print:block mb-6 border-b border-ink/20 pb-4">
        <h1 className="font-display text-2xl font-bold text-ink">
          {business?.name || 'BIZ-ERP'} — Laporan Keuangan
        </h1>
        <p className="text-xs text-fog mt-1">
          Laporan: {REPORT_TABS_CONFIG.find((t) => t.id === activeTab)?.label} | Periode: {fromDate} s/d {toDate}
        </p>
      </div>

      {/* Active Tab View */}
      {activeTab === 'labarugi' && (
        <ProfitLossView
          data={profitLossData}
          isLoading={isLoading}
          error={error}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}

      {activeTab === 'neraca' && (
        <BalanceSheetView
          data={balanceSheetData}
          isLoading={isLoading}
          error={error}
          asOfDate={asOfDate || toDate}
        />
      )}

      {activeTab === 'aruskas' && (
        <CashflowReportView
          data={cashflowData}
          isLoading={isLoading}
          error={error}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}

      {activeTab === 'bukubesar' && (
        <GeneralLedgerView
          data={generalLedgerData}
          isLoading={isLoading}
          error={error}
          fromDate={fromDate}
          toDate={toDate}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountSelect={setSelectedAccountId}
        />
      )}

      {activeTab === 'neracasaldo' && (
        <TrialBalanceView
          data={trialBalanceData}
          isLoading={isLoading}
          error={error}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
    </div>
  );
}

const REPORT_TABS_CONFIG = [
  { id: 'labarugi', label: 'Laba Rugi' },
  { id: 'neraca', label: 'Neraca' },
  { id: 'aruskas', label: 'Arus Kas' },
  { id: 'bukubesar', label: 'Buku Besar' },
  { id: 'neracasaldo', label: 'Neraca Saldo' },
];
