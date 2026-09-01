# PHASE SA-2.3 — SUPERADMIN COMMERCIAL CONTROL CENTER REPORT

**Status:** IMPLEMENTATION & VERIFICATION COMPLETE (READY FOR SA-2.4)
**Track:** Superadmin Control Plane (SA Track)
**Phase:** SA-2.3
**Baseline Commit:** `ee8965b426c42c47405b69f30bd478274947c29f`
**Date:** September 1, 2026

---

## 1. Architecture Classification

Dokumen ini membedakan secara tegas 5 tingkatan kepastian arsitektur:
- **`[FACT]`**: Fakta terbukti dari kode sumber, routing Next.js Turbopack, dan backend API SA-2.2 aktif.
- **`[DECISION]`**: Keputusan arsitektur yang telah disetujui pada SA-2.0, SA-2.1, dan SA-2.2.
- **`[IMPLEMENTATION]`**: Web UI Console, Drawer editors, Bundle composer, Showcase control center, Live Preview modal, dan client unit test suite yang dibangun pada SA-2.3.
- **`[DEFERRED]`**: Landing page public app frontend (`apps/landing`) yang dijadwalkan pada fase SA-2.4.
- **`[OPEN QUESTION]`**: Tidak ada pertanyaan terbuka tersisa untuk Web UI Control Plane.

---

## 2. Routes & UI Information Architecture `[IMPLEMENTATION]`

