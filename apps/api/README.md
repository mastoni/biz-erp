# BizERP API — Phase 3.0.2

Backend foundation dan Sync API pertama untuk BizERP.

Phase ini membangun:

- Express + TypeScript backend di `apps/api`
- PostgreSQL sebagai global source of truth
- Health endpoint
- Product sync pull & optimistic concurrency update
- Sales batch sync dengan idempotency dan transactional insert
- Multi-tenant isolation berdasarkan `business_id`
- Auth placeholder untuk Phase 4

## 1. Requirement

- Node.js 20+
- PostgreSQL 16
- npm

Stack yang digunakan:

- Express
- TypeScript
- pg
- dotenv
- cors
- Vitest
- Supertest

ORM tidak digunakan. Semua query memakai SQL parameterized melalui `pg`.

## 2. Install

```bash
cd apps/api
npm install
```
