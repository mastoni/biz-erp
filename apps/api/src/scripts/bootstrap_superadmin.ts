import 'dotenv/config'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { hashPassword } from '../services/password_service'

export async function bootstrapSuperAdmin(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV

  if (!nodeEnv || nodeEnv === 'production') {
    console.error('REFUSED: bootstrap_superadmin is strictly disabled in production or undefined environment')
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required')
    process.exit(1)
  }

  // Parse database info safely for audit (strictly redacting credentials)
  try {
    const parsedUrl = new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, 'http://'))
    const safeHost = parsedUrl.host
    const safeDb = parsedUrl.pathname.replace(/^\//, '')
    console.log(`[DB SAFETY CHECK] Environment: ${nodeEnv} | Host: ${safeHost} | Database: ${safeDb}`)
  } catch {
    console.log(`[DB SAFETY CHECK] Environment: ${nodeEnv} | Host: [PARSED_SAFE]`)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // 1. Idempotency check: verify if a SUPER_ADMIN already exists
    const existing = await pool.query(
      "SELECT id, email, status, platform_role, created_at FROM users WHERE platform_role = 'SUPER_ADMIN' LIMIT 1"
    )

    if (existing.rows.length > 0) {
      const user = existing.rows[0]
      console.log(`[BOOTSTRAP] SUPER_ADMIN already exists (id: ${user.id}, email: ${user.email}, status: ${user.status}, role: ${user.platform_role}). No changes made.`)
      return
    }

    // 2. Read credentials strictly from environment variables (no fallback literals)
    const adminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim()
    const adminPassword = process.env.SUPERADMIN_PASSWORD

    if (!adminEmail) {
      console.error('ERROR: SUPERADMIN_EMAIL environment variable is required')
      process.exit(1)
    }

    if (!adminPassword || adminPassword.trim().length === 0) {
      console.error('ERROR: SUPERADMIN_PASSWORD environment variable is required')
      process.exit(1)
    }

    // 3. Hash password using canonical service (bcrypt with salt rounds = 12)
    const passwordHash = await hashPassword(adminPassword)
    const userId = randomUUID()

    // 4. Insert pure platform SUPER_ADMIN (no tenant coupling, no business_id)
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'ACTIVE', 'SUPER_ADMIN')
       ON CONFLICT (email) DO UPDATE SET platform_role = 'SUPER_ADMIN', password_hash = EXCLUDED.password_hash, status = 'ACTIVE'`,
      [userId, adminEmail, passwordHash]
    )

    console.log(`[BOOTSTRAP SUCCESS] Platform SUPER_ADMIN created successfully: email=${adminEmail}, platform_role=SUPER_ADMIN (zero tenant binding).`)
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  bootstrapSuperAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Bootstrap error:', err.message)
      process.exit(1)
    })
}
