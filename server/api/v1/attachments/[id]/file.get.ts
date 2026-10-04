import { createReadStream } from 'node:fs'
import { findAttachment, resolveAttachmentPath } from '../../../../services/attachment.service'
import { failure } from '../../../../utils/response'

// Streams the stored image. <img src> can't send an Authorization header, so
// the auth middleware also accepts ?token= for this one route (see middleware/auth.ts).
export default defineEventHandler(async (event) => {
  const row = await findAttachment(getRouterParam(event, 'id')!)
  if (!row) return failure('Attachment tidak ditemukan', 'NOT_FOUND', 404)
  setHeader(event, 'Content-Type', row.mime)
  setHeader(event, 'Cache-Control', 'private, max-age=86400')
  return sendStream(event, createReadStream(resolveAttachmentPath(row.path)))
})
