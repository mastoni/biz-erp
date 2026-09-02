# PHASE 4.1.40D — VIRTUAL ISP LAB PROVISIONING PLAN
## Isolated Staging Integration Lab Architecture & Execution Plan

**Status:** AWAITING PROVISIONING AUTHORIZATION  
**Phase ID:** 4.1.40D  
**Target Environment:** Staging VPS (`staging-api.skmnetwork.com` / Docker Host)  
**Parent Track:** SKMNetwork Platform Ecosystem — ISP / Internet Integration  

---

## 1. System Readiness State

| State Dimension | Status | Notes |
| :--- | :--- | :--- |
| **SOFTWARE READY** | **YES (PASS)** | Schema, DTOs, drivers, SA-2.7 provisioning integration, AI CS tools, 12/12 unit tests, CI, and staging deployment verified (`65b6e1b`). |
| **INFRASTRUCTURE READY** | **NO** | Live RouterOS and GenieACS containers are not yet provisioned on staging VPS. |
| **LIVE ACCEPTANCE READY** | **NO** | Requires virtual lab container provisioning and adapter binding. |
| **PHASE CLOSED** | **NO** | 4.1.40D remains officially open until live integration criteria pass. |

---

## 2. MikroTik RouterOS CHR Specification

### 2.1 Technical Deployment
- **Image / Runtime**: Genuine MikroTik RouterOS Cloud Hosted Router (CHR) v7 running in a containerized KVM environment (e.g. `vmactions/routeros` or `mikrotik-chr` container).
- **Architecture**: Runs the genuine RouterOS v7 kernel, networking stack, and management APIs.

### 2.2 Access & Interfaces
- **API Access**: RouterOS Binary API on TCP port `8728` (or REST API over HTTPS on TCP `8729` / `443`).
- **Management User**: Dedicated test user `api_staging_bizerp` restricted to `api`, `read`, `write`, `test` policies.
- **Virtual Interfaces**:
  - `bridge-test-lan`: IP `10.254.10.1/24` for virtual PPPoE server.
  - `pppoe-server-test`: Service name `skmnet-staging-pppoe`.

### 2.3 PPPoE & Profile Configuration
- **IP Pool**: `pool-test-subscribers` (`10.254.10.100 - 10.254.10.200`).
- **Profiles**:
  - `PROFILE_ACTIVE_50M`: `rate-limit=50M/20M`, `only-one=yes`.
  - `PROFILE_SUSPENDED_ISOLATED`: `rate-limit=256k/256k`, `only-one=yes`, `address-list=SUSPENDED_POOL`.
- **Test Subscriber**: `test_lab_sub1@skmnet` (password encrypted in database).

### 2.4 Isolation & Rollback
- **Safety**: No default route to public internet on `bridge-test-lan`. All traffic is contained within the Docker bridge.
- **Rollback Command**: `/ppp secret remove [find name~"^test_lab_"]` removes all test secrets created during the run.

---

## 3. GenieACS TR-069 Stack Specification

### 3.1 Architecture & Services
- **Backend Database**: MongoDB v6+ instance (`bizerp_staging_mongodb`).
- **GenieACS Core Containers**:
  - `genieacs-nbi`: Port `7557` (REST API for ERP integration).
  - `genieacs-cwmp`: Port `7547` (TR-069 CPE SOAP interaction).
  - `genieacs-fs`: Port `7567` (Firmware / config file storage).

### 3.2 Virtual CPE / ONT Simulator
- **Runtime**: Lightweight TR-069 CPE agent (e.g. Node.js `tr069-simulator` or `freecwmp` container).
- **Identity**: Serial number `SKMN-ONT-TEST001`, OUI `00259E`, Product Class `SKM-ONT-G1`.
- **Telemetry Representation**:
  - Optical Rx Power: `-19.45 dBm` (parameterized in CPE data model).
  - Optical Tx Power: `+2.15 dBm`.
  - Device Temperature: `42.5 C`.
  - Connection Status: `ONLINE`.
