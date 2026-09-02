# PHASE 4.1.5 — APPLICATION SHELL IMPLEMENTATION PLAN
## Web ERP Tenant Application Shell & RBAC Navigation Verification Plan

**Status:** READY FOR IMPLEMENTATION  
**Phase ID:** 4.1.5  
**Phase Name:** Application Shell & Navigation Foundation  
**Parent Track:** Web ERP Core (Tenant Workspace)  
**Target Application:** `apps/web`  

---

## 1. Executive Summary & Inventory Classification

Phase 4.1.5 establishes the complete, role-aware, tenant-isolated Application Shell for Web ERP.
Inspection of the codebase confirms that the core architectural foundations (layout, desktop sidebar, mobile drawer, branch selector, RBAC route matrix, tenant status screens, and scope guards) are already cleanly implemented.

### Component-by-Component Classification:

| # | Shell Dimension / Component | Implementation File | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Authenticated Layout** | `apps/web/src/app/(authenticated)/layout.tsx` | `COMPLETE` | Handles session loading, tenant status interception, scope guard, desktop sidebar, header, and content container. |
| 2 | **Sidebar Navigation** | `apps/web/src/components/layout/Sidebar.tsx` | `COMPLETE` | Fixed desktop sidebar, branding, dynamic RBAC navigation, active link highlighting, print isolation. |
| 3 | **Header Navigation** | `apps/web/src/components/layout/Header.tsx` | `COMPLETE` | Mobile drawer trigger, TenantSwitcher, Branch selector dropdown, StatusPill, User profile dropdown, logout. |
| 4 | **Responsive Behavior** | `Sidebar.tsx` & `Header.tsx` | `COMPLETE` | Desktop fixed sidebar (`md:flex`), main area offset (`md:pl-64`), mobile slide-over `Sheet` drawer (`md:hidden`). |
| 5 | **OWNER / CASHIER RBAC** | `apps/web/src/lib/rbac.ts` | `COMPLETE` | `ROUTE_PERMISSIONS` matrix, longest-prefix `canAccessRoute`, `getAuthorizedNavigation`. |
| 6 | **Tenant Isolation** | `apps/web/src/features/auth/guards.tsx` | `COMPLETE` | `TenantGuard` ensuring platform sessions cannot enter tenant workspace without explicit tenant context. |
| 7 | **Branch Context / Switcher**| `BranchContext.tsx` & `Header.tsx` | `COMPLETE` | Multi-branch state, active branch selector dropdown with active checkmark indicator. |
| 8 | **Tenant Lifecycle Interception**| `TenantStatusScreen.tsx` | `COMPLETE` | Intercepts non-ACTIVE states (`PENDING_REVIEW`, `SUSPENDED`, `REJECTED`, `TERMINATED`). |
| 9 | **Platform-Token Blocking** | `layout.tsx` (`TenantAccessDenied`) | `COMPLETE` | Blocks platform tokens from tenant routes with explicit UI rejection message. |
| 10| **Loading / Error / Empty States**| `layout.tsx` & `app/403/page.tsx` | `COMPLETE` | Loading spinner for session resolution, dedicated `/403` forbidden page. |
| 11| **Navigation Consistency** | `Sidebar.tsx` & `Header.tsx` | `COMPLETE` | Desktop and mobile menus consume identical `getAuthorizedNavigation(role)` source of truth. |
| 12| **Session / Logout Behavior** | `AuthContext.tsx` & `Header.tsx` | `COMPLETE` | Integrated `logout()` handler clears tokens and redirects to `/login`. |
| 13| **Accessibility & Semantics**| Layout & Navigation Elements | `COMPLETE` | Semantic `<aside>`, `<header>`, `<nav>`, `<main>` landmarks; screen-reader titles on mobile drawer. |

---

## 2. Identified Implementation Gaps

The visual and runtime implementation of the shell is **COMPLETE**.  
The single concrete gap to achieve formal Phase 4.1.5 closure is:

### Gap: Dedicated Unit & Integration Test Suite for Shell RBAC & Guards
- **Target Files**:
  - `apps/web/src/lib/__tests__/rbac.test.ts` (NEW)
  - `apps/web/src/lib/__tests__/guards.test.ts` (NEW)
