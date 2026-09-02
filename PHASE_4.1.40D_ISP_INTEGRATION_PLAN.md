# PHASE 4.1.40D — ISP / INTERNET INTEGRATION IMPLEMENTATION PLAN
## Network & Device Services Foundation

**Status:** DRAFT — ARCHITECTURALLY & SECURITY RECONCILED  
**Phase ID:** 4.1.40D  
**Phase Name:** ISP / Internet Integration (Network & Device Services)  
**Parent Track:** SKMNetwork Platform Ecosystem — Canonical Services  
**Authoritative Roadmaps:**
- `docs/PHASE_ROADMAP.md` (Track 4.1.40D)
- `MASTER_ROADMAP_SKMNETWORK_ECOSYSTEM.md` (Section 9: Network & Device Services)

---

## 1. Executive Summary & Goals

Phase 4.1.40D establishes the operational service layer for the canonical platform service `ISP_MANAGEMENT`.

### Primary Goals:
1. **Subscriber Management**: Model and manage ISP subscribers (`isp_subscribers`) bound to ERP customers, commercial plans (`INTERNET_PLAN`), and multi-provider gateway infrastructure.
2. **Database-Enforced Tenant Integrity**: Enforce hard cross-tenant isolation at the database level using composite foreign keys `(gateway_id, business_id)` in addition to service-layer verification.
3. **Multi-Gateway Architecture**: Decouple subscriber network authentication (MikroTik/RADIUS) from CPE device management (GenieACS TR-069) and mesh fleet controllers (OpenWISP).
4. **Pluggable Network Drivers**: Implement driver adapters for MikroTik (RouterOS PPPoE/Queues), GenieACS (TR-069 ONT/CPE diagnostics), and OpenWISP (device controllers), starting with resilient Mock/Sandbox drivers for deterministic testing.
5. **Provisioning Integration**: Wire subscriber lifecycle events seamlessly to SA-2.7 `provisioning_jobs` using canonical actions (`ACTIVATE`, `SUSPEND`, `RESTORE`, `DEACTIVATE`, `CONFIGURE`).
6. **Entitlement & Tenant Security**: Enforce SA-2.6 entitlement guards and tenant isolation (`business_id`) on all ISP operations.
7. **AI CS Diagnostics**: Extend SA-2.9 AI Customer Service tools (`check_onu_status`, `reboot_onu`, `isp_troubleshooting`) via authenticated service boundaries.
8. **Strict ERP Core Isolation**: Ensure zero network/device concepts leak into ERP master data, inventory, or accounting journals.

---

## 2. Canonical Action Reconciliation (SA-2.7 Alignment)

The canonical actions defined in SA-2.7 (`provisioning_jobs`) are preserved without any database or enum modifications:

| ISP Business Intent | SA-2.7 Canonical Action | Multi-Gateway Driver Operational Behavior |
| :--- | :--- | :--- |
| **New Subscription Activation** | `ACTIVATE` | 1. **MikroTik**: Create PPPoE secret & bandwidth queue.<br>2. **GenieACS**: Bind ONT Serial, push Wi-Fi & TR-069 config. |
| **Non-Payment / Policy Suspension** | `SUSPEND` | 1. **MikroTik**: Disable PPPoE account / reassign to isolated rate-limit profile.<br>2. **GenieACS**: Update ACS provisioning tag to `SUSPENDED`. |
| **Payment Received / Reactivation** | `RESTORE` | 1. **MikroTik**: Re-enable PPPoE account and restore normal plan bandwidth.<br>2. **GenieACS**: Restore normal ACS profile. |
| **Service Cancellation / Termination** | `DEACTIVATE` | 1. **MikroTik**: Delete/archive PPPoE account & release IP.<br>2. **GenieACS**: Unbind ONT Serial and clear provisioning profile. |
| **Bandwidth Upgrade / Downgrade** | `CONFIGURE` | 1. **MikroTik**: Update Simple Queue / Queue Tree target rate-limit to new plan speed. |

> **Reconciliation Decision**: Reuses existing `ProvisioningAction = 'ACTIVATE' | 'SUSPEND' | 'RESTORE' | 'DEACTIVATE' | 'CONFIGURE'`. Zero modifications to `037_provisioning_foundation.sql` or `provisioning_dto.ts`.

---

## 3. Multi-Gateway Model & Database-Level Tenant Integrity

### 3.1 Composite Foreign Key Strategy
To guarantee that a subscriber cannot bind to a gateway belonging to another tenant at the database engine level, `isp_gateways` defines a unique composite constraint, and `isp_subscribers` references `(gateway_id, business_id)`:

