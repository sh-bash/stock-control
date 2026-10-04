import { listShippableItems } from '../../../repositories/purchase-order.repository'
import { success } from '../../../utils/response'

// GET /api/v1/purchase-orders/shippable?search=&supplier_id=&product_id=
// Open PO lines grouped per PO, for the Shipment picker.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const str = (k: string) => (typeof q[k] === 'string' && q[k] ? (q[k] as string) : undefined)
  const rows = await listShippableItems({ search: str('search'), supplierId: str('supplier_id'), productId: str('product_id') })

  const byPo = new Map<string, any>()
  for (const r of rows) {
    const po =
      byPo.get(r.po_id) ??
      byPo
        .set(r.po_id, {
          po_id: r.po_id,
          no_po: r.no_po,
          order_date: r.order_date,
          currency: r.currency,
          status: r.status,
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name,
          items: [],
        })
        .get(r.po_id)
    const remaining = Number(r.qty_order) - Number(r.qty_received)
    po.items.push({
      item_id: r.item_id,
      product_id: r.product_id,
      sku: r.sku,
      product_name: r.product_name,
      qty_order: Number(r.qty_order),
      qty_remaining: remaining,
      unit_price: Number(r.unit_price),
      weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
      length_cm: r.length_cm, width_cm: r.width_cm, height_cm: r.height_cm,
      pack_length_cm: r.pack_length_cm, pack_width_cm: r.pack_width_cm, pack_height_cm: r.pack_height_cm,
    })
  }
  return success([...byPo.values()])
})
