# SKMNetwork Business Concept Document

## 1. SKMNetwork Positioning

SKMNetwork is a **technology partner for UMKM and growing businesses** in Indonesia. We do not merely sell software or hardware—we enable digital transformation ("digitalisasi usaha") by providing an integrated ecosystem of connectivity, operations, and protection.

**Core thesis:** UMKM need more than a POS. They need reliable internet, operational software that works offline-first, asset protection, and a partner who manages the technology so they can focus on their business.

---

## 2. Ecosystem Pillars: CONNECT / OPERATE / PROTECT / HARDWARE / SERVICES

| Pillar | Role | Revenue Model |
|--------|------|---------------|
| **CONNECT** | Business-grade internet (fiber, 4G/5G backup, SD-WAN) | Recurring (monthly) |
| **OPERATE** | SKMNetwork ERP (POS, inventory, sales, customers, sync) | Included in Connect / Standalone subscription |
| **PROTECT** | CCTV + cloud recording, alarm monitoring, access control | Recurring (monthly cloud storage + monitoring) |
| **HARDWARE** | Routers, switches, POS terminals, CCTV cameras, sensors | One-time (bundled with installation) |
| **SERVICES** | Installation, configuration, onboarding, training, managed services | One-time (setup) + Recurring (managed service) |

> **Principle:** Hardware is a **solution component**, not a standalone commodity. We never "sell a router" or "sell a camera"—we sell a connected, protected, operated business.

---

## 3. SKMNetwork ERP as the Operational Core

The ERP is the **central nervous system** of the business:
- **Offline-first POS** — transactions never stop when internet drops
- **Multi-device sync** — receipt integrity across devices (Phase 4.1.39 Track A)
- **Inventory & catalog** — single source of truth, synced to cloud
- **Customers & loyalty** — know your buyers, run promotions
- **Sales history** — append-only, audit-ready, pull-based sync
- **Multi-branch, multi-user** — scales from warung to mini-market chain

**Architecture:** Local-first (SQLite/Flutter) + server sync (PostgreSQL/API) + conflict resolution.

---

## 4. Internet as Connectivity Foundation

- **Primary:** Fiber (biz-grade SLA)
- **Failover:** 4G/5G automatic (SD-WAN)
- **Managed:** SKMNetwork monitors uptime, latency, bandwidth
- **Value:** Without reliable connectivity, cloud ERP, CCTV cloud storage, and remote monitoring fail. Connectivity is the **enabler** for all recurring services.

---

## 5. Hardware as Solution Component

| Hardware | Purpose | Bundled With |
|----------|---------|--------------|
| Router + SD-WAN appliance | CONNECT foundation | Internet subscription |
| POS terminal (Android) | OPERATE endpoint | ERP onboarding |
| CCTV cameras (IP, PoE) | PROTECT sensors | Cloud recording plan |
| Network switch, cabling, UPS | Infrastructure | Installation service |
| Sensors (door, motion, temp) | PROTECT extensions | Monitoring plan |

**No hardware-only SKUs.** Every device ships pre-configured, enrolled, and supported.

---

## 6. CCTV + Cloud Storage as Recurring-Service Opportunity

- **Cameras** → one-time hardware + installation
- **Cloud recording** (7/30/90-day retention) → monthly per-camera
- **AI analytics** (people counting, heatmap, intrusion) → add-on tier
- **Remote viewing app** → included with cloud plan
- **Managed monitoring** (SOC-lite alerts) → premium tier

> CCTV is the **highest-margin recurring service** after internet. It turns a capital expense into an operational expense the owner understands: "My shop is watched 24/7 for Rp X/bulan."

---

## 7. Hardware + Installation + Services as One-Time Revenue

| Component | Example Pricing (Indicative) |
|-----------|------------------------------|
| Router + SD-WAN box | Rp 2.5–5 jt |
| POS terminal (1–2 units) | Rp 3–6 jt |
| CCTV 4-ch kit (cams + NVR + cabling) | Rp 6–12 jt |
| Installation & config (1 day) | Rp 1–2 jt |
| Onboarding & training (2 sessions) | Rp 1–1.5 jt |
| **Typical starter bundle** | **Rp 13–26 jt one-time** |

> One-time revenue funds CAC and hardware COGS. Recurring revenue builds LTV.

---

## 8. Recurring Revenue Stack

| Layer | Monthly per Outlet (Indicative) |
|-------|----------------------------------|
| **Internet (fiber + 4G backup)** | Rp 350k–750k |
| **ERP (included with internet)** | Rp 0 (bundled) / Rp 150k standalone |
| **CCTV cloud recording (4 cams, 30-day)** | Rp 200k–400k |
| **Managed monitoring (optional)** | Rp 150k–300k |
| **Total recurring/outlet** | **Rp 550k–1.5 jt / bulan** |

> **Target:** 80%+ gross margin on recurring stack after month 6.

---

## 9. INCLUDED ERP Model (Default)

**ERP is free with SKMNetwork Internet.**

- Customer signs 24-month internet contract
- ERP (POS, inventory, sync, multi-device) included at no extra charge
- CCTV cloud recording is the primary upsell
- Managed services (monitoring, backup config) as add-ons