### A. Navigation Hierarchy (Platform Control Plane)
Sidebar terintegrasi secara modular di [`apps/web/src/features/platform/list-helpers.ts`](file:///d:/projectfolder/biz-erp/apps/web/src/features/platform/list-helpers.ts) dan [`apps/web/src/components/platform/PlatformSidebar.tsx`](file:///d:/projectfolder/biz-erp/apps/web/src/components/platform/PlatformSidebar.tsx):
1. **Overview** (`/platform`)
2. **Businesses** (`/platform/businesses`) — SA-1 Tenant Lifecycle Approval Gate
3. **Plans & Pricing** (`/platform/plans`) — SA-2.3 Commercial Plans Console
4. **Bundle Composer** (`/platform/bundles`) — SA-2.3 Multi-Item Bundle Composer
5. **Landing Showcase** (`/platform/showcase`) — SA-2.3 Showcase & Live Landing Preview
6. **Modules** (`/platform/modules`)
7. **Subscriptions** (`/platform/subscriptions`)

---

## 3. UI Console Details & Capabilities `[IMPLEMENTATION]`

### 1. Plans & Pricing Console ([`apps/web/src/app/platform/plans/page.tsx`](file:///d:/projectfolder/biz-erp/apps/web/src/app/platform/plans/page.tsx))
- **KPI Summary Cards:** Total Paket, Paket Aktif, Draft Internal, Deprecated.
- **Filters & Search:** Pencarian nama/kode paket, Filter status (`ACTIVE`, `DRAFT`, `DEPRECATED`), Filter Family (`ERP_PLAN`, `INTERNET_PLAN`, `CCTV_PLAN`).
- **Interactive Plans Table:**
  - Menampilkan nama & kode paket (PK).
  - Family, Tier, dan Billing cycle badge.
  - Skema harga bersih (*Net Price*) dalam Rupiah langsung (`formatMinor`).
  - Limits kuota cabang & pengguna, serta durasi trial.
  - Status state machine badge (`ACTIVE` = teal, `DRAFT` = amber, `DEPRECATED` = gray).
  - Indikator tayang publik (`is_published` dan nomor urut `display_order`).
- **6-Section Drawer Editor:**
  - **Section 1 (Basic Info):** `code`, `name`, `family`, `tier`, `billing_cycle`, `type`.
  - **Section 2 (Pricing Contract):** Input harga dasar, diskon, dan pajak (PPN 11%) dengan kalkulasi harga final live preview dalam Rupiah.
  - **Section 3 & 4 (Trial & Limits):** `trial_days`, `max_branches`, `max_users`.
  - **Section 5 (Module Entitlement Matrix):** Checkbox multi-select modul software ERP (`POS`, `INVENTORY`, `FINANCE`, `CRM`, dll).
  - **Section 6 (Governance & Publishing):** State machine selector, `display_order`, dan checkbox publikasi.
- **Optimistic Locking Guard:** Menerima `expected_version`. Jika terjadi modifikasi konkuren (`409 CONCURRENT_MODIFICATION`), banner peringatan konflik muncul dan menyediakan tombol *"Muat Ulang Versi Terbaru"* tanpa menimpa data admin lain secara diam-diam.

---

### 2. Bundle Composer Console ([`apps/web/src/app/platform/bundles/page.tsx`](file:///d:/projectfolder/biz-erp/apps/web/src/app/platform/bundles/page.tsx))
- **KPI Summary Cards:** Total Bundle, Bundle Aktif, Draft Komposisi, Deprecated.
- **Interactive Bundles Table:**
  - Menampilkan kode, nama bundle, target segmen (`RETAIL`, `CAFE_RESTO`, dll).
  - Biaya pasang awal (*One-Time Fee*) dan biaya langganan bulanan (*Monthly Fee*).
  - Ringkasan jumlah item penyusun (`item_count`).
  - Status state machine dan status publikasi.
- **Visual Bundle Composer Drawer:**
  - **Identitas Bundle:** `code`, `name`, `target_segment`, checkbox `installation_required`.
  - **Composition Builder:**
    - Panel penambah item cepat dari katalog paket ERP aktif (`PLAN`) dan katalog produk ISP/Hardware (`PRODUCT`, `HARDWARE`, `SERVICE`).
    - Daftar komposisi item terpilih dengan kuantitas interaktif (`quantity >= 1`) dan tombol hapus.
  - **Harga Bundel Mandiri:** Input biaya pasang satu kali (Rp), biaya bulanan (Rp), dan durasi komitmen kontrak (bulan). **Harga bundle tidak dihitung otomatis dari item, melainkan memiliki harga komersial tersendiri.**
  - **Activation Integrity:** Memberikan validasi visual jika Superadmin mencoba mengaktifkan bundle yang masih kosong (`BUNDLE_EMPTY`).

---

### 3. Showcase Control Center & Live Preview ([`apps/web/src/app/platform/showcase/page.tsx`](file:///d:/projectfolder/biz-erp/apps/web/src/app/platform/showcase/page.tsx))
- **Section Tabs:** `Semua Section`, `Hero Featured`, `ERP Plans`, `ISP Plans`, `Bundles`, `Hardware`, `Promos`.
- **Showcase Placement Table:**
  - Urutan tampil (`#display_order`) dan nama section penempatan.
  - Target entitas terhubung (`PLAN`, `BUNDLE`, `CATALOG_PRODUCT`, `CUSTOM`).
  - Judul etalase, sub-headline, dan marketing badge (*ribbon* e.g. `"PALING POPULER"`).
  - Jumlah poin keunggulan bullet points.
  - Tombol toggle publikasi seketika (Live / Draft) dan aksi hapus penempatan.
- **Drawer Placement Editor:**
  - Pilihan section dan tipe target entitas dengan dropdown otomatis yang mengambil data entitas aktif dari database.
  - Input copywriting marketing: Display Name, Headline, Marketing Badge, Textarea Poin Keunggulan (1 baris per poin), CTA Text (`"Coba Gratis 14 Hari"`), dan CTA URL (`"/register"`).
- **"Live Landing Page Preview" Modal:**
  - Mengambil data langsung dari endpoint publik `GET /v1/public/showcase` (unauthenticated).
  - Merender simulasi visual kartu Landing Page secara real-time seperti yang akan dilihat oleh calon pengunjung sebelum paket dipublikasikan resmi.

---

## 4. Canonical Money Contract Verification `[FACT]`

- Seluruh komponen UI menggunakan helper [`@/lib/format`](file:///d:/projectfolder/biz-erp/apps/web/src/lib/format.ts) (`formatMinor`) yang memformat nilai integer Rupiah langsung tanpa membagi dengan 100:
  $$\text{Input Database: } 277500 \longrightarrow \text{Tampilan UI: } \text{Rp } 277.500$$
- Semua label form dan input field secara eksplisit mencantumkan satuan mata uang Rupiah (`Rp`).

---

## 5. Security & Tenant Scope Boundary `[FACT]`

- Seluruh rute `/platform/*` dilindungi oleh `PlatformGuard` pada layout level:
  - Token non-platform (seperti `OWNER` / `CASHIER`) ditolak dengan tampilan `PlatformAccessDenied` (*"Akses Ditolak: Halaman ini hanya tersedia untuk administrator platform"*).
  - Backend API SA-2.2 tetap menjadi security boundary mutlak dengan mengembalikan `403 WRONG_SCOPE` jika diakses token tenant.

---

## 6. Test & Quality Verification Results `[IMPLEMENTATION]`

1. **Frontend Platform Test Suite (`src/features/platform/`):**
   - **49/49 PASS** (0.94s):
     - `✓ platform-commercial-sa2-3-ui.test.ts (4 tests)` — Plans list, create, update with optimistic concurrency, Bundle composer item mapping, Showcase publish toggle & unauthenticated public showcase.
     - `✓ platform.test.ts (37 tests)` — Business lifecycle, modules, subscriptions, and pagination.
     - `✓ platform-overview-ui.test.tsx (5 tests)` — Overview KPI cards and chart distributions.
     - `✓ platform-businesses-ui.test.tsx (3 tests)` — Tenant lifecycle approval list rendering.
2. **Backend Regression Test Suite (`apps/api`):**
   - **21/21 PASS** (18.67s):
     - `✓ test/platform_commercial_sa2_2.test.ts (8/8 PASS)`
     - `✓ test/commercial_governance_sa2_1.test.ts (5/5 PASS)`
     - `✓ test/tenant_lifecycle_sa1.test.ts (8/8 PASS)`
3. **Typecheck Verifications:**
   - `apps/web`: `tsc --noEmit` $\longrightarrow$ **PASS (0 errors)**.
   - `apps/api`: `tsc --noEmit` $\longrightarrow$ **PASS (0 errors)**.
4. **Next.js Production Build:**
   - `npm run build` in `apps/web`: **SUCCESS (33 static & dynamic routes prerendered smoothly)**.
   - `npm run build` in `apps/api`: **SUCCESS (0 errors)**.
5. **Git Diff Check:**
   - `git diff --check`: **PASS (0 whitespace errors)**.

---

## 7. Items Intentionally Deferred to SA-2.4 `[DEFERRED]`

- **SA-2.4:** Landing Page Public Dynamic Integration (`apps/landing`), menghubungkan consumer frontend ke endpoint publik `GET /v1/public/showcase`.

---

**SA-2.3 COMPLETE.** Seluruh Web UI Superadmin Commercial Control Center telah terpasang, terintegrasi dengan API SA-2.2, lolos typecheck, dan lulus build produksi.

**STOPPING.** Menunggu approval Anda sebelum melangkah ke Phase SA-2.4.
