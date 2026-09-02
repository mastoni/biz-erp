# PHASE 4.1.40D — DEDICATED ISP LAB INVENTORY REPORT
## Dedicated Hardware & Virtualization Host Inventory Audit

**Status:** INVENTORY COMPLETE — AWAITING INFRASTRUCTURE PROVISIONING DECISION  
**Phase ID:** 4.1.40D  
**Phase Name:** ISP / Internet Integration (Network & Device Services)  
**Target Environments:** Staging VPS (`staging-api.skmnetwork.com`) & Dedicated ISP Integration Lab  

---

## 1. System Readiness State

| State Dimension | Status | Notes |
| :--- | :--- | :--- |
| **SOFTWARE READY** | **YES (PASS)** | Schema, DTOs, drivers, SA-2.7 provisioning integration, AI CS tools, 12/12 unit tests, CI, and staging deployment verified (`65b6e1b`). |
| **INFRASTRUCTURE READY** | **NO** | Current staging VPS lacks `/dev/kvm`; dedicated lab host has not yet been provisioned. |
| **LIVE ACCEPTANCE READY** | **NO** | Awaiting dedicated lab connection to execute live RouterOS/GenieACS adapter verification. |
| **PHASE CLOSED** | **NO** | 4.1.40D remains officially open. |

---

## 2. Current Staging Limitation Summary

