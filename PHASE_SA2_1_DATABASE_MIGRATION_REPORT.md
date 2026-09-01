# PHASE SA-2.1 — DATABASE MIGRATION REPORT
## Commercial Governance & Showcase Foundation

**Status:** IMPLEMENTATION & VERIFICATION COMPLETE (READY FOR SA-2.2)
**Track:** Superadmin Control Plane (SA Track)
**Phase:** SA-2.1
**Baseline Commit:** `ee8965b426c42c47405b69f30bd478274947c29f`
**Date:** September 1, 2026

---

## 1. Existing Schema Discovered `[FACT]`

Audit skema database sebelum migrasi SA-2.1:
1. `modules` & `module_features` (Migration `015`): Struktur modul fungsional dan sub-fitur.
2. `catalog_products` (Migration `015`): Produk dan layanan level platform SKMNetwork (`code`, `type`, `billing_model`, `base_price`, `currency`, `status`).
3. `plans` (Migration `015`): Paket langganan ERP (`code`, `name`, `family`, `tier`, `billing_cycle`, `pricing JSONB`, `type`, `status`).
4. `plan_modules` (Migration `015`): Relasi M:N paket dengan modul software ERP.
5. `bundles` & `bundle_items` (Migration `015`): Komposisi multi-item komersial (`PRODUCT`, `PLAN`, `SERVICE`, `HARDWARE`).
6. `subscriptions` (Migration `016`): Langganan aktif per bisnis tenant dengan snapshot harga historis dan triggers lifecycle.
7. `products` (Migration `001`): Master barang inventaris/POS milik **TENANT** (`business_id`).

---

## 2. New Schema Additions `[IMPLEMENTATION]`

Migrasi `034_commercial_governance_foundation.sql` telah diterapkan ke database:

### A. Tabel `plans` (Enhanced):
- `ADD COLUMN limits JSONB NOT NULL DEFAULT '{}'` `[DECISION]`: Kuota batasan sumber daya (e.g. `{"max_branches": 3, "max_users": 5}`).
- `ADD COLUMN trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0)` `[DECISION]`: Durasi masa uji coba gratis dalam hitungan hari.
- `ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE`: Status publikasi ke etalase publik.
- `ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0)`: Urutan prioritas penayangan.
- `ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)`: Version counter untuk optimistic concurrency control.

### B. Tabel `bundles` (Enhanced):
- `ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE`
- `ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0)`
- `ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)`

### C. Tabel `catalog_products` (Enhanced):
- `ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE`
- `ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0)`
- `ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)`

### D. Tabel Baru `showcase_items` `[IMPLEMENTATION]`:
Tabel terdedikasi untuk kurasi penayangan multi-section pada Landing Page:
```sql
CREATE TABLE IF NOT EXISTS showcase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section TEXT NOT NULL CHECK (section IN ('HERO_FEATURED', 'ERP_PLANS', 'ISP_PLANS', 'BUNDLES', 'HARDWARE', 'PROMOS')),
    item_type TEXT NOT NULL CHECK (item_type IN ('PLAN', 'BUNDLE', 'CATALOG_PRODUCT', 'CUSTOM')),
    plan_code TEXT REFERENCES plans(code) ON DELETE CASCADE,
    bundle_code TEXT REFERENCES bundles(code) ON DELETE CASCADE,
    catalog_product_code TEXT REFERENCES catalog_products(code) ON DELETE CASCADE,
    custom_item_code TEXT,
    display_name TEXT NOT NULL,
    headline TEXT,
    description TEXT,
    marketing_badge TEXT,
    features_list JSONB NOT NULL DEFAULT '[]',
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    cta_text TEXT NOT NULL DEFAULT 'Pilih Paket',
    cta_url TEXT NOT NULL DEFAULT '/register',
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_showcase_item_target_integrity CHECK (
        (item_type = 'PLAN' AND plan_code IS NOT NULL AND bundle_code IS NULL AND catalog_product_code IS NULL AND custom_item_code IS NULL) OR
        (item_type = 'BUNDLE' AND bundle_code IS NOT NULL AND plan_code IS NULL AND catalog_product_code IS NULL AND custom_item_code IS NULL) OR
        (item_type = 'CATALOG_PRODUCT' AND catalog_product_code IS NOT NULL AND plan_code IS NULL AND bundle_code IS NULL AND custom_item_code IS NULL) OR
        (item_type = 'CUSTOM' AND custom_item_code IS NOT NULL AND plan_code IS NULL AND bundle_code IS NULL AND catalog_product_code IS NULL)
    )
);
```

---

## 3. Constraints, Indexes, & Integrity Rules `[IMPLEMENTATION]`

1. **Showcase Target Integrity (`chk_showcase_item_target_integrity`):**
   - Menjamin bahwa satu baris `showcase_items` **HANYA** menunjuk tepat satu target entitas (`plan_code`, `bundle_code`, `catalog_product_code`, atau `custom_item_code`).
   - Mencegah konflik referensi ganda atau baris orphan tanpa target.