- **Current Behavior**: `apps/web/src/lib/__tests__/` contains only `format.test.ts`. Shell RBAC logic and guard authorization matrices lack dedicated automated test coverage.
- **Required Behavior**: Comprehensive Vitest test suite validating:
  1. `canAccessRoute` evaluation across all routes for `OWNER` and `CASHIER`.
  2. Longest-prefix route specificity (e.g. `/inventory/movements` vs `/inventory`).
  3. `getAuthorizedNavigation` filtering for `OWNER` (full list) vs `CASHIER` (restricted list).
  4. Non-existent route fallback (`false`).
  5. `TenantGuard` and `PlatformGuard` evaluation across `tenant` vs `platform` session claims.

---

## 3. Strict Implementation Prohibitions

During Phase 4.1.5 completion, the agent MUST NOT:
- Rewrite or refactor existing working layout/sidebar/header components.
- Introduce a new authentication system or modify `AuthContext.tsx`.
- Introduce a second RBAC system or modify canonical roles (`OWNER`, `CASHIER`).
- Introduce a second tenant guard or bypass `TenantGuard`.
- Introduce commercial entitlement logic (Phase 4.1.40E).
- Introduce ISP functionality (Phase 4.1.40D is paused).
- Implement domain-specific business page logic (POS cart, inventory movements, finance ledgers).
- Modify completed 4.1.1–4.1.4 foundations unless a concrete defect is proven.

---

## 4. Focused Acceptance Test Matrix

| Test ID | Target Component | Test Scenario | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `SHELL-001` | `lib/rbac.ts` | `OWNER` route access across all canonical ERP routes | All routes return `true` |
| `SHELL-002` | `lib/rbac.ts` | `CASHIER` route access to permitted operational routes (`/dashboard`, `/pos`, `/inventory`, `/purchases`, `/customers`, `/suppliers`, `/reports`, `/settings`) | Permitted routes return `true` |
| `SHELL-003` | `lib/rbac.ts` | `CASHIER` route access to restricted routes (`/products`, `/inventory/movements`, `/inventory/adjustment`, `/sales`, `/customers/new`, `/users`) | Restricted routes return `false` |
| `SHELL-004` | `lib/rbac.ts` | Longest-prefix matching (`/inventory/movements` restricted for CASHIER while `/inventory` is permitted) | Correctly resolves specific child route permissions |
| `SHELL-005` | `lib/rbac.ts` | `getAuthorizedNavigation` for `OWNER` | Returns all 15 navigation items |
| `SHELL-006` | `lib/rbac.ts` | `getAuthorizedNavigation` for `CASHIER` | Returns only authorized navigation items (excludes Products, Movements, Adjustments, Sales, Users) |
| `SHELL-007` | `lib/rbac.ts` | Unauthenticated / null role access | Returns `false` for all routes and empty navigation array |
| `SHELL-008` | `features/auth/guards.tsx` | `TenantGuard` authorization check | Allows tenant session, rejects platform session |
| `SHELL-009` | `features/auth/guards.tsx` | `PlatformGuard` authorization check | Allows platform session, rejects tenant session |

---

## 5. Smallest Implementation Sequence

```text
Step 1: Author focused RBAC and Guard test suite in apps/web/src/lib/__tests__/rbac.test.ts
   ↓
Step 2: Author focused Scope Guard test suite in apps/web/src/lib/__tests__/guards.test.ts
   ↓
Step 3: Run targeted test suite: npx vitest run src/lib/__tests__/rbac.test.ts src/lib/__tests__/guards.test.ts
   ↓
Step 4: Run frontend typecheck: npm run typecheck in apps/web
   ↓
Step 5: Run frontend production build: npm run build in apps/web
   ↓
Step 6: Present Phase 4.1.5 Verification Report at Commit Gate
```

---

## 6. Files Allowed to Be Modified / Created

| File | Type | Description |
| :--- | :--- | :--- |
| `apps/web/src/lib/__tests__/rbac.test.ts` | **NEW** | Focused RBAC permissions matrix and route matching unit tests |
| `apps/web/src/lib/__tests__/guards.test.ts` | **NEW** | Focused Scope Guard unit tests |
| `PHASE_4.1.5_APPLICATION_SHELL_IMPLEMENTATION_PLAN.md` | **NEW** | Authoritative Phase 4.1.5 Implementation Plan |

---

## 7. Implementation Readiness Decision

**IMPLEMENTATION READY: YES**

---

### Preserved Roadmap State:
- **Phase 4.1.40D**: `PAUSED / DEFERRED`
- **ERP Priority**: `ACTIVE`
- **Current Active Phase**: `PHASE 4.1.5 — APPLICATION SHELL`
