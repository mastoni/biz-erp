# PHASE SA-2.2 — PLATFORM COMMERCIAL GOVERNANCE API REPORT

**Status:** IMPLEMENTATION & VERIFICATION COMPLETE (READY FOR SA-2.3)
**Track:** Superadmin Control Plane (SA Track)
**Phase:** SA-2.2
**Baseline Commit:** `ee8965b426c42c47405b69f30bd478274947c29f`
**Date:** September 1, 2026

---

## 1. Domain Separation & Architecture Classification

Dokumen ini membedakan secara tegas 5 tingkatan kepastian arsitektur:
- **`[FACT]`**: Fakta terbukti dari kode sumber, migration SQL, dan skema database aktif.
- **`[DECISION]`**: Keputusan arsitektur yang telah disetujui pada SA-2.0 / SA-2.1.
- **`[IMPLEMENTATION]`**: Endpoint API, service layer, dan test suite yang dibangun pada fase SA-2.2.
- **`[DEFERRED]`**: Komponen yang sengaja ditunda ke fase berikutnya (UI Web console pada SA-2.3, landing page frontend pada SA-2.4).
- **`[OPEN QUESTION]`**: Tidak ada pertanyaan terbuka tersisa untuk API core layer.

---

## 2. API Endpoints Specification `[IMPLEMENTATION]`

### A. Plan Governance & Pricing APIs (Superadmin Control Plane)

