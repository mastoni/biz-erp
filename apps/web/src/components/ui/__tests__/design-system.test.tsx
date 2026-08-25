import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { Badge } from '../badge';
import { StatusPill } from '../status-pill';
import { KPICard } from '../kpi-card';
import { Search } from '../search';
import { EmptyState } from '../empty-state';
import { ErrorState } from '../error-state';
import { Modal } from '../modal';

describe('Web Design System Components', () => {
  it('renders Badge with pine variant classes', () => {
    const html = renderToString(<Badge variant="pine" dot>SKMNet</Badge>);
    expect(html).toContain('SKMNet');
    expect(html).toContain('bg-pine-soft');
    expect(html).toContain('text-pine');
  });

  it('renders StatusPill for synced status', () => {
    const html = renderToString(<StatusPill status="synced" />);
    expect(html).toContain('Tersinkron');
    expect(html).toContain('bg-pine-soft');
  });

  it('renders KPICard with title and value', () => {
    const html = renderToString(
      <KPICard
        title="Omzet Harian"
        value="Rp 12.500.000"
        subtitle="32 transaksi"
        tone="pine"
      />
    );
    expect(html).toContain('Omzet Harian');
    expect(html).toContain('Rp 12.500.000');
    expect(html).toContain('32 transaksi');
  });

  it('renders Search input with placeholder', () => {
    const html = renderToString(<Search placeholder="Cari nota..." value="TRX-101" onChange={() => {}} />);
    expect(html).toContain('Cari nota...');
    expect(html).toContain('TRX-101');
  });

  it('renders EmptyState with title and description', () => {
    const html = renderToString(
      <EmptyState
        title="Keranjang Kosong"
        description="Pilih produk dari katalog untuk memulai transaksi"
      />
    );
    expect(html).toContain('Keranjang Kosong');
    expect(html).toContain('Pilih produk dari katalog untuk memulai transaksi');
  });

  it('renders ErrorState with title and message', () => {
    const html = renderToString(
      <ErrorState
        title="Koneksi Terputus"
        message="Gagal memuat data dari server"
      />
    );
    expect(html).toContain('Koneksi Terputus');
    expect(html).toContain('Gagal memuat data dari server');
  });

  it('renders Modal dialog container when open', () => {
    const html = renderToString(
      <Modal open={true} onClose={() => {}} title="Detail Transaksi">
        <p>Isi Modal</p>
      </Modal>
    );
    expect(html).toContain('Detail Transaksi');
    expect(html).toContain('Isi Modal');
  });
});
