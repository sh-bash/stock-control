import { z } from 'zod'

// Shared zod payload schemas for the Request → Comparison → PO flow.

const optNum = z.number().nonnegative().nullable().optional()
const optStr = z.string().nullable().optional()

export const requestItemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  spec: optStr,
  qty: z.number().positive(),
  unit: z.string().max(30).nullable().optional(),
  notes: optStr,
})

export const requestSchema = z.object({
  title: z.string().min(1).max(200),
  notes: optStr,
  needed_date: z.string().min(1).nullable().optional(),
  needs_approval: z.boolean().default(true),
  items: z.array(requestItemSchema).min(1),
})

export const weightsSchema = z
  .object({
    price: z.number().min(0).optional(),
    weight: z.number().min(0).optional(),
    volume: z.number().min(0).optional(),
    lead_time: z.number().min(0).optional(),
  })
  .nullable()
  .optional()

export const comparisonSchema = z.object({
  request_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  notes: optStr,
  exchange_rate: z.number().positive().default(1),
  weights: weightsSchema,
})

export const comparisonUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: optStr,
  exchange_rate: z.number().positive().optional(),
  weights: weightsSchema,
  status: z.enum(['draft', 'in_review', 'decided', 'closed']).optional(),
})

export const candidateSchema = z.object({
  request_item_id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  price: z.number().nonnegative(),
  currency: z.enum(['RMB', 'IDR']).default('RMB'),
  moq: optNum,
  lead_time_days: z.number().int().nonnegative().nullable().optional(),
  weight_kg: optNum,
  length_cm: optNum,
  width_cm: optNum,
  height_cm: optNum,
  pack_length_cm: optNum,
  pack_width_cm: optNum,
  pack_height_cm: optNum,
  notes: optStr,
})

export const promoteSchema = z.object({
  items: z
    .array(
      z.object({
        candidate_id: z.string().uuid(),
        sku: z.string().min(1).max(50).optional(),
        name: z.string().min(1).max(150).optional(),
        category_id: z.string().uuid().nullable().optional(),
        base_unit_id: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1),
})

export const poItemSchema = z.object({
  product_id: z.string().uuid(),
  candidate_id: z.string().uuid().nullable().optional(),
  qty_order: z.number().positive(),
  // Price in the PO's own currency (RMB or IDR). unit_price (IDR) is derived server-side.
  price: z.number().nonnegative(),
})

export const poSchema = z
  .object({
    supplier_id: z.string().uuid(),
    warehouse_id: z.string().uuid(),
    order_date: z.string().min(1),
    currency: z.enum(['RMB', 'IDR']).default('IDR'),
    // Required for RMB (no silent default); ignored for IDR.
    exchange_rate: z.number().positive().optional(),
    request_id: z.string().uuid().nullable().optional(),
    comparison_id: z.string().uuid().nullable().optional(),
    notes: optStr,
    items: z.array(poItemSchema).min(1),
  })
  .refine((d) => d.currency === 'IDR' || d.exchange_rate != null, {
    message: 'Kurs wajib diisi untuk PO dalam RMB',
    path: ['exchange_rate'],
  })
  .transform((d) => ({ ...d, exchange_rate: d.exchange_rate ?? 1 }))