```sql
-- isp_gateways composite unique constraint
CONSTRAINT uq_isp_gateways_id_business UNIQUE (id, business_id)

-- isp_subscribers composite foreign keys
CONSTRAINT fk_isp_sub_network_gw FOREIGN KEY (network_gateway_id, business_id)
  REFERENCES isp_gateways(id, business_id) ON DELETE RESTRICT,

CONSTRAINT fk_isp_sub_acs_gw FOREIGN KEY (acs_gateway_id, business_id)
  REFERENCES isp_gateways(id, business_id) ON DELETE SET NULL,

CONSTRAINT fk_isp_sub_mesh_gw FOREIGN KEY (mesh_gateway_id, business_id)
  REFERENCES isp_gateways(id, business_id) ON DELETE SET NULL
```

- **PostgreSQL Compatibility**: In PostgreSQL, standard `MATCH SIMPLE` rules apply. If `acs_gateway_id` or `mesh_gateway_id` is `NULL`, the constraint is satisfied. When non-null, PostgreSQL guarantees that `(gateway_id, business_id)` exists in `isp_gateways`, making cross-tenant binding physically impossible in the DB engine.

### 3.2 Canonical Relationship Structure

```text
ERP Customer (customers.id)
       │
       ▼ (1 : N)
ISP Subscriber (isp_subscribers.id)
       ├── business_id (UUID NOT NULL)
       ├── customer_id (UUID NOT NULL REFERENCES customers(id))
       ├── subscription_id (UUID NULL REFERENCES subscriptions(id))
       ├── plan_code (TEXT NOT NULL REFERENCES plans(code))
       │
       ├── network_gateway_id (UUID NOT NULL)  ──┐
       ├── acs_gateway_id     (UUID NULL)      ──┼── Composite FKs (gw_id, business_id) -> isp_gateways(id, business_id)
       ├── mesh_gateway_id    (UUID NULL)      ──┘
       │
       ├── pppoe_username (TEXT NOT NULL)
       ├── pppoe_password_encrypted (TEXT NOT NULL)
       ├── ip_address (TEXT NULL)
       ├── ont_serial_number (TEXT NULL)
       ├── ont_vlan (INTEGER NULL)
       ├── status (TEXT: PENDING_ACTIVATION | ACTIVE | SUSPENDED | TERMINATED)
       └── metadata (JSONB)
```

- **Uniqueness Guarantee**: `UNIQUE(network_gateway_id, pppoe_username)` ensures no duplicate PPPoE usernames exist on the same network gateway.

### 3.3 Defense-in-Depth: Service-Layer Validation
In addition to database-level composite foreign keys, `isp_service.ts` strictly validates:
1. **Tenant Match**: Explicitly verifies `gateway.business_id === tenantId`.
2. **Gateway Type Match**:
   - `network_gateway_id` must have `gateway_type IN ('MIKROTIK', 'RADIUS')`.
   - `acs_gateway_id` must have `gateway_type = 'GENIEACS'`.
   - `mesh_gateway_id` must have `gateway_type = 'OPENWISP'`.
3. **Gateway Status**: Gateway must be in `status = 'ACTIVE'`.

---

## 4. Provisioning Job Driver Execution Flow

When an ISP action is triggered, SA-2.7 `provisioning_jobs` stores the complete multi-gateway context in its `payload`:

```json
{
  "subscriber_id": "sub-uuid",
  "business_id": "biz-uuid",
  "plan_code": "INTERNET_50M",
  "network_gateway_id": "gw-mikrotik-uuid",
  "acs_gateway_id": "gw-genieacs-uuid",
  "mesh_gateway_id": null,
  "pppoe_username": "user123@skmnet",
  "ont_serial_number": "ZTEGC0123456",
  "target_action": "ACTIVATE"
}
```

### Multi-Step Orchestration within `IspProvisioningDriver`:
1. **Network Step**: Resolves `network_gateway_id` $\rightarrow$ invokes MikroTik driver (creates PPPoE secret, sets queue rate-limit).
2. **ACS Step**: If `acs_gateway_id` is present $\rightarrow$ invokes GenieACS driver (provisions ONT Serial, verifies optical parameters).
3. **Mesh Step**: If `mesh_gateway_id` is present $\rightarrow$ invokes OpenWISP driver.
4. **Aggregate Result**: Output written to `provisioning_jobs.result`:
   ```json
   {
     "service": "ISP_MANAGEMENT",
     "action": "ACTIVATE",
     "network_provisioning": {
       "gateway_id": "gw-mikrotik-uuid",
       "status": "SUCCESS",
       "profile": "RATE_50M_20M",
       "interface": "pppoe-user123"
     },
     "acs_provisioning": {
       "gateway_id": "gw-genieacs-uuid",
       "status": "SUCCESS",
       "device_id": "ZTEGC0123456",
       "tr069_sync": "SYNCHRONIZED"
     },
     "timestamp": "2026-09-02T18:00:00.000Z"
   }
   ```