**Why:** Removes ERP price objection. "You're already paying for internet—here's the business software to run on it."

---

## 10. STANDALONE ERP Model

For businesses with existing internet (non-SKMNetwork):

| Tier | Monthly | Includes |
|------|---------|----------|
| **Starter** | Rp 150k | 1 outlet, 2 devices, 1k products, basic sync |
| **Growth** | Rp 300k | 3 outlets, 5 devices, unlimited products, multi-branch sync, customer loyalty |
| **Scale** | Rp 600k | Unlimited outlets/devices, API access, priority support, custom fields |

> Standalone ERP is a **smaller market**—most UMKM prefer the bundled simplicity. Priced to not cannibalize Connect attach.

---

## 11. Go-to-Market: Existing SKMNetwork Internet Customers

**Phase 1 (Months 1–6):**
- Target: **Existing 500+ SKMNetwork internet customers** (warung, cafes, retail, bengkel)
- Approach: "Upgrade paket internet → gratis ERP + opsi CCTV cloud"
- Channel: Account managers + field technicians (already on-site)

**Phase 2 (Months 6–18):**
- Referral program: existing merchants refer peers
- Digital marketing: "digitalisasi usaha" content, case studies
- Partnerships: accounting firms, business associations, POS hardware distributors

**Phase 3 (Month 18+):**
- Standalone ERP sales for non-internet customers
- Vertical packages (kuliner, retail, bengkel, laundry)
- White-label for telco partners

---

## 12. "Digitalisasi Usaha" Positioning

> **We don't sell POS software. We digitalisasi usaha Anda.**

Messaging pillars:
- "Transaksi tidak pernah berhenti" (offline-first)
- "Stok real-time di HP Anda" (sync + mobile)
- "Toko terawat 24 jam" (CCTV cloud)
- "Internet bisnis yang diurus kami" (managed connectivity)
- "Satu tagihan, satu partner" (single invoice, single support line)

**Avoid:** Feature lists, technical jargon, "cloud POS," "SaaS."

---

## 13. Solution/Package-Based Selling by UMKM Type

| UMKM Type | Starter Package | Core Value |
|-----------|-----------------|------------|
| **Warung / Mini-market** | Internet + ERP + 4-ch CCTV | Stock accuracy, loss prevention |
| **Kuliner (cafe, warteg, bakso)** | Internet + ERP (kitchen display) + 2-ch CCTV | Speed of service, queue mgmt |
| **Bengkel / Service** | Internet + ERP (service orders) + 2-ch CCTV | Job tracking, customer history |
| **Laundry / Cleaning** | Internet + ERP (pickup/delivery) + 2-ch CCTV | Order tracking, auto-notify |
| **Retail Fashion / Aksesoris** | Internet + ERP (variants, barcode) + 4-ch CCTV | Size/color matrix, shrinkage control |

> Each package = **one SKU, one price, one installation day.**

---

## 14. Founding-User Strategy (First 50–100 UMKM)

| Aspect | Execution |
|--------|-----------|
| **Selection** | Existing SKMNet internet customers, 1–3 outlets, high transaction volume, willing to give feedback |
| **Incentive** | Free hardware (POS terminal, 4-ch CCTV), free installation, 6 months free CCTV cloud, dedicated support line |
| **Commitment** | 12-month contract, weekly 15-min check-in (month 1–3), monthly NPS survey |
| **Feedback loop** | Direct Slack channel to product team, feature requests tagged "founding-user" |
| **Success metric** | ≥80% daily active use, ≤2 critical bugs/merchant/month, NPS ≥50 |
| **Graduation** | After 6 months → case study, referral bonus (1 month free internet), co-marketing |

> Founding users **co-design** the product. They are not beta testers—they are design partners.

---

## 15. Long-Term Ecosystem Direction

| Horizon | Direction |
|---------|-----------|
| **Year 1** | Prove INCLUDED ERP model with 100+ outlets; stabilize sync, receipt integrity, multi-device |
| **Year 2** | Launch CCTV cloud recording at scale; add AI analytics (people count, dwell); launch managed monitoring |
| **Year 3** | Fintech layer: embedded payments (QRIS, VA), working capital loans based on ERP sales data |
| **Year 4** | Marketplace: B2B ordering from suppliers via ERP; logistics integration |
| **Year 5** | Platform: third-party apps on SKMNetwork ERP (accounting, payroll, e-commerce connectors); white-label for regional ISPs |

**North Star:** Every UMKM in Indonesia runs on SKMNetwork—connected, operated, protected.

---

## Appendix: Revenue Mix Target (Year 3)

| Stream | % of Revenue | Margin Target |
|--------|--------------|---------------|
| Internet (connectivity) | 40% | 35% |
| CCTV Cloud Recording | 25% | 70% |
| Managed Services (monitoring, backup, config) | 15% | 60% |
| ERP Standalone | 10% | 80% |
| Hardware + Installation (one-time) | 10% | 25% |

---

## Document Control

- **Version:** 1.0
- **Date:** 2026-08-22
- **Status:** Approved for internal alignment
- **Next Review:** 2026-11-22 (post founding-user cohort)

> This document captures the **business concept only**. Technical implementation follows the existing roadmap (Phase 4.1.x → Phase 5.x). No architectural changes are implied by this document.