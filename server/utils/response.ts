export function success(data: unknown = {}, message: string | null = null, meta: Record<string, unknown> = {}) {
  return { success: true, data, message, meta }
}

export function failure(message: string, code: string, statusCode = 400) {
  throw createError({
    statusCode,
    data: { success: false, data: null, message, meta: { code } },
  })
}