5. **Failure / Rollback**: If any driver step fails, the job records the failure in `provisioning_jobs.error_message`, remaining retryable via SA-2.7 `retryJob`.

---

## 5. Credential & Gateway Security Model

### `isp_gateways` Management:
1. **Ownership**: Every gateway belongs to a specific tenant (`business_id`).
2. **Gateway Types**: `MIKROTIK`, `GENIEACS`, `OPENWISP`, `RADIUS`.
3. **Encryption-at-Rest**: Gateway passwords, API tokens, and secrets are encrypted using AES-256-GCM.
4. **Secret Redaction**:
   - Outgoing API DTOs mask credentials: `{ "auth_secret": "********" }`.
   - Audit logs store only metadata: `{ "event": "GATEWAY_CREATED", "host": "10.0.0.1", "secret": "[REDACTED]" }`.
   - Credentials are never exposed to AI Customer Service tools or public endpoints.
5. **Rotation**: Supported via `PATCH /v1/isp/gateways/:id` with optimistic concurrency / versioning.

---

## 6. ERP Boundary Guarantee

- **ERP Core (Accounting/POS/Sales/Inventory)**:
  - ZERO references to RouterOS, GenieACS, TR-069, VLANs, ONTs, or network IPs.
  - Subscription billing generates standard invoices/receivables in ERP without touching router state.
- **ISP Service Layer**:
  - Encapsulates all network driver invocations and device monitoring.
  - Communicates with ERP strictly through standard tenant and customer IDs.

---

## 7. Entitlement & Provisioning Architecture

1. **Entitlement Guard**: Every tenant ISP route (`/v1/isp/*`) is protected by `requireServiceEntitlement('ISP_MANAGEMENT')`.
2. **Provisioning Workflow**:
   - `POST /v1/isp/subscribers/:id/provision`
   - Creates a record in `provisioning_jobs` with `action = 'ACTIVATE'`, `service_code = 'ISP_MANAGEMENT'`, and `idempotency_key`.
   - `provisioning_service.processJob(jobId)` triggers the registered `IspProvisioningDriver`.
   - Job logs progress and outputs result to `provisioning_audit_logs`.

---

## 8. AI Customer Service (AI CS) Integration

AI CS accesses ISP diagnostics exclusively via authenticated, entitlement-gated tools:

1. **`get_provisioning_diagnostic`** (Existing): Checks provisioning job history and overall service status.
2. **`check_onu_status`** (New/Extended): Resolves ONT optical signal level (Rx/Tx dBm), registration status, and uptime from GenieACS via `subscriber.acs_gateway_id`.
3. **`reboot_onu`** (New): Dispatches remote reboot command via GenieACS TR-069 with customer confirmation.
4. **`isp_troubleshooting`** (New): Analyzes PPPoE session status and router queue errors via `subscriber.network_gateway_id`.

> **Security Guard**: Tools validate `ctx.entitledServices.includes('ISP_MANAGEMENT')` and operate strictly within the caller's `ctx.businessId`.

---

## 9. Proposed Database Schema (`040_isp_management_foundation.sql`)

```sql
-- 1. ISP Gateways (Routers, BNGs, ACS Controllers, Mesh Controllers)
CREATE TABLE IF NOT EXISTS isp_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gateway_type TEXT NOT NULL CHECK (gateway_type IN ('MIKROTIK', 'GENIEACS', 'OPENWISP', 'RADIUS')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  use_tls BOOLEAN NOT NULL DEFAULT TRUE,
  auth_username TEXT,
  auth_secret_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_isp_gateways_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_isp_gateways_business_id ON isp_gateways(business_id);

-- 2. ISP Subscribers (Multi-Gateway Architecture with Composite Tenant FKs)
CREATE TABLE IF NOT EXISTS isp_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL REFERENCES plans(code),
  
  -- Multi-Gateway References with Composite Tenant Integrity Constraints
  network_gateway_id UUID NOT NULL,
  acs_gateway_id UUID,
  mesh_gateway_id UUID,

  pppoe_username TEXT NOT NULL,
  pppoe_password_encrypted TEXT NOT NULL,
  ip_address TEXT,
  ont_serial_number TEXT,
  ont_vlan INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION' CHECK (status IN ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Database-enforced Tenant FK Integrity
  CONSTRAINT fk_isp_sub_network_gw FOREIGN KEY (network_gateway_id, business_id)
    REFERENCES isp_gateways(id, business_id) ON DELETE RESTRICT,
  CONSTRAINT fk_isp_sub_acs_gw FOREIGN KEY (acs_gateway_id, business_id)
    REFERENCES isp_gateways(id, business_id) ON DELETE SET NULL,
  CONSTRAINT fk_isp_sub_mesh_gw FOREIGN KEY (mesh_gateway_id, business_id)
    REFERENCES isp_gateways(id, business_id) ON DELETE SET NULL,

  CONSTRAINT uq_isp_network_pppoe_username UNIQUE (network_gateway_id, pppoe_username)
);

CREATE INDEX IF NOT EXISTS idx_isp_subscribers_business_id ON isp_subscribers(business_id);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_customer_id ON isp_subscribers(customer_id);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_network_gw ON isp_subscribers(network_gateway_id);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_acs_gw ON isp_subscribers(acs_gateway_id);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_ont_serial ON isp_subscribers(ont_serial_number);
```

