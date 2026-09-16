import { createJobLog } from '../repositories/job-log.repository'

// Every job (§7 Fase 7 point 4: "WAJIB idempotent ... dan tercatat ke
// job_execution_logs, status/rows_processed/duration_ms/error_message")
// runs through this wrapper so timing, row counts and failures are recorded
// the same way regardless of which job it is. A thrown error still gets a
// 'failed' row (with the message) instead of silently vanishing, then
// re-throws so the caller (API route / scheduled task) sees it too.
export async function runJobWithLogging<T>(
  jobName: string,
  fn: () => Promise<{ rowsProcessed: number; result: T; warning?: string | null }>,
): Promise<T> {
  const startedAt = new Date()
  const start = Date.now()
  try {
    const { rowsProcessed, result, warning } = await fn()
    await createJobLog({
      job_name: jobName,
      status: warning ? 'warning' : 'success',
      rows_processed: rowsProcessed,
      duration_ms: Date.now() - start,
      error_message: warning ?? null,
      executed_at: startedAt,
    })
    return result
  } catch (err: any) {
    await createJobLog({
      job_name: jobName,
      status: 'failed',
      rows_processed: null,
      duration_ms: Date.now() - start,
      error_message: err?.message ?? String(err),
      executed_at: startedAt,
    })
    throw err
  }
}
