# GATE 1 — NAVIGATION & TERMINOLOGY STREAMLINING CHECKPOINT

## 1. Before
Sebelum perbaikan, antarmuka navigasi desktop ([Sidebar.tsx](file:///d:/projectfolder/biz-erp/apps/web/src/components/layout/Sidebar.tsx)) dan mobile ([Header.tsx](file:///d:/projectfolder/biz-erp/apps/web/src/components/layout/Header.tsx)) menampilkan 19 menu secara *flat* tanpa struktur kategori dan mencampurkan bahasa Inggris serta Indonesia secara tidak konsisten:
- `Dashboard`, `Products`, `Inventory`, `Movement History`, `Stock Adjustment`, `Sales`, `Customers`, `Users`, `Reports` (Inggris)
- `Kasir`, `Pembelian`, `Supplier`, `Pembukuan`, `Laporan Keuangan`, `Pengaturan`, `Perangkat Hardware`, `Layanan Servis`, `Langganan & Tagihan`, `Digital Wallet` (Indonesia)
Hal ini memicu kebingungan kognitif dan mempersulit navigasi bagi pemilik toko/warung UMKM.

## 2. After
Navigasi telah disederhanakan dan dikelompokkan ke dalam **5 cluster terstruktur** dengan label bahasa Indonesia yang ramah UMKM:
1. **Ringkasan & Kasir**: `Dasbor`, `Kasir`, `Penjualan`
2. **Produk & Stok**: `Katalog Produk`, `Stok Barang`, `Riwayat Stok`, `Penyesuaian Stok`
3. **Pembelian & Kontak**: `Pembelian`, `Pelanggan`, `Supplier`
4. **Keuangan & Dompet**: `Laporan Keuangan`, `Pembukuan`, `Digital Wallet`
5. **Laporan & Pengaturan**: `Laporan`, `Kelola Pengguna`, `Pengaturan`, `Perangkat Hardware`, `Layanan Servis`, `Langganan & Tagihan`

## 3. Navigation Mapping

| Route | Cluster | Label Baru (User-Facing) | Label Lama | Status |
| :--- | :--- | :--- | :--- | :---: |
| `/dashboard` | Ringkasan & Kasir | Dasbor | Dashboard | RENAME |
| `/pos` | Ringkasan & Kasir | Kasir | Kasir | KEEP |
| `/sales` | Ringkasan & Kasir | Penjualan | Sales | RENAME |
| `/products` | Produk & Stok | Katalog Produk | Products | RENAME |
| `/inventory` | Produk & Stok | Stok Barang | Inventory | RENAME |
| `/inventory/movements` | Produk & Stok | Riwayat Stok | Movement History | RENAME |
| `/inventory/adjustment` | Produk & Stok | Penyesuaian Stok | Stock Adjustment | RENAME |
| `/purchases` | Pembelian & Kontak | Pembelian | Pembelian | KEEP |
| `/customers` | Pembelian & Kontak | Pelanggan | Customers | RENAME |
| `/suppliers` | Pembelian & Kontak | Supplier | Supplier | KEEP |
| `/finance` | Keuangan & Dompet | Laporan Keuangan | Laporan Keuangan | KEEP |
| `/finance/bookkeeping` | Keuangan & Dompet | Pembukuan | Pembukuan | KEEP |
| `/wallet` | Keuangan & Dompet | Digital Wallet | Digital Wallet | KEEP |
| `/reports` | Laporan & Pengaturan | Laporan | Reports | RENAME |
| `/users` | Laporan & Pengaturan | Kelola Pengguna | Users | RENAME |
| `/settings` | Laporan & Pengaturan | Pengaturan | Pengaturan | KEEP |
| `/devices` | Laporan & Pengaturan | Perangkat Hardware | Perangkat Hardware | KEEP |
| `/device-services` | Laporan & Pengaturan | Layanan Servis | Layanan Servis | KEEP |
| `/billing` | Laporan & Pengaturan | Langganan & Tagihan | Langganan & Tagihan | KEEP |

## 4. Terminology Mapping
- Istilah user-facing diselaraskan secara konsisten ke dalam bahasa Indonesia tanpa mengubah kontrak API backend atau route URL.
- Nama cluster menggunakan huruf kapital kecil yang jelas dan tipografi elegan (`text-[10px] uppercase font-mono tracking-wider`).

## 5. Role Impact & RBAC Safety
- **OWNER**: Memiliki visibilitas lengkap pada kelima cluster navigasi.
- **CASHIER**: Hanya melihat menu operasional kasir, stok barang, pelanggan, supplier, kasir, dan pengaturan dasar; menu manajerial terlarang (`/products`, `/sales`, `/inventory/movements`, `/users`, `/wallet`) tetap disaring secara ketat.
- **STAFF**: Mengikuti hak akses operasional staf yang telah ditetapkan.
- RBAC permissions (`ROUTE_PERMISSIONS`) dan guard evaluasi (`canAccessRoute`) 100% dipertahankan dan tidak mengalami pelebaran akses.

## 6. Route Impact
- Semua URL route existing (`/dashboard`, `/pos`, `/products`, `/inventory`, `/sales`, `/purchases`, `/customers`, `/finance`, `/wallet`, dll) tetap 100% valid dan aktif.
- Nol broken links, nol redirect loops, dan nol 404 errors.

## 7. Tests & Validation
- `npm run typecheck --prefix apps/web`: **0 errors (PASS)**
- `npm test --prefix apps/web`: **980/980 tests PASS across 64 test suites (100% PASS)**
  - Menguji `getAuthorizedNavigation` dan `getGroupedAuthorizedNavigation` untuk OWNER dan CASHIER (`SHELL-001..008`).

## 8. Diff Hygiene
- Hanya file layout dan helper RBAC navigasi web yang dimodifikasi:
  - `apps/web/src/lib/rbac.ts`
  - `apps/web/src/lib/__tests__/rbac.test.ts`
  - `apps/web/src/components/layout/Sidebar.tsx`
  - `apps/web/src/components/layout/Header.tsx`
- `git diff --check`: **Clean (PASS)**

## 9. Production Status
- Lingkungan produksi tetap tidak tersentuh (Production untouched, no deploy).

## 10. Final Verdict
**PASS** — Seluruh kriteria penerimaan GATE 1 terpenuhi secara penuh.
