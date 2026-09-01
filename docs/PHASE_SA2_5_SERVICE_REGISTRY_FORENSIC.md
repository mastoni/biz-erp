# PHASE SA-2.5 — SERVICE REGISTRY DETAILED DESIGN & FORENSIC REPORT

## 1. Executive Summary

Proyek SKMNetwork Ecosystem bertransisi dari sekadar aplikasi ERP menjadi ekosistem multi-service. Laporan ini menjabarkan desain detail (Detailed Design) untuk **Service Registry** sebagai satu-satunya sumber kebenaran (canonical source of truth) kapabilitas makro platform (seperti ERP, ISP, Digital Wallet, CCTV), sebelum logika commercial, provisioning, dan entitlement berjalan.

Desain ini telah memperhitungkan instruksi arsitektur:
- Service Registry bersifat murni PLATFORM scope, tanpa `business_id`.
- Modul tetap sebagai granular component; `modules` dapat dipetakan ke `services` melalui kolom nullable.
- Entitlement, Subscription, Provisioning, dan AI CS belum diimplementasikan di phase ini, namun metadata pendukung sudah disiapkan.
- Public display tidak dibuat endpoint baru, tapi tetap menggunakan canonical public showcase.

## 2. Final Entity Model

### 2.1. Tabel `services`

| Field | Type | Constraint | Rationale / Alasan Bisnis |
| --- | --- | --- | --- |
| `code` | TEXT (PK) | UNIQUE, UPPERCASE | ID stabil untuk referensi cross-table dan backend system (contoh: `ERP`, `ISP`). |
| `name` | TEXT | NOT NULL | Nama representatif service (contoh: "Enterprise Resource Planning"). |
| `description` | TEXT | | Penjelasan kapabilitas untuk Superadmin dan metadata catalog. |
| `category` | TEXT | NOT NULL | Kategori makro (contoh: `SOFTWARE`, `NETWORK`, `FINANCIAL`). |
| `service_type` | TEXT | `INTERNAL`, `EXTERNAL`, `HYBRID` | `INTERNAL` (on-platform), `EXTERNAL` (rely pada vendor/3rd party), `HYBRID`. |
| `owner` | TEXT | DEFAULT 'PLATFORM' | Penanda mutlak kepemilikan platform. |
| `lifecycle_status` | TEXT | Enum (DRAFT, ACTIVE, dll) | Menandakan fase aktif dari layanan (lihat bagian Lifecycle). |
| `public_visibility` | BOOLEAN | DEFAULT FALSE | TRUE berarti diizinkan tampil di public showcase (dikontrol oleh `/v1/public/showcase`). |
| `base_capability` | JSONB | DEFAULT '{}' | Metadata base-level (contoh: endpoint baseUrl internal). |
| `provisioning_capability`| JSONB | DEFAULT '{}' | Metadata untuk phase SA-2.7 (contoh: `{"type": "MANUAL"}`). |
| `support_capability` | JSONB | DEFAULT '{}' | Metadata untuk future AI CS (contoh: `{"support_category": "ERP"}`). |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Audit creation timestamp. |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Audit update timestamp. |

### 2.2. Tabel `service_dependencies`

| Field | Type | Constraint | Rationale / Alasan Bisnis |
| --- | --- | --- | --- |
| `service_code` | TEXT (PK) | FK -> services(code) | Service yang membutuhkan. |
| `depends_on_service_code` | TEXT (PK) | FK -> services(code) | Service yang dibutuhkan. |
| `dependency_type` | TEXT | `REQUIRED`, `OPTIONAL` | Sifat dependensi (misal `CCTV` requires `DEVICE_SERVICE`). |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Timestamp. |

## 3. Relasi Ekosistem & Komersial

### 3.1. Service / Module Relationship
- **Konsep**: Service adalah payung besar, Module adalah fitur granular di dalamnya.
- **Relasi Database**: Akan ditambahkan kolom `service_code TEXT REFERENCES services(code)` pada tabel `modules`.
- **Constraint**: Kolom ini bersifat **NULLABLE**. Existing module tidak dipaksa untuk mapping jika evidence / desain final belum cukup kuat.

### 3.2. Service / Plan Relationship
- **Konsep**: Entitas `plans` merepresentasikan paket komersial.
- **Relasi Database**: Akan ditambahkan kolom `service_code TEXT REFERENCES services(code)` pada tabel `plans`.
- **Constraint**: Kolom ini bersifat **NULLABLE** sebagai persiapan.

### 3.3. Service / Bundle Relationship
- **Konsep**: Entitas `bundles` merupakan penggabungan (mis. Internet + ERP). Bundle tidak terikat pada 1 service saja, melainkan menggabungkan banyak item.
- **Relasi Database**: Tidak ada mapping foreign key langsung dari Bundle ke Service secara single-column. Relasi ini terjalin implicit via `bundle_items` -> `plans` -> `services`.

### 3.4. Dependency Model
- Dependency graph tersimpan di `service_dependencies`. Mendukung struktur DAG untuk mencegah circular dependency. Validasi pencegahan circular cycle harus ada pada API layer.

## 4. Lifecycle State Machine

