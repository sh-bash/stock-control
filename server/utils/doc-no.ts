import { randomUUID } from 'node:crypto'

// Same document-number shape every module already uses: PREFIX-<base36 time>-<4 hex>.
export function genDocNo(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`
}