2. **Indexes Dibuat:**
   - `idx_plans_published ON plans(status, is_published)`
   - `idx_plans_display_order ON plans(display_order)`
   - `idx_bundles_published ON bundles(status, is_published)`
   - `idx_bundles_display_order ON bundles(display_order)`
   - `idx_catalog_products_published ON catalog_products(status, is_published)`
   - `idx_catalog_products_display_order ON catalog_products(display_order)`
   - `idx_showcase_items_section_published ON showcase_items(section, is_published, display_order)`
   - `idx_showcase_items_plan ON showcase_items(plan_code)`
   - `idx_showcase_items_bundle ON showcase_items(bundle_code)`
   - `idx_showcase_items_catalog_product ON showcase_items(catalog_product_code)`
3. **Cascading Integrity:**
   - Deletion pada `plans`, `bundles`, atau `catalog_products` secara otomatis membersihkan entri `showcase_items` terkait (`ON DELETE CASCADE`).

---

## 4. Canonical Money Contract `[FACT]`

- Seluruh nilai nominal harga dipertahankan secara mutlak:
  $$\text{Nilai Integer Minor} = \text{Nominal Rupiah Nyata (IDR)}$$
- `catalog_products.base_price`: `BIGINT` (Rupiah langsung).
- `subscriptions.unit_price`, `discount`, `tax`, `final_price`: `BIGINT` (Rupiah langsung).
- `plans.pricing`: Struktur JSONB memuat angka bulat Rupiah langsung tanpa pembagian cents.

---

## 5. Backward Compatibility & Zero Tenant Regression `[FACT]`

- **Non-Destructive & Additive:** Seluruh kolom baru memiliki nilai `DEFAULT` yang valid (`limits: '{}'`, `trial_days: 0`, `is_published: FALSE`, `display_order: 0`, `version: 1`).
- **Zero Tenant Impact:** Modul operasional tenant (POS, Sales, Finance, Inventory, Products, Print, Mobile Sync, dan Tenant Auth) sama sekali tidak mengalami perubahan atau interupsi.
- **SA-1 Tenant Lifecycle Compatibility:** Seluruh guard keamanan tenant non-aktif (`PENDING_REVIEW`, `SUSPENDED`, `REJECTED`) tetap berjalan sempurna.

---

## 6. Test & Validation Results `[IMPLEMENTATION]`

1. **Migration Execution (`npm run migrate`):**
   - `[2026-09-01 19:42:34] INFO: Applied migration: 034_commercial_governance_foundation.sql` (PASS)
2. **SA-2.1 Targeted Test Suite (`commercial_governance_sa2_1.test.ts`):**
   - **5/5 PASS** (2.56s):
     - `✓ 1. Plans table supports governance fields`
     - `✓ 2. Bundles table supports governance fields`
     - `✓ 3. Catalog Products table supports governance fields`
     - `✓ 4. Showcase Items enforces target integrity (exactly one target entity)`
     - `✓ 5. Cascading deletion of plan removes associated showcase item`
3. **SA-1 Regression Test Suite (`tenant_lifecycle_sa1.test.ts`):**
   - **8/8 PASS** (9.00s) — Zero regression on tenant lifecycle approval gate.
4. **Typecheck Backend (`apps/api`):**
   - `tsc --noEmit`: **PASS (0 errors)**.
5. **Git Diff Check:**
   - `git diff --check`: **PASS (0 whitespace errors)**.

---

## 7. Explicit Decisions Locked `[DECISION]`

1. **`limits JSONB`**: Diterapkan dengan default `'{}'` untuk menyimpan kuota numerik fleksibel (`max_branches`, `max_users`).
2. **`trial_days INT`**: Diterapkan dengan default `0` pada tabel `plans`.
3. **`showcase_items` Table**: Diterapkan dengan check constraint multi-target eksklusif untuk mendukung penempatan landing page yang dinamis dan modular.
4. **Optimistic Locking**: Kolom `version INT NOT NULL DEFAULT 1` ditambahkan pada `plans`, `bundles`, `catalog_products`, dan `showcase_items`.

---

## 8. Items Intentionally Deferred to SA-2.2 `[DEFERRED]`

Item berikut **sengaja ditunda** ke Phase SA-2.2 sesuai prinsip isolasi batasan fase:
- Implementasi API Controller & Service CRUD Plans (`POST /v1/platform/plans`, `PUT /v1/platform/plans/:code`, `PATCH /v1/platform/plans/:code/status`).
- Implementasi API Controller & Service CRUD Bundles (`POST /v1/platform/bundles`, `PUT /v1/platform/bundles/:code/items`).
- Implementasi Public Showcase API (`GET /v1/public/showcase?section=...`).
- Modernisasi Web UI Superadmin (`/platform/plans`, `/platform/bundles`).

---

**SA-2.1 COMPLETE.** Seluruh fondasi database telah terpasang, teruji, dan diverifikasi secara forensik.

**STOPPING.** Menunggu approval pengguna sebelum melangkah ke Phase SA-2.2.