#### 1. `GET /v1/platform/plans`
- **Method:** `GET`
- **Path:** `/v1/platform/plans`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Query Params:** `status` (`DRAFT`, `ACTIVE`, `DEPRECATED`, `ALL`), `family` (`ERP_PLAN`, dll), `search`, `limit`, `offset`
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "code": "ERP_PRO_2026",
        "name": "Paket ERP Pro",
        "family": "ERP_PLAN",
        "tier": "PRO",
        "billing_cycle": "MONTHLY",
        "pricing": {
          "base_price": 250000,
          "discount": 0,
          "tax": 27500,
          "final_price": 277500,
          "currency": "IDR"
        },
        "type": "STANDALONE",
        "status": "ACTIVE",
        "limits": { "max_branches": 3, "max_users": 5 },
        "trial_days": 14,
        "is_published": true,
        "display_order": 1,
        "version": 1,
        "module_count": 4,
        "created_at": "2026-09-01T12:00:00.000Z",
        "updated_at": "2026-09-01T12:00:00.000Z"
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "summary": {
      "total": 1,
      "active_count": 1,
      "draft_count": 0,
      "deprecated_count": 0
    }
  }
  ```

#### 2. `GET /v1/platform/plans/:code`
- **Method:** `GET`
- **Path:** `/v1/platform/plans/:code`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Response (200 OK):** Detail paket lengkap dengan relasi `modules` (matrix entitlement) dan `showcase_items` (penempatan Landing Page).

#### 3. `POST /v1/platform/plans`
- **Method:** `POST`
- **Path:** `/v1/platform/plans`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Request Body:**
  ```json
  {
    "code": "ERP_PRO_2026",
    "name": "Paket ERP Pro",
    "family": "ERP_PLAN",
    "tier": "PRO",
    "billing_cycle": "MONTHLY",
    "pricing": {
      "base_price": 250000,
      "discount": 0,
      "tax": 27500,
      "final_price": 277500
    },
    "trial_days": 14,
    "limits": { "max_branches": 3, "max_users": 5 },
    "status": "DRAFT",
    "is_published": false,
    "display_order": 1
  }
  ```
- **Response (201 Created):** `{ "message": "Plan created successfully", "plan": { ... } }`
- **Error Contracts:**
  - `400 VALIDATION_ERROR`: Format kode salah, nama kosong, siklus tidak valid.
  - `409 CONFLICT`: Kode paket sudah ada di sistem.

#### 4. `PUT /v1/platform/plans/:code`
- **Method:** `PUT`
- **Path:** `/v1/platform/plans/:code`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Concurrency Protection:** Menerima `expected_version`. Jika versi di DB tidak sesuai $\rightarrow$ `409 CONCURRENT_MODIFICATION`.
- **Response (200 OK):** `{ "message": "Plan updated successfully", "plan": { ... } }`

#### 5. `PATCH /v1/platform/plans/:code/status`
- **Method:** `PATCH`
- **Path:** `/v1/platform/plans/:code/status`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Request Body:** `{ "status": "ACTIVE" }`
- **State Machine Guard:** `DRAFT` $\leftrightarrow$ `ACTIVE` $\leftrightarrow$ `DEPRECATED`. Status ilegal $\rightarrow$ `400 VALIDATION_ERROR`.

#### 6. `PUT /v1/platform/plans/:code/modules`
- **Method:** `PUT`
- **Path:** `/v1/platform/plans/:code/modules`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Request Body:**
  ```json
  {
    "modules": [
      { "module_code": "POS", "feature_overrides": { "offline_mode": true } },
      { "module_code": "INVENTORY" }
    ]
  }
  ```
- **Integrity Guard:** Memvalidasi seluruh `module_code` terhadap tabel master `modules`. Modul invalid $\rightarrow$ `400 INVALID_MODULE`.

---

### B. Bundle Governance & Multi-Item Composition APIs

#### 1. `GET /v1/platform/bundles` & `GET /v1/platform/bundles/:code`
- **Method:** `GET`
- **Path:** `/v1/platform/bundles` & `/v1/platform/bundles/:code`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Detail Response:** Mengembalikan detail bundle beserta array `items` (joined dari plans, catalog_products) dan `showcase_items`.

#### 2. `POST /v1/platform/bundles` & `PUT /v1/platform/bundles/:code`
- **Method:** `POST` / `PUT`
- **Path:** `/v1/platform/bundles` & `/v1/platform/bundles/:code`
- **Pricing Support:** Memiliki harga mandiri Rupiah integer langsung:
  ```json
  {
    "pricing": {
      "one_time": 1000000,
      "monthly": 650000,
      "commitment_months": 12
    }
  }
  ```

#### 3. `PUT /v1/platform/bundles/:code/items`
- **Method:** `PUT`
- **Path:** `/v1/platform/bundles/:code/items`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Request Body:**
  ```json
  {
    "items": [
      { "item_type": "PLAN", "item_code": "ERP_PRO", "quantity": 1, "required": true },
      { "item_type": "PRODUCT", "item_code": "ISP_50M", "quantity": 1, "required": true },
      { "item_type": "HARDWARE", "item_code": "ROUTER_MIKROTIK", "quantity": 2, "required": false }
    ]
  }
  ```
- **Integrity Guards:**
  - `quantity < 1` $\rightarrow$ ditolak `400 VALIDATION_ERROR`.
  - Item type/code tidak ditemukan $\rightarrow$ ditolak `400 INVALID_ITEM`.

#### 4. `PATCH /v1/platform/bundles/:code/status`
- **Method:** `PATCH`
- **Path:** `/v1/platform/bundles/:code/status`
- **Publish & Activation Integrity Guard:**
  - Bundle tanpa item saat aktivasi $\rightarrow$ ditolak `400 BUNDLE_EMPTY`.
  - Bundle yang memiliki item non-aktif (`status != 'ACTIVE'`) $\rightarrow$ ditolak `400 BUNDLE_ITEM_INACTIVE`.

---

### C. Landing Showcase Governance APIs (Superadmin Control Plane)

#### 1. `GET /v1/platform/showcase`
- **Method:** `GET`
- **Path:** `/v1/platform/showcase`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Query Params:** `section` (`HERO_FEATURED`, `ERP_PLANS`, `ISP_PLANS`, `BUNDLES`, `HARDWARE`, `PROMOS`), `is_published`

#### 2. `POST /v1/platform/showcase`
- **Method:** `POST`
- **Path:** `/v1/platform/showcase`
- **Authorization:** `scope: platform`, role: `SUPER_ADMIN` | `PLATFORM_ADMIN`
- **Request Body:**
  ```json
  {
    "section": "HERO_FEATURED",
    "item_type": "PLAN",
    "plan_code": "ERP_PRO_2026",
    "display_name": "Paket Juara UMKM",
    "headline": "Solusi Lengkap Kasir & Stok",
    "marketing_badge": "PALING POPULER",
    "features_list": ["Kasir Cepat Offline", "Laporan Keuangan Otomatis"],
    "display_order": 1,
    "is_featured": true,
    "is_published": true,
    "cta_text": "Coba Gratis 14 Hari",
    "cta_url": "/register"
  }
  ```
- **Target Exclusivity Guard:**
  - Tepat satu target kode yang boleh diisi (`plan_code`, `bundle_code`, `catalog_product_code`, atau `custom_item_code`). Pelanggaran target ganda $\rightarrow$ `400 VALIDATION_ERROR`.
  - Target tidak ditemukan di DB $\rightarrow$ `400 INVALID_TARGET`.

#### 3. `PATCH /v1/platform/showcase/:id/publish` & `DELETE /v1/platform/showcase/:id`
- **Publish Toggle:** Mengubah flag `is_published` seketika.
- **Delete:** Menghapus kurasi penempatan tanpa menghapus master paket.

---

### D. Public Showcase API (Landing Page & Calon Pelanggan)

#### `GET /v1/public/showcase`
- **Method:** `GET`
- **Path:** `/v1/public/showcase`
- **Authorization:** **Public / Unauthenticated** (Tanpa JWT header).
- **Query Params:** `section` (`HERO_FEATURED`, `ERP_PLANS`, `BUNDLES`, dll).
- **Public Data Protection:**
  - Hanya menampilkan item yang berstatus `is_published = true`.
  - Hanya menyertakan target yang underlying status-nya `ACTIVE` (draft atau deprecated otomatis difilter keluar).
  - Tidak mengekspos audit trail internal, admin IDs, atau metadata sensitif platform.
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "83dc30f0-d87e-4136-8208-660f05215565",
        "section": "ERP_PLANS",
        "item_type": "PLAN",
        "item_code": "ERP_PRO_2026",
        "display_name": "Paket Juara UMKM",
        "headline": "Solusi Lengkap Kasir & Stok",
        "marketing_badge": "PALING POPULER",
        "features_list": ["Kasir Cepat Offline", "Laporan Keuangan Otomatis"],
        "display_order": 1,
        "is_featured": true,
        "cta_text": "Coba Gratis 14 Hari",
        "cta_url": "/register",
        "pricing": {
          "base_price": 250000,
          "discount": 0,
          "tax": 27500,
          "final_price": 277500,
          "currency": "IDR"
        },
        "target_details": {
          "family": "ERP_PLAN",
          "billing_cycle": "MONTHLY"
        }
      }
    ]
  }
  ```

