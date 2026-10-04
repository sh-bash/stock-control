import { z } from 'zod'
import { saveAttachment } from '../../../services/attachment.service'
import { success, failure } from '../../../utils/response'
import { authUserId, validateOrThrow } from '../../../utils/validate'

// POST /api/v1/attachments  (multipart/form-data)
// fields: owner_type, owner_id, and one or more `file` parts (pasted/dropped images).
export default defineEventHandler(async (event) => {
  const parts = (await readMultipartFormData(event)) ?? []
  const field = (name: string) => parts.find((p) => p.name === name && !p.filename)?.data.toString('utf8')
  const meta = validateOrThrow(z.object({ owner_type: z.string().min(1), owner_id: z.string().uuid() }), {
    owner_type: field('owner_type'),
    owner_id: field('owner_id'),
  })

  const files = parts.filter((p) => p.name === 'file' && p.filename !== undefined)
  if (files.length === 0) return failure('Tidak ada file yang diunggah', 'NO_FILE', 400)

  const userId = authUserId(event)
  const saved = []
  for (const f of files) {
    saved.push(
      await saveAttachment({
        ...meta,
        data: f.data,
        mime: f.type ?? 'application/octet-stream',
        file_name: f.filename,
        user_id: userId,
      }),
    )
  }
  return success(saved)
})
