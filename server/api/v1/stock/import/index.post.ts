import { z } from 'zod'
import { commitStockImport, previewStockImport, rowsFromRaw } from '../../../../services/stock-import.service'
import { success } from '../../../../utils/response'
import { authUserId, readValidated } from '../../../../utils/validate'

const today = () => new Date().toISOString().slice(0, 10)

// POST /api/v1/stock/import
//   mode         — "preview" (default) shows what would happen; "commit" applies it
//   import_date  — optional YYYY-MM-DD, defaults to today
//   file_name    — original file name, kept on the batch for audit
//   rows         — the sheet's rows as objects keyed by header (sku, warehouse, qty, hpp;
//                  common aliases accepted). The page parses .xlsx/.csv in the browser.
const schema = z.object({
  mode: z.enum(['preview', 'commit']).default('preview'),
  import_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(today),
  file_name: z.string().max(200).nullable().optional(),
  rows: z.array(z.record(z.unknown())).min(1).max(20000),
})

export default defineEventHandler(async (event) => {
  const body = await readValidated(event, schema)
  const rows = rowsFromRaw(body.rows)

  if (body.mode === 'preview') return success(await previewStockImport(rows))

  return success(
    await commitStockImport({ rows, file_name: body.file_name ?? null, import_date: body.import_date, user_id: authUserId(event) }),
    'Import stok berhasil',
  )
})
