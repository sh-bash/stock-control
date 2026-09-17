import 'dotenv/config'
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../server/db/client'
import { products, stockLayers, stockLedger, stockSummary, warehouses } from '../server/db/schema'
import { consumeStock } from '../server/services/stock.service'

// Simulates PRD §7 Fase 10's "load test concurrency FIFO" requirement:
// fires N concurrent consumeStock calls against the SAME product+warehouse
// with a fixed total stock, and verifies:
//   1. total qty actually consumed == sum of qty successfully deducted
//   2. qty_on_hand never goes negative
//   3. exactly enough requests succeed to exhaust stock, the rest fail with
//      INSUFFICIENT_STOCK (never a partial/incorrect deduction)

;(globalThis as any).createError = createError

const CONCURRENCY = 20
const QTY_PER_REQUEST = 3
const INITIAL_STOCK = 30 // exactly enough for 10 of the 20 requests

async function main() {
  const [wh] = await db.insert(warehouses).values({ code: `LT-WH-${randomUUID().slice(0, 8)}`, name: 'Load Test WH' }).returning()
  const [p] = await db.insert(products).values({ sku: `LT-SKU-${randomUUID().slice(0, 8)}`, name: 'Load Test Product' }).returning()

  await db.insert(stockLayers).values({
    product_id: p.id,
    warehouse_id: wh.id,
    source_type: 'receiving',
    source_id: randomUUID(),
    receive_date: '2026-01-01',
    qty_original: INITIAL_STOCK.toString(),
    qty_remaining: INITIAL_STOCK.toString(),
    hpp: '1000',
  })
  await db.insert(stockSummary).values({
    product_id: p.id,
    warehouse_id: wh.id,
    qty_on_hand: INITIAL_STOCK.toString(),
    qty_reserved: '0',
    qty_available: INITIAL_STOCK.toString(),
    total_value: (INITIAL_STOCK * 1000).toString(),
  })

  console.log(`Starting ${CONCURRENCY} concurrent consumeStock(qty=${QTY_PER_REQUEST}) against stock=${INITIAL_STOCK}...`)

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, () =>
      db.transaction((tx) =>
        consumeStock(tx, {
          product_id: p.id,
          warehouse_id: wh.id,
          qty_needed: QTY_PER_REQUEST,
          transaction_type: 'delivery',
          reference_type: 'load-test',
          reference_id: randomUUID(),
        }),
      ),
    ),
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled')
  const failed = results.filter((r) => r.status === 'rejected')
  const insufficientStockFailures = failed.filter(
    (r) => r.status === 'rejected' && (r.reason as any)?.data?.meta?.code === 'INSUFFICIENT_STOCK',
  )

  const [finalSummary] = await db.select().from(stockSummary).where(eq(stockSummary.product_id, p.id))
  const ledgerEntries = await db.select().from(stockLedger).where(eq(stockLedger.product_id, p.id))
  const [finalLayer] = await db.select().from(stockLayers).where(eq(stockLayers.product_id, p.id))

  console.log(`Succeeded: ${succeeded.length}, Failed: ${failed.length} (of which INSUFFICIENT_STOCK: ${insufficientStockFailures.length})`)
  console.log(`Final qty_on_hand: ${finalSummary.qty_on_hand} (expected ${INITIAL_STOCK - succeeded.length * QTY_PER_REQUEST})`)
  console.log(`Final layer qty_remaining: ${finalLayer.qty_remaining}`)
  console.log(`Ledger entries written: ${ledgerEntries.length} (expected == succeeded count: ${succeeded.length})`)

  const expectedSucceeded = Math.floor(INITIAL_STOCK / QTY_PER_REQUEST)
  const problems: string[] = []
  if (succeeded.length !== expectedSucceeded) problems.push(`expected exactly ${expectedSucceeded} successes, got ${succeeded.length}`)
  if (failed.length !== insufficientStockFailures.length) problems.push('some failures were not INSUFFICIENT_STOCK (unexpected error type)')
  if (Number(finalSummary.qty_on_hand) < 0) problems.push('qty_on_hand went NEGATIVE')
  if (Number(finalSummary.qty_on_hand) !== INITIAL_STOCK - succeeded.length * QTY_PER_REQUEST) problems.push('qty_on_hand does not match successful consumption total')
  if (ledgerEntries.length !== succeeded.length) problems.push('ledger entry count does not match successful consumption count')

  // cleanup
  await db.delete(stockLedger).where(eq(stockLedger.product_id, p.id))
  await db.delete(stockSummary).where(eq(stockSummary.product_id, p.id))
  await db.delete(stockLayers).where(eq(stockLayers.product_id, p.id))
  await db.delete(products).where(eq(products.id, p.id))
  await db.delete(warehouses).where(eq(warehouses.id, wh.id))

  if (problems.length > 0) {
    console.error('\nLOAD TEST FAILED:')
    for (const problem of problems) console.error(` - ${problem}`)
    process.exit(1)
  }

  console.log('\nLOAD TEST PASSED: no race condition, no negative stock, exact accounting under concurrency.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
