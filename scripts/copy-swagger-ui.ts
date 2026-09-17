import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Copies the swagger-ui-dist assets we need into public/swagger-ui so the
// docs page works fully offline (no CDN dependency) — only the runtime
// bundle + CSS, not the whole package (no oauth2 redirect, no source maps).
const require = (await import('node:module')).createRequire(import.meta.url)
const distDir = dirname(require.resolve('swagger-ui-dist/package.json'))
const outDir = join(process.cwd(), 'public/swagger-ui')

mkdirSync(outDir, { recursive: true })
for (const file of ['swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js', 'swagger-ui.css']) {
  cpSync(join(distDir, file), join(outDir, file))
}
console.log(`swagger-ui assets copied to ${outDir}`)