As proven in the live diagnostic report ([`PHASE_4.1.40D_CHR_VIRTUALIZATION_FEASIBILITY.md`](file:///d:/projectfolder/biz-erp/PHASE_4.1.40D_CHR_VIRTUALIZATION_FEASIBILITY.md)):
- **Host Architecture**: QEMU KVM Guest (Ubuntu 24.04 LTS).
- **Nested Virtualization**: **NOT AVAILABLE** (`/dev/kvm` absent).
- **Resource Sizing**: 2 vCPUs, 3.8 GiB RAM, 59 GB SSD.
- **Verdict**: Cannot host a genuine MikroTik RouterOS CHR VM co-located with the existing Docker stack. **PATH 2 (Dedicated ISP Lab)** is strictly required.

---

## 3. Candidate Lab Hosts Assessment

Based on repository documentation and operational records:

### Candidate 1: Current Staging Cloud VPS (`103.168.147.243`)
- **Classification**: `UNSUITABLE`
- **CPU / KVM**: 2 vCPU / `/dev/kvm` not available.
- **Suitability**: Confirmed unable to host hardware-accelerated CHR VM.

### Candidate 2: Local On-Premise Hypervisor / Workstation (Proxmox VE / Ubuntu KVM)
- **Classification**: `DOCUMENTED AS TARGET / AVAILABILITY UNKNOWN`
- **Architecture**: Standard x86_64 host with Intel VT-x or AMD-V.
- **Capabilities**: Capable of hosting Proxmox VE / Linux KVM, MikroTik CHR VM, GenieACS + MongoDB, virtual TR-069 CPE, and WireGuard client to staging VPS.
- **Status in Repo**: Referenced in system architecture; physical hardware presence and IP reachability must be confirmed by operator.

### Candidate 3: Physical MikroTik Hardware (e.g. hEX S / CCR1009) + Physical GPON ONT
- **Classification**: `DOCUMENTED BUT AVAILABILITY UNKNOWN`
- **Architecture**: MIPSBE / MMIPS / ARM (RouterBOARD RouterOS v7) + GPON ONT.
- **Capabilities**: Genuine hardware ASIC routing and physical fiber optical attenuation measurement.
- **Status in Repo**: Documented in commercial product catalog (`ROUTER_MIKROTIK_HEX`); physical bench connection pending.

### Candidate 4: Dedicated Virtualization-Capable Cloud Lab VPS (New Instance)
- **Classification**: `NOT DOCUMENTED / PROVISIONABLE ON DEMAND`
- **Architecture**: Cloud VPS with Nested Virtualization enabled (e.g. DigitalOcean Dedicated CPU, Hetzner Cloud with KVM passthrough, or bare-metal server).
- **Capabilities**: 100% cloud-hosted virtual lab, capable of running RouterOS CHR VM + GenieACS with zero physical office network dependencies.

---

## 4. Hardware & Candidate Capability Matrix

| Feature / Requirement | Candidate 1 (Current VPS) | Candidate 2 (Local KVM/Proxmox) | Candidate 3 (Physical Router/ONT) | Candidate 4 (Dedicated KVM VPS) |
| :--- | :--- | :--- | :--- | :--- |
| **CPU Virtualization (KVM)** | **NO** (`/dev/kvm` missing) | **YES** (VT-x / AMD-V) | N/A (Embedded Hardware) | **YES** (Nested KVM) |
| **MikroTik RouterOS Execution** | NO (Software TCG only) | **YES (Genuine CHR VM)** | **YES (Genuine RouterBOARD)** | **YES (Genuine CHR VM)** |
| **GenieACS + MongoDB** | Resource Constrained | **YES** | Requires separate server | **YES** |
| **Virtual TR-069 CPE** | Resource Constrained | **YES** | Optional (Physical ONT) | **YES** |
| **Physical ONT Testing** | NO | Optional (if OLT attached) | **YES (Physical Fiber)** | NO (Virtual TR-069 only) |
| **WireGuard to Staging VPS** | Local | **YES** | **YES** | **YES** |
| **Tenant & Production Isolation** | N/A | **100% ISOLATED** | **100% ISOLATED** | **100% ISOLATED** |
| **Availability in Repo** | Confirmed Existing | Unknown / Needs confirmation | Unknown / Needs confirmation | Provisionable on demand |

---

## 5. Minimum Dedicated Lab Host Specification

If a new dedicated virtualization host is provisioned (either cloud or local):

- **CPU**: $\ge$ 4 vCPU / Cores with Intel VT-x or AMD-V enabled (`/dev/kvm` exposed).
- **RAM**: $\ge$ 8 GB ECC/DDR4 (allows 1GB CHR + 2GB GenieACS/Mongo + OS + WireGuard headroom).
- **Storage**: $\ge$ 50 GB NVMe / SSD.
- **OS / Hypervisor**: Ubuntu 24.04 LTS (with KVM/QEMU) or Proxmox VE 8.x.
- **Network Interfaces**:
  - `eth0`: Management / WAN connection with WireGuard VPN tunnel to staging VPS.
  - `br-lab-internal`: Private bridge (`10.254.0.0/16`) hosting CHR management API and GenieACS NBI.

---

## 6. Network Topology & WireGuard Interconnect

```text
┌────────────────────────────────────────────────────────┐
│                   STAGING CLOUD VPS                    │
│                 (103.168.147.243)                      │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │               bizerp_staging_api               │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │ (wg0: 10.250.0.1)          │
└───────────────────────────┼────────────────────────────┘
                            │
                            │ WireGuard Site-to-Site Tunnel (UDP)
                            │ Private Subnet: 10.250.0.0/24
                            │
┌───────────────────────────┼────────────────────────────┐
│                           │ (wg0: 10.250.0.2)          │
│   ┌───────────────────────┴────────────────────────┐   │
│   │             DEDICATED ISP LAB HOST             │   │
│   │          (Proxmox / KVM / Ubuntu Host)         │   │
│   └───────────────┬────────────────┬───────────────┘   │
│                   │ (8728)         │ (7557)            │
│                   ▼                ▼                   │
│          ┌────────────────┐ ┌────────────────┐         │
│          │  RouterOS CHR  │ │  GenieACS NBI  │         │
│          │  (10.250.0.10) │ │  (10.250.0.20) │         │
│          └────────────────┘ └────────┬───────┘         │
│                                      │ (7547)          │
│                                      ▼                 │
│                             ┌────────────────┐         │
│                             │  Virtual CPE / │         │
│                             │  Physical ONT  │         │
│                             └────────────────┘         │
└────────────────────────────────────────────────────────┘
```

---

## 7. Security, Firewall & Isolation Controls

1. **Strict WireGuard Routing**: Only management ports are routed across the tunnel:
   - Port `8728` (RouterOS Binary API)
   - Port `7557` (GenieACS NBI REST API)
2. **Zero Public Exposure**: The lab RouterOS and GenieACS endpoints have **zero** inbound ports exposed to the public internet.
3. **Tenant Context**: All test transactions executed through staging BIZ-ERP use dedicated test tenant `Tenant Staging Lab ISP` and disposable subscriber IDs (`test_lab_*`).

---

## 8. Preferred Path & Next Action

### Preferred Strategy:
- **Option A (If on-premise hardware exists)**: Configure Candidate 2 (Local KVM/Proxmox machine) with WireGuard connecting to `103.168.147.243`.
- **Option B (If 100% cloud-managed is preferred)**: Provision Candidate 4 (Dedicated KVM VPS with 4 vCPU / 8GB RAM) supporting `/dev/kvm`.

---

## 9. Single Recommended Next Action

**RECOMMENDED NEXT ACTION:**  
Request user confirmation regarding whether a **local physical/KVM host (Candidate 2)** is available for lab pairing, or whether a **dedicated cloud KVM instance (Candidate 4)** should be specified.
