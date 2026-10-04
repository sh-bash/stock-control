import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { attachments } from '../db/schema'
import { failure } from '../utils/response'

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
const MAX_BYTES = 8 * 1024 * 1024
const OWNER_TYPES = ['candidate', 'request', 'product', 'po', 'receiving'] as const
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function assertOwnerType(t: string) {
  if (!(OWNER_TYPES as readonly string[]).includes(t)) {
    return failure(`owner_type "${t}" tidak dikenali`, 'INVALID_OWNER_TYPE', 400)
  }
}

export async function saveAttachment(params: {
  owner_type: string
  owner_id: string
  data: Buffer
  mime: string
  file_name?: string | null
  user_id?: string | null
}) {
  assertOwnerType(params.owner_type)
  const ext = EXT_BY_MIME[params.mime]
  if (!ext) return failure('Hanya gambar PNG/JPEG/WEBP/GIF yang didukung', 'UNSUPPORTED_FILE_TYPE', 400)
  if (params.data.length > MAX_BYTES) return failure('Ukuran file maksimal 8MB', 'FILE_TOO_LARGE', 400)

  // Files are named by a random uuid, never by the client-supplied name, so a
  // crafted file name can't escape UPLOAD_DIR.
  const rel = `${params.owner_type}/${randomUUID()}.${ext}`
  const abs = path.join(UPLOAD_DIR, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, params.data)

  const [row] = await db
    .insert(attachments)
    .values({
      owner_type: params.owner_type,
      owner_id: params.owner_id,
      path: rel,
      file_name: params.file_name?.slice(0, 200) ?? null,
      mime: params.mime,
      size: params.data.length,
      created_by: params.user_id ?? null,
    })
    .returning()
  return row
}

export function listAttachments(ownerType: string, ownerId: string) {
  return db
    .select()
    .from(attachments)
    .where(and(eq(attachments.owner_type, ownerType), eq(attachments.owner_id, ownerId)))
    .orderBy(asc(attachments.created_at))
}

export function findAttachment(id: string) {
  return db.query.attachments.findFirst({ where: eq(attachments.id, id) })
}

export function resolveAttachmentPath(rel: string) {
  const abs = path.resolve(UPLOAD_DIR, rel)
  if (!abs.startsWith(path.resolve(UPLOAD_DIR))) return failure('Path file tidak valid', 'INVALID_PATH', 400)
  return abs
}

// The physical file is only removed once no attachment row references it any
// more (promoting a candidate to a product shares its photos by path).
export async function deleteAttachment(id: string) {
  const row = await findAttachment(id)
  if (!row) return failure('Attachment tidak ditemukan', 'NOT_FOUND', 404)
  await db.delete(attachments).where(eq(attachments.id, id))
  const stillUsed = await db.select({ id: attachments.id }).from(attachments).where(eq(attachments.path, row.path)).limit(1)
  if (stillUsed.length === 0) await fs.rm(resolveAttachmentPath(row.path), { force: true })
  return { id }
}

export async function deleteAttachmentsOf(ownerType: string, ownerId: string) {
  const rows = await listAttachments(ownerType, ownerId)
  for (const r of rows) await deleteAttachment(r.id)
}

// Shares the source's photos with another owner (same files, new rows).
export async function copyAttachments(fromType: string, fromId: string, toType: string, toId: string) {
  const rows = await listAttachments(fromType, fromId)
  for (const r of rows) {
    await db.insert(attachments).values({
      owner_type: toType,
      owner_id: toId,
      path: r.path,
      file_name: r.file_name,
      mime: r.mime,
      size: r.size,
      created_by: r.created_by,
    })
  }
  return rows.length
}
