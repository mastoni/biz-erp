# PHASE 4.1.40D — CHR VIRTUALIZATION FEASIBILITY REPORT
## MikroTik RouterOS Cloud Hosted Router (CHR) Virtualization Analysis

**Status:** FEASIBILITY AUDIT COMPLETE — INFRASTRUCTURE CONFIRMATION REQUIRED  
**Phase ID:** 4.1.40D  
**Phase Name:** ISP / Internet Integration (Network & Device Services)  
**Parent Track:** SKMNetwork Platform Ecosystem  
**Target Environments:** Staging VPS (`staging-api.skmnetwork.com`) & ISP Integration Testbed  

---

## 1. System Readiness State

| State Dimension | Status | Notes |
| :--- | :--- | :--- |
| **SOFTWARE READY** | **YES (PASS)** | Schema, DTOs, drivers, SA-2.7 provisioning integration, AI CS tools, 12/12 unit tests, CI, and staging deployment verified (`65b6e1b`). |
| **INFRASTRUCTURE READY** | **NO** | Live RouterOS CHR VM and GenieACS TR-069 stack are not yet provisioned. |
| **LIVE ACCEPTANCE READY** | **NO** | Cannot execute live network adapter verification until CHR hypervisor/host is established. |
| **PHASE CLOSED** | **NO** | 4.1.40D remains officially open. |

---

## 2. Technical Nature of MikroTik RouterOS CHR

### 2.1 Virtual Machine vs. Container Distinction
- **Official Definition**: MikroTik RouterOS Cloud Hosted Router (CHR) is an x86_64 operating system image designed to run exclusively as a **Virtual Machine (VM)** on hypervisors (KVM, QEMU, VMware ESXi, VirtualBox, Hyper-V, Proxmox, AWS EC2, GCP, Azure).
- **RouterOS Container vs. Docker**: RouterOS v7 includes a "Container" package designed to host third-party Linux containers *inside* RouterOS; MikroTik does **not** provide a native Docker image to run RouterOS inside a Linux container runtime.
- **Running CHR via Docker**: Packaging CHR inside a Docker container requires embedding a full QEMU hypervisor instance inside the container image, which depends on hardware-assisted virtualization (`/dev/kvm`) on the host.

---

## 3. Staging VPS Technical Feasibility Audit

### 3.1 Staging VPS Environment & Provider
- **Current Runtime**: Cloud VPS running Ubuntu Linux hosting Docker Compose (`bizerp_staging_postgres`, `bizerp_staging_api`, `bizerp_staging_web`, `bizerp_staging_nginx`).
- **Deployment Pipeline**: GitHub Actions SSH deployment (`appleboy/ssh-action` executing `docker compose up -d`).

### 3.2 Nested Virtualization & `/dev/kvm` Availability
- Standard commodity cloud VPS instances (e.g., standard droplets/instances) typically have nested virtualization disabled by default.
- To run a genuine CHR VM with acceptable performance and stability, the host kernel must support KVM (`kvm_intel` or `kvm_amd`) and expose the `/dev/kvm` character device to the container/VM process.
- Without `/dev/kvm`, QEMU must fall back to software emulation (TCG - Tiny Code Generator), which is CPU-intensive, prone to timing glitches, and can cause kernel panics on RouterOS v7.

### 3.3 Hardware Resource Sizing
To safely run the complete staging application alongside the ISP integration stack, the host requires the following resource budget:

| Component | Minimum vCPU | Minimum RAM | Minimum Disk |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 16** (`bizerp_staging_postgres`) | 1 vCPU | 512 MB | 5 GB |
| **Backend API** (`bizerp_staging_api`) | 1 vCPU | 512 MB | 1 GB |
| **Frontend Web** (`bizerp_staging_web`) | 1 vCPU | 512 MB | 1 GB |
| **Nginx Ingress** (`bizerp_staging_nginx`) | 0.5 vCPU | 128 MB | 500 MB |
| **MikroTik CHR VM** (RouterOS v7) | 1 vCPU | 256 MB – 512 MB | 1 GB |
| **GenieACS Stack** (NBI + CWMP + FS) | 1 vCPU | 512 MB | 2 GB |
| **MongoDB 6+** (GenieACS Backend) | 1 vCPU | 1024 MB | 5 GB |
| **Virtual TR-069 CPE** (Simulator) | 0.5 vCPU | 256 MB | 500 MB |
| **TOTAL MINIMUM RECOMMENDED** | **4 vCPU** | **4 GB – 6 GB RAM** | **20 GB SSD** |

### 3.4 Virtual Network Interface Topology
- **NIC 1 (Management API)**: VirtIO interface attached to internal Docker/bridge network (`172.28.0.0/16`) for RouterOS API on port `8728` (private to `bizerp_staging_api`).
- **NIC 2 (Virtual Test WAN/LAN)**: Isolated bridge for PPPoE server (`skmnet-staging-pppoe`) on `10.254.10.0/24`.

### 3.5 Firewall & Security Isolation
- RouterOS API port `8728` must **never** be exposed on the VPS public IP address.
- It remains strictly bound to internal bridge/container communication.

### 3.6 RouterOS CHR Licensing for Lab
- MikroTik CHR operates under a **Free license tier** indefinitely with all features (API, PPPoE server, queue trees, firewall, Winbox) fully enabled, throttled only to 1 Mbps per interface.
- 1 Mbps speed limit is **100% sufficient** for API, subscriber provisioning, suspension, and rate-limit queue validation.

---

## 4. Feasibility Classification

### **CLASSIFICATION: C. UNKNOWN — REQUIRES INFRASTRUCTURE / PROVIDER CONFIRMATION**

### Exact Infrastructure Facts Required:
1. **Host Virtualization Capability**: Does the current staging VPS support nested virtualization / is `/dev/kvm` present on the host? (Check via `[ -e /dev/kvm ] && echo KVM_AVAILABLE || echo KVM_UNAVAILABLE`).
2. **Total Memory / CPU Headroom**: Does the current staging VPS have at least 4 GB RAM and 2–4 vCPU to accommodate the CHR VM + MongoDB + GenieACS without triggering OOM on `bizerp_staging_postgres` / `api`?

---

## 5. Architectural Paths Based on Confirmation

### Path 1: If Staging VPS has `/dev/kvm` and $\ge$ 4 GB RAM (Single-Host Virtual Lab)
- Run QEMU-KVM CHR container (with `--device /dev/kvm`) and GenieACS on the staging Docker host.
- Connect `bizerp_staging_api` to `bizerp_staging_chr:8728` over the internal Docker network.

### Path 2: If Staging VPS lacks `/dev/kvm` or is memory-constrained (Dedicated Lab Host)
- Provision a separate virtualization-capable Lab VM/VPS (or local lab machine with KVM).
- Host RouterOS CHR and GenieACS on the dedicated lab host.
- Connect `bizerp_staging_api` to the lab host via a private WireGuard tunnel or private VPC interconnect.

---

## 6. Smallest Concrete Next Action

**RECOMMENDED NEXT INFRASTRUCTURE ACTION:**  
Inspect the staging VPS host capabilities by running a non-intrusive diagnostic check on the staging VPS:
```bash
echo "=== Host Hardware & KVM Check ==="
lscpu | grep -i virtualization || true
[ -e /dev/kvm ] && echo "KVM: AVAILABLE" || echo "KVM: NOT_AVAILABLE"
free -h
nproc
```
to determine whether **Path 1 (Co-located KVM Lab)** or **Path 2 (Dedicated Lab Host)** must be adopted.
