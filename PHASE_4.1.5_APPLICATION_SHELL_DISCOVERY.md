# PHASE 4.1.5 — APPLICATION SHELL DISCOVERY REPORT
## Web ERP Tenant Application Shell & Navigation Architecture

**Status:** DISCOVERY COMPLETE — AWAITING IMPLEMENTATION PLAN  
**Phase ID:** 4.1.5  
**Phase Name:** Application Shell & Navigation Foundation  
**Parent Track:** Web ERP Core (Tenant Workspace)  
**Target Application:** `apps/web` (Next.js App Router)  

---

## 1. Executive Summary & Objective

Phase 4.1.5 establishes the primary tenant workspace shell for Web ERP. It provides the structured, responsive desktop and mobile frame in which all operational ERP modules (Dashboard, POS, Products, Inventory, Customers, Suppliers, Purchases, Sales, Finance, Reports, Users, Settings) are mounted.

### Primary Objective:
Deliver a secure, role-aware, tenant-isolated, and fully responsive Application Shell that enforces tenant scope boundaries, displays active business and branch contexts, filters navigation by RBAC (`OWNER` vs `CASHIER`), intercepts non-active tenant lifecycle states, and provides standardized header and layout services.

---

## 2. Official Scope from Authoritative Roadmap

| Component | Scope Description | Target Files |
| :--- | :--- | :--- |
| **Authenticated Layout** | Root wrapper for all tenant routes `/(authenticated)/*` | `apps/web/src/app/(authenticated)/layout.tsx` |
| **Sidebar Navigation** | Fixed desktop sidebar with dynamic RBAC-filtered route links and branding | `apps/web/src/components/layout/Sidebar.tsx` |
| **Top Navigation Header** | Responsive header with branch switcher, user profile, status indicators, and logout | `apps/web/src/components/layout/Header.tsx` |
| **RBAC Route Guard** | Role-based authorization filter and route matcher | `apps/web/src/lib/rbac.ts` |
| **Tenant Scope Guard** | Strict client-side isolation blocking platform sessions from tenant ERP shell | `apps/web/src/features/auth/guards.tsx` |
| **Tenant Status Screen** | Intercepts `PENDING_REVIEW`, `SUSPENDED`, `REJECTED`, `TERMINATED` business states | `apps/web/src/features/auth/components/TenantStatusScreen.tsx` |
| **Branch Context** | Active branch state provider and selector integration | `apps/web/src/features/branches/BranchContext.tsx` |

---

## 3. Foundation from Completed Phases (4.1.1 – 4.1.4)

- **Phase 4.1.1 (Project Foundation)**: Next.js App Router setup, design tokens, Tailwind / CSS variables (`globals.css`), typography (Geist / Inter fonts).
- **Phase 4.1.2 (Authentication Foundation)**: `AuthContext.tsx`, access token lifecycle, tenant session storage, login (`/login`) and register (`/register`) flows.
- **Phase 4.1.3 (RBAC & Permission Model)**: Canonical roles (`OWNER`, `CASHIER`), route mapping matrix in `lib/rbac.ts`.
- **Phase 4.1.4 (Branch Management Context)**: Multi-branch data models, active branch switching (`BranchContext.tsx`), local branch persistence.

---

## 4. Phase 4.1.5 Scope Additions & Refinements

1. **Unified Shell Layout**: Ensure `AuthenticatedLayout` cleanly mounts `Sidebar`, `Header`, and page content container (`max-w-7xl`).
2. **Scope Boundary Enforcement**: Enforce `TenantGuard` with `TenantAccessDenied` fallback so platform admins (`PLATFORM_ADMIN`, `SUPER_ADMIN`) cannot enter tenant ERP without an explicit tenant session.
3. **Tenant Lifecycle Interception**: Show `TenantStatusScreen` immediately when `business.status !== 'ACTIVE'`.
4. **Dynamic Navigation Highlighting**: Active link state styling (`bg-[#17593e]`, gold indicator `#d3921f`) for current pathname.
5. **Mobile Navigation Drawer**: Responsive slide-over menu for mobile/tablet viewports (< 768px).
6. **Print View Isolation**: `no-print` classes applied to `Sidebar` and `Header` to ensure invoices and receipts print cleanly.

---

## 5. Explicit Out-of-Scope Items

- **Domain Feature Pages**: Business logic inside individual pages (e.g. POS cart, inventory stock opname, journal entries, P&L reports) belongs to their respective module phases.
- **Platform Superadmin Shell**: The Platform Control Center (`apps/web/src/app/platform/*`) is strictly separate.
- **Commercial Entitlement Engine**: Feature entitlement evaluation and plan upgrade popups (Phase 4.1.40E/tracks).
- **ISP Network / Device Services**: RouterOS / GenieACS / TR-069 device operations (Phase 4.1.40D is paused).

---

## 6. Acceptance Criteria

| # | Acceptance Criterion | Verification Method |
| :--- | :--- | :--- |
| **AC-1** | Unauthenticated user accessing `/(authenticated)/*` is redirected to `/login`. | E2E / Component Test |
| **AC-2** | Platform-only session (`PLATFORM_ADMIN`) accessing tenant route is blocked by `TenantAccessDenied`. | Scope Guard Test |
| **AC-3** | Tenant with `PENDING_REVIEW` or `SUSPENDED` status sees `TenantStatusScreen` instead of ERP modules. | Lifecycle Guard Test |
| **AC-4** | `OWNER` role sees all authorized navigation items (Dashboard, Products, POS, Inventory, Finance, Reports, Users, Settings). | RBAC Navigation Test |
| **AC-5** | `CASHIER` role sees restricted navigation items (POS, Sales, Products view) and is blocked from `/finance`, `/settings`, `/users` (`/403`). | RBAC Navigation Test |
| **AC-6** | Top `Header` displays active branch name, allows switching branch via `BranchContext`, and shows user email/role. | UI Component Test |
| **AC-7** | Sign out action clears token state and redirects to `/login`. | Auth Flow Test |
| **AC-8** | Responsive layout displays fixed sidebar on $\ge 768\text{px}$ and toggleable navigation drawer on $< 768\text{px}$. | Responsive Viewport Check |

---

## 7. Smallest Implementation Sequence

```text
Step 1: Audit & Validate existing Shell components (layout.tsx, Sidebar.tsx, Header.tsx, rbac.ts)
   ↓
Step 2: Ensure Mobile Drawer / Navigation Responsive controls are complete
   ↓
Step 3: Verify Branch switcher integration and profile dropdown in Header
   ↓
Step 4: Create focused unit & integration tests for Application Shell and RBAC route enforcement
   ↓
Step 5: Run typecheck (npm run typecheck) and test suite (npm test) in apps/web
   ↓
Step 6: Present Phase 4.1.5 Implementation & Verification Report at Commit Gate
```

---

## 8. Current System State

- **Phase 4.1.40D Status**: `PAUSED / DEFERRED`
- **ERP Priority**: `ACTIVE`
- **Next Authorized Phase**: `PHASE 4.1.5 — APPLICATION SHELL`
