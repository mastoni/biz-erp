# BIZ-ERP — AI AGENT ENTRY RULES

Before modifying the repository, the agent MUST read:

1. `AGENTS.md`
2. `docs/DEVELOPMENT_RULES.md`
3. `docs/PHASE_ROADMAP.md`
4. the latest applicable checkpoint/documentation for the current phase

## Mandatory workflow

- Identify the current phase and exact boundary.
- Identify allowed and forbidden files.
- Inspect existing implementation before changing anything.
- Prove the first/root failure before changing application behavior.
- Prefer the smallest safe change.
- Validate with targeted tests first, then regression as required.
- Do not repeat the same failed test without a new hypothesis.
- Never stage or commit unrelated working-tree changes.
- Do not modify completed phases without explicit authorization.
- Never touch production without explicit authorization and a deployment checkpoint.

## Core architecture guards

- `PLATFORM_ADMIN` / `SUPER_ADMIN` = PLATFORM scope.
- `OWNER` = BUSINESS/TENANT scope.
- `CASHIER` / `STAFF` = operational tenant scope.
- RBAC != Entitlement.
- Mobile is a first-class offline-first client.
- Mobile uses the same canonical ERP backend and server source of truth.
- Do not create a second business database in mobile.
- Do not split ERP/POS/Billing/CCTV into unrelated products unless explicitly decided.
- Do not create duplicate `platform_*` canonical entities when a canonical entity already exists.
