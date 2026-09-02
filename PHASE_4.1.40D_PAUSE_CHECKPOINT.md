# PHASE 4.1.40D — PAUSE CHECKPOINT
## ISP / Internet Integration (Network & Device Services)

**1. Phase Identity:**  
Phase 4.1.40D — ISP / Internet Integration (Network & Device Services)  
Parent Track: SKMNetwork Platform Ecosystem — Connectivity & Device Services  

**2. Status:**  
`PAUSED / DEFERRED`  
(Software layer complete, deployed to staging, and verified in CI; physical/virtual live hardware integration deferred).

**3. Completed Work (Preserved & Active on Staging):**  
- **Database Schema**: [`apps/api/migrations/040_isp_management_foundation.sql`](file:///d:/projectfolder/biz-erp/apps/api/migrations/040_isp_management_foundation.sql) with composite foreign key tenant isolation (`uq_isp_gateways_id_business` & composite FKs on `isp_subscribers`).
- **DTOs & Validation**: [`apps/api/src/dto/isp_dto.ts`](file:///d:/projectfolder/biz-erp/apps/api/src/dto/isp_dto.ts) with strict validation and credential masking (`auth_secret_masked` $\rightarrow$ `********`).
- **Driver Abstractions**: [`apps/api/src/drivers/isp/isp_driver_interface.ts`](file:///d:/projectfolder/biz-erp/apps/api/src/drivers/isp/isp_driver_interface.ts) and [`apps/api/src/drivers/isp/mock_isp_driver.ts`](file:///d:/projectfolder/biz-erp/apps/api/src/drivers/isp/mock_isp_driver.ts).
- **Tenant Repository**: [`apps/api/src/repositories/isp_repository.ts`](file:///d:/projectfolder/biz-erp/apps/api/src/repositories/isp_repository.ts) with multi-gateway lookup.
- **Service Layer & SA-2.7 Provisioning**: [`apps/api/src/services/isp_service.ts`](file:///d:/projectfolder/biz-erp/apps/api/src/services/isp_service.ts) integrated directly with SA-2.7 `provisioning_service.ts` managing canonical actions (`ACTIVATE`, `SUSPEND`, `RESTORE`, `DEACTIVATE`, `CONFIGURE`).
- **API Endpoints**: [`apps/api/src/routes/isp_routes.ts`](file:///d:/projectfolder/biz-erp/apps/api/src/routes/isp_routes.ts) mounted at `/v1/isp/*` protected by `requireRole('OWNER' | 'CASHIER')` and SA-2.6 `requireEntitlement(jwtService, pool, 'ISP_MANAGEMENT')`.
- **AI Customer Service**: [`apps/api/src/services/ai_tool_registry.ts`](file:///d:/projectfolder/biz-erp/apps/api/src/services/ai_tool_registry.ts) extended with `check_onu_status`, `reboot_onu` (with confirmation gate), and `isp_troubleshooting`.
- **Audit Logging**: Integrated with SA-2.8 `provisioning_audit_logs`.
- **Automated Validation**: 12/12 focused integration tests (`test/isp_management_4_1_40d.test.ts`) and 39/39 regression tests **PASS**.
- **CI & Staging**: Revision `65b6e1b` passed full CI workflow `33624483699` and is live on `https://staging-api.skmnetwork.com`.

**4. Remaining Acceptance Scope (Deferred):**  
- Live RouterOS API socket interaction with genuine RouterOS endpoint.
- Live GenieACS NBI / TR-069 SOAP RPC parameter query and remote CPE restart.
- Live physical GPON optical laser dBm telemetry reading.
- Live OpenWISP / OpenWrt mesh controller interaction.
- Final live physical acceptance gate.

**5. Infrastructure Blocker:**  
The current staging VPS (`103.168.147.243`) lacks nested hardware virtualization (`/dev/kvm` is NOT AVAILABLE, 2 vCPU / 3.8 GiB RAM), making co-located RouterOS CHR virtualization unfeasible without dedicated lab hardware or a dedicated nested-KVM instance.

**6. Resume Condition:**  
Resume Phase 4.1.40D only when dedicated ISP integration infrastructure (KVM hypervisor or physical MikroTik/ONT lab bench) is intentionally provisioned, and when ERP roadmap priorities permit dedicated network lab testing.

**7. Resume Point:**  
Do **NOT** restart architecture discovery or software implementation.  
Resume directly from **Dedicated ISP Lab Provisioning / Live Adapter Verification**.

**8. Strategic Priority:**  
**ERP is the current primary product target.**
