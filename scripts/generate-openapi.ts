import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Walks the Nitro file-based routes under server/api/v1 and emits an OpenAPI
// 3.0 document at public/openapi.json. Routes in this project are 1:1 with
// files (Nitro convention: <path>.<method>.ts, [param] segments -> {param}),
// so the file tree itself is the authoritative source of truth for the
// endpoint list — this walks it directly instead of hand-maintaining a
// separate spec that would drift out of sync.
//
// Request bodies: each POST/PUT handler in this codebase defines its
// validation as `const schema = z.object({ ... })` near the top of the file.
// We extract that literal (best-effort, via brace balancing) and embed it in
// the operation description as a zod-schema reference, rather than doing a
// full zod -> JSON Schema conversion (out of scope for a doc-generation
// pass) — anyone building a client gets the exact validation rules verbatim.

const API_ROOT = join(process.cwd(), 'server/api/v1')
const OUT_PATH = join(process.cwd(), 'public/openapi.json')

interface RouteFile {
  filePath: string
  urlPath: string
  method: 'get' | 'post' | 'put' | 'delete' | 'patch'
}

function walk(dir: string, acc: RouteFile[] = []): RouteFile[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, acc)
      continue
    }
    const match = entry.match(/^(.*)\.(get|post|put|delete|patch)\.ts$/)
    if (!match) continue
    const [, base, method] = match
    const relDir = relative(API_ROOT, dir).split(sep).filter(Boolean)
    const segments = [...relDir, base === 'index' ? '' : base].filter(Boolean)
    const urlSegments = segments.map((s) => (s.startsWith('[') && s.endsWith(']') ? `{${s.slice(1, -1)}}` : s))
    const urlPath = `/api/v1/${urlSegments.join('/')}`
    acc.push({ filePath: full, urlPath, method: method as RouteFile['method'] })
  }
  return acc
}

function extractZodSchema(source: string): string | null {
  const idx = source.indexOf('z.object(')
  if (idx === -1) return null
  const start = source.indexOf('{', idx)
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return null
}

function pathParams(urlPath: string) {
  const matches = [...urlPath.matchAll(/\{([^}]+)\}/g)]
  return matches.map((m) => ({
    name: m[1],
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  }))
}

function tagFor(urlPath: string) {
  const parts = urlPath.replace('/api/v1/', '').split('/')
  return parts[0] || 'root'
}

const ENVELOPE_RESPONSE = {
  description: 'Standard response envelope used by every endpoint in this API (see server/utils/response.ts).',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {},
          message: { type: 'string', nullable: true },
          meta: { type: 'object' },
        },
      },
    },
  },
}

function buildSpec() {
  const routes = walk(API_ROOT)
  const paths: Record<string, any> = {}

  for (const route of routes) {
    const source = readFileSync(route.filePath, 'utf-8')
    const zodSchema = extractZodSchema(source)
    const params = pathParams(route.urlPath)
    const usesAuth = source.includes('event.context.auth')

    paths[route.urlPath] = paths[route.urlPath] || {}
    paths[route.urlPath][route.method] = {
      tags: [tagFor(route.urlPath)],
      summary: `${route.method.toUpperCase()} ${route.urlPath}`,
      operationId: `${route.method}_${route.urlPath.replace(/[/{}]/g, '_')}`,
      security: usesAuth ? [{ bearerAuth: [] }] : [],
      parameters: params.length ? params : undefined,
      requestBody: zodSchema
        ? {
            required: true,
            description: `Validated with zod:\n\`\`\`ts\nz.object(${zodSchema})\n\`\`\``,
            content: { 'application/json': { schema: { type: 'object' } } },
          }
        : undefined,
      responses: {
        200: ENVELOPE_RESPONSE,
        400: ENVELOPE_RESPONSE,
        401: ENVELOPE_RESPONSE,
        404: ENVELOPE_RESPONSE,
        409: ENVELOPE_RESPONSE,
      },
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Inventory Management System (stock_control) API',
      version: '1.0.0',
      description:
        'Auto-generated from the server/api/v1 file-based route tree (see scripts/generate-openapi.ts). ' +
        'Every response follows the { success, data, message, meta } envelope; errors additionally set meta.code.',
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths,
  }
}

mkdirSync(join(process.cwd(), 'public'), { recursive: true })
const spec = buildSpec()
writeFileSync(OUT_PATH, JSON.stringify(spec, null, 2))
console.log(`OpenAPI spec written to ${OUT_PATH} (${Object.keys(spec.paths).length} paths, ${Object.values(spec.paths).reduce((n, p: any) => n + Object.keys(p).length, 0)} operations)`)