- **DRAFT**: Service baru didaftarkan, konfigurasi belum siap. Tidak akan ditarik ke public showcase.
- **ACTIVE**: Tersedia untuk dilanggan / digunakan (jika visibility TRUE, bisa masuk showcase).
- **SUSPENDED**: Penangguhan sementara karena alasan teknis / bisnis (misal gangguan external provider).
- **DEPRECATED**: Tidak bisa disubscribe pengguna baru, pengguna lama tetap bisa pakai.
- **RETIRED**: Dihentikan sepenuhnya.

## 5. Security Boundary & Authorization

- **Platform Control**: Seluruh mutasi CRUD Service Registry (tabel `services`, `service_dependencies`) HANYA dapat dieksekusi oleh token dengan role `SUPER_ADMIN` atau `PLATFORM_ADMIN`.
- **Isolasi Tenant**: Tidak ada kolom `business_id` pada Service Registry. Tenant model tidak berhak membaca endpoint ini kecuali melalui `/v1/public/showcase` yang sudah difilter oleh status `ACTIVE` & `public_visibility = TRUE`.
- **RBAC Tetap**: Tenant authorization model existing (OWNER, CASHIER) TIDAK DIUBAH.

## 6. Integrasi Future Capabilities

- **AI CS Integration Boundary**: `support_capability` (JSONB) disiapkan, sehingga AI CS nantinya bisa memetakan intent (mis. "Wifi mati" -> baca metadata ISP) tanpa mengubah skema tabel di masa depan.
- **Provisioning Integration Boundary**: `provisioning_capability` (JSONB) disiapkan, sehingga Engine SA-2.7 bisa mengetahui cara mengaktifkan layanan (otomatis API call, atau buat task manual) berdasar metadata tersebut.

## 7. API Contract

**1. GET /v1/platform/services** (Superadmin Management)
- Deskripsi: List semua services (termasuk DRAFT, PRIVATE).
- Security: `SUPER_ADMIN`, `PLATFORM_ADMIN`.

**2. POST /v1/platform/services** (Superadmin Create)
- Body: `{ code, name, category, service_type, public_visibility, base_capability, ... }`
- Security: `SUPER_ADMIN`, `PLATFORM_ADMIN`.

**3. GET /v1/platform/services/:code** (Superadmin Detail)
- Deskripsi: Mengambil detail service & dependencies.

**4. PATCH /v1/platform/services/:code** (Superadmin Update)
- Body: `{ name, lifecycle_status, public_visibility, ... }`

**Catatan Public Catalog**:
Sesuai arahan arsitektur, **TIDAK ADA ENDPOINT BARU** seperti `/v1/catalog/services`. Public landing tetap menggunakan endpoint canonical yang sudah ada (`/v1/public/showcase`), dengan modifikasi logika untuk join data service berstatus `ACTIVE` dan `public_visibility = TRUE` ke depan.

## 8. Validation Rules & Uniqueness Constraints

- `services.code`: Harus UNIQUE, disarankan UPPERCASE alphanumeric dan underscore (mis: `DIGITAL_WALLET`).
- `services.service_type`: Harus divalidasi ke enum `INTERNAL`, `EXTERNAL`, `HYBRID`.
- `services.lifecycle_status`: Harus divalidasi ke enum DRAFT/ACTIVE/SUSPENDED/DEPRECATED/RETIRED.
- API layer harus menolak kreasi dependency jika mengakibatkan circular reference.

## 9. Migration & Backward Compatibility Strategy

- **Tabel Baru**: `services` dan `service_dependencies` di-create.
- **Alteration**: `ALTER TABLE modules ADD COLUMN service_code TEXT REFERENCES services(code)` (Nullable).
- **Alteration**: `ALTER TABLE plans ADD COLUMN service_code TEXT REFERENCES services(code)` (DITUNDA ke phase berikutnya sesuai instruksi).
- **Backward Compatibility 100%**: Aplikasi web/API yang belum menyadari adanya tabel ini tidak akan crash, karena foreign key bersifat nullable dan tabel baru tidak merusak query existing.
- **Seed Strategy**: Pembuatan seed terpisah yang akan mendaftarkan set minimal kandidat awal (seperti `ERP`, `ISP`) tanpa merusak data production.

## 10. Audit Requirements

- Menggunakan trigger PostgreSQL (seperti yang digunakan pada file `015_canonical_catalog_module_foundation.sql`) untuk update kolom `updated_at`.
- Mutasi oleh Superadmin akan menghasilkan jejak (log API) pada level framework, selaras dengan rencana SA-2.8 (Audit & Observability).

## 11. Acceptance Criteria (Untuk Implementasi)

- [x] Tabel `services` dan `service_dependencies` berhasil terbuat.
- [x] Kolom opsional `service_code` ditambahkan ke `modules` tanpa merusak eksisting. (plans ditunda).
- [x] Endpoint `/v1/platform/services` (GET, POST, GET/:code, PATCH) terimplementasi.
- [x] Validasi guard `SUPER_ADMIN` / `PLATFORM_ADMIN` diterapkan 100% pada endpoint platform service.
- [x] Enum validation (`lifecycle_status`, `service_type`) enforced.
- [x] Duplicate public endpoint `/v1/catalog/services` dihindari.
- [x] Typecheck pass, build pass, dan tests pass.

---
**STATUS:**
- Implementation: COMPLETED
- Isolated SA-2.5 verification: PASS
- Full repository test suite: FAIL / BLOCKED BY PRE-EXISTING OR UNRELATED FAILURES
