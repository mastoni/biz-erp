# PHASE SA-2.4 — LANDING PAGE DYNAMIC SHOWCASE FORENSIC MAPPING REPORT

**Track:** Superadmin Control Plane (SA Track)  
**Phase:** SA-2.4 — Public Landing Page Dynamic Integration  
**Status:** FORENSIC MAPPING COMPLETE (AUDIT ONLY — NO CODE CHANGES)  
**Date:** September 1, 2026  
**Baseline Commit:** `05f6f1c3293773553710dd5d0a5870c41e190628`  

---

## 1. CURRENT LANDING ARCHITECTURE `[FACT]`

Aplikasi `apps/landing` dibangun menggunakan:
- **Build Tool / Framework:** Vite 6.3.5 + React 18.2.0 + TypeScript 5.7.0.
- **Styling:** TailwindCSS v4.1.7 (`@tailwindcss/vite`) dengan custom theme palet: `bg-paper` (#F3F2EA), `text-ink` (#0B1F33), `bg-ledger`, `marigold`, `sky-2`, `leaf`, `brick`.
- **Motion & Interactions:** Custom CSS animations (`noise-overlay`, `floaty`, `mask-line`, `wifi-ripple`, `scanline`), custom IntersectionObserver hook (`useInView`), decoder text effect (`useScramble`), dan live clock (`useClock`).
- **Entry Points:**
  - `apps/landing/index.html`
  - `apps/landing/src/main.tsx`
  - `apps/landing/src/App.tsx`
- **Hierarki Komponen Linear:**
  1. `Nav.tsx` (Top sticky navigation + CTA)
  2. `Hero.tsx` (Headline, network node animation, status marquee)
  3. `Marquee.tsx` (Infinite ticker logo & keywords)
  4. `Problems.tsx` (Identifikasi pain points UMKM)
  5. `Solutions.tsx` (Bento grid 6 pilar layanan)
  6. `Erp.tsx` (Produk unggulan SKMNet ERP, modul-modul, model akses)
  7. `Ecosystem.tsx` (6 layer arsitektur teknologi)
  8. `HowItWorks.tsx` (3 langkah alur implementasi)
  9. `Customers.tsx` (Profil segmentasi pelanggan: Rumah, Toko, Kantor, dll)
  10. `Internet.tsx` (Layanan konektivitas & ripple visual)
  11. `Cctv.tsx` (Infrastruktur, panel monitoring CCTV & network)
  12. `Why.tsx` (5 keunggulan komparatif)
  13. `Development.tsx` (Track status pengembangan)
  14. `Faq.tsx` (Accordion pertanyaan umum)
  15. `Cta.tsx` (Final banner konversi)
  16. `Footer.tsx` (Legal, copyright, links)

---

## 2. CURRENT STATIC DATA SOURCES `[FACT]`

Saat ini, seluruh data teks, link, list modul, dan profil layanan disimpan secara statis (*hardcoded*) di:
- [`apps/landing/src/data.ts`](file:///d:/projectfolder/biz-erp/apps/landing/src/data.ts)
  - `SITE`, `ERP_URL`, `CONTACT_URL`, `INTERNET_URL`
  - `capabilities`, `servicesMarquee`, `heroNodes`, `problems`, `solutions`
  - `erpModules`, `erpAccess`
  - `ecosystemLayers`, `steps`, `customerTypes`, `whyPoints`, `devTracks`, `faqs`

**Fakta Kunci:**
Saat ini `apps/landing` **belum memiliki kartu harga komersial (commercial pricing cards)** yang dinamis dan **belum memiliki API client layer** untuk memanggil backend ERP.

---

## 3. PUBLIC SHOWCASE API CONTRACT `[FACT]`

Endpoint publik telah aktif dan terverifikasi di backend:
`GET /v1/public/showcase?section=:section`

### Karakteristik Endpoint:
- **Autentikasi:** Bebas token (Unauthenticated / Public).
- **Filtering Integritas:** Backend hanya mengembalikan item dengan `is_published = true` dan underlying target entity berstatus `ACTIVE`. Item `DRAFT`, `DEPRECATED`, atau target `INACTIVE` tersaring otomatis.
- **Data Transfer Object (DTO):**
```json
{
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "section": "ERP_PLANS",
      "item_type": "PLAN",
      "item_code": "ERP_PRO",
      "display_name": "Paket Juara UMKM",
      "headline": "Solusi Lengkap Kasir & Inventory",
      "description": "Dirancang untuk bisnis retail dan F&B multi-cabang.",
      "marketing_badge": "PALING POPULER",
      "features_list": [
        "Kasir & POS Multi-Kasir",
        "Multi-Cabang & Gudang Terpusat",
        "Laporan Laba Rugi Otomatis",
        "Dukungan Backup Cloud"
      ],
      "display_order": 1,
      "is_featured": true,
      "cta_text": "Coba Gratis 14 Hari",
      "cta_url": "https://erp.skmnetwork.com/register",
      "pricing": {
        "base_price": 250000,
        "discount_amount": 0,
        "tax_amount": 27500,
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

## 4. SHOWCASE → LANDING MAPPING `[DECISION]`

Superadmin mengatur tata kelola penempatan pada `/platform/showcase`. Hubungan mapping ke seksi Landing Page dirancang sebagai berikut:

| Section Enum Backend | Landing Target Component | Perilaku Rendering |
| :--- | :--- | :--- |
| **`HERO_FEATURED`** | `Hero.tsx` | Menampilkan floating chip / badge promo unggulan yang sedang aktif. |
| **`ERP_PLANS`** | `Erp.tsx` (Sub-seksi Paket Layanan) | Merender grid kartu paket langganan ERP dengan harga Rupiah bersih, durasi billing, badge "Paling Populer", daftar fitur, dan tombol CTA pendaftaran. |
| **`ISP_PLANS`** | `Internet.tsx` | Merender pilihan paket kecepatan internet broadband yang dipublikasikan platform. |
| **`BUNDLES`** | `Solutions.tsx` / `Erp.tsx` (Paket Bundel) | Merender kartu solusi gabungan (ERP + Internet + Hardware Kasir) dengan harga One-Time & Monthly terpisah. |
| **`HARDWARE`** | `Cctv.tsx` / `Solutions.tsx` | Merender etalase perangkat fisik (kamera CCTV, barcode scanner, thermal printer) yang siap dipesan. |
| **`PROMOS`** | `Cta.tsx` / Top Banner | Menampilkan penawaran khusus diskon musiman atau free trial promo. |

---

## 5. MONEY CONTRACT AUDIT `[FACT]`

- Kontrak moneter kanonikal di backend: `*_minor = IDR direct integer` (e.g. `277500` = **Rp 277.500**).
- **Audit `apps/landing`:** Tidak ditemukan adanya pembagian `/100` pada seluruh codebase `apps/landing`.
- **Rekomendasi Formatting:** Tambahkan utility `formatCurrency(val: number): string` di `apps/landing/src/lib/format.ts` menggunakan `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })`.

---

## 6. SECURITY AUDIT `[FACT]`

- Endpoint `GET /v1/public/showcase` di backend (`apps/api/src/services/platform_service.ts`) menerapkan proyeksi DTO eksplisit:
  - **TIDAK membocorkan:** `created_by`, `updated_by`, `user_id`, `business_id`, `audit_trail`, `internal_notes`, `version`.
  - **Menjaga Isolasi Tenant:** Endpoint publik hanya membaca tabel katalog platform (`showcase_items`, `plans`, `bundles`, `catalog_products`). Tidak ada sentuhan pada tabel operasional tenant (`products`, `sales`, `inventory`).

---

## 7. FALLBACK BEHAVIOR `[DECISION]`

Agar landing page memiliki ketahanan tinggi (*high availability & zero downtime*):
1. **Default State (Static Fallback):** Jika API backend tidak dapat dihubungi (offline, network error, timeout, atau status 500), landing page tetap menampilkan konten statis `data.ts` secara elegan tanpa broken layout.
2. **Empty API Result:** Jika Superadmin belum mempublikasikan item (`items: []`), seksi pricing merender state default statis atau fallback message tanpa merusak estetika desain.
3. **Loading State:** Menggunakan skeleton card berkedip halus (*shimmer animation*) yang serasi dengan palet tema `bg-card` dan border `border-ink/10`.

---

## 8. DESIGN / UX PRESERVATION PLAN `[DECISION]`

Desain landing page existing memiliki estetika tinggi (*paper aesthetic*, font-display, custom borders). Implementasi SA-2.4 WAJIB menjaga identitas visual ini:
- **Card Styling:** Menggunakan `rounded-2xl border-2 border-ink/12 bg-card p-6 sm:p-8 shadow-sm hover:shadow-md transition`.
- **Typography:** Menjaga paduan `font-display` untuk judul/harga dan `font-body` / `font-mono` untuk metadata & badge.
- **Badge Ribbon:** `marketing_badge` ditampilkan dengan chip kontras (e.g. `bg-marigold text-ink font-mono text-[10px] font-extrabold uppercase`).
- **Button Hierarchy:** Tombol CTA mengikuti style `btn-arrow rounded-xl bg-ink px-6 py-3.5 text-[15px] font-extrabold text-paper`.

---

## 9. FILES YANG AKAN DIUBAH / DIBUAT PADA SA-2.4 `[IMPLEMENTATION BOUNDARY]`

### File Baru:
- `apps/landing/src/lib/api.ts` — API client untuk memanggil `GET /v1/public/showcase`.
- `apps/landing/src/lib/format.ts` — Helper format Rupiah langsung (`formatRupiah`).
- `apps/landing/src/types.ts` — TypeScript interfaces untuk `PublicShowcaseItem` dan query filters.
- `apps/landing/src/components/ShowcasePlans.tsx` — Komponen kartu paket dinamis (ERP Plans, ISP Plans, Bundles).

### File yang Dimodifikasi:
- `apps/landing/src/components/Erp.tsx` — Integrasi komponen showcase paket ERP dinamis dengan fallback statis.
- `apps/landing/src/components/Internet.tsx` — Integrasi paket ISP dinamis jika ada item `ISP_PLANS` terbit.
- `apps/landing/src/data.ts` — Sinkronisasi konfigurasi URL API staging & production.
- `apps/landing/vite.config.js` / env configuration — Dukungan `VITE_API_URL`.

---

## 10. FILES YANG DILARANG DIUBAH `[FORBIDDEN]`

- Seluruh backend tenant modules: POS, Sales, Finance, Inventory, Purchases, Reports.
- SA-1 Tenant lifecycle logic & Auth tenant (`apps/api/src/routes/auth_routes.ts`).
- Mobile client codebase (`apps/mobile/*`).
- Core canonical database schemas (`migrations/001` s.d. `migrations/033`).

---

## 11. DAFTAR TEMUAN FORENSIC (FINDINGS) `[FACT]`

- **`BUG-SA24-001 (P3 - Minor/Config):`** `apps/landing` saat ini belum memiliki konfigurasi environment `.env` untuk `VITE_API_URL` (masih menggunakan hardcoded URLs di `data.ts`).
  - *Recommendation:* Tambahkan dukungan fallback cerdas `import.meta.env.VITE_API_URL || 'https://api.skmnetwork.com'` atau auto-detect staging vs prod.

---

## 12. ROADMAP IMPLEMENTASI SA-2.4 `[PLAN]`

1. **SA-2.4.1 — Client Layer & Types (`apps/landing`):**
   - Buat `types.ts`, `lib/format.ts`, dan `lib/api.ts` di `apps/landing`.
2. **SA-2.4.2 — Dynamic Showcase Components & Integration:**
   - Bangun `ShowcasePlans.tsx` (Cards, badges, features list, direct Rupiah formatting, skeleton loading, graceful fallback).
   - Integrasikan ke `Erp.tsx`, `Internet.tsx`, dan `Hero.tsx`.
3. **SA-2.4.3 — Verification & Visual Acceptance:**
   - Uji live rendering dengan Superadmin control center.
   - Typecheck, build Vite production bundle, dan cross-browser responsive test.

---

## 13. ACCEPTANCE TEST MATRIX SA-2.4 `[GATE]`

| Test Scenario | Expected Outcome | Status |
| :--- | :--- | :--- |
| **A. Live API Fetch** | Mengambil item aktif dari `GET /v1/public/showcase` dan merender kartu paket. | Planned |
| **B. Superadmin Control Reflection** | Saat Superadmin mengubah harga / unpublish di `/platform/showcase`, landing page merefleksikan perubahan seketika. | Planned |
| **C. Canonical Rupiah Display** | Nilai `277500` tampil sebagai `Rp 277.500` (tanpa `/100`). | Planned |
| **D. Offline / API Error Fallback** | Saat API offline / error, landing page tetap merender konten statis default tanpa error console. | Planned |
| **E. Empty Section Graceful State** | Seksi tanpa item aktif menampilkan fallback default yang rapi. | Planned |
| **F. Responsive & Theme Harmony** | Kartu tampil konsisten pada mobile, tablet, dan desktop dengan palet paper-ink. | Planned |

---

**FORENSIC MAPPING COMPLETE.** Tidak ada kode yang diubah, di-commit, di-push, atau di-deploy.
Menunggu instruksi persetujuan Anda sebelum memulai implementasi Phase SA-2.4.1.
