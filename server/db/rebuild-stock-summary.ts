import 'dotenv/config'
import { rebuildStockSummary } from '../services/stock.service'

async function main() {
  const results = await rebuildStockSummary()
  console.log(`Rebuilt stock_summary for ${results.length} product/warehouse combination(s).`)
  for (const r of results) {
    const changed = r.before !== r.after
    console.log(
      `${changed ? '[CHANGED]' : '[OK]     '} product=${r.product_id} warehouse=${r.warehouse_id} ` +
        `before=${r.before ?? '(none)'} after=${r.after}`,
    )
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
