import type { ZodTypeAny, z } from 'zod'

// Reads the request body and validates it against a zod schema, throwing the
// same 400 VALIDATION_ERROR envelope every other endpoint in this app returns.
export async function readValidated<T extends ZodTypeAny>(event: any, schema: T): Promise<z.infer<T>> {
  const body = await readBody(event).catch(() => ({}))
  return validateOrThrow(schema, body ?? {})
}

export function validateOrThrow<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: {
        success: false,
        data: null,
        message: 'Payload tidak valid',
        meta: { code: 'VALIDATION_ERROR', errors: parsed.error.flatten() },
      },
    })
  }
  return parsed.data
}

export function authUserId(event: any): string {
  return (event.context.auth as { sub: string }).sub
}
