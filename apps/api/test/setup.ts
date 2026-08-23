import 'dotenv/config'
import { afterAll } from 'vitest'

// TEST/CI environment isolation.
//
// Vitest shares `process.env` across test files when `fileParallelism` is
// false (all files run in the same worker/process sequentially). Several test
// files mutate `process.env.DATABASE_URL` (and other vars such as JWT_*,
// NODE_ENV, CORS_ALLOWED_ORIGINS, SENTRY_DSN). Without restoration these
// mutations leak into later files and cause cross-test contamination such as
// ECONNREFUSED to the wrong Postgres host/port.
//
// Capture a clean baseline once per worker and restore it after every test
// file so each file starts from an isolated, pristine environment.

const ENV_BASELINE_KEY = '__BIZ_ERP_TEST_ENV_BASELINE__'

const g = globalThis as unknown as Record<string, Record<string, string | undefined> | undefined>

if (!g[ENV_BASELINE_KEY]) {
  g[ENV_BASELINE_KEY] = { ...process.env }
}

afterAll(() => {
  const baseline = g[ENV_BASELINE_KEY]
  if (!baseline) return

  // Restore every variable that existed at baseline to its original value.
  // Variables introduced during the file (e.g. a test that did
  // `process.env.FOO = 'x'`) are intentionally left untouched to avoid
  // clobbering vitest/parent-process internals; every known mutator in this
  // suite only touches variables already present in the baseline.
  for (const key of Object.keys(baseline)) {
    const base = baseline[key]
    if (base === undefined) {
      if (process.env[key] !== undefined) delete process.env[key]
    } else {
      process.env[key] = base
    }
  }
})
