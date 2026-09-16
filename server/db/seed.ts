import 'dotenv/config'
import bcrypt from 'bcryptjs'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  // 1 warehouse
  let warehouse = await db.query.warehouses.findFirst({ where: eq(schema.warehouses.code, 'WH-MAIN') })
  if (!warehouse) {
    const rows = await db
      .insert(schema.warehouses)
      .values({ code: 'WH-MAIN', name: 'Main Warehouse', type: 'main', is_active: true })
      .returning()
    warehouse = rows[0]
    console.log('Created warehouse:', warehouse.code)
  } else {
    console.log('Warehouse already exists:', warehouse.code)
  }

  // 1 role admin
  let adminRole = await db.query.roles.findFirst({ where: eq(schema.roles.name, 'admin') })
  if (!adminRole) {
    const rows = await db.insert(schema.roles).values({ name: 'admin' }).returning()
    adminRole = rows[0]
    console.log('Created role:', adminRole.name)
  } else {
    console.log('Role already exists:', adminRole.name)
  }

  // 1 user admin
  const adminEmail = 'admin@ims.local'
  let adminUser = await db.query.users.findFirst({ where: eq(schema.users.email, adminEmail) })
  if (!adminUser) {
    const passwordHash = await bcrypt.hash('Admin123!', 10)
    const rows = await db
      .insert(schema.users)
      .values({
        name: 'Administrator',
        email: adminEmail,
        password_hash: passwordHash,
        role_id: adminRole.id,
        is_active: true,
      })
      .returning()
    adminUser = rows[0]
    console.log('Created user:', adminUser.email, '(password: Admin123!)')
  } else {
    console.log('User already exists:', adminUser.email)
  }

  // global_stock_settings default row
  const existingSettings = await db.select().from(schema.globalStockSettings).limit(1)
  if (existingSettings.length === 0) {
    await db.insert(schema.globalStockSettings).values({
      fast_moving_min_daily_out: '10',
      slow_moving_max_daily_out: '2',
      aging_warning_days: 30,
      aging_danger_days: 60,
      dead_stock_no_movement_days: 90,
    })
    console.log('Created default global_stock_settings')
  } else {
    console.log('global_stock_settings already exists')
  }

  await client.end()
  console.log('Seed completed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
