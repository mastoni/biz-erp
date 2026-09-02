# PHASE 4.1.40D — INFRASTRUCTURE DECISION REPORT
## ISP & Device Integration Lab Architecture Decision

**Status:** DECISION SUBMITTED — AWAITING INFRASTRUCTURE APPROVAL  
**Phase ID:** 4.1.40D  
**Phase Name:** ISP / Internet Integration (Network & Device Services)  
**Parent Track:** SKMNetwork Platform Ecosystem  
**Target Environments:** Staging VPS (`staging-api.skmnetwork.com`) & ISP Hardware Test Lab  

---

## 1. Current Blocker Analysis

Phase 4.1.40D software implementation, data models, SA-2.7 provisioning integration, SA-2.6 entitlement guards, AI CS tools, and automated tests are **100% PASS** on staging (`65b6e1b`).

**The Exact Concrete Blocker:**  
The staging cloud VPS runs isolated in a public cloud environment without network reachability to either:
1. A genuine RouterOS endpoint (MikroTik CHR or physical hardware) for live PPPoE / queue orchestration.
2. A genuine GenieACS TR-069 NBI endpoint and registered CPE for live device parameter query and reboot RPC execution.

---

## 2. Path A Analysis — Virtual / Containerized Staging Lab

### Overview
Deploy a virtualized integration stack directly on the staging VPS or an adjacent staging Docker network:
- **MikroTik RouterOS CHR**: Genuine MikroTik RouterOS v7 running in a container / KVM instance.
- **GenieACS Container**: Official GenieACS v1.2 stack (NBI, CWMP, FS, MongoDB).
- **Virtual TR-069 CPE**: Software CWMP agent (e.g. `freecwmp` or simulated TR-069 client) registered to GenieACS.
- **OpenWISP Test Container**: Lightweight OpenWISP controller instance.

### Evaluation Criteria:
1. **Can it satisfy official 4.1.40D acceptance?**: **YES (for Network & Protocol boundaries)**. RouterOS CHR executes the exact same RouterOS REST API, PPPoE server, queue trees, and firewall rules as physical hardware. GenieACS NBI executes real TR-069 SOAP/NBI exchanges.
2. **Acceptance criteria verified**:
   - Real RouterOS REST API / binary API authentication & command dispatch.
   - Real PPPoE secret creation, enabling, rate-limiting, disabling, and deletion.
   - Real GenieACS NBI REST query, device parameter retrieval, and reboot RPC dispatch.
   - Real SA-2.7 `provisioning_jobs` state machine transitions with live external results.
3. **Criteria still requiring physical hardware**:
   - Physical GPON optical laser power attenuation (dBm readings will be synthetic or fixed simulation values).
   - Physical hardware power cycling / LED observation.
4. **Minimum components**:
   - 1x MikroTik CHR container/VM (512MB RAM).
   - 1x GenieACS container stack (GenieACS + MongoDB, 1GB RAM).
   - 1x Virtual TR-069 client.
5. **Network topology**: Local Docker network bridge `bizerp_staging_network` on the staging VPS (no external VPN needed).
6. **Required credentials**:
   - `MIKROTIK_HOST=bizerp_staging_chr`, `MIKROTIK_PORT=8728` (or `443`), `MIKROTIK_USER=api_admin`, `MIKROTIK_PASS=...`
   - `GENIEACS_NBI_URL=http://bizerp_staging_genieacs:7557`
7. **Rollback & safety**: Ephemeral Docker containers with volume snapshots; 100% isolated from any real customer traffic.
8. **Staging compatibility**: **100% SAFE** — can be deployed alongside existing staging containers via Docker Compose.
9. **Application code changes required**: **0 CODE CHANGES** — configured solely through `/v1/isp/gateways` API records and standard environment variables.
10. **Estimated complexity**: **MEDIUM** (1-2 days to provision Docker Compose manifests).

---

## 3. Path B Analysis — Physical ISP Hardware Lab

### Overview
Establish a physical hardware test bench in a dedicated office/POP lab connected to the staging VPS via a secure WireGuard site-to-site VPN tunnel:
- **Physical Router**: MikroTik CCR1009 / hEX S connected to a dedicated lab switch.
- **Physical OLT & ONT**: GPON Mini-OLT (or direct Gigabit ethernet WAN) + GPON/XPON ONT.
- **Physical GenieACS Server**: Dedicated TR-069 server managing lab CPEs.
- **Physical OpenWrt AP**: Test router running OpenWrt with `openwisp-config`.
- **WireGuard Gateway**: Lab router establishing tunnel to staging VPS.

### Evaluation Criteria:
1. **Can it satisfy official 4.1.40D acceptance?**: **YES (100% comprehensive)**. Covers all protocol, software, optical, and physical hardware criteria.
2. **Acceptance criteria verified**:
   - Everything in Path A, PLUS:
   - Genuine physical GPON transceiver laser optical power (Rx/Tx dBm) queried from physical fiber.
   - Genuine physical ONT hardware power cycle and cold-boot timing verification.
3. **Criteria still requiring physical hardware**: None (all satisfied).
4. **Minimum components**:
   - 1x MikroTik Router (RouterOS v7).
   - 1x Physical GPON ONT with TR-069 client.
   - 1x Linux host running GenieACS & WireGuard client.
   - 1x WireGuard tunnel interface configured on staging VPS.
5. **Network topology**: WireGuard site-to-site tunnel (`10.250.0.0/24`) routing staging VPS traffic directly to lab subnet (`192.168.100.0/24`).
6. **Required credentials**:
   - WireGuard private/public keys, router API credentials, ACS NBI token.