---

## 3. Canonical Money Contract Verification `[FACT]`

- Seluruh nilai nominal harga dipertahankan dalam **Integer Rupiah Langsung**:
  $$\text{Nilai Minor} = \text{Nominal IDR Nyata}$$
  *Contoh:* `250000` = Rp 250.000.
- Tidak ada pembagian atau pengalian `/ 100` pada nominal uang.

---

## 4. Test & Verification Results `[IMPLEMENTATION]`

1. **SA-2.2 Targeted Integration Test Suite (`platform_commercial_sa2_2.test.ts`):**
   - **8/8 PASS** (11.24s):
     - `✓ Plan Governance & Pricing: creates a new plan with limits, trial_days, and IDR direct integer pricing`
     - `✓ Plan Governance & Pricing: updates plan pricing and checks optimistic concurrency (409 Conflict)`
     - `✓ Plan Governance & Pricing: handles status transitions and module assignment (400 validation)`
     - `✓ Bundle Governance: creates bundle, adds items, and enforces activation integrity (BUNDLE_EMPTY, BUNDLE_ITEM_INACTIVE)`
     - `✓ Showcase Governance: supports multi-section placement, target exclusivity, and publishing toggle`
     - `✓ Public Showcase API: returns only published items with active targets without requiring authentication`
     - `✓ Security & Scope Enforcement: strictly rejects tenant token on platform routes with 403 WRONG_SCOPE`
     - `✓ Security & Scope Enforcement: allows SUPER_ADMIN and PLATFORM_ADMIN on platform routes`
2. **SA-2.1 Database Test Suite (`commercial_governance_sa2_1.test.ts`):**
   - **5/5 PASS** (1.88s).
3. **SA-1 Tenant Lifecycle Regression Suite (`tenant_lifecycle_sa1.test.ts`):**
   - **8/8 PASS** (8.20s) — Zero regression on tenant lifecycle approval gate.
4. **Typecheck Backend (`apps/api`):**
   - `tsc --noEmit`: **PASS (0 errors)**.
5. **Typecheck Frontend (`apps/web`):**
   - `tsc --noEmit`: **PASS (0 errors)**.
6. **Git Diff Whitespace Check:**
   - `git diff --check`: **PASS (0 whitespace errors)**.

---

## 5. Items Intentionally Deferred to SA-2.3 & SA-2.4 `[DEFERRED]`

- **SA-2.3:** Superadmin Web UI Console (`apps/web/src/app/platform/plans`, `apps/web/src/app/platform/bundles`).
- **SA-2.4:** Landing Page Public Dynamic Integration (`apps/landing`).

---

**SA-2.2 COMPLETE.** Seluruh backend API commercial governance telah terpasang, teruji, dan diverifikasi secara komprehensif.

**STOPPING.** Menunggu approval Anda sebelum melangkah ke Phase SA-2.3.
