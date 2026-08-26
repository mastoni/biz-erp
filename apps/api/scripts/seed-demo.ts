import 'dotenv/config'
import { Pool } from 'pg'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

async function main() {
  const nodeEnv = process.env.NODE_ENV || 'development'

  if (nodeEnv === 'production') {
    console.error('REFUSED: seed-demo.ts must NEVER run in production.')
    process.exit(1)
  }

  console.log('DEMO seed - development use only. Proceeding...')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const ownerPassword = process.env.DEMO_OWNER_PASSWORD || 'Password123!'
  const cashierPassword = process.env.DEMO_CASHIER_PASSWORD || 'Password123!'

  const pool = new Pool({ connectionString: databaseUrl })

  // Canonical Business 1 (Multi-Branch Coffee Shop)
  const BUSINESS_1_ID = 'd1111111-1111-4111-8111-111111111111'
  const BUSINESS_1_NAME = 'Warung Kopi Nusantara'

  // Canonical Business 2 (Multi-Tenant Second Business - Restaurant)
  const BUSINESS_2_ID = 'd2222222-2222-4222-8222-222222222222'
  const BUSINESS_2_NAME = 'Resto Padang Nusantara'

  const USER_ID_OWNER = 'd9999999-9999-4999-8999-999999999999'
  const USER_EMAIL_OWNER = 'owner@demo.local'
  
  const USER_ID_CASHIER = 'd8888888-8888-4888-8888-888888888888'
  const USER_EMAIL_CASHIER = 'cashier@demo.local'

  // Branches for Business 1
  const BRANCH_1A_ID = 'b1111111-1111-4111-8111-111111111111'
  const BRANCH_1A_NAME = 'Cabang Pusat - Sudirman'

  const BRANCH_1B_ID = 'b2222222-2222-4222-8222-222222222222'
  const BRANCH_1B_NAME = 'Cabang Senopati'

  const BRANCH_1C_ID = 'b3333333-3333-4333-8333-333333333333'
  const BRANCH_1C_NAME = 'Cabang Bandung (Baru)' // Empty branch for isolation testing

  // Branches for Business 2
  const BRANCH_2A_ID = 'b4444444-4444-4444-8444-444444444444'
  const BRANCH_2A_NAME = 'Cabang Menteng'

  try {
    // 1. Seed Businesses
    await pool.query(
      'INSERT INTO businesses (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
      [BUSINESS_1_ID, BUSINESS_1_NAME]
    )
    await pool.query(
      'INSERT INTO businesses (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
      [BUSINESS_2_ID, BUSINESS_2_NAME]
    )

    // 2. Seed Users
    const hashOwner = await bcrypt.hash(ownerPassword, 10)
    const ownerRes = await pool.query(`
      INSERT INTO users (id, email, password_hash, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status
      RETURNING id
    `, [USER_ID_OWNER, USER_EMAIL_OWNER, hashOwner])
    const actualOwnerId = ownerRes.rows[0].id

    // Clean old duplicate memberships
    await pool.query(
      'DELETE FROM user_businesses WHERE user_id = $1 AND business_id NOT IN ($2, $3)',
      [actualOwnerId, BUSINESS_1_ID, BUSINESS_2_ID]
    )

    // Assign owner to both businesses
    await pool.query(`
      INSERT INTO user_businesses (user_id, business_id, role, status)
      VALUES ($1, $2, 'OWNER', 'ACTIVE')
      ON CONFLICT (user_id, business_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
    `, [actualOwnerId, BUSINESS_1_ID])

    await pool.query(`
      INSERT INTO user_businesses (user_id, business_id, role, status)
      VALUES ($1, $2, 'OWNER', 'ACTIVE')
      ON CONFLICT (user_id, business_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
    `, [actualOwnerId, BUSINESS_2_ID])

    // Cashier for Business 1
    const hashCashier = await bcrypt.hash(cashierPassword, 10)
    const cashierRes = await pool.query(`
      INSERT INTO users (id, email, password_hash, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status
      RETURNING id
    `, [USER_ID_CASHIER, USER_EMAIL_CASHIER, hashCashier])
    const actualCashierId = cashierRes.rows[0].id

    await pool.query(`
      INSERT INTO user_businesses (user_id, business_id, role, status)
      VALUES ($1, $2, 'CASHIER', 'ACTIVE')
      ON CONFLICT (user_id, business_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
    `, [actualCashierId, BUSINESS_1_ID])

    // 3. Seed Branches
    const branches = [
      { id: BRANCH_1A_ID, businessId: BUSINESS_1_ID, name: BRANCH_1A_NAME },
      { id: BRANCH_1B_ID, businessId: BUSINESS_1_ID, name: BRANCH_1B_NAME },
      { id: BRANCH_1C_ID, businessId: BUSINESS_1_ID, name: BRANCH_1C_NAME },
      { id: BRANCH_2A_ID, businessId: BUSINESS_2_ID, name: BRANCH_2A_NAME },
    ]

    for (const b of branches) {
      await pool.query(`
        INSERT INTO branches (id, business_id, name, status, created_at, updated_at)
        VALUES ($1, $2, $3, TRUE, now(), now())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      `, [b.id, b.businessId, b.name])
    }

    // 4. Seed Customers for Business 1 & 2
    const customers = [
      { id: 'c1111111-1111-4111-8111-111111111111', bizId: BUSINESS_1_ID, name: 'Dewi Lestari', email: 'dewi@gmail.com', phone: '0812-3345-1908', tier: 'Gold', points: 2450 },
      { id: 'c2222222-2222-4222-8222-222222222222', bizId: BUSINESS_1_ID, name: 'Siti Rahmawati', email: 'siti@gmail.com', phone: '0813-9034-2216', tier: 'Silver', points: 980 },
      { id: 'c3333333-3333-4333-8333-333333333333', bizId: BUSINESS_1_ID, name: 'Yoga Pratama', email: 'yoga@gmail.com', phone: '0896-1120-3384', tier: 'Reguler', points: 140 },
      { id: 'c4444444-4444-4444-8444-444444444444', bizId: BUSINESS_2_ID, name: 'Hendro Gunawan', email: 'hendro@padang.local', phone: '0852-6601-8873', tier: 'Gold', points: 3100 },
    ]

    for (const c of customers) {
      await pool.query(`
        INSERT INTO customers (id, business_id, name, email, phone, tier, points, server_version, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1, now(), now())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, tier = EXCLUDED.tier, points = EXCLUDED.points, updated_at = now()
      `, [c.id, c.bizId, c.name, c.email, c.phone, c.tier, c.points])
    }

    // 5. Seed Products for Business 1 & 2
    const productsBiz1 = [
      { id: 'a1111111-1111-4111-8111-111111111111', name: 'Kopi Susu Gula Aren', desc: 'Espresso dengan susu segar dan gula aren asli', price: 1800000, category: 'Beverage', barcode: 'SKM-BEV-001' },
      { id: 'a2222222-2222-4222-8222-222222222222', name: 'Americano Double Shot', desc: 'Espresso ganda dengan air mineral pilihan', price: 2200000, category: 'Beverage', barcode: 'SKM-BEV-002' },
      { id: 'a3333333-3333-4333-8333-333333333333', name: 'Croissant Butter', desc: 'Pastry renyah dengan butter Perancis', price: 2500000, category: 'Food', barcode: 'SKM-FOOD-001' },
      { id: 'a4444444-4444-4444-8444-444444444444', name: 'Matcha Latte Premium', desc: 'Matcha Uji Jepang dengan susu steamed', price: 2800000, category: 'Beverage', barcode: 'SKM-BEV-003' },
      { id: 'a5555555-5555-4555-8555-555555555555', name: 'Earl Grey Milk Tea', desc: 'Teh Earl Grey aromatik dengan boba kenyal', price: 2400000, category: 'Beverage', barcode: 'SKM-BEV-004' },
      { id: 'a6666666-6666-4666-8666-666666666666', name: 'Mineral Water 600ml', desc: 'Air mineral kemasan botol', price: 800000, category: 'Beverage', barcode: 'SKM-BEV-005' },
    ]

    for (const p of productsBiz1) {
      await pool.query(`
        INSERT INTO products (id, business_id, name, description, price_minor, category, barcode, is_active, server_version, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 1, now(), now())
        ON CONFLICT (id) DO UPDATE SET price_minor = EXCLUDED.price_minor, name = EXCLUDED.name, is_active = TRUE, updated_at = now()
      `, [p.id, BUSINESS_1_ID, p.name, p.desc, p.price, p.category, p.barcode])
    }

    const productsBiz2 = [
      { id: 'aa111111-1111-4111-8111-111111111111', name: 'Rendang Daging Sapi Special', desc: 'Rendang daging sapi empuk khas Minang', price: 3500000, category: 'Main Course', barcode: 'PDG-FOOD-001' },
      { id: 'aa222222-2222-4222-8222-222222222222', name: 'Ayam Pop Kampung', desc: 'Ayam kampung khas Bukittinggi dengan sambal tomat', price: 2800000, category: 'Main Course', barcode: 'PDG-FOOD-002' },
      { id: 'aa333333-3333-4333-8333-333333333333', name: 'Gulai Tunjang Padang', desc: 'Kikil sapi empuk dengan kuah gulai rempah gurih', price: 3200000, category: 'Main Course', barcode: 'PDG-FOOD-003' },
      { id: 'aa444444-4444-4444-8444-444444444444', name: 'Es Teh Manis Padang', desc: 'Teh melati wangi dengan es segar', price: 600000, category: 'Beverage', barcode: 'PDG-BEV-001' },
    ]

    for (const p of productsBiz2) {
      await pool.query(`
        INSERT INTO products (id, business_id, name, description, price_minor, category, barcode, is_active, server_version, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 1, now(), now())
        ON CONFLICT (id) DO UPDATE SET price_minor = EXCLUDED.price_minor, name = EXCLUDED.name, is_active = TRUE, updated_at = now()
      `, [p.id, BUSINESS_2_ID, p.name, p.desc, p.price, p.category, p.barcode])
    }

    // 6. Seed Stocks
    const stocks = [
      // Business 1 - Branch 1A (Sudirman)
      { id: 'bb111111-1111-4111-8111-111111111111', bizId: BUSINESS_1_ID, branchId: BRANCH_1A_ID, productId: productsBiz1[0].id, qty: 50 },
      { id: 'bb222222-2222-4222-8222-222222222222', bizId: BUSINESS_1_ID, branchId: BRANCH_1A_ID, productId: productsBiz1[1].id, qty: 35 },
      { id: 'bb333333-3333-4333-8333-333333333333', bizId: BUSINESS_1_ID, branchId: BRANCH_1A_ID, productId: productsBiz1[2].id, qty: 15 },
      { id: 'bb444444-4444-4444-8444-444444444444', bizId: BUSINESS_1_ID, branchId: BRANCH_1A_ID, productId: productsBiz1[3].id, qty: 20 },
      { id: 'bb555555-5555-4555-8555-555555555555', bizId: BUSINESS_1_ID, branchId: BRANCH_1A_ID, productId: productsBiz1[4].id, qty: 25 },
      { id: 'bb666666-6666-4666-8666-666666666666', bizId: BUSINESS_1_ID, branchId: BRANCH_1A_ID, productId: productsBiz1[5].id, qty: 0 }, // Out of stock!

      // Business 1 - Branch 1B (Senopati)
      { id: 'bb777777-7777-4777-8777-777777777777', bizId: BUSINESS_1_ID, branchId: BRANCH_1B_ID, productId: productsBiz1[0].id, qty: 40 },
      { id: 'bb888888-8888-4888-8888-888888888888', bizId: BUSINESS_1_ID, branchId: BRANCH_1B_ID, productId: productsBiz1[1].id, qty: 20 },
      { id: 'bb999999-9999-4999-8999-999999999999', bizId: BUSINESS_1_ID, branchId: BRANCH_1B_ID, productId: productsBiz1[2].id, qty: 10 },
      { id: 'bbaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', bizId: BUSINESS_1_ID, branchId: BRANCH_1B_ID, productId: productsBiz1[3].id, qty: 15 },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', bizId: BUSINESS_1_ID, branchId: BRANCH_1B_ID, productId: productsBiz1[4].id, qty: 18 },
      { id: 'bbcccccc-cccc-4ccc-8ccc-cccccccccccc', bizId: BUSINESS_1_ID, branchId: BRANCH_1B_ID, productId: productsBiz1[5].id, qty: 12 },

      // Business 2 - Branch 2A (Menteng)
      { id: 'bbdddddd-dddd-4ddd-8ddd-dddddddddddd', bizId: BUSINESS_2_ID, branchId: BRANCH_2A_ID, productId: productsBiz2[0].id, qty: 30 },
      { id: 'bbeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', bizId: BUSINESS_2_ID, branchId: BRANCH_2A_ID, productId: productsBiz2[1].id, qty: 25 },
      { id: 'bbffffff-ffff-4fff-8fff-ffffffffffff', bizId: BUSINESS_2_ID, branchId: BRANCH_2A_ID, productId: productsBiz2[2].id, qty: 18 },
      { id: 'bb000000-0000-4000-8000-000000000000', bizId: BUSINESS_2_ID, branchId: BRANCH_2A_ID, productId: productsBiz2[3].id, qty: 50 },
    ]

    for (const s of stocks) {
      await pool.query(`
        INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 1, now(), now())
        ON CONFLICT (business_id, branch_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()
      `, [s.id, s.bizId, s.branchId, s.productId, s.qty])
    }

    // 7. Seed Real Sales for Today
    const todayUtc = new Date().toISOString().split('T')[0]
    const localNow = new Date()
    const yyyy = localNow.getFullYear()
    const mm = String(localNow.getMonth() + 1).padStart(2, '0')
    const dd = String(localNow.getDate()).padStart(2, '0')
    const todayLocal = `${yyyy}-${mm}-${dd}`

    const activeDates = Array.from(new Set([todayUtc, todayLocal]))

    for (const targetDate of activeDates) {
      // Business 1 Sales
      const sampleSalesBiz1 = [
        // Branch 1A (Sudirman)
        {
          receipt: `RCP-SUD-${targetDate.substring(5)}-01`,
          bizId: BUSINESS_1_ID,
          branchId: BRANCH_1A_ID,
          time: `${targetDate}T08:15:00.000Z`,
          payment: 'QRIS',
          items: [
            { prod: productsBiz1[0], qty: 2 }, // 2x Kopi Susu = 36.000
            { prod: productsBiz1[2], qty: 1 }, // 1x Croissant = 25.000
          ]
        },
        {
          receipt: `RCP-SUD-${targetDate.substring(5)}-02`,
          bizId: BUSINESS_1_ID,
          branchId: BRANCH_1A_ID,
          time: `${targetDate}T09:45:00.000Z`,
          payment: 'CASH',
          items: [
            { prod: productsBiz1[1], qty: 1 }, // 1x Americano = 22.000
          ]
        },
        {
          receipt: `RCP-SUD-${targetDate.substring(5)}-03`,
          bizId: BUSINESS_1_ID,
          branchId: BRANCH_1A_ID,
          time: `${targetDate}T12:30:00.000Z`,
          payment: 'QRIS',
          items: [
            { prod: productsBiz1[0], qty: 3 }, // 3x Kopi Susu = 54.000
            { prod: productsBiz1[3], qty: 2 }, // 2x Matcha = 56.000
            { prod: productsBiz1[2], qty: 2 }, // 2x Croissant = 50.000
          ]
        },
        {
          receipt: `RCP-SUD-${targetDate.substring(5)}-04`,
          bizId: BUSINESS_1_ID,
          branchId: BRANCH_1A_ID,
          time: `${targetDate}T14:20:00.000Z`,
          payment: 'TRANSFER',
          items: [
            { prod: productsBiz1[4], qty: 2 }, // 2x Earl Grey = 48.000
          ]
        },
        {
          receipt: `RCP-SUD-${targetDate.substring(5)}-05`,
          bizId: BUSINESS_1_ID,
          branchId: BRANCH_1A_ID,
          time: `${targetDate}T19:10:00.000Z`,
          payment: 'QRIS',
          items: [
            { prod: productsBiz1[0], qty: 4 }, // 4x Kopi Susu = 72.000
            { prod: productsBiz1[1], qty: 2 }, // 2x Americano = 44.000
          ]
        },

        // Branch 1B (Senopati)
        {
          receipt: `RCP-SEN-${targetDate.substring(5)}-01`,
          bizId: BUSINESS_1_ID,
          branchId: BRANCH_1B_ID,
          time: `${targetDate}T11:00:00.000Z`,
          payment: 'CASH',
          items: [
            { prod: productsBiz1[0], qty: 2 }, // 2x Kopi Susu = 36.000
            { prod: productsBiz1[4], qty: 1 }, // 1x Earl Grey = 24.000
          ]
        },
        {
          receipt: `RCP-SEN-${targetDate.substring(5)}-02`,
          bizId: BUSINESS_1_ID,
          branchId: BRANCH_1B_ID,
          time: `${targetDate}T16:45:00.000Z`,
          payment: 'QRIS',
          items: [
            { prod: productsBiz1[3], qty: 3 }, // 3x Matcha = 84.000
            { prod: productsBiz1[2], qty: 2 }, // 2x Croissant = 50.000
          ]
        },

        // Business 2 (Resto Padang) - Branch 2A (Menteng)
        {
          receipt: `RCP-PDG-${targetDate.substring(5)}-01`,
          bizId: BUSINESS_2_ID,
          branchId: BRANCH_2A_ID,
          time: `${targetDate}T13:15:00.000Z`,
          payment: 'QRIS',
          items: [
            { prod: productsBiz2[0], qty: 1 }, // 1x Rendang Daging = 35.000
            { prod: productsBiz2[1], qty: 1 }, // 1x Ayam Pop = 28.000
            { prod: productsBiz2[3], qty: 2 }, // 2x Es Teh = 12.000
          ]
        }
      ]

      for (const s of sampleSalesBiz1) {
        const existing = await pool.query(
          'SELECT id FROM sales WHERE business_id = $1 AND receipt_number = $2',
          [s.bizId, s.receipt]
        )

        let saleId = existing.rows[0]?.id
        const subtotal = s.items.reduce((sum, item) => sum + (item.prod.price * item.qty), 0)
        const tax = Math.round(subtotal * 0.1)
        const total = subtotal + tax

        if (!saleId) {
          saleId = randomUUID()
          await pool.query(`
            INSERT INTO sales (
              id, business_id, branch_id, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor,
              payment_method, paid_minor, change_minor, cashier_id, created_at, client_created_at, server_created_at
            )
            VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $7, 0, $9, $10, $10, $10)
          `, [
            saleId, s.bizId, s.branchId, s.receipt, subtotal, tax, total, s.payment, USER_ID_CASHIER, new Date(s.time)
          ])
        }

        for (const item of s.items) {
          const itemSubtotal = item.prod.price * item.qty
          const itemCheck = await pool.query(
            'SELECT id FROM sale_items WHERE sale_id = $1 AND product_id = $2',
            [saleId, item.prod.id]
          )

          if (itemCheck.rows.length === 0) {
            await pool.query(`
              INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price_minor, subtotal_minor)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              randomUUID(), saleId, item.prod.id, item.prod.name, item.qty, item.prod.price, itemSubtotal
            ])
          }
        }
      }
    }

    console.log('--------------------------------------------------')
    console.log('DEMO REAL DATA SEEDING COMPLETE')
    console.log(`Tenant 1: ${BUSINESS_1_NAME} (${BUSINESS_1_ID})`)
    console.log(`  - Branch 1A: ${BRANCH_1A_NAME} (${BRANCH_1A_ID}) - 5 sales`)
    console.log(`  - Branch 1B: ${BRANCH_1B_NAME} (${BRANCH_1B_ID}) - 2 sales`)
    console.log(`  - Branch 1C: ${BRANCH_1C_NAME} (${BRANCH_1C_ID}) - 0 sales (empty)`)
    console.log(`  - Products: 6 catalog products`)
    console.log(`Tenant 2: ${BUSINESS_2_NAME} (${BUSINESS_2_ID})`)
    console.log(`  - Branch 2A: ${BRANCH_2A_NAME} (${BRANCH_2A_ID}) - 1 sale`)
    console.log(`  - Products: 4 catalog products (Rendang, Ayam Pop, Gulai, Es Teh)`)
    console.log(`Owner Login: ${USER_EMAIL_OWNER} / ${ownerPassword}`)
    console.log('--------------------------------------------------')

  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