- **Distinction**:
  > [!NOTE]
  > Telemetry returned from the virtual CPE represents genuine TR-069 SOAP XML RPC parameter exchanges (`GetParameterValues`), but the optical dBm values are software-parameterized since no physical GPON fiber laser is attached.

### 3.3 Reboot Operation & Rollback
- **Reboot RPC**: GenieACS dispatches `Reboot` method to the virtual CPE via CWMP connection request.
- **Virtual CPE Behavior**: Acknowledges `RebootResponse`, simulates 10-second offline period, sends `0 BOOTSTRAP` / `1 BOOT` Inform event upon reconnect.
- **Rollback**: Delete device record via NBI API `DELETE /devices/00259E-SKM%2DONT%2DG1-SKMN%2DONT%2DTEST001`.

---

## 4. OpenWISP / OpenWrt Evaluation

- **Status for Initial 4.1.40D Live Acceptance**: **DEFERRED (OPTIONAL GATE)**.
- **Rationale**: In schema `040_isp_management_foundation.sql`, `mesh_gateway_id` is an optional nullable field. Primary ISP provisioning and customer lifecycle (`ACTIVATE`, `SUSPEND`, `RESTORE`, `DEACTIVATE`) are driven by MikroTik (Network Gateway) and GenieACS (ACS Gateway).
- **Roadmap Preservation**: OpenWISP driver interface remains implemented; controller deployment will be tested when multi-mesh services are activated.

---

## 5. Network Topology

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             STAGING DOCKER HOST                                  │
│                                                                                  │
│   ┌────────────────────────────────┐                                             │
│   │       bizerp_staging_api       │                                             │
│   │     (Phase 4.1.40D Engine)     │                                             │
│   └──────┬──────────────────┬──────┘                                             │
│          │ (8728/API)       │ (7557/NBI)                                         │
│          ▼                  ▼                                                    │
│   ┌──────────────┐   ┌──────────────┐                                            │
│   │  staging_chr │   │ staging_acs  │                                            │
│   │ (RouterOS 7) │   │ (GenieACS)   │                                            │
│   └──────────────┘   └──────┬───────┘                                            │
│                             │ (7547/CWMP)                                        │
│                             ▼                                                    │
│                      ┌──────────────┐                                            │
│                      │ virtual_cpe  │                                            │
│                      │ (TR-069 Sim) │                                            │
│                      └──────────────┘                                            │
│                                                                                  │
│   Docker Network: bizerp_staging_lab_net (Subnet 172.28.0.0/16, Internal Only)  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Firewall Rules**: Ports `8728`, `7557`, and `7547` are bound **only** to the internal Docker bridge network (`bizerp_staging_lab_net`). No external internet exposure.

---

## 6. Credentials & Secrets Management

| Secret Variable | Storage Location | Scope | Usage | Redaction Rule |
| :--- | :--- | :--- | :--- | :--- |
| `STAGING_LAB_CHR_USER` | Staging Host `.env.lab` | Staging Lab | RouterOS API User | N/A (Username) |
| `STAGING_LAB_CHR_PASSWORD` | Staging Host `.env.lab` | Staging Lab | RouterOS API Password | Masked as `********` in all logs |
| `STAGING_LAB_ACS_TOKEN` | Staging Host `.env.lab` | Staging Lab | GenieACS NBI Token | Masked as `********` in all logs |

---

## 7. Environment Variables Configuration

### Existing Environment Variables (Unchanged):
- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: Platform JWT signing key.
- `NODE_ENV`: `staging`.

### Additional Virtual Lab Configuration (Infrastructure only, no code changes):
- `STAGING_ISP_CHR_HOST`: `bizerp_staging_chr`
- `STAGING_ISP_CHR_PORT`: `8728`
- `STAGING_ISP_ACS_URL`: `http://bizerp_staging_acs:7557`

---

## 8. Acceptance Criteria Mapping Matrix

