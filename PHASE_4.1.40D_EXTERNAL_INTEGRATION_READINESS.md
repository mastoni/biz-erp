# PHASE 4.1.40D — EXTERNAL INTEGRATION READINESS DISCOVERY REPORT
## Hardware & Device Services Lab Readiness Audit

**Status:** AUDIT COMPLETE — INFRASTRUCTURE DEFICIT IDENTIFIED  
**Phase ID:** 4.1.40D  
**Phase Name:** ISP / Internet Integration (Network & Device Services)  
**Parent Track:** SKMNetwork Platform Ecosystem  
**Target Environments:** Staging VPS (`staging-api.skmnetwork.com`) & Local Lab Infrastructure  

---

## 1. Executive Summary & Integration Classification

Phase 4.1.40D software implementation, data models (`040_isp_management_foundation.sql`), provisioning pipeline integration (SA-2.7), entitlement guards (SA-2.6), AI CS tools (SA-2.9), and unit/integration tests (12/12) are **100% PASS** in CI and deployed on staging (`65b6e1b`).

However, physical external hardware and device controller endpoints are not attached to the staging cloud VPS.

### External Integration Readiness Classification:

| Integration / System | Current Classification | Staging VPS Connectivity | Lab Prerequisite |
| :--- | :--- | :--- | :--- |
| **MikroTik RouterOS API** | `DOCUMENTED ONLY` / `MOCK AVAILABLE` | **NOT AVAILABLE** (No IP/Port route to physical router) | RouterOS v7 device / CHR on staging network |
| **GenieACS TR-069 NBI** | `DOCUMENTED ONLY` / `MOCK AVAILABLE` | **NOT AVAILABLE** (No ACS server deployed on staging) | GenieACS instance + TR-069 CWMP port |
| **ONT / ONU Test Device** | `DOCUMENTED ONLY` / `MOCK AVAILABLE` | **NOT AVAILABLE** (No physical optical line/modem attached) | Optical test bench with provisionable ONT |
| **OpenWISP Controller** | `DOCUMENTED ONLY` / `MOCK AVAILABLE` | **NOT AVAILABLE** (No controller instance deployed) | OpenWISP server / Docker instance |
| **OpenWrt Test Nodes** | `DOCUMENTED ONLY` / `MOCK AVAILABLE` | **NOT AVAILABLE** (No node connected) | OpenWrt AP registered to controller |

---

## 2. Detailed Technical Requirements

### A. Current Staging Status
- **Staging Cloud VPS**: Hosts Docker containers (`bizerp_staging_api`, `bizerp_staging_web`, `bizerp_staging_postgres`).
- **Network Scope**: Public cloud ingress via Nginx reverse proxy.
- **Software Drivers**: `MockIspDriver` is active and deterministic for software-level verification.
- **Physical Lab**: Zero physical network devices attached.

### B. MikroTik RouterOS Requirements
1. **Device / Platform**: Physical MikroTik router (e.g. hEX / CCR) or Virtual RouterOS (Cloud Hosted Router - CHR).
2. **Protocols**: RouterOS REST API (HTTPS Port 443 / RouterOS v7.1+) or RouterOS Binary API (Port 8728).
3. **Configurations Needed**:
   - Dedicated test IP pool (e.g. `10.254.0.0/24`).
   - Isolated PPPoE server interface (`pppoe-in-test`).
   - Test rate-limit profiles: `PROFILE_50M_20M` and `PROFILE_SUSPENDED_ISOLATED` (256k/256k).
   - Dedicated API service user with restricted permissions (`api-bizerp`).

### C. GenieACS (TR-069) Requirements
1. **ACS Server**: GenieACS v1.2+ server (NBI on port 7557, CWMP on port 7547, FS on port 7567).
2. **Authentication**: REST API Basic Auth or Bearer token for NBI.
3. **Data Model / Presets**:
   - TR-069 provisioning presets for test ONT serial numbers (e.g. `ZTEGC*` or `HWTC*`).
   - WAN PPP connection parameter definitions (`InternetGatewayDevice.WANDevice.1...`).

### D. ONT / ONU Test Device Requirements
1. **Hardware**: At least 1 physical GPON/EPON/XPON ONT (or simulated CPE with TR-069 agent like `freecwmp`).
2. **Registration**: ONT paired to test OLT/ACS with optical Rx power between -8 dBm and -25 dBm.
3. **Safe Reboot Scope**: Dedicated test device ensuring zero disruption to live customers.

### E. OpenWISP & OpenWrt Requirements
1. **Controller**: OpenWISP 2 controller instance with REST API enabled.
2. **Access Points**: 1 test node running OpenWrt with `openwisp-config` package installed.

---

## 3. Network Connectivity & VPN Strategy

```text
┌──────────────────────────────────────────────┐
│             Staging Cloud VPS                │
│    (https://staging-api.skmnetwork.com)      │
│        bizerp_staging_api Container          │
└──────────────────────┬───────────────────────┘
                       │ WireGuard Site-to-Site VPN Tunnel
                       ▼
┌──────────────────────────────────────────────┐
│           Local ISP Staging Lab              │
│  ┌────────────────────┬───────────────────┐  │
│  │ MikroTik CHR/hEX   │ GenieACS TR-069   │  │
│  │ (192.168.100.1)    │ (192.168.100.10)  │  │
│  └─────────┬──────────┴─────────┬─────────┘  │
│            │                    │            │
│            ▼                    ▼            │
│     PPPoE Test Client      Physical ONT/ONU  │
└──────────────────────────────────────────────┘
```