7. **Rollback & safety**: Dedicated isolated VLAN/subnet; physical devices disconnected from production fiber.
8. **Staging compatibility**: Safe, provided WireGuard firewall rules strictly isolate lab subnet from production networks.
9. **Application code changes required**: **0 CODE CHANGES**.
10. **Estimated complexity**: **HIGH** (Requires physical hardware procurement, fiber splicing/patching, WireGuard tunnel setup, and manual lab maintenance).

---

## 4. Acceptance-Criteria Coverage Matrix

| Acceptance Criteria Item | Current Staging | PATH A (Virtual Lab) | PATH B (Physical Lab) |
| :--- | :--- | :--- | :--- |
| **1. Database & Tenant Composite FKs** | **PASS / VERIFIED** | **PASS / VERIFIED** | **PASS / VERIFIED** |
| **2. Entitlement & Auth Guards** | **PASS / VERIFIED** | **PASS / VERIFIED** | **PASS / VERIFIED** |
| **3. Subscriber / Gateway CRUD & Masking** | **PASS / VERIFIED** | **PASS / VERIFIED** | **PASS / VERIFIED** |
| **4. SA-2.7 State Machine & Idempotency** | **PASS / VERIFIED** | **PASS / VERIFIED** | **PASS / VERIFIED** |
| **5. AI CS Tool Guards (`reboot_onu` gate)**| **PASS / VERIFIED** | **PASS / VERIFIED** | **PASS / VERIFIED** |
| **6. Real RouterOS API Execution** | `MOCK ONLY` | **GENUINE ROUTEROS (CHR)** | **GENUINE ROUTEROS (HARDWARE)** |
| **7. Real PPPoE / Queue Shaping** | `MOCK ONLY` | **GENUINE (CHR Kernel)** | **GENUINE (Hardware ASIC)** |
| **8. Real GenieACS NBI & TR-069 RPC** | `MOCK ONLY` | **GENUINE (GenieACS NBI)** | **GENUINE (GenieACS NBI)** |
| **9. Real Optical Laser Power (-dBm)** | `MOCK ONLY` | *Simulated CWMP values* | **GENUINE (Physical Photodiode)** |
| **10. Physical Hardware Cold Restart** | `MOCK ONLY` | *Software Agent Restart* | **GENUINE (Hardware Boot)** |

---

## 5. Minimum Recommended Lab Architecture

### Recommendation: **Hybrid Staged Approach**

1. **Short-Term (To unblock Live Acceptance in CI/Staging)**:
   - Deploy **PATH A (Virtual Staging Lab)** on the staging VPS using Docker Compose.
   - This provides genuine RouterOS v7 and GenieACS TR-069 protocol endpoints reachable directly from `bizerp_staging_api` without external network dependencies.
2. **Medium-Term (For Final Field Pilot / Production Deployment)**:
   - Commission **PATH B (Physical ISP Lab)** via WireGuard for physical optical calibration and hardware stress testing prior to commercial release.

---

## 6. Required Network Topology & Configuration

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        STAGING CLOUD VPS                               │
│  ┌─────────────────────────┐         ┌──────────────────────────────┐  │
│  │   bizerp_staging_api    │◄───────►│    bizerp_staging_chr        │  │
│  │   (Node.js / Express)   │ (8728)  │    (MikroTik RouterOS v7)    │  │
│  └────────────┬────────────┘         └──────────────────────────────┘  │
│               │ (7557)                                                 │
│               ▼                                                        │
│  ┌─────────────────────────┐         ┌──────────────────────────────┐  │
│  │   bizerp_staging_acs    │◄───────►│    virtual_tr069_cpe         │  │
│  │   (GenieACS NBI + CWMP) │ (7547)  │    (Simulated ONT Device)    │  │
│  └─────────────────────────┘         └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Environment Variables / Gateway Configs:
- Network Gateway Host: `chr.staging.internal` (or container alias `bizerp_staging_chr:8728`)
- ACS Gateway Host: `acs.staging.internal` (or container alias `bizerp_staging_acs:7557`)

---

## 7. Safety, Rollback & Isolation Controls

1. **No Production Overlap**: Staging gateways use dedicated IP blocks (`10.254.0.0/24`) completely isolated from production ISP subnets.
2. **Test Subscriber Naming**: Staging subscribers are strictly prefixed with `test_lab_*@skmnet`.
3. **Non-Destructive Reset**: Test script cleans up all RouterOS secrets and ACS bindings upon completion.

---

## 8. Exact Smallest Next Action

1. **Option 1**: Provision the **PATH A Virtual Staging Lab** container definition in `docker-compose.staging.yml` on the staging environment to perform live protocol verification.
2. **Option 2**: Authorize closing Phase 4.1.40D Software Foundation based on the completed Mock Driver & Application Staging validation (`65b6e1b`), deferring live hardware verification to a dedicated Phase 4.1.40E (Hardware Lab Acceptance).

---

## 9. GO / NO-GO Recommendation & System State

| Dimension | State | Description |
| :--- | :--- | :--- |
| **SOFTWARE READY** | **YES (PASS)** | Schema, DTOs, drivers, routes, tests, CI, and staging deployment are 100% complete (`65b6e1b`). |
| **INFRASTRUCTURE READY**| **NO** | Live RouterOS / GenieACS endpoints are not yet provisioned on staging. |
| **LIVE ACCEPTANCE READY**| **NO** | Cannot execute live network calls until Path A or Path B is deployed. |
| **PHASE CLOSED** | **NO** | Awaiting infrastructure provisioning or explicit scope sign-off. |

---

**FINAL RECOMMENDATION:**  
**GO FOR PATH A (VIRTUAL STAGING LAB PROVISIONING)** to achieve full live integration readiness without external hardware dependencies.