| Acceptance Criterion | Required Component | Verification Method | Virtual Lab Verification | Physical HW Required? | Required Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Database Schema & Composite FKs** | PostgreSQL DB | Automated Vitest / SQL constraints | **YES (FULL)** | NO | Constraint enforcement log |
| **2. RouterOS API Authentication** | RouterOS CHR | Binary API connect & challenge | **YES (FULL)** | NO | Successful socket handshake |
| **3. PPPoE Secret Creation (`ACTIVATE`)** | RouterOS CHR | `/ppp secret add` command execution | **YES (FULL)** | NO | Query `/ppp secret print` shows user |
| **4. Bandwidth Shaping (`SUSPEND`)** | RouterOS CHR | Rate-limit profile switch to `256k/256k` | **YES (FULL)** | NO | Secret shows updated profile |
| **5. Bandwidth Restore (`RESTORE`)** | RouterOS CHR | Rate-limit profile restore to `50M/20M` | **YES (FULL)** | NO | Secret shows normal profile |
| **6. Secret Teardown (`DEACTIVATE`)** | RouterOS CHR | `/ppp secret remove` execution | **YES (FULL)** | NO | Secret absent from RouterOS |
| **7. TR-069 Telemetry (`check_onu_status`)** | GenieACS + CPE | NBI `GET /devices` + CWMP poll | **YES (PROTOCOL)** | NO (Synthetic dBm) | JSON payload with Rx/Tx values |
| **8. TR-069 Reboot RPC (`reboot_onu`)** | GenieACS + CPE | NBI `POST /devices/.../tasks` (Reboot) | **YES (FULL)** | NO | Task queue `COMPLETED`, CPE restart event |
| **9. AI CS Integration** | AI Tool Registry | Automated invocation with `businessId` | **YES (FULL)** | NO | Tool execution result |
| **10. Audit Observability & Redaction** | Audit Engine | Query `provisioning_audit_logs` | **YES (FULL)** | NO | Audit row without secrets |
| **11. Physical Optical Laser Attenuation** | Physical OLT/ONT | Optical Power Meter (OPM) reading | **NO** | **YES** | Physical meter reading |

---

## 9. Safety & Isolation Protocol

1. **Zero Customer Contact**: All lab traffic is constrained to `10.254.0.0/16` and virtual bridge interfaces.
2. **Dedicated Staging Tenant**: Lab tests run strictly under dedicated tenant `Tenant Staging Lab ISP`.
3. **Disposable Identities**: Subscribers prefixed with `test_lab_*`.
4. **Automated Teardown**: Post-verification teardown script purges all RouterOS entries and ACS device bindings.

---

## 10. Provisioning Order & Execution Sequence

```text
Step 1: Deploy docker-compose.lab.yml on Staging Host (CHR + GenieACS + MongoDB + Virtual CPE)
   ↓
Step 2: Verify container health & internal Docker network routing
   ↓
Step 3: Configure initial RouterOS CHR profiles & IP pools
   ↓
Step 4: Register Virtual CPE to GenieACS and verify CWMP Inform handshake
   ↓
Step 5: Register Staging Gateways in BIZ-ERP via POST /v1/isp/gateways
   ↓
Step 6: Execute Live Provisioning Flow (ACTIVATE → SUSPEND → RESTORE → DEACTIVATE)
   ↓
Step 7: Verify AI CS Diagnostic & Reboot Tools (check_onu_status, reboot_onu)
   ↓
Step 8: Collect Audit Logs & Live Protocol Evidence
   ↓
Step 9: Present Final 4.1.40D Live Acceptance Report
```

---

## 11. Smallest Concrete Next Action

**RECOMMENDED NEXT ACTION:**  
Author the virtual lab Docker Compose manifest: [`apps/api/docker-compose.lab.yml`](file:///d:/projectfolder/biz-erp/apps/api/docker-compose.lab.yml) specifying the isolated MikroTik CHR, GenieACS, and virtual TR-069 CPE containers.
