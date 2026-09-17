import 'dotenv/config'
import { createError } from 'h3'

// server/utils/* rely on Nitro's auto-imported `createError` global; outside
// the Nuxt/Nitro runtime (i.e. under vitest) that auto-import doesn't exist,
// so we shim it globally with h3's own implementation.
;(globalThis as any).createError = createError