1. **Connectivity Requirement**: WireGuard VPN tunnel connecting the staging VPS to the local hardware lab network, or containerized MikroTik CHR + GenieACS within the staging VPS Docker network.
2. **Network Ports Required**:
   - RouterOS API: TCP `8728` (or HTTPS `443` for REST).
   - GenieACS NBI: TCP `7557`.
   - GenieACS CWMP: TCP `7547`.
   - OpenWISP API: HTTPS `443`.

---

## 4. Credentials & Secret Management

| Secret Variable | Target System | Scope | Description |
| :--- | :--- | :--- | :--- |
| `ISP_LAB_MIKROTIK_HOST` | Staging Lab Router | Internal Lab | IP or DNS of test MikroTik |
| `ISP_LAB_MIKROTIK_USER` | Staging Lab Router | Internal Lab | API username |
| `ISP_LAB_MIKROTIK_PASS` | Staging Lab Router | Internal Lab | API password (encrypted at rest) |
| `ISP_LAB_GENIEACS_URL` | Staging Lab ACS | Internal Lab | Base URL for GenieACS NBI (`http://...:7557`) |
| `ISP_LAB_GENIEACS_TOKEN`| Staging Lab ACS | Internal Lab | Auth token / credentials for ACS NBI |

---

## 5. Safe Test & Rollback Procedure

### Safe Live Verification Sequence (When Lab is Connected):
1. **Gateway Registration**: Register staging lab MikroTik and GenieACS via `POST /v1/isp/gateways`.
2. **Test Subscriber Creation**: Create subscriber with username `test_subscriber_lab@skmnet` and test ONT serial.
3. **Provisioning `ACTIVATE`**:
   - Verify PPPoE secret appears in `/ppp secret print` on MikroTik.
   - Verify device parameters bind in GenieACS.
4. **Provisioning `SUSPEND`**:
   - Verify secret disabled or rate-limit updated to 256k.
5. **Provisioning `RESTORE`**:
   - Verify secret re-enabled and full bandwidth restored.
6. **AI CS Diagnostics**:
   - Execute `check_onu_status` and verify live optical power readings.
   - Execute `reboot_onu` with confirmation and observe physical ONT restart.
7. **Provisioning `DEACTIVATE` (Teardown & Rollback)**:
   - Removes PPPoE secret from MikroTik.
   - Unbinds device from GenieACS.
   - Deletes test subscriber and gateway from staging database.

---

## 6. Acceptance Criteria Mapping

| Acceptance Criterion | Verification Mode | Status |
| :--- | :--- | :--- |
| Database schema & composite tenant FKs | PostgreSQL Database (`040_isp_management_foundation.sql`) | **PASS / VERIFIED** |
| Subscriber CRUD & PPPoE uniqueness | Automated Vitest (`test/isp_management_4_1_40d.test.ts`) | **PASS / VERIFIED** |
| SA-2.7 Provisioning state machine (`ACTIVATE` $\rightarrow$ `SUSPEND` $\rightarrow$ `RESTORE` $\rightarrow$ `DEACTIVATE`) | Provisioning Engine + `MockIspDriver` | **PASS / VERIFIED** |
| AI CS Tools (`check_onu_status`, `reboot_onu`, `isp_troubleshooting`) | AI CS Service Layer | **PASS / VERIFIED** |
| SA-2.8 Audit logging & secret redaction | Observability Engine | **PASS / VERIFIED** |
| Real RouterOS traffic shaping / queue creation | Physical MikroTik / CHR | **NOT AVAILABLE (Lab pending)** |
| Real TR-069 optical power query & reboot | Physical ONT + GenieACS | **NOT AVAILABLE (Lab pending)** |
| Real OpenWrt mesh configuration | OpenWISP Controller + Node | **NOT AVAILABLE (Lab pending)** |

---

## 7. Minimal Infrastructure Needed to Complete Live Acceptance

To transition the external integration from `NOT AVAILABLE` to `VERIFIED LIVE`:

1. **Option A (Containerized Staging Lab — Fastest & Fully Isolated)**:
   - Add a lightweight containerized MikroTik CHR instance and GenieACS container to `docker-compose.staging.yml`.
   - Allows fully automated end-to-end integration tests in CI/staging without physical fiber/hardware.
2. **Option B (Physical Hardware Lab — Site-to-Site)**:
   - Connect physical MikroTik router and GPON ONT testbench via WireGuard tunnel to the staging VPS.

---

## 8. Final Readiness Conclusion

**EXTERNAL INTEGRATION NOT READY**

### Concrete Gap:
The software architecture, database foundations, driver abstractions, API routes, and automated test suites for Phase 4.1.40D are **100% COMPLETE & VERIFIED** (`65b6e1b`). However, live physical or containerized lab hardware (MikroTik RouterOS, GenieACS TR-069 server, physical ONT) is not attached to the staging VPS environment.

---

*Phase 4.1.40D software foundation is closed. Awaiting decision on whether to proceed to the next roadmap phase or establish containerized/physical hardware lab for live external verification.*