---

## 10. Focused Test Strategy (12 Tests)

The test suite `apps/api/test/isp_management_4_1_40d.test.ts` will cover:

1. **ISP-001**: Tenant Isolation — Tenant B cannot view/modify Tenant A subscribers/gateways (`403 BUSINESS_ACCESS_DENIED`).
2. **ISP-002**: Entitlement Enforcement — Unentitled tenant rejected (`403 SERVICE_NOT_ENTITLED`).
3. **ISP-003**: Gateway CRUD & Credential Redaction — API masks `auth_secret` as `********`.
4. **ISP-004**: Composite DB FK & Multi-Gateway Validation — DB rejects cross-tenant gateway bindings; service validates gateway types and unique PPPoE username.
5. **ISP-005**: Provisioning Activation (`ACTIVATE`) — Coordinates MikroTik + GenieACS mock execution, transitions status to `ACTIVE`.
6. **ISP-006**: Provisioning Suspension (`SUSPEND`) — Disables PPPoE & updates ACS profile, transitions status to `SUSPENDED`.
7. **ISP-007**: Provisioning Restoration (`RESTORE`) — Restores PPPoE bandwidth and ACS profile to `ACTIVE`.
8. **ISP-008**: Provisioning Termination (`DEACTIVATE`) — Tears down network and ACS bindings, status `TERMINATED`.
9. **ISP-009**: AI CS Tool `check_onu_status` — Queries mock GenieACS for optical Rx/Tx power within tenant boundary.
10. **ISP-010**: AI CS Tool `reboot_onu` — Successfully triggers reboot on mock CPE.
11. **ISP-011**: Provisioning Idempotency & Retry — Duplicate `idempotency_key` returns existing job without double execution.
12. **ISP-012**: SA-2.8 Audit Trail — Validates `platform_audit_logs` entries for all ISP subscriber mutations.

---

## 11. Staging Prerequisites & Mocking Strategy

1. **Mock Driver Default**: On staging, `MockIspDriver` is active by default to allow automated verification without physical MikroTik/GenieACS hardware.
2. **Live Adapter Configuration**: Staging environment variables (`ISP_MIKROTIK_HOST`, `ISP_GENIEACS_URL`) allow connecting to dedicated staging lab hardware when available.
3. **Rollback Strategy**: Clean database teardown in `040_isp_management_foundation.sql` rollback section (`DROP TABLE isp_subscribers; DROP TABLE isp_gateways;`).

---

## 12. Ordered Implementation Sequence

1. **Migration**: `apps/api/migrations/040_isp_management_foundation.sql`.
2. **DTOs & Validation**: `apps/api/src/dto/isp_dto.ts`.
3. **Driver Interface & Mocks**: `apps/api/src/drivers/isp/`.
4. **ISP Service & Repository**: `apps/api/src/services/isp_service.ts`, `apps/api/src/repositories/isp_repository.ts`.
5. **API Routes & Guards**: `apps/api/src/routes/isp_routes.ts` mounted in `app.ts`.
6. **AI CS Tools**: `apps/api/src/services/ai_tool_registry.ts`.
7. **Focused Test Suite**: `apps/api/test/isp_management_4_1_40d.test.ts`.
8. **Build, Review & Staging Promotion**.

---

## 13. Risks & Blockers

- **Risks**: Multi-gateway partial failures (mitigated by explicit step results in `provisioning_jobs.result` and SA-2.7 retry mechanism).
- **Blockers**: **NONE**. All foundations are verified and ready.
