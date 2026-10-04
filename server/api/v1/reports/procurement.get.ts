import { listRequestPipeline } from '../../../repositories/procurement-analytics.repository'
import { success } from '../../../utils/response'

// GET /api/v1/reports/procurement?date_from=&date_to=&status=
// Request → Comparison → PO tracing: one row per product request.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const str = (k: string) => (typeof q[k] === 'string' && q[k] ? (q[k] as string) : undefined)
  const rows = await listRequestPipeline({ dateFrom: str('date_from'), dateTo: str('date_to'), status: str('status') })

  const lines = rows.map((r: any) => ({ ...r, po_value_idr: Number(r.po_value_idr) }))
  return success({
    summary: {
      total_requests: lines.length,
      with_comparison: lines.filter((r: any) => r.comparison_count > 0).length,
      with_po: lines.filter((r: any) => r.po_count > 0).length,
      total_po_value_idr: lines.reduce((s: number, r: any) => s + r.po_value_idr, 0),
    },
    lines,
  })
})
